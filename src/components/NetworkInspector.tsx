import { useMemo, useState } from 'react';
import { Check, Copy, Search, Server } from 'lucide-react';
import type { BackendTrace, NetworkTraceEntry } from '../types/api';

interface NetworkInspectorProps {
  trace: BackendTrace;
  upstreamStatus?: number;
}

type ResourceFilter = 'all' | 'document' | 'xhr-discovered' | 'media-stream' | 'crawl-page';
type DetailTab = 'headers' | 'xhr' | 'flow' | 'response';

function shortResourceName(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, 'http://localhost');
    const path = parsed.pathname === '/' ? parsed.hostname : parsed.pathname;
    const suffix = parsed.search ? parsed.search.slice(0, 32) : '';
    return `${path}${suffix}`;
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

export function NetworkInspector({ trace, upstreamStatus = 200 }: NetworkInspectorProps) {
  const [resourceFilter, setResourceFilter] = useState<ResourceFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [selectedId, setSelectedId] = useState<string>('doc-0');
  const [detailTab, setDetailTab] = useState<DetailTab>('headers');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const entries: NetworkTraceEntry[] = useMemo(() => {
    if (trace.networkEntries && trace.networkEntries.length > 0) {
      return trace.networkEntries;
    }
    return [
      {
        id: 'doc-0',
        method: 'GET',
        url: trace.finalUrl || trace.requestUrl,
        resourceType: 'document',
        status: upstreamStatus,
        durationMs: 0,
        bytes: trace.htmlBytes || 0,
        requestHeaders: trace.requestHeaders || {},
        responseHeaders: trace.responseHeaders || {},
        initiator: 'User Input URL',
      },
    ];
  }, [trace, upstreamStatus]);

  const filteredEntries = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return entries.filter((entry) => {
      if (resourceFilter !== 'all' && entry.resourceType !== resourceFilter) return false;
      if (!q) return true;
      return (
        entry.url.toLowerCase().includes(q) ||
        entry.initiator.toLowerCase().includes(q) ||
        entry.resourceType.toLowerCase().includes(q)
      );
    });
  }, [entries, resourceFilter, searchText]);

  const selectedEntry =
    filteredEntries.find((e) => e.id === selectedId) || filteredEntries[0] || entries[0];

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const xhrAndMedia = entries.filter(
    (e) => e.resourceType === 'xhr-discovered' || e.resourceType === 'media-stream'
  );

  return (
    <div className="space-y-4">
      {/* DevTools Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(
            [
              { id: 'all', label: `All (${entries.length})` },
              {
                id: 'document',
                label: `Doc (${entries.filter((e) => e.resourceType === 'document').length})`,
              },
              {
                id: 'xhr-discovered',
                label: `Fetch/XHR (${entries.filter((e) => e.resourceType === 'xhr-discovered').length})`,
              },
              {
                id: 'media-stream',
                label: `Media (${entries.filter((e) => e.resourceType === 'media-stream').length})`,
              },
              {
                id: 'crawl-page',
                label: `Crawled (${entries.filter((e) => e.resourceType === 'crawl-page').length})`,
              },
            ] as Array<{ id: ResourceFilter; label: string }>
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setResourceFilter(f.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                resourceFilter === f.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Filter URL, stream, XHR..."
            aria-label="Filter F12 network entries"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Split F12 Network Table + Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border border-slate-200 rounded-lg overflow-hidden bg-white">
        {/* Request Waterfall List */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-200 max-h-[460px] overflow-y-auto divide-y divide-slate-100">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span className="col-span-6">Name / Endpoint</span>
            <span className="col-span-2 text-right">Status</span>
            <span className="col-span-2 text-right">Size</span>
            <span className="col-span-2 text-right">Time</span>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No network requests matched this filter.
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const isSelected = selectedEntry?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full text-left px-3 py-2 grid grid-cols-12 gap-2 items-center text-xs transition-colors cursor-pointer ${
                    isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="col-span-6 min-w-0">
                    <p className="font-mono font-medium text-slate-900 truncate" title={entry.url}>
                      {shortResourceName(entry.url)}
                    </p>
                    <p className="text-[11px] font-mono text-slate-500 truncate">
                      {entry.method} · {entry.resourceType}
                    </p>
                  </div>
                  <span
                    className={`col-span-2 text-right font-mono tabular-nums ${
                      typeof entry.status === 'number' && entry.status < 400
                        ? 'text-emerald-700 font-semibold'
                        : 'text-slate-600'
                    }`}
                  >
                    {entry.status}
                  </span>
                  <span className="col-span-2 text-right font-mono tabular-nums text-slate-600">
                    {formatBytes(entry.bytes)}
                  </span>
                  <span className="col-span-2 text-right font-mono tabular-nums text-slate-600">
                    {entry.durationMs > 0 ? `${entry.durationMs}ms` : '—'}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Right Detail Inspector */}
        <div className="lg:col-span-7 flex flex-col max-h-[460px]">
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'headers', label: 'Headers' },
                  { id: 'xhr', label: 'Fetch/XHR & Streams' },
                  { id: 'flow', label: 'Redirects & Flow' },
                  { id: 'response', label: 'Response' },
                ] as Array<{ id: DetailTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDetailTab(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    detailTab === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {selectedEntry && (
              <button
                type="button"
                onClick={() => void handleCopy(selectedEntry.url, 'sel-url')}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                {copiedId === 'sel-url' ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                URL
              </button>
            )}
          </div>

          <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
            {detailTab === 'headers' && selectedEntry && (
              <>
                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-900">General</p>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono space-y-1.5">
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-4 text-slate-500">Request URL:</span>
                      <span className="col-span-8 text-slate-900 break-all">{selectedEntry.url}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-4 text-slate-500">Request Method:</span>
                      <span className="col-span-8 text-slate-900">{selectedEntry.method}</span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-4 text-slate-500">Status Code:</span>
                      <span className="col-span-8 text-emerald-700 font-semibold">
                        {selectedEntry.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-12 gap-2">
                      <span className="col-span-4 text-slate-500">Initiator:</span>
                      <span className="col-span-8 text-slate-700">{selectedEntry.initiator}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-900">
                    Response Headers ({Object.keys(selectedEntry.responseHeaders).length})
                  </p>
                  {Object.keys(selectedEntry.responseHeaders).length === 0 ? (
                    <p className="text-slate-500">
                      No remote response headers recorded for this entry.
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {Object.entries(selectedEntry.responseHeaders).map(([k, v]) => (
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
                    Request Headers ({Object.keys(selectedEntry.requestHeaders).length})
                  </p>
                  {Object.keys(selectedEntry.requestHeaders).length === 0 ? (
                    <p className="text-slate-500">No request headers captured for this entry.</p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {Object.entries(selectedEntry.requestHeaders).map(([k, v]) => (
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

            {detailTab === 'xhr' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="font-semibold text-slate-900">
                    Discovered Fetch/XHR APIs &amp; Stream Endpoints ({xhrAndMedia.length})
                  </p>
                  {xhrAndMedia.length === 0 ? (
                    <p className="text-slate-500">
                      No inline XHR/API endpoints or direct stream manifests detected in scripts on this page.
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {xhrAndMedia.map((item) => (
                        <div
                          key={item.id}
                          className="px-3 py-2 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-slate-900 break-all">{item.url}</p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {item.resourceType} · {item.initiator}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleCopy(item.url, item.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
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
                  )}
                </div>

                <div className="space-y-2">
                  <p className="font-semibold text-slate-900">
                    Embedded Backend Payloads ({trace.embeddedPayloads.length})
                  </p>
                  {trace.embeddedPayloads.length === 0 ? (
                    <p className="text-slate-500">
                      Pure server-rendered HTML (data extracted directly from DOM elements).
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {trace.embeddedPayloads.map((p, idx) => (
                        <div key={idx} className="px-3 py-2 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">{p.name}</span>
                            <span className="font-mono text-slate-500">{p.kind}</span>
                          </div>
                          <p className="font-mono text-slate-600 break-all">{p.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {detailTab === 'flow' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono space-y-1">
                  <p className="font-sans font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    HTTP Redirect Chain &amp; Crawl Summary
                  </p>
                  <p className="text-slate-700 break-all">Initial: {trace.requestUrl}</p>
                  {trace.redirectChain.map((hop, idx) => (
                    <p key={idx} className="text-amber-700 break-all">
                      Redirect ({hop.status}): {hop.url}
                    </p>
                  ))}
                  <p className="text-emerald-700 break-all">Final: {trace.finalUrl}</p>
                </div>

                {trace.notes.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Engine Notes</p>
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-slate-700">
                      {trace.notes.map((n, idx) => (
                        <p key={idx}>{n}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="font-semibold text-slate-900">
                    Link Origin Provenance ({trace.linkSourceBreakdown.length})
                  </p>
                  <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {trace.linkSourceBreakdown.map((b, idx) => (
                      <div key={idx} className="px-3 py-1.5 flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-700">{b.source}</span>
                        <span className="font-mono font-semibold tabular-nums text-slate-900">
                          {b.count} links
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'response' && selectedEntry && (
              <div className="space-y-2">
                <p className="font-semibold text-slate-900">Captured Payload / Stream Preview</p>
                <pre className="p-3 rounded-lg bg-[#0F172A] text-slate-100 font-mono text-xs leading-relaxed overflow-x-auto max-h-72">
                  {selectedEntry.responsePreview ||
                    `Endpoint: ${selectedEntry.url}\nStatus: ${selectedEntry.status}\nSize: ${formatBytes(selectedEntry.bytes)}\nInitiator: ${selectedEntry.initiator}`}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
