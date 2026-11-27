import { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Film,
  Play,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  EndpointDataFilter,
  LiveApiPayload,
  LiveEndpointTestResult,
  PublishedEndpoint,
} from '../types/api';
import { UniversalVideoPlayer } from './UniversalVideoPlayer';
import { NetworkInspector } from './NetworkInspector';
import { ExternalHtmlTester } from './ExternalHtmlTester';
import { PhpExporterPanel } from './PhpExporterPanel';
import { safeParseJson } from '../utils/safeFetch';

interface LiveEndpointsViewProps {
  endpoints: PublishedEndpoint[];
  selectedSlug: string | null;
  onSelectSlug: (slug: string) => void;
  onDeleteEndpoint: (slug: string) => void;
  onRefreshEndpoints: () => void;
}

export function LiveEndpointsView({
  endpoints,
  selectedSlug,
  onSelectSlug,
  onDeleteEndpoint,
  onRefreshEndpoints,
}: LiveEndpointsViewProps) {
  const [searchEndpoints, setSearchEndpoints] = useState('');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST'>('GET');
  const [apiQuery, setApiQuery] = useState('');
  const [overrideUrl, setOverrideUrl] = useState('');
  const [filterType, setFilterType] = useState<EndpointDataFilter>('all');
  const [sortMode, setSortMode] = useState<'relevance' | 'az'>('relevance');
  const [testLimit, setTestLimit] = useState(0); // 0 = All (No Limit)
  const [useSiteSearch, setUseSiteSearch] = useState(true);
  const [responseView, setResponseView] = useState<'rich' | 'trace' | 'json' | 'external' | 'php'>('rich');

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<LiveEndpointTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingVideos, setPlayingVideos] = useState<Record<string, boolean>>({});

  const activeSlug = selectedSlug || endpoints[0]?.slug || '';
  const activeEndpoint = endpoints.find((ep) => ep.slug === activeSlug) || null;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const buildRequestPath = (
    slugToTest: string,
    q: string,
    type: EndpointDataFilter,
    limitVal: number,
    siteSearch: boolean,
    sort: 'relevance' | 'az',
    urlParam?: string
  ) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (urlParam?.trim()) params.set('url', urlParam.trim());
    if (type !== 'all') params.set('type', type);
    params.set('limit', limitVal === 0 ? 'all' : String(limitVal));
    if (sort === 'az') params.set('sort', 'az');
    if (q.trim()) {
      params.set('siteSearch', siteSearch ? 'true' : 'false');
    }
    return `/api/v1/${encodeURIComponent(slugToTest)}?${params.toString()}`;
  };

  const runLiveTest = async (
    slugToTest: string,
    override?: {
      q?: string;
      urlParam?: string;
      method?: 'GET' | 'POST';
      type?: EndpointDataFilter;
      limitVal?: number;
      siteSearch?: boolean;
      sort?: 'relevance' | 'az';
    }
  ) => {
    if (!slugToTest) return;
    setTesting(true);
    setTestError(null);
    const q = override?.q !== undefined ? override.q : apiQuery;
    const urlParam = override?.urlParam !== undefined ? override.urlParam : overrideUrl;
    const methodToUse = override?.method !== undefined ? override.method : httpMethod;
    const type = override?.type !== undefined ? override.type : filterType;
    const limitVal = override?.limitVal !== undefined ? override.limitVal : testLimit;
    const siteSearch = override?.siteSearch !== undefined ? override.siteSearch : useSiteSearch;
    const sort = override?.sort !== undefined ? override.sort : sortMode;

    const started = performance.now();
    try {
      let res: Response;
      if (methodToUse === 'POST') {
        res = await fetch(`/api/v1/${encodeURIComponent(slugToTest)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: q.trim() || undefined,
            url: urlParam.trim() || undefined,
            type,
            limit: limitVal === 0 ? 'all' : limitVal,
            sort,
            siteSearch,
          }),
        });
      } else {
        const requestPath = buildRequestPath(
          slugToTest,
          q,
          type,
          limitVal,
          siteSearch,
          sort,
          urlParam
        );
        res = await fetch(requestPath);
      }

      const elapsed = Math.round(performance.now() - started);
      const data = await safeParseJson<LiveApiPayload | { error?: string }>(res);
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        if (
          [
            'content-type',
            'access-control-allow-origin',
            'access-control-allow-methods',
            'x-api-source-mode',
            'x-response-time-ms',
          ].includes(key.toLowerCase())
        ) {
          headers[key] = value;
        }
      });
      setTestResult({
        status: res.status,
        responseTimeMs: elapsed,
        headers,
        body: data,
      });
      onRefreshEndpoints();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (!activeSlug || testing) return;
    const currentApi =
      testResult && 'api' in testResult.body ? String(testResult.body.api || '') : '';
    if (currentApi !== `/api/v1/${activeSlug}`) {
      void runLiveTest(activeSlug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlug]);

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore clipboard restriction
    }
  };

  const filteredEndpoints = endpoints.filter(
    (ep) =>
      ep.slug.toLowerCase().includes(searchEndpoints.toLowerCase()) ||
      ep.name.toLowerCase().includes(searchEndpoints.toLowerCase()) ||
      ep.url.toLowerCase().includes(searchEndpoints.toLowerCase())
  );

  const fullTestedUrl = activeSlug
    ? `${origin}${buildRequestPath(activeSlug, apiQuery, filterType, testLimit, useSiteSearch, sortMode, overrideUrl)}`
    : '';
  const openApiSpecUrl = activeSlug ? `${origin}/api/v1/${encodeURIComponent(activeSlug)}/openapi.json` : '';

  const liveBody =
    testResult && testResult.status < 400 ? (testResult.body as LiveApiPayload) : null;

  return (
    <div className="space-y-6">
      {/* Published Endpoints Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Published Live Endpoints</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Every endpoint has public CORS (<span className="font-mono">Access-Control-Allow-Origin: *</span>) and an OpenAPI 3.0 spec for use in external apps and websites.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchEndpoints}
              onChange={(e) => setSearchEndpoints(e.target.value)}
              placeholder="Filter endpoints..."
              aria-label="Filter endpoints"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {filteredEndpoints.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">No published API endpoints found</p>
            <p className="text-xs text-slate-500 mt-1">
              Build and publish a website API in the API Builder tab first.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-4 font-medium">Method &amp; Route</th>
                  <th className="py-2.5 px-4 font-medium">Target Website</th>
                  <th className="py-2.5 px-4 font-medium">Crawl &amp; Engine</th>
                  <th className="py-2.5 px-4 font-medium text-right">Requests</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEndpoints.map((ep) => {
                  const isSelected = ep.slug === activeSlug;
                  return (
                    <tr
                      key={ep.slug}
                      className={`transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="py-3 px-4 font-mono">
                        <span className="text-emerald-700 font-semibold mr-2">GET/POST</span>
                        <span className="text-slate-900 font-medium">/api/v1/{ep.slug}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={ep.url}>
                        {ep.sourceMode === 'html' ? `Offline Demo (${ep.name})` : ep.url}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {ep.capturedPattern
                          ? `F12 Captured (${ep.capturedPattern.queryParam ? `?${ep.capturedPattern.queryParam}` : ep.capturedPattern.kind})`
                          : ep.builderMode === 'custom'
                            ? 'Custom CSS'
                            : 'Smart Auto'}{' '}
                        · {ep.crawlDepth}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                        {ep.hitCount}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSlug(ep.slug);
                              void runLiveTest(ep.slug);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            Test &amp; Search
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyText(`${origin}/api/v1/${ep.slug}?limit=all`, `copy-${ep.slug}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {copiedId === `copy-${ep.slug}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            {copiedId === `copy-${ep.slug}` ? 'Copied' : 'URL'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteEndpoint(ep.slug)}
                            aria-label={`Delete ${ep.slug}`}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Interactive Search & Live API Testing Console */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Live API Search &amp; Backend Inspector
            </h2>
            <p className="text-xs text-slate-500">
              Search courses, videos, PDF notes, or books using <span className="font-mono">?q=</span> (e.g. <span className="font-mono">dbms</span>, <span className="font-mono">python</span>, <span className="font-mono">pdf</span>) with unlimited results.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setResponseView('rich')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                responseView === 'rich' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Results View
            </button>
            <button
              type="button"
              onClick={() => setResponseView('trace')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                responseView === 'trace' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              F12 Network
            </button>
            <button
              type="button"
              onClick={() => setResponseView('external')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                responseView === 'external' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Live HTML Tester
            </button>
            <button
              type="button"
              onClick={() => setResponseView('php')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                responseView === 'php' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              PHP api.php
            </button>
            <button
              type="button"
              onClick={() => setResponseView('json')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                responseView === 'json' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Raw JSON
            </button>
          </div>
        </div>

        {/* Request Builder Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runLiveTest(activeSlug);
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
            <div className="lg:col-span-4 flex items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
              <select
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value as 'GET' | 'POST')}
                aria-label="HTTP method"
                className="px-2.5 py-2 text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 border-r border-slate-200 focus:outline-none shrink-0 cursor-pointer"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
              </select>
              <select
                value={activeSlug}
                onChange={(e) => {
                  onSelectSlug(e.target.value);
                  void runLiveTest(e.target.value);
                }}
                aria-label="Select API endpoint"
                className="w-full px-3 py-2 text-xs font-mono bg-transparent text-slate-900 focus:outline-none"
              >
                {endpoints.map((ep) => (
                  <option key={ep.slug} value={ep.slug}>
                    /api/v1/{ep.slug}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-4 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={apiQuery}
                onChange={(e) => setApiQuery(e.target.value)}
                placeholder="Search query (?q= / ?query= / JSON q)"
                aria-label="Search query parameter"
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
              />
            </div>

            <div className="lg:col-span-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = testLimit === 0 ? 25 : 0;
                  setTestLimit(next);
                  void runLiveTest(activeSlug, { limitVal: next });
                }}
                className={`flex-1 px-2.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  testLimit === 0
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {testLimit === 0 ? 'All (No Limit)' : 'Set Unlimited'}
              </button>
              {testLimit !== 0 && (
                <input
                  type="number"
                  min={1}
                  value={testLimit}
                  onChange={(e) => setTestLimit(Math.max(1, Number(e.target.value) || 25))}
                  aria-label="Limit query parameter"
                  className="w-24 px-2 py-2 text-xs font-mono tabular-nums bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
              )}
            </div>

            <button
              type="submit"
              disabled={!activeSlug || testing}
              className="lg:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {testing ? 'Searching...' : 'Run API'}
            </button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              {(
                [
                  { id: 'all', label: 'All Data' },
                  { id: 'videos', label: 'Videos' },
                  { id: 'documents', label: 'PDFs & Notes' },
                  { id: 'items', label: 'Courses & Books' },
                  { id: 'tables', label: 'Tables' },
                  { id: 'sections', label: 'Sections' },
                  { id: 'links', label: 'Links' },
                ] as Array<{ id: EndpointDataFilter; label: string }>
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFilterType(f.id);
                    void runLiveTest(activeSlug, { type: f.id });
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    filterType === f.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const nextSort = sortMode === 'az' ? 'relevance' : 'az';
                  setSortMode(nextSort);
                  void runLiveTest(activeSlug, { sort: nextSort });
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                  sortMode === 'az'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Sort: {sortMode === 'az' ? 'A–Z' : 'Default'}
              </button>

              {(activeEndpoint?.hasSearchForm || liveBody?.searchFormAvailable) && (
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSiteSearch}
                    onChange={(e) => setUseSiteSearch(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>Search live on target site (?siteSearch=true)</span>
                </label>
              )}

              {openApiSpecUrl && (
                <a
                  href={openApiSpecUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-blue-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100"
                >
                  OpenAPI Spec
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {fullTestedUrl && (
                <button
                  type="button"
                  onClick={() => void copyText(fullTestedUrl, 'full-url')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer max-w-xs truncate"
                  title={fullTestedUrl}
                >
                  {copiedId === 'full-url' ? <Check className="w-3 h-3 text-emerald-600 shrink-0" /> : <Copy className="w-3 h-3 shrink-0" />}
                  <span className="truncate">Copy Request URL</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={overrideUrl}
              onChange={(e) => setOverrideUrl(e.target.value)}
              placeholder="Optional ?url= override (leave blank to query this endpoint's saved target URL, or paste any live site URL)"
              aria-label="Optional target URL override"
              className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600"
            />
          </div>
        </form>

        {testError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{testError}</span>
          </div>
        )}

        {testResult && (
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span
                className={`font-mono font-semibold ${
                  testResult.status >= 200 && testResult.status < 300 ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                Status: {testResult.status} {testResult.status < 300 ? 'OK' : 'Error'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{testResult.responseTimeMs} ms</span>
              {liveBody && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{liveBody.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Limit: {liveBody.limitApplied}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {liveBody.counts.videos} videos · {liveBody.counts.documents} PDFs/notes · {liveBody.counts.items} items · {liveBody.counts.links} links
                  </span>
                  {testResult.headers['access-control-allow-origin'] && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-emerald-700">
                        CORS: {testResult.headers['access-control-allow-origin']}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>

            {responseView === 'php' ? (
              <PhpExporterPanel
                key={activeSlug}
                defaultBaseUrl={overrideUrl || activeEndpoint?.url || 'https://example.com'}
                defaultSampleItemUrl={
                  liveBody?.items[0]?.url || liveBody?.videos[0]?.pageUrl || overrideUrl || activeEndpoint?.url
                }
                capturedPattern={activeEndpoint?.capturedPattern}
                detectedQueryParam={activeEndpoint?.capturedPattern?.queryParam}
              />
            ) : responseView === 'external' ? (
              <ExternalHtmlTester
                origin={origin}
                slug={activeSlug}
                targetUrl={overrideUrl || activeEndpoint?.url || ''}
                samplePayload={liveBody || undefined}
              />
            ) : responseView === 'json' || !liveBody ? (
              <pre className="p-4 rounded-lg bg-[#0F172A] text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto max-h-[480px]">
                {JSON.stringify(testResult.body, null, 2)}
              </pre>
            ) : responseView === 'trace' ? (
              <NetworkInspector trace={liveBody.backendTrace} upstreamStatus={testResult.status} />
            ) : (
              <div className="space-y-5">
                {liveBody.counts.videos === 0 &&
                  liveBody.counts.documents === 0 &&
                  liveBody.counts.items === 0 &&
                  liveBody.counts.sections === 0 &&
                  liveBody.counts.links === 0 &&
                  liveBody.capturedUpstreamData === undefined && (
                    <div className="p-8 text-center border border-dashed border-slate-200 rounded-lg">
                      <p className="text-sm font-medium text-slate-800">
                        No results matched {liveBody.query ? `"${liveBody.query}"` : 'this filter'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try another keyword like &quot;dbms&quot;, &quot;pdf&quot;, &quot;rest api&quot;, or clear the search query.
                      </p>
                    </div>
                  )}

                {liveBody.capturedUpstreamData !== undefined && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Captured Upstream JSON API Data
                    </h3>
                    <pre className="p-3.5 rounded-lg bg-[#0F172A] text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto max-h-80">
                      {typeof liveBody.capturedUpstreamData === 'string'
                        ? liveBody.capturedUpstreamData
                        : JSON.stringify(liveBody.capturedUpstreamData, null, 2)}
                    </pre>
                  </div>
                )}

                {/* PDFs, Notes & Study Downloads in Live Response */}
                {liveBody.documents.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        PDFs, Notes &amp; Study Downloads ({liveBody.documents.length})
                      </h3>
                    </div>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {liveBody.documents.map((doc, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-blue-700">
                                {doc.fileType}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <p className="text-xs font-semibold text-slate-900">{doc.title}</p>
                            </div>
                            <p className="text-xs font-mono text-slate-400 truncate mt-0.5">{doc.url}</p>
                          </div>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline shrink-0"
                          >
                            <Download className="w-3 h-3" />
                            Open
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Videos in Live Response */}
                {liveBody.videos.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Film className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        Videos &amp; Stream Links ({liveBody.videos.length})
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {liveBody.videos.map((v, idx) => {
                        const vidKey = `${v.videoUrl}-${idx}`;
                        const canPlayInline =
                          Boolean(v.embedUrl) ||
                          v.playableType === 'youtube-embed' ||
                          v.playableType === 'hls' ||
                          v.playableType === 'html5' ||
                          v.playableType === 'iframe' ||
                          /\.(mp4|m3u8|webm|ogg|ogv|mov)(\?|$)/i.test(v.videoUrl);
                        const isPlaying = Boolean(playingVideos[vidKey]);
                        return (
                          <div key={vidKey} className="p-3.5 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2.5">
                            <div className="flex gap-3">
                              {v.thumbnail && (
                                <img
                                  src={v.thumbnail}
                                  alt={v.title}
                                  referrerPolicy="no-referrer"
                                  className="w-28 h-16 object-cover rounded bg-slate-200 shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-semibold text-slate-900 leading-snug">{v.title}</p>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {canPlayInline && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPlayingVideos((prev) => ({
                                            ...prev,
                                            [vidKey]: !prev[vidKey],
                                          }))
                                        }
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                                          isPlaying
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                        }`}
                                      >
                                        <Play className="w-3 h-3" />
                                        {isPlaying ? 'Hide' : 'Play'}
                                      </button>
                                    )}
                                    <a
                                      href={v.downloadable ? v.proxyStreamUrl || v.videoUrl : v.videoUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-blue-700 hover:underline shrink-0"
                                    >
                                      {v.downloadable ? 'Download' : 'Open'}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                  {v.streamFormat && (
                                    <span className="font-mono font-medium text-blue-700">{v.streamFormat}</span>
                                  )}
                                  {v.downloadable && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-700">Downloadable</span>
                                    </>
                                  )}
                                  {v.channelName && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{v.channelName}</span>
                                    </>
                                  )}
                                  {v.duration && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono tabular-nums">{v.duration}</span>
                                    </>
                                  )}
                                  {v.views && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="tabular-nums">{v.views}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            {v.description && (
                              <p className="text-xs text-slate-600 leading-relaxed">{v.description}</p>
                            )}
                            {isPlaying && <UniversalVideoPlayer video={v} />}
                            <p className="text-xs font-mono text-slate-400 truncate">
                              {v.extractedFrom} · {v.videoUrl}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Courses, Posts & Books in Live Response */}
                {liveBody.items.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        Courses, Posts &amp; Catalog Items ({liveBody.items.length})
                      </h3>
                    </div>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {liveBody.items.map((item, idx) => (
                        <div key={idx} className="p-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                            {item.meta && (
                              <p className="text-xs font-mono text-slate-500 mt-0.5">{item.meta}</p>
                            )}
                            {item.description && (
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.description}</p>
                            )}
                          </div>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-700 hover:underline shrink-0"
                            >
                              Open
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tables in Live Response */}
                {liveBody.tables.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Tables ({liveBody.tables.length})
                    </h3>
                    {liveBody.tables.map((tbl, tIdx) => (
                      <div key={tIdx} className="border border-slate-200 rounded-lg overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {tbl.headers.map((h, i) => (
                                <th key={i} className="py-2 px-3 font-medium text-slate-700">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {tbl.rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {tbl.headers.map((h, cIdx) => (
                                  <td key={cIdx} className="py-2 px-3 text-slate-700">
                                    {row[h] || '—'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sections in Live Response */}
                {liveBody.sections.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Article Sections ({liveBody.sections.length})
                    </h3>
                    <div className="space-y-2">
                      {liveBody.sections.map((sec, idx) => (
                        <div key={idx} className="p-3 border border-slate-200 rounded-lg">
                          <p className="text-xs font-semibold text-slate-900">{sec.heading}</p>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{sec.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links in Live Response */}
                {liveBody.links.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Extracted Links &amp; Origins ({liveBody.links.length})
                    </h3>
                    <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                      {liveBody.links.map((lnk, idx) => (
                        <div key={idx} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="text-slate-800 truncate">{lnk.text}</p>
                            <p className="font-mono text-slate-400 truncate">
                              {lnk.extractedFrom} · {lnk.url}
                            </p>
                          </div>
                          <a
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline shrink-0"
                          >
                            {lnk.category}
                          </a>
                        </div>
                      ))}
                    </div>
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
