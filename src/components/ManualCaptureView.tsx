import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Layers,
  Play,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type {
  CapturedPattern,
  CrawlDepth,
  DynamicVariableSpec,
  ExtractedVideo,
  LiveApiPayload,
} from '../types/api';
import { safeParseJson } from '../utils/safeFetch';
import {
  parseSmartF12Dump,
  type SmartF12ParseResult,
} from '../utils/f12SmartParser';
import {
  buildAutoDetectingIndexHtml,
  detectJsonSchemaRecursively,
  type AutoDetectedSummary,
} from '../utils/selfHealingDetector';
import { UniversalVideoPlayer } from './UniversalVideoPlayer';
import { PhpExporterPanel } from './PhpExporterPanel';

interface ManualCaptureViewProps {
  onPublishCapturedEndpoint: (payload: {
    slug: string;
    name: string;
    url: string;
    crawlDepth: CrawlDepth;
    capturedPattern: CapturedPattern;
  }) => Promise<{ ok: boolean; text: string; livePath?: string }>;
  onNavigateToEndpoints: (slug?: string) => void;
}

function parseHeadersText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}

function formatHeadersText(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function deriveSlug(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, '').split('.')[0] || 'manual';
    const seg = u.pathname.split('/').filter(Boolean)[0] || 'api';
    return (
      `${host}-${seg}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36) || 'manual-f12-api'
    );
  } catch {
    return 'manual-f12-api';
  }
}

export function ManualCaptureView({
  onPublishCapturedEndpoint,
  onNavigateToEndpoints,
}: ManualCaptureViewProps) {
  const [rawDumpInput, setRawDumpInput] = useState('');
  const [smartState, setSmartState] = useState<SmartF12ParseResult | null>(null);
  const [chunkStatusBanner, setChunkStatusBanner] = useState<string | null>(null);

  // Part A: Static Template
  const [requestUrl, setRequestUrl] = useState('');
  const [staticUrlTemplate, setStaticUrlTemplate] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [method, setMethod] = useState<'GET' | 'POST'>('GET');
  const [kind, setKind] = useState<'json-api' | 'html-search'>('json-api');
  const [headersText, setHeadersText] = useState('');
  const [postBodyTemplate, setPostBodyTemplate] = useState('');

  // Part B: Dynamic Variables & Demo Fallbacks
  const [queryParam, setQueryParam] = useState('');
  const [idParam, setIdParam] = useState('');
  const [pageParam, setPageParam] = useState('');
  const [timestampParam, setTimestampParam] = useState('');
  const [sampleQuery, setSampleQuery] = useState('');
  const [sampleId, setSampleId] = useState('');
  const [samplePage, setSamplePage] = useState('1');
  const [dynamicVariables, setDynamicVariables] = useState<DynamicVariableSpec[]>([]);

  // Optional Multi-Route Support (?action=latest|search|detail)
  const [latestRouteUrl, setLatestRouteUrl] = useState('');
  const [searchRouteUrl, setSearchRouteUrl] = useState('');
  const [detailRouteUrl, setDetailRouteUrl] = useState('');

  const [sampleResponse, setSampleResponse] = useState('');
  const [collectAll, setCollectAll] = useState(true);
  const [slug, setSlug] = useState('manual-site-api');
  const [endpointName, setEndpointName] = useState('');
  const [testQuery, setTestQuery] = useState('');

  const [testing, setTesting] = useState(false);
  const [testPayload, setTestPayload] = useState<LiveApiPayload | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{
    ok: boolean;
    text: string;
    slug?: string;
  } | null>(null);
  const [outputView, setOutputView] = useState<'summary' | 'json' | 'php'>('summary');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const cleanSlug = useMemo(
    () =>
      slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'manual-site-api',
    [slug]
  );

  const parsedHeaders = useMemo(() => parseHeadersText(headersText), [headersText]);

  const sourceOrigin = useMemo(() => {
    try {
      return new URL(siteUrl || requestUrl).origin;
    } catch {
      return undefined;
    }
  }, [requestUrl, siteUrl]);

  const parsedSampleJson = useMemo(() => {
    const trimmed = sampleResponse.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }, [sampleResponse]);

  const activeJsonForDetection = useMemo(() => {
    if (testPayload?.capturedUpstreamData !== undefined) {
      return testPayload.capturedUpstreamData;
    }
    if (parsedSampleJson !== null) {
      return parsedSampleJson;
    }
    return null;
  }, [parsedSampleJson, testPayload]);

  const autoDetectedSchema: AutoDetectedSummary | null = useMemo(() => {
    if (activeJsonForDetection === null) return null;
    return detectJsonSchemaRecursively(activeJsonForDetection, sourceOrigin);
  }, [activeJsonForDetection, sourceOrigin]);

  const builtPattern: CapturedPattern = useMemo(() => {
    let baseUrl = requestUrl.trim();
    const qp = queryParam.trim();
    try {
      if (baseUrl && qp && method === 'GET') {
        const u = new URL(baseUrl);
        u.searchParams.delete(qp);
        baseUrl = u.toString();
      }
    } catch {
      // keep raw
    }
    const hasMultiRoutes =
      latestRouteUrl.trim() || searchRouteUrl.trim() || detailRouteUrl.trim();

    return {
      kind,
      baseUrl,
      staticUrlTemplate: staticUrlTemplate.trim() || undefined,
      method,
      queryParam: qp || undefined,
      idParam: idParam.trim() || undefined,
      pageParam: pageParam.trim() || undefined,
      timestampParam: timestampParam.trim() || undefined,
      requestHeaders: Object.keys(parsedHeaders).length > 0 ? parsedHeaders : undefined,
      postBodyTemplate:
        method === 'POST' && postBodyTemplate.trim() ? postBodyTemplate.trim() : undefined,
      sampleQuery: sampleQuery.trim() || undefined,
      sampleId: sampleId.trim() || undefined,
      samplePage: samplePage.trim() || undefined,
      dynamicVariables: dynamicVariables.length > 0 ? dynamicVariables : undefined,
      multiRoutes: hasMultiRoutes
        ? {
            latestUrl: latestRouteUrl.trim() || undefined,
            searchUrl: searchRouteUrl.trim() || undefined,
            detailUrl: detailRouteUrl.trim() || undefined,
          }
        : undefined,
      collectAll,
      siteUrl: siteUrl.trim() || undefined,
    };
  }, [
    collectAll,
    detailRouteUrl,
    dynamicVariables,
    idParam,
    kind,
    latestRouteUrl,
    method,
    pageParam,
    parsedHeaders,
    postBodyTemplate,
    queryParam,
    requestUrl,
    sampleId,
    samplePage,
    sampleQuery,
    searchRouteUrl,
    siteUrl,
    staticUrlTemplate,
    timestampParam,
  ]);

  const applySmartParseResult = (parsed: SmartF12ParseResult, mode: 'fresh' | 'merge') => {
    setSmartState(parsed);
    if (parsed.url) {
      setRequestUrl(parsed.url);
      setSlug(deriveSlug(parsed.url));
      try {
        setEndpointName(`Manual F12 (${new URL(parsed.url).hostname})`);
      } catch {
        setEndpointName('Manual F12 Captured API');
      }
    }
    if (parsed.staticUrlTemplate) {
      setStaticUrlTemplate(parsed.staticUrlTemplate);
    }
    setMethod(parsed.method);
    setKind(parsed.kind);
    if (Object.keys(parsed.essentialHeaders).length > 0) {
      setHeadersText(formatHeadersText(parsed.essentialHeaders));
    }
    if (parsed.staticPostTemplate || parsed.postBody) {
      setPostBodyTemplate(parsed.staticPostTemplate || parsed.postBody);
    }
    if (parsed.siteUrl) setSiteUrl(parsed.siteUrl);
    if (parsed.queryParam) setQueryParam(parsed.queryParam);
    if (parsed.idParam) setIdParam(parsed.idParam);
    if (parsed.pageParam) setPageParam(parsed.pageParam);
    if (parsed.timestampParam) setTimestampParam(parsed.timestampParam);
    if (parsed.sampleQuery) {
      setSampleQuery(parsed.sampleQuery);
      setTestQuery(parsed.sampleQuery);
    }
    if (parsed.sampleId) {
      setSampleId(parsed.sampleId);
      if (!parsed.sampleQuery) setTestQuery(parsed.sampleId);
    }
    if (parsed.samplePage) setSamplePage(parsed.samplePage);
    if (parsed.dynamicVariables.length > 0) {
      setDynamicVariables(parsed.dynamicVariables);
    }
    if (parsed.responseJsonText) setSampleResponse(parsed.responseJsonText);

    const essentialCount = Object.keys(parsed.essentialHeaders).length;
    const parts: string[] = [];
    if (parsed.staticUrlTemplate) {
      parts.push(`Split ${parsed.method} ${parsed.staticUrlTemplate}`);
    } else if (parsed.url) {
      parts.push(`${parsed.method} URL captured`);
    }
    if (parsed.dynamicVariables.length > 0) {
      parts.push(`${parsed.dynamicVariables.length} dynamic variable(s) extracted`);
    }
    if (essentialCount > 0) parts.push(`${essentialCount} essential header(s) kept`);
    if (parsed.strippedNoiseCount > 0) {
      parts.push(`${parsed.strippedNoiseCount} noise header(s) stripped`);
    }
    if (parsed.parsedJson !== null) {
      parts.push('Response JSON auto-detected — deliverables ready below');
    } else {
      parts.push('Paste Response JSON next or click Test Capture Live / Generate');
    }

    setChunkStatusBanner(
      `${mode === 'merge' ? 'Merged chunk' : 'Captured'}: ${parts.join(' · ')}.`
    );
    if (mode === 'merge') {
      setRawDumpInput('');
    }
  };

  const handleParseFresh = () => {
    if (!rawDumpInput.trim()) return;
    const parsed = parseSmartF12Dump(rawDumpInput);
    applySmartParseResult(parsed, 'fresh');
  };

  const handleMergeChunk = () => {
    if (!rawDumpInput.trim()) return;
    const merged = parseSmartF12Dump(rawDumpInput, smartState || undefined);
    applySmartParseResult(merged, 'merge');
  };

  const handleResetCaptured = () => {
    setRawDumpInput('');
    setSmartState(null);
    setChunkStatusBanner(null);
    setRequestUrl('');
    setStaticUrlTemplate('');
    setSiteUrl('');
    setMethod('GET');
    setKind('json-api');
    setQueryParam('');
    setIdParam('');
    setPageParam('');
    setTimestampParam('');
    setSampleQuery('');
    setSampleId('');
    setSamplePage('1');
    setDynamicVariables([]);
    setLatestRouteUrl('');
    setSearchRouteUrl('');
    setDetailRouteUrl('');
    setHeadersText('');
    setPostBodyTemplate('');
    setSampleResponse('');
    setTestPayload(null);
    setTestError(null);
    setPublishMessage(null);
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

  const handleDownloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleTestLive = async () => {
    if (!requestUrl.trim() && !staticUrlTemplate.trim()) {
      setTestError('Please enter or parse a Request URL from Chrome F12 Network.');
      return;
    }
    setTesting(true);
    setTestError(null);
    setTestPayload(null);
    try {
      const res = await fetch('/api/manual-f12/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: testQuery.trim() || sampleQuery.trim() || undefined,
          id: sampleId.trim() || undefined,
          limit: 'all',
          collectAll,
          capturedPattern: builtPattern,
        }),
      });
      const data = await safeParseJson<LiveApiPayload & { error?: string }>(res);
      if (!res.ok) {
        setTestError(data.error || `HTTP ${res.status} error while testing capture.`);
      } else {
        setTestPayload(data);
        if (data.capturedUpstreamData !== undefined) {
          setSampleResponse(JSON.stringify(data.capturedUpstreamData, null, 2));
        }
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Manual F12 capture test failed.');
    } finally {
      setTesting(false);
    }
  };

  const handlePublish = async () => {
    if (!requestUrl.trim() && !staticUrlTemplate.trim()) {
      setPublishMessage({ ok: false, text: 'Request URL is required before publishing.' });
      return;
    }
    if (cleanSlug.length < 2) {
      setPublishMessage({ ok: false, text: 'Slug must be at least 2 characters.' });
      return;
    }
    setPublishing(true);
    setPublishMessage(null);
    const res = await onPublishCapturedEndpoint({
      slug: cleanSlug,
      name: endpointName.trim() || `Manual F12 (${cleanSlug})`,
      url: siteUrl.trim() || requestUrl.trim(),
      crawlDepth: collectAll ? 'deep' : 'single',
      capturedPattern: builtPattern,
    });
    setPublishing(false);
    setPublishMessage({ ...res, slug: cleanSlug });
  };

  const liveEndpointBase = `${origin}/api/v1/${cleanSlug}`;
  const sampleTargetForUrlParam = requestUrl.trim() || siteUrl.trim() || 'https://targetsite.com/item';
  const demoQ = testQuery.trim() || sampleQuery.trim() || 'python';
  const demoId = sampleId.trim() || '308007';

  const callDemoFallbackUrl = liveEndpointBase;
  const callDynamicUrlMode = `${liveEndpointBase}?url=${encodeURIComponent(sampleTargetForUrlParam)}`;
  const callShortcutIdUrl = `${liveEndpointBase}?action=detail&id=${encodeURIComponent(demoId)}`;
  const callSearchUrl = `${liveEndpointBase}?action=search&q=${encodeURIComponent(demoQ)}&limit=all&collectAll=true`;
  const callLatestUrl = `${liveEndpointBase}?action=latest&page=1`;

  const liveAutoHtmlViewer = useMemo(
    () =>
      buildAutoDetectingIndexHtml(
        liveEndpointBase,
        sampleQuery.trim() || sampleId.trim() || '',
        sourceOrigin
      ),
    [liveEndpointBase, sampleId, sampleQuery, sourceOrigin]
  );

  const generatedCurlCmd = `curl -X GET "${callShortcutIdUrl}" -H "Accept: application/json"`;
  const generatedFetchCode = `const res = await fetch("${callSearchUrl}");
const raw = await res.text();
if (raw.trimStart().startsWith("<")) throw new Error("Expected JSON");
const data = JSON.parse(raw);
console.log(data.videos, data.items, data.capturedUpstreamData);`;

  const essentialHeaderCount = Object.keys(parsedHeaders).length;
  const strippedNoiseCount = smartState?.strippedNoiseCount || 0;
  const hasSplitSummary =
    Boolean(requestUrl.trim() || staticUrlTemplate.trim()) ||
    essentialHeaderCount > 0 ||
    autoDetectedSchema !== null;

  return (
    <div className="space-y-6">
      {/* Intro & Step 1: Smart Chrome F12 Parser (All-at-once OR Piece-by-Piece) */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              F12 Network Analyzer &amp; Dynamic 2-Part API Generator
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Paste raw Chrome <strong>F12 → Network</strong> data all at once or piece-by-piece. Browser/CDN noise is stripped, paths/queries/JSON bodies are split into <strong>Part A (Static Template)</strong> + <strong>Part B (Dynamic Variables &amp; Demo Fallbacks)</strong>, and ready-to-host <span className="font-mono">api.php</span> &amp; <span className="font-mono">index.html</span> are generated.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-700 font-medium whitespace-nowrap shrink-0">
            Web · App · Telegram Bot Ready
          </span>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="manual-curl-paste"
              className="text-xs font-semibold text-slate-900 flex items-center gap-1.5"
            >
              <Terminal className="w-3.5 h-3.5 text-blue-600" />
              Step 1: Paste F12 Dump (General, Request Headers, Payload, Response JSON, cURL, or fetch)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleParseFresh}
                disabled={!rawDumpInput.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Parse Fresh F12 Dump
              </button>
              <button
                type="button"
                onClick={handleMergeChunk}
                disabled={!rawDumpInput.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 text-slate-800 rounded-md hover:bg-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Merge Next Chunk
              </button>
              <button
                type="button"
                onClick={handleResetCaptured}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-600 rounded-md hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          <textarea
            id="manual-curl-paste"
            rows={5}
            value={rawDumpInput}
            onChange={(e) => setRawDumpInput(e.target.value)}
            placeholder={`Paste ANY raw F12 piece (first Headers, then click "Merge Next Chunk" and paste Response JSON — OR paste everything at once):\nExample 1: https://site.com/api/id/308007 -> splits into .../api/id/{id} (Demo: 308007)\nExample 2: https://site.com/search?q=hindi+songs&page=1&t=1795794688 -> splits q, page, and dynamic time() timestamp`}
            className="w-full p-3 text-xs font-mono bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
          />

          {chunkStatusBanner && (
            <div className="px-3 py-2 rounded-md bg-white border border-slate-200 text-xs text-slate-800 flex items-center gap-2 font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{chunkStatusBanner}</span>
            </div>
          )}
        </div>
      </section>

      {/* Deliverable 1: 2-Part Split Breakdown (Part A Static Template + Part B Dynamic Variables) */}
      {hasSplitSummary && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
            <h2 className="text-sm font-semibold text-slate-900">
              1. 2-Part Split Breakdown (Static Template vs. Dynamic Variables)
            </h2>
            <span className="text-xs font-mono text-slate-600 tabular-nums">
              {strippedNoiseCount} noise header{strippedNoiseCount === 1 ? '' : 's'} stripped ·{' '}
              {essentialHeaderCount} essential kept
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            {/* Part A */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <p className="font-semibold text-slate-900">Part A — Static Template (Fixed Structure)</p>
              <div className="font-mono text-slate-800 space-y-1">
                <p className="break-all">
                  <span className="font-semibold text-blue-700">{method}</span>{' '}
                  {staticUrlTemplate || requestUrl || 'Waiting for Request URL'}
                </p>
                <p className="text-[11px] text-slate-600">
                  Essential Headers: {Object.keys(parsedHeaders).join(', ') || 'Auto Origin, Referer, User-Agent'}
                </p>
                {smartState?.authToken && (
                  <p className="text-[11px] text-amber-700">
                    Configurable Token Detected: API_AUTH_TOKEN constant at top of api.php
                  </p>
                )}
                {method === 'POST' && postBodyTemplate && (
                  <p className="text-[11px] text-slate-700 break-all">
                    POST Body Template: {postBodyTemplate}
                  </p>
                )}
              </div>
            </div>

            {/* Part B */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <p className="font-semibold text-slate-900">
                Part B — Dynamic Variables &amp; Demo Fallbacks (Never Hardcoded)
              </p>
              {dynamicVariables.length > 0 ? (
                <div className="space-y-1.5 font-mono text-[11px]">
                  {dynamicVariables.map((dv, idx) => (
                    <div
                      key={`${dv.name}-${dv.location}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded"
                    >
                      <span className="text-slate-900 font-semibold">
                        {dv.placeholder}{' '}
                        <span className="font-normal text-slate-500">({dv.location})</span>
                      </span>
                      <span className="text-emerald-700 truncate max-w-[240px]" title={dv.demoValue}>
                        Demo fallback: {dv.demoValue}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600">
                  No dynamic path/query variables detected yet — uses <span className="font-mono">?url=</span> or static fallback.
                </p>
              )}
              {autoDetectedSchema && (
                <p className="font-mono text-[11px] text-emerald-700 pt-1 tabular-nums">
                  Schema Auto-Detected: {autoDetectedSchema.titles.length} title(s) ·{' '}
                  {autoDetectedSchema.posters.length} poster(s) ·{' '}
                  {autoDetectedSchema.mediaLinks.length} stream/download link(s)
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Step 2: Essential Template, Fallbacks & Multi-Route Config */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            Step 2: Configure Static Template, Demo Fallbacks &amp; Multi-Routes
          </h2>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={collectAll}
              onChange={(e) => setCollectAll(e.target.checked)}
              className="rounded border-slate-300 text-blue-600"
            />
            <span>Collect full multi-page + linked site data (collectAll=true)</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          <div className="md:col-span-2 space-y-1">
            <label className="block font-medium text-slate-700">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'GET' | 'POST')}
              className="w-full px-2.5 py-2 font-mono font-semibold bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="block font-medium text-slate-700">Endpoint Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'json-api' | 'html-search')}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            >
              <option value="json-api">JSON / Fetch / XHR API</option>
              <option value="html-search">HTML Page / Search URL</option>
            </select>
          </div>

          <div className="md:col-span-7 space-y-1">
            <label className="block font-medium text-slate-700">
              Part A: Static URL Template (use {'{id}'}, {'{q}'}, {'{page}'}, {'{timestamp}'})
            </label>
            <input
              type="text"
              value={staticUrlTemplate}
              onChange={(e) => setStaticUrlTemplate(e.target.value)}
              placeholder="https://site.com/api/id/{id} or https://site.com/search?q={q}&page={page}&t={timestamp}"
              className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-5 space-y-1">
            <label className="block font-medium text-slate-700">Captured Raw Request URL</label>
            <input
              type="text"
              value={requestUrl}
              onChange={(e) => {
                setRequestUrl(e.target.value);
                if (!staticUrlTemplate) setStaticUrlTemplate(e.target.value);
                if (!slug || slug === 'manual-site-api') {
                  setSlug(deriveSlug(e.target.value));
                }
              }}
              placeholder="https://site.com/api/id/308007"
              className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-3 space-y-1">
            <label className="block font-medium text-slate-700">Demo Fallback ?q=</label>
            <input
              type="text"
              value={sampleQuery}
              onChange={(e) => setSampleQuery(e.target.value)}
              placeholder="hindi songs"
              className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="block font-medium text-slate-700">Demo Fallback ?id=</label>
            <input
              type="text"
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
              placeholder="308007"
              className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="block font-medium text-slate-700">Endpoint Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-site-api"
              className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Multi-Route Bundle Fields (Optional) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Multi-Route: Latest URL (?action=latest)
            </label>
            <input
              type="text"
              value={latestRouteUrl}
              onChange={(e) => setLatestRouteUrl(e.target.value)}
              placeholder="Optional: https://site.com/api/latest?page={page}"
              className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Multi-Route: Search Template (?action=search)
            </label>
            <input
              type="text"
              value={searchRouteUrl}
              onChange={(e) => setSearchRouteUrl(e.target.value)}
              placeholder="Optional: https://site.com/search?q={q}&page={page}"
              className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Multi-Route: Detail Template (?action=detail)
            </label>
            <input
              type="text"
              value={detailRouteUrl}
              onChange={(e) => setDetailRouteUrl(e.target.value)}
              placeholder="Optional: https://site.com/api/id/{id}"
              className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="block font-medium text-slate-700">
              Essential Request Headers (Origin, Referer, User-Agent, Accept, Authorization)
            </label>
            <textarea
              rows={5}
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              placeholder={`Origin: https://target-site.com\nReferer: https://target-site.com/\nAccept: application/json, text/plain, */*\nAuthorization: Bearer ...`}
              className="w-full p-2.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="block font-medium text-slate-700">
                POST JSON Payload Template (supports {'{q}'}, {'{id}'}, {'{page}'}, {'{timestamp}'})
              </label>
              <textarea
                rows={2}
                value={postBodyTemplate}
                onChange={(e) => setPostBodyTemplate(e.target.value)}
                placeholder='{"query": "{q}", "page": "{page}"}'
                className="w-full p-2.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium text-slate-700">
                F12 Response JSON (Relative paths like /images/thumb.jpg are auto-resolved)
              </label>
              <textarea
                rows={2}
                value={sampleResponse}
                onChange={(e) => setSampleResponse(e.target.value)}
                placeholder='{"title": "...", "poster": "/images/thumb.jpg", "links": [{"quality": "1080p", "url": "https://..."}]}'
                className="w-full p-2.5 font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder="Test keyword (?q=) or leave empty for Demo Fallback"
              className="w-full sm:w-72 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
            <button
              type="button"
              disabled={testing || (!requestUrl.trim() && !staticUrlTemplate.trim())}
              onClick={() => void handleTestLive()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {testing ? 'Testing Live Capture...' : 'Test Capture Live'}
            </button>
          </div>

          <button
            type="button"
            disabled={publishing || (!requestUrl.trim() && !staticUrlTemplate.trim())}
            onClick={() => void handlePublish()}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Rocket className="w-3.5 h-3.5" />
            {publishing ? 'Publishing Endpoint...' : 'Publish Live Endpoint'}
          </button>
        </div>

        {testError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{testError}</span>
          </div>
        )}

        {publishMessage && (
          <div
            className={`p-3 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
              publishMessage.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span>{publishMessage.text}</span>
            {publishMessage.ok && publishMessage.slug && (
              <button
                type="button"
                onClick={() => onNavigateToEndpoints(publishMessage.slug)}
                className="font-semibold text-emerald-800 underline hover:text-emerald-950 whitespace-nowrap cursor-pointer"
              >
                Open in Live Endpoints &amp; External HTML Tester
              </button>
            )}
          </div>
        )}
      </section>

      {/* Step 3: Calling URLs, Self-Healing Preview, 2. Complete api.php, 3. Complete index.html */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Step 3: Multi-Platform Calling URLs, Complete api.php &amp; Complete index.html
            </h2>
            <p className="text-xs text-slate-500">
              Supports Demo Fallback (zero params), <span className="font-mono">?q=</span>,{' '}
              <span className="font-mono">?id=</span>, <span className="font-mono">?action=latest|search|detail</span>, and <span className="font-mono">?url=LINK</span>.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
            {(
              [
                { id: 'summary', label: 'Calling URLs & Auto-Detect UI' },
                { id: 'json', label: 'Full JSON Output' },
                { id: 'php', label: '2. api.php & 3. index.html' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOutputView(t.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  outputView === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {outputView === 'php' ? (
          <div className="space-y-5">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <Code2 className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-900">
                    Live Hosted index.html (Bound to {liveEndpointBase})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => void handleCopy(liveAutoHtmlViewer, 'live-html-copy')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    {copiedId === 'live-html-copy' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copy Live index.html
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadFile(liveAutoHtmlViewer, 'index.html', 'text/html;charset=utf-8')
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    Download index.html
                  </button>
                </div>
              </div>
              <pre className="p-3.5 bg-[#0F172A] text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-60">
                {liveAutoHtmlViewer}
              </pre>
            </div>

            <PhpExporterPanel
              defaultBaseUrl={siteUrl || requestUrl || 'https://example.com'}
              defaultSampleItemUrl={requestUrl || siteUrl || 'https://example.com'}
              defaultCapturedPayload={postBodyTemplate || staticUrlTemplate || sampleResponse || requestUrl}
              capturedPattern={builtPattern}
              detectedQueryParam={queryParam || idParam}
            />
          </div>
        ) : outputView === 'json' ? (
          <pre className="p-4 rounded-lg bg-[#0F172A] text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto max-h-[520px]">
            {testPayload
              ? JSON.stringify(testPayload, null, 2)
              : parsedSampleJson
                ? JSON.stringify(parsedSampleJson, null, 2)
                : 'Paste a Response JSON or click "Test Capture Live" above to inspect full JSON output.'}
          </pre>
        ) : (
          <div className="space-y-4 text-xs">
            {/* Multi-Route & Universal Calling URLs */}
            <div className="space-y-2 font-mono">
              {(
                [
                  { id: 'u-demo', label: 'Demo Fallback (No Params)', url: callDemoFallbackUrl },
                  { id: 'u-search', label: 'Search (?action=search&q=)', url: callSearchUrl },
                  { id: 'u-id', label: 'Detail (?action=detail&id=)', url: callShortcutIdUrl },
                  { id: 'u-latest', label: 'Latest (?action=latest)', url: callLatestUrl },
                  { id: 'u-url', label: 'Dynamic (?url=LINK)', url: callDynamicUrlMode },
                ] as const
              ).map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-sans font-semibold text-slate-700 shrink-0">
                      {item.label}:
                    </span>
                    <span className="text-slate-900 truncate" title={item.url}>
                      {item.url}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(item.url, item.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:text-slate-900 shrink-0 cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copy
                  </button>
                </div>
              ))}
            </div>

            {/* cURL & JS fetch() Snippets */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-blue-600" />
                    cURL Call Command
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(generatedCurlCmd, 'curl-cmd')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    {copiedId === 'curl-cmd' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copy
                  </button>
                </div>
                <pre className="p-3 bg-[#0F172A] text-slate-100 font-mono text-[11px] overflow-x-auto">
                  {generatedCurlCmd}
                </pre>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-blue-600" />
                    Website / App JavaScript fetch()
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopy(generatedFetchCode, 'fetch-js')}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 cursor-pointer"
                  >
                    {copiedId === 'fetch-js' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    Copy
                  </button>
                </div>
                <pre className="p-3 bg-[#0F172A] text-slate-100 font-mono text-[11px] overflow-x-auto">
                  {generatedFetchCode}
                </pre>
              </div>
            </div>

            {/* Self-Healing Recursive Auto-Detected UI Preview */}
            {autoDetectedSchema &&
              (autoDetectedSchema.titles.length > 0 ||
                autoDetectedSchema.posters.length > 0 ||
                autoDetectedSchema.mediaLinks.length > 0) && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      Self-Healing Auto-Detected Response Preview
                    </p>
                    <span className="font-mono text-[11px] text-emerald-700 tabular-nums">
                      {autoDetectedSchema.titles.length} title(s) ·{' '}
                      {autoDetectedSchema.posters.length} image(s) ·{' '}
                      {autoDetectedSchema.mediaLinks.length} stream/download link(s)
                    </span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row gap-4">
                    {autoDetectedSchema.posters[0] && (
                      <img
                        src={autoDetectedSchema.posters[0]}
                        alt={autoDetectedSchema.titles[0] || 'Detected Poster'}
                        referrerPolicy="no-referrer"
                        className="w-28 h-40 object-cover rounded-md border border-slate-200 shrink-0 bg-slate-100"
                      />
                    )}
                    <div className="min-w-0 space-y-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {autoDetectedSchema.titles[0] || 'Auto-Detected Item'}
                      </h3>
                      {autoDetectedSchema.descriptions[0] && (
                        <p className="text-xs text-slate-600 line-clamp-3">
                          {autoDetectedSchema.descriptions[0]}
                        </p>
                      )}
                      {Object.keys(autoDetectedSchema.metadata).length > 0 && (
                        <p className="font-mono text-[11px] text-slate-600">
                          {Object.entries(autoDetectedSchema.metadata)
                            .slice(0, 8)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {autoDetectedSchema.mediaLinks.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {autoDetectedSchema.mediaLinks.slice(0, 12).map((lnk, idx) => {
                        const isPlayableStream = /\.(mp4|m3u8|webm|mov)(\?|$)/i.test(lnk.url);
                        const videoObj: ExtractedVideo | null = isPlayableStream
                          ? {
                              title: lnk.label,
                              description: [lnk.quality, lnk.size].filter(Boolean).join(' · '),
                              videoUrl: lnk.url,
                              playableType: /\.m3u8(\?|$)/i.test(lnk.url) ? 'hls' : 'html5',
                              streamFormat: /\.m3u8(\?|$)/i.test(lnk.url) ? 'HLS' : 'MP4',
                              proxyStreamUrl: `/api/media-proxy?url=${encodeURIComponent(lnk.url)}`,
                              downloadable: true,
                              extractedFrom: requestUrl || 'F12 JSON',
                              sourceType: 'script-stream',
                            }
                          : null;

                        return (
                          <div
                            key={`${lnk.url}-${idx}`}
                            className="p-3 bg-white border border-slate-200 rounded-lg space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate">{lnk.label}</p>
                                <p className="font-mono text-[11px] text-slate-500">
                                  {[lnk.quality, lnk.size, lnk.kind.toUpperCase()]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              </div>
                              <a
                                href={lnk.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700 shrink-0"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Open / DL
                              </a>
                            </div>
                            {videoObj && <UniversalVideoPlayer video={videoObj} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            {/* Live Harvested Fallback Preview */}
            {testPayload && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-700 tabular-nums">
                  <span className="text-emerald-700 font-semibold">Live Test OK</span>
                  <span>·</span>
                  <span>Pages Crawled: {testPayload.crawledPagesCount}</span>
                  <span>·</span>
                  <span>Videos: {testPayload.counts.videos}</span>
                  <span>·</span>
                  <span>PDFs/Docs: {testPayload.counts.documents}</span>
                  <span>·</span>
                  <span>Items: {testPayload.counts.items}</span>
                  <span>·</span>
                  <span>Links: {testPayload.counts.links}</span>
                </div>

                {testPayload.videos.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {testPayload.videos.slice(0, 4).map((v, idx) => (
                      <div key={idx} className="p-3 border border-slate-200 rounded-lg space-y-2">
                        <p className="font-semibold text-slate-900">{v.title}</p>
                        <UniversalVideoPlayer video={v} />
                      </div>
                    ))}
                  </div>
                )}

                {testPayload.items.length > 0 && (
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {testPayload.items.slice(0, 15).map((it, idx) => (
                      <div key={idx} className="px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{it.title}</p>
                          {it.description && (
                            <p className="text-slate-600 truncate">{it.description}</p>
                          )}
                        </div>
                        {it.url && (
                          <a
                            href={it.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline shrink-0"
                          >
                            Open
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
