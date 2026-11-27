import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Film,
  Globe,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { CapturedF12Event, CapturedPattern, CrawlDepth } from '../types/api';
import { UniversalVideoPlayer } from './UniversalVideoPlayer';
import { PhpExporterPanel } from './PhpExporterPanel';
import { safeParseJson } from '../utils/safeFetch';

interface F12CaptureViewProps {
  onPublishCapturedEndpoint: (payload: {
    slug: string;
    name: string;
    url: string;
    crawlDepth: CrawlDepth;
    capturedPattern: CapturedPattern;
  }) => Promise<{ ok: boolean; text: string; livePath?: string }>;
  onNavigateToEndpoints: (slug?: string) => void;
}

type F12Filter = 'all' | 'search-doc' | 'xhr' | 'media' | 'pdf';
type InspectorTab = 'headers' | 'response' | 'streams' | 'php';

function generateSessionId(): string {
  return `f12-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeInputUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function deriveSlugFromCapturedUrl(rawUrl: string, queryVal?: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '').split('.')[0] || 'site';
    const lastSeg = u.pathname.split('/').filter(Boolean).pop() || '';
    const base = queryVal ? `${host}-${queryVal}` : lastSeg ? `${host}-${lastSeg}` : `${host}-captured`;
    return (
      base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 38) || 'captured-api'
    );
  } catch {
    return 'captured-api';
  }
}

function buildPatternFromEvent(evt: CapturedF12Event, overrideParam?: string): CapturedPattern {
  let cleanBase = evt.url;
  const param = (overrideParam ?? evt.detectedQueryParam ?? '').trim();
  try {
    const u = new URL(evt.url);
    if (param) {
      u.searchParams.delete(param);
    }
    cleanBase = u.toString();
  } catch {
    // keep raw url
  }
  const isJsonLike =
    Boolean(evt.isJson) ||
    evt.contentType.toLowerCase().includes('json') ||
    evt.resourceType === 'fetch' ||
    evt.resourceType === 'xhr';

  return {
    kind: isJsonLike ? 'json-api' : 'html-search',
    baseUrl: cleanBase,
    method: evt.method.toUpperCase() === 'POST' ? 'POST' : 'GET',
    queryParam: param || undefined,
    sampleQuery: evt.detectedQueryValue || undefined,
  };
}

function shortUrlLabel(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const path = u.pathname === '/' ? u.hostname : `${u.hostname}${u.pathname}`;
    const q = u.search ? u.search.slice(0, 42) : '';
    return `${path}${q}`;
  } catch {
    return rawUrl;
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function prettyPreview(raw: string, isJson?: boolean): string {
  if (!raw) return '';
  if (isJson || raw.trimStart().startsWith('{') || raw.trimStart().startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function F12CaptureView({
  onPublishCapturedEndpoint,
  onNavigateToEndpoints,
}: F12CaptureViewProps) {
  const [sessionId] = useState<string>(() => generateSessionId());
  const [addressInput, setAddressInput] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [activeTargetUrl, setActiveTargetUrl] = useState<string>('');
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [loadingFrame, setLoadingFrame] = useState<boolean>(false);

  const [events, setEvents] = useState<CapturedF12Event[]>([]);
  const [filterType, setFilterType] = useState<F12Filter>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('headers');

  // Synthesize API controls for selected captured request
  const [customSlug, setCustomSlug] = useState<string>('captured-site-api');
  const [customQueryParam, setCustomQueryParam] = useState<string>('');
  const [crawlDepth, setCrawlDepth] = useState<CrawlDepth>('single');
  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishResult, setPublishResult] = useState<{
    ok: boolean;
    text: string;
    livePath?: string;
    slug?: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const mergeEvents = useCallback((incoming: CapturedF12Event[]) => {
    if (!incoming.length) return;
    setEvents((prev) => {
      const map = new Map<string, CapturedF12Event>();
      for (const item of incoming) {
        map.set(item.id, item);
      }
      for (const item of prev) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }
      const next = Array.from(map.values()).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return next.slice(0, 250);
    });
  }, []);

  const syncServerCaptures = useCallback(async () => {
    try {
      const res = await fetch(`/api/f12-captures?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = await safeParseJson<{ events?: CapturedF12Event[] }>(res);
      if (Array.isArray(data.events)) {
        mergeEvents(data.events);
      }
    } catch {
      // ignore transient poll errors
    }
  }, [mergeEvents, sessionId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const payload = e.data;
      if (
        payload &&
        typeof payload === 'object' &&
        payload.source === 'site2api-f12' &&
        payload.sessionId === sessionId &&
        payload.event
      ) {
        const evt = payload.event as CapturedF12Event;
        mergeEvents([evt]);
        if (evt.resourceType === 'document' || evt.resourceType === 'search') {
          setAddressInput(evt.url);
          setLoadingFrame(false);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mergeEvents, sessionId]);

  useEffect(() => {
    if (!activeTargetUrl) return;
    void syncServerCaptures();
    const timer = setInterval(() => {
      void syncServerCaptures();
    }, 2500);
    return () => clearInterval(timer);
  }, [activeTargetUrl, syncServerCaptures]);

  const filteredEvents = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return events.filter((evt) => {
      if (filterType === 'search-doc' && evt.resourceType !== 'search' && evt.resourceType !== 'document') {
        return false;
      }
      if (filterType === 'xhr' && evt.resourceType !== 'xhr' && evt.resourceType !== 'fetch') {
        return false;
      }
      if (filterType === 'media' && evt.resourceType !== 'media') {
        return false;
      }
      if (filterType === 'pdf' && evt.resourceType !== 'pdf') {
        return false;
      }
      if (!q) return true;
      return (
        evt.url.toLowerCase().includes(q) ||
        (evt.detectedQueryParam || '').toLowerCase().includes(q) ||
        (evt.detectedQueryValue || '').toLowerCase().includes(q) ||
        evt.initiator.toLowerCase().includes(q)
      );
    });
  }, [events, filterType, searchFilter]);

  const selectedEvent = useMemo(() => {
    if (selectedEventId) {
      const found = events.find((e) => e.id === selectedEventId);
      if (found) return found;
    }
    // Auto-prioritize the newest search/XHR event if present, else latest event
    return (
      filteredEvents.find(
        (e) => e.resourceType === 'search' || e.resourceType === 'fetch' || e.resourceType === 'xhr'
      ) ||
      filteredEvents[0] ||
      events[0] ||
      null
    );
  }, [events, filteredEvents, selectedEventId]);

  // Sync suggested slug and detected query param when selecting a different request
  useEffect(() => {
    if (!selectedEvent) return;
    setCustomSlug(deriveSlugFromCapturedUrl(selectedEvent.url, selectedEvent.detectedQueryValue));
    setCustomQueryParam(selectedEvent.detectedQueryParam || '');
    setPublishResult(null);
  }, [selectedEvent]);

  const openUrlInProxy = (raw: string, pushHistory = true) => {
    const normalized = normalizeInputUrl(raw);
    if (!normalized) return;
    if (pushHistory && activeTargetUrl && activeTargetUrl !== normalized) {
      setHistory((prev) => [...prev.slice(-15), activeTargetUrl]);
    }
    setAddressInput(normalized);
    setActiveTargetUrl(normalized);
    setReloadNonce((n) => n + 1);
    setLoadingFrame(true);
  };

  const handleGoBack = () => {
    if (history.length === 0) return;
    const prevUrl = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    openUrlInProxy(prevUrl, false);
  };

  const handleClearLog = async () => {
    setEvents([]);
    setSelectedEventId(null);
    setPublishResult(null);
    try {
      await fetch(`/api/f12-captures?sessionId=${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
    } catch {
      // ignore
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCreateApiFromSelected = async () => {
    if (!selectedEvent) return;
    const cleanSlug = customSlug
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (cleanSlug.length < 2) {
      setPublishResult({
        ok: false,
        text: 'Endpoint slug must be at least 2 characters.',
      });
      return;
    }

    setPublishing(true);
    setPublishResult(null);
    const pattern = buildPatternFromEvent(selectedEvent, customQueryParam);
    const friendlyName =
      selectedEvent.extractedSummary?.title ||
      `${selectedEvent.resourceType.toUpperCase()} (${shortUrlLabel(selectedEvent.url)})`;

    const res = await onPublishCapturedEndpoint({
      slug: cleanSlug,
      name: friendlyName.slice(0, 85),
      url: selectedEvent.url,
      crawlDepth,
      capturedPattern: pattern,
    });
    setPublishing(false);
    setPublishResult({ ...res, slug: cleanSlug });
  };

  const proxiedIframeSrc = activeTargetUrl
    ? `/api/browser-proxy?url=${encodeURIComponent(activeTargetUrl)}&sessionId=${encodeURIComponent(sessionId)}&_r=${reloadNonce}`
    : '';

  const previewEndpointUrl = `${origin}/api/v1/${customSlug || 'captured-api'}${
    customQueryParam
      ? `?q=${encodeURIComponent(selectedEvent?.detectedQueryValue || 'search-term')}&limit=all`
      : '?limit=all'
  }`;

  const searchCount = events.filter(
    (e) => e.resourceType === 'search' || e.resourceType === 'document'
  ).length;
  const xhrCount = events.filter((e) => e.resourceType === 'xhr' || e.resourceType === 'fetch').length;
  const mediaCount = events.filter((e) => e.resourceType === 'media').length;
  const pdfCount = events.filter((e) => e.resourceType === 'pdf').length;

  return (
    <div className="space-y-6">
      {/* Compact Header & Address Toolbar */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Live Browser &amp; Built-in F12 Network Capture
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Open any website inside the capture browser, perform a search or play a video, and click any captured request below to turn it into a limitless REST API.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 whitespace-nowrap shrink-0">
            Session {sessionId} · Unlimited Capture
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            openUrlInProxy(addressInput);
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleGoBack}
              disabled={history.length === 0}
              title="Back"
              className="p-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (!activeTargetUrl) return;
                setReloadNonce((n) => n + 1);
                setLoadingFrame(true);
              }}
              disabled={!activeTargetUrl}
              title="Reload page"
              className="p-2.5 border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingFrame ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative flex-1">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              placeholder="Enter any college, course, video, or reference URL (e.g. https://en.wikipedia.org/ or https://books.toscrape.com/)"
              aria-label="Capture browser website URL"
              className="w-full pl-9 pr-3 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={!addressInput.trim()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-4 h-4" />
            Open in Capture Browser
          </button>
        </form>
      </section>

      {/* Interactive Website Browser Viewport */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-700 whitespace-nowrap">Interactive Site Viewport</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono text-slate-600 truncate">
              {activeTargetUrl || 'No page loaded yet'}
            </span>
          </div>
          {activeTargetUrl && (
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-emerald-700 font-medium">
                {loadingFrame ? 'Fetching & hooking...' : 'F12 Sniffer Active'}
              </span>
              <a
                href={activeTargetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-700 hover:underline whitespace-nowrap"
              >
                Open Tab
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {!activeTargetUrl ? (
          <div className="p-8 sm:p-12 text-center bg-slate-50/50 space-y-4">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="max-w-xl mx-auto space-y-1.5">
              <h2 className="text-base font-semibold text-slate-900">
                Browse &amp; Search Any Website — We Capture the API Automatically
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Enter any website URL above and click <strong>Open in Capture Browser</strong>. Search on the site, open course pages, click PDFs, or play videos. Every page search, Fetch/XHR call, query parameter, and stream URL will appear live in the F12 Network Recorder below.
              </p>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            key={`${activeTargetUrl}-${reloadNonce}`}
            src={proxiedIframeSrc}
            title="Live Interactive Website Capture Viewport"
            sandbox="allow-scripts allow-forms allow-popups"
            onLoad={() => {
              setLoadingFrame(false);
              void syncServerCaptures();
            }}
            className="w-full h-[460px] bg-white border-0"
          />
        )}
      </section>

      {/* Built-in F12 Network Capture Studio */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { id: 'all', label: `All (${events.length})` },
                { id: 'search-doc', label: `Search & Pages (${searchCount})` },
                { id: 'xhr', label: `Fetch/XHR (${xhrCount})` },
                { id: 'media', label: `Streams (${mediaCount})` },
                { id: 'pdf', label: `PDF/Docs (${pdfCount})` },
              ] as Array<{ id: F12Filter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filterType === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter captured requests..."
                aria-label="Filter captured F12 network requests"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <button
              type="button"
              onClick={() => void syncServerCaptures()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh F12
            </button>

            <button
              type="button"
              onClick={() => void handleClearLog()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Waterfall List + Request Detail & One-Click API Builder */}
        <div className="grid grid-cols-1 lg:grid-cols-12 border border-slate-200 rounded-lg overflow-hidden bg-white">
          {/* Left Waterfall */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 max-h-[540px] overflow-y-auto divide-y divide-slate-100">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <span className="col-span-7">Request / Query Param</span>
              <span className="col-span-2 text-right">Status</span>
              <span className="col-span-3 text-right">Size · Time</span>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-700">Waiting for captured requests</p>
                <p>Open any website above and browse, search, or play media to capture live traffic.</p>
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const isSelected = selectedEvent?.id === evt.id;
                return (
                  <button
                    key={evt.id}
                    type="button"
                    onClick={() => setSelectedEventId(evt.id)}
                    className={`w-full text-left px-3 py-2.5 grid grid-cols-12 gap-2 items-center text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="col-span-7 min-w-0 space-y-0.5">
                      <p className="font-mono font-medium text-slate-900 truncate" title={evt.url}>
                        {shortUrlLabel(evt.url)}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 truncate">
                        {evt.method} · {evt.resourceType}
                        {evt.detectedQueryParam && (
                          <span className="text-blue-700 font-semibold">
                            {' '}
                            · ?{evt.detectedQueryParam}={evt.detectedQueryValue || ''}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`col-span-2 text-right font-mono tabular-nums ${
                        typeof evt.status === 'number' && evt.status < 400
                          ? 'text-emerald-700 font-semibold'
                          : 'text-slate-600'
                      }`}
                    >
                      {evt.status}
                    </span>
                    <span className="col-span-3 text-right font-mono tabular-nums text-slate-600">
                      {formatBytes(evt.bytes)} · {evt.durationMs > 0 ? `${evt.durationMs}ms` : '—'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Pane: One-Click API Synthesizer + Inspector */}
          <div className="lg:col-span-7 flex flex-col max-h-[540px]">
            {!selectedEvent ? (
              <div className="p-8 text-center text-sm text-slate-500 flex-1 flex items-center justify-center">
                Select a captured network request on the left to inspect headers, response JSON/HTML, streams, and generate its live API.
              </div>
            ) : (
              <>
                {/* 1-Click Synthesize API Strip */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Build Live REST API from Selected Request
                      </p>
                      <p className="text-[11px] font-mono text-slate-600 mt-0.5 break-all">
                        {selectedEvent.method} {selectedEvent.url}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-blue-700 font-semibold">
                      {selectedEvent.isJson ||
                      selectedEvent.resourceType === 'fetch' ||
                      selectedEvent.resourceType === 'xhr'
                        ? 'JSON API Replay'
                        : 'Live Search + Full HTML/Stream Extractor'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-4 space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Endpoint Slug
                      </label>
                      <input
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                        placeholder="my-college-search"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Search Query Param
                      </label>
                      <input
                        type="text"
                        value={customQueryParam}
                        onChange={(e) => setCustomQueryParam(e.target.value)}
                        placeholder="e.g. q, s, search"
                        className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Crawl Depth
                      </label>
                      <select
                        value={crawlDepth}
                        onChange={(e) => setCrawlDepth(e.target.value as CrawlDepth)}
                        className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
                      >
                        <option value="single">Single Page</option>
                        <option value="linked">Linked</option>
                        <option value="deep">Deep</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        disabled={publishing}
                        onClick={() => void handleCreateApiFromSelected()}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        {publishing ? 'Publishing...' : 'Create Live API'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-[11px] font-mono">
                    <span className="text-slate-700 truncate" title={previewEndpointUrl}>
                      Call URL: {previewEndpointUrl}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleCopy(previewEndpointUrl, 'call-url')}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 shrink-0 cursor-pointer"
                    >
                      {copiedId === 'call-url' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      Copy
                    </button>
                  </div>

                  {publishResult && (
                    <div
                      className={`p-2.5 rounded-md border text-xs flex flex-wrap items-center justify-between gap-2 ${
                        publishResult.ok
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <span>{publishResult.text}</span>
                      {publishResult.ok && publishResult.slug && (
                        <button
                          type="button"
                          onClick={() => onNavigateToEndpoints(publishResult.slug)}
                          className="font-semibold text-emerald-800 underline hover:text-emerald-950 whitespace-nowrap cursor-pointer"
                        >
                          Open in Live Endpoints &amp; HTML Tester
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* DevTools Detail Tabs */}
                <div className="px-3.5 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'headers', label: 'Headers' },
                        { id: 'response', label: 'Response' },
                        {
                          id: 'streams',
                          label: `Streams & Downloads (${
                            (selectedEvent.videos?.length ?? 0) + (selectedEvent.documents?.length ?? 0)
                          })`,
                        },
                        { id: 'php', label: 'PHP api.php' },
                      ] as Array<{ id: InspectorTab; label: string }>
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setInspectorTab(t.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          inspectorTab === t.id
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopy(selectedEvent.url, 'req-url')}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-slate-700 border border-slate-200 rounded-md hover:bg-slate-50 shrink-0 cursor-pointer"
                  >
                    {copiedId === 'req-url' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copy Request URL
                  </button>
                </div>

                {/* Inspector Body */}
                <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
                  {inspectorTab === 'headers' && (
                    <>
                      <div className="space-y-1.5">
                        <p className="font-semibold text-slate-900">General</p>
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono space-y-1.5">
                          <div className="grid grid-cols-12 gap-2">
                            <span className="col-span-4 text-slate-500">Request URL:</span>
                            <span className="col-span-8 text-slate-900 break-all">{selectedEvent.url}</span>
                          </div>
                          <div className="grid grid-cols-12 gap-2">
                            <span className="col-span-4 text-slate-500">Request Method:</span>
                            <span className="col-span-8 text-slate-900">{selectedEvent.method}</span>
                          </div>
                          <div className="grid grid-cols-12 gap-2">
                            <span className="col-span-4 text-slate-500">Status Code:</span>
                            <span className="col-span-8 text-emerald-700 font-semibold">
                              {selectedEvent.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-12 gap-2">
                            <span className="col-span-4 text-slate-500">Content-Type:</span>
                            <span className="col-span-8 text-slate-700 break-all">
                              {selectedEvent.contentType || '—'}
                            </span>
                          </div>
                          <div className="grid grid-cols-12 gap-2">
                            <span className="col-span-4 text-slate-500">Initiator:</span>
                            <span className="col-span-8 text-slate-700">{selectedEvent.initiator}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-semibold text-slate-900">
                          Response Headers ({Object.keys(selectedEvent.responseHeaders || {}).length})
                        </p>
                        {Object.keys(selectedEvent.responseHeaders || {}).length === 0 ? (
                          <p className="text-slate-500">No response headers recorded for this event.</p>
                        ) : (
                          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {Object.entries(selectedEvent.responseHeaders).map(([k, v]) => (
                              <div key={k} className="px-3 py-1.5 grid grid-cols-12 gap-2">
                                <span className="col-span-4 font-mono font-medium text-slate-700 break-all">
                                  {k}
                                </span>
                                <span className="col-span-8 font-mono text-slate-600 break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <p className="font-semibold text-slate-900">
                          Request Headers ({Object.keys(selectedEvent.requestHeaders || {}).length})
                        </p>
                        {Object.keys(selectedEvent.requestHeaders || {}).length === 0 ? (
                          <p className="text-slate-500">No custom request headers captured.</p>
                        ) : (
                          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {Object.entries(selectedEvent.requestHeaders).map(([k, v]) => (
                              <div key={k} className="px-3 py-1.5 grid grid-cols-12 gap-2">
                                <span className="col-span-4 font-mono font-medium text-slate-700 break-all">
                                  {k}
                                </span>
                                <span className="col-span-8 font-mono text-slate-600 break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {inspectorTab === 'response' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">Captured Upstream Response</p>
                        <button
                          type="button"
                          onClick={() =>
                            void handleCopy(
                              prettyPreview(selectedEvent.responsePreview, selectedEvent.isJson),
                              'resp-body'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
                        >
                          {copiedId === 'resp-body' ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copy Response
                        </button>
                      </div>
                      <pre className="p-3 rounded-lg bg-[#0F172A] text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto max-h-72">
                        {prettyPreview(selectedEvent.responsePreview, selectedEvent.isJson) ||
                          'No response body preview captured for this entry.'}
                      </pre>
                    </div>
                  )}

                  {inspectorTab === 'streams' && (
                    <div className="space-y-4">
                      {selectedEvent.extractedSummary && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3 font-mono text-xs text-slate-700">
                          <span>Videos: {selectedEvent.extractedSummary.videosCount}</span>
                          <span>·</span>
                          <span>Documents: {selectedEvent.extractedSummary.documentsCount}</span>
                          <span>·</span>
                          <span>Items: {selectedEvent.extractedSummary.itemsCount}</span>
                          <span>·</span>
                          <span>Links: {selectedEvent.extractedSummary.linksCount}</span>
                        </div>
                      )}

                      {selectedEvent.videos && selectedEvent.videos.length > 0 ? (
                        <div className="space-y-3">
                          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <Film className="w-3.5 h-3.5 text-blue-600" />
                            Captured Video Streams ({selectedEvent.videos.length})
                          </p>
                          {selectedEvent.videos.slice(0, 8).map((vid, idx) => (
                            <div
                              key={`${vid.videoUrl}-${idx}`}
                              className="p-3 rounded-lg border border-slate-200 space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-slate-900">{vid.title}</p>
                                <span className="font-mono text-[11px] text-slate-500 shrink-0">
                                  {vid.streamFormat || vid.sourceType}
                                </span>
                              </div>
                              <UniversalVideoPlayer video={vid} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500">
                          No playable video streams captured in this request entry.
                        </p>
                      )}

                      {selectedEvent.documents && selectedEvent.documents.length > 0 && (
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            Captured PDF &amp; Study Downloads ({selectedEvent.documents.length})
                          </p>
                          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                            {selectedEvent.documents.slice(0, 20).map((doc, idx) => (
                              <div
                                key={`${doc.url}-${idx}`}
                                className="px-3 py-2 flex items-center justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 truncate">{doc.title}</p>
                                  <p className="font-mono text-[11px] text-slate-500 truncate">
                                    {doc.fileType} · {doc.url}
                                  </p>
                                </div>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 shrink-0"
                                >
                                  <Download className="w-3 h-3" />
                                  Open
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {inspectorTab === 'php' && (
                    <PhpExporterPanel
                      key={selectedEvent.id}
                      defaultBaseUrl={activeTargetUrl || selectedEvent.url}
                      defaultSampleItemUrl={selectedEvent.url}
                      defaultCapturedPayload={
                        selectedEvent.resourceType === 'fetch' || selectedEvent.resourceType === 'xhr'
                          ? selectedEvent.url
                          : undefined
                      }
                      capturedPattern={buildPatternFromEvent(selectedEvent, customQueryParam)}
                      detectedQueryParam={customQueryParam || selectedEvent.detectedQueryParam}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
