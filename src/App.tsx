import { useCallback, useEffect, useState } from 'react';
import { ApiBuilderView } from './components/ApiBuilderView';
import { F12CaptureView } from './components/F12CaptureView';
import { ManualCaptureView } from './components/ManualCaptureView';
import { LiveEndpointsView } from './components/LiveEndpointsView';
import { ArchitectureView } from './components/ArchitectureView';
import { PresentationView } from './components/PresentationView';
import { safeParseJson } from './utils/safeFetch';
import type {
  BuilderMode,
  CapturedPattern,
  CrawlDepth,
  ExtractResponse,
  ExtractionRule,
  PublishedEndpoint,
} from './types/api';

type AppTab = 'builder' | 'capture' | 'manual' | 'endpoints' | 'architecture' | 'presentation';

function deriveSlugFromUrl(rawUrl: string): string {
  try {
    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl.trim())
      ? rawUrl.trim()
      : `https://${rawUrl.trim()}`;
    const u = new URL(withScheme);
    const hostPart = u.hostname.replace(/^www\./, '').split('.')[0] || 'site';
    const pathPart =
      u.pathname
        .split('/')
        .filter(Boolean)
        .slice(-1)[0] || '';
    const combined = pathPart ? `${hostPart}-${pathPart}` : `${hostPart}-api`;
    return (
      combined
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 36) || 'site-api'
    );
  } catch {
    return 'custom-site-api';
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('builder');

  const [sourceMode, setSourceMode] = useState<'url' | 'html'>('url');
  const [builderMode, setBuilderMode] = useState<BuilderMode>('auto');
  const [crawlDepth, setCrawlDepth] = useState<CrawlDepth>('linked');
  const [url, setUrl] = useState<string>('');
  const [rawHtml, setRawHtml] = useState<string>('');
  const [containerSelector, setContainerSelector] = useState<string>('');
  const [rules, setRules] = useState<ExtractionRule[]>([
    { id: 'r1', key: 'title', selector: 'h2, h3, a', attribute: 'text' },
    { id: 'r2', key: 'link', selector: 'a', attribute: 'href' },
  ]);
  const [limit, setLimit] = useState<number>(0); // 0 = All (No Limit)
  const [slug, setSlug] = useState<string>('my-site-api');

  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractResult, setExtractResult] = useState<ExtractResponse | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState<boolean>(false);
  const [publishMessage, setPublishMessage] = useState<{
    type: 'success' | 'error';
    text: string;
    livePath?: string;
  } | null>(null);

  const [endpoints, setEndpoints] = useState<PublishedEndpoint[]>([]);
  const [selectedEndpointSlug, setSelectedEndpointSlug] = useState<string | null>(null);

  const fetchEndpoints = useCallback(async () => {
    try {
      const res = await fetch('/api/endpoints');
      if (res.ok) {
        const data = await safeParseJson<{ endpoints?: PublishedEndpoint[] }>(res);
        setEndpoints(Array.isArray(data.endpoints) ? data.endpoints : []);
      }
    } catch {
      // ignore transient network error
    }
  }, []);

  const runExtraction = useCallback(
    async (override?: {
      sourceMode: 'url' | 'html';
      builderMode: BuilderMode;
      crawlDepth: CrawlDepth;
      url: string;
      rawHtml: string;
      containerSelector: string;
      rules: ExtractionRule[];
      limit: number;
    }) => {
      const params = override ?? {
        sourceMode,
        builderMode,
        crawlDepth,
        url,
        rawHtml,
        containerSelector,
        rules,
        limit,
      };
      setExtracting(true);
      setExtractError(null);
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const data = await safeParseJson<ExtractResponse>(res);
        if (!res.ok || !data.ok) {
          setExtractError(data.error || 'Failed to extract website data.');
        } else {
          setExtractResult(data);
        }
      } catch (err) {
        setExtractError(err instanceof Error ? err.message : 'Network error while extracting.');
      } finally {
        setExtracting(false);
      }
    },
    [sourceMode, builderMode, crawlDepth, url, rawHtml, containerSelector, rules, limit]
  );

  useEffect(() => {
    void fetchEndpoints();
  }, [fetchEndpoints]);

  const handleUrlChange = (nextUrl: string) => {
    setUrl(nextUrl);
    if (nextUrl.trim().length > 4) {
      setSlug(deriveSlugFromUrl(nextUrl));
    }
  };

  const handlePublishEndpoint = async () => {
    setPublishing(true);
    setPublishMessage(null);
    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name: extractResult?.overview.title || `API (${slug})`,
          sourceMode,
          builderMode,
          crawlDepth,
          url,
          rawHtml: sourceMode === 'html' ? rawHtml : undefined,
          containerSelector,
          rules,
          limit,
          hasSearchForm: Boolean(extractResult?.searchForm),
        }),
      });
      const data = await safeParseJson<{ error?: string; livePath?: string }>(res);
      if (!res.ok) {
        setPublishMessage({
          type: 'error',
          text: data.error || 'Could not publish endpoint.',
        });
      } else {
        setPublishMessage({
          type: 'success',
          text: `Live CORS-enabled API published at ${data.livePath}`,
          livePath: data.livePath,
        });
        await fetchEndpoints();
      }
    } catch (err) {
      setPublishMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to publish endpoint.',
      });
    } finally {
      setPublishing(false);
    }
  };

  const handleDeleteEndpoint = async (targetSlug: string) => {
    try {
      const res = await fetch(`/api/endpoints/${encodeURIComponent(targetSlug)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        if (selectedEndpointSlug === targetSlug) {
          setSelectedEndpointSlug(null);
        }
        await fetchEndpoints();
      }
    } catch {
      // ignore delete error
    }
  };

  const handlePublishCapturedEndpoint = async (payload: {
    slug: string;
    name: string;
    url: string;
    crawlDepth: CrawlDepth;
    capturedPattern: CapturedPattern;
  }): Promise<{ ok: boolean; text: string; livePath?: string }> => {
    try {
      const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: payload.slug,
          name: payload.name,
          sourceMode: 'url',
          builderMode: 'auto',
          crawlDepth: payload.crawlDepth,
          url: payload.url,
          containerSelector: '',
          rules: [],
          limit: 0,
          hasSearchForm: Boolean(payload.capturedPattern.queryParam),
          capturedPattern: payload.capturedPattern,
        }),
      });
      const data = await safeParseJson<{ error?: string; livePath?: string }>(res);
      if (!res.ok) {
        return { ok: false, text: data.error || 'Could not publish captured endpoint.' };
      }
      await fetchEndpoints();
      return {
        ok: true,
        text: `Live limitless CORS API published at ${data.livePath}`,
        livePath: data.livePath,
      };
    } catch (err) {
      return {
        ok: false,
        text: err instanceof Error ? err.message : 'Failed to publish captured endpoint.',
      };
    }
  };

  const navItems: Array<{ id: AppTab; label: string }> = [
    { id: 'builder', label: 'API Builder' },
    { id: 'capture', label: 'F12 Capture' },
    { id: 'manual', label: 'Manual F12' },
    { id: 'endpoints', label: 'Live Endpoints' },
    { id: 'architecture', label: 'How It Works' },
    { id: 'presentation', label: 'Presentation' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Site2API Lab
          </button>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-slate-900 border-blue-600'
                      : 'text-slate-600 border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() =>
                setActiveTab(activeTab === 'presentation' ? 'builder' : 'presentation')
              }
              className="px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activeTab === 'presentation' ? 'Back to Builder' : 'Start Presentation'}
            </button>
          </div>
        </div>

        {/* Mobile Nav Strip */}
        <nav
          aria-label="Mobile navigation"
          className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-4 overflow-x-auto"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-slate-900 border-blue-600'
                    : 'text-slate-600 border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Workspace Container */}
      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'builder' && (
          <ApiBuilderView
            sourceMode={sourceMode}
            onSourceModeChange={setSourceMode}
            builderMode={builderMode}
            onBuilderModeChange={setBuilderMode}
            crawlDepth={crawlDepth}
            onCrawlDepthChange={setCrawlDepth}
            url={url}
            onUrlChange={handleUrlChange}
            rawHtml={rawHtml}
            onRawHtmlChange={setRawHtml}
            containerSelector={containerSelector}
            onContainerSelectorChange={setContainerSelector}
            rules={rules}
            onRulesChange={setRules}
            limit={limit}
            onLimitChange={setLimit}
            slug={slug}
            onSlugChange={setSlug}
            extracting={extracting}
            extractResult={extractResult}
            extractError={extractError}
            onRunExtract={() => void runExtraction()}
            publishing={publishing}
            publishMessage={publishMessage}
            onPublishEndpoint={() => void handlePublishEndpoint()}
            onNavigateToEndpoints={(targetSlug) => {
              if (targetSlug) setSelectedEndpointSlug(targetSlug);
              setActiveTab('endpoints');
            }}
          />
        )}

        {activeTab === 'capture' && (
          <F12CaptureView
            onPublishCapturedEndpoint={handlePublishCapturedEndpoint}
            onNavigateToEndpoints={(targetSlug) => {
              if (targetSlug) setSelectedEndpointSlug(targetSlug);
              setActiveTab('endpoints');
            }}
          />
        )}

        {activeTab === 'manual' && (
          <ManualCaptureView
            onPublishCapturedEndpoint={handlePublishCapturedEndpoint}
            onNavigateToEndpoints={(targetSlug) => {
              if (targetSlug) setSelectedEndpointSlug(targetSlug);
              setActiveTab('endpoints');
            }}
          />
        )}

        {activeTab === 'endpoints' && (
          <LiveEndpointsView
            endpoints={endpoints}
            selectedSlug={selectedEndpointSlug}
            onSelectSlug={setSelectedEndpointSlug}
            onDeleteEndpoint={(s) => void handleDeleteEndpoint(s)}
            onRefreshEndpoints={() => void fetchEndpoints()}
          />
        )}

        {activeTab === 'architecture' && <ArchitectureView />}

        {activeTab === 'presentation' && (
          <PresentationView onOpenLiveDemo={() => setActiveTab('builder')} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Site2API Lab — Universal Website-to-JSON API &amp; Search Workbench</span>
          <span>Express.js · Cheerio DOM Parser · CORS &amp; OpenAPI 3.0</span>
        </div>
      </footer>
    </div>
  );
}
