import { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Film,
  Globe,
  Link2,
  Play,
  Plus,
  Rocket,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  BuilderMode,
  CrawlDepth,
  ExtractAttribute,
  ExtractResponse,
  ExtractionRule,
} from '../types/api';
import { UniversalVideoPlayer } from './UniversalVideoPlayer';
import { NetworkInspector } from './NetworkInspector';
import { ExternalHtmlTester } from './ExternalHtmlTester';

interface ApiBuilderViewProps {
  sourceMode: 'url' | 'html';
  onSourceModeChange: (mode: 'url' | 'html') => void;
  builderMode: BuilderMode;
  onBuilderModeChange: (mode: BuilderMode) => void;
  crawlDepth: CrawlDepth;
  onCrawlDepthChange: (depth: CrawlDepth) => void;
  url: string;
  onUrlChange: (url: string) => void;
  rawHtml: string;
  onRawHtmlChange: (html: string) => void;
  containerSelector: string;
  onContainerSelectorChange: (sel: string) => void;
  rules: ExtractionRule[];
  onRulesChange: (rules: ExtractionRule[]) => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  slug: string;
  onSlugChange: (slug: string) => void;
  extracting: boolean;
  extractResult: ExtractResponse | null;
  extractError: string | null;
  onRunExtract: () => void;
  publishing: boolean;
  publishMessage: { type: 'success' | 'error'; text: string; livePath?: string } | null;
  onPublishEndpoint: () => void;
  onNavigateToEndpoints: (slug?: string) => void;
}

type OutputTab = 'preview' | 'trace' | 'json' | 'code' | 'source';
type CodeLang = 'external' | 'javascript' | 'python' | 'curl' | 'express';

export function ApiBuilderView({
  sourceMode,
  onSourceModeChange,
  builderMode,
  onBuilderModeChange,
  crawlDepth,
  onCrawlDepthChange,
  url,
  onUrlChange,
  rawHtml,
  onRawHtmlChange,
  containerSelector,
  onContainerSelectorChange,
  rules,
  onRulesChange,
  limit,
  onLimitChange,
  slug,
  onSlugChange,
  extracting,
  extractResult,
  extractError,
  onRunExtract,
  publishing,
  publishMessage,
  onPublishEndpoint,
  onNavigateToEndpoints,
}: ApiBuilderViewProps) {
  const [outputTab, setOutputTab] = useState<OutputTab>('preview');
  const [codeLang, setCodeLang] = useState<CodeLang>('external');
  const [previewSearch, setPreviewSearch] = useState('');
  const [sortAZ, setSortAZ] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [playingVideos, setPlayingVideos] = useState<Record<string, boolean>>({});

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Clipboard blocked in some iframe contexts
    }
  };

  const addRule = () => {
    const nextIndex = rules.length + 1;
    onRulesChange([
      ...rules,
      {
        id: `rule-${Date.now()}`,
        key: `field${nextIndex}`,
        selector: 'h2',
        attribute: 'text',
      },
    ]);
  };

  const updateRule = (id: string, patch: Partial<ExtractionRule>) => {
    onRulesChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => {
    if (rules.length <= 1) return;
    onRulesChange(rules.filter((r) => r.id !== id));
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'my-site-api';
  const limitParam = limit === 0 ? 'all' : String(limit);
  const liveEndpointUrl = `${origin}/api/v1/${cleanSlug}?limit=${limitParam}`;
  const liveSearchEndpointUrl = `${origin}/api/v1/${cleanSlug}?q=dbms&limit=${limitParam}`;
  const openApiUrl = `${origin}/api/v1/${cleanSlug}/openapi.json`;

  const matchPreviewRelated = <T,>(
    list: T[],
    getText: (item: T) => string,
    getLabel: (item: T) => string
  ): T[] => {
    const cleanQ = previewSearch.trim().toLowerCase();
    const terms = cleanQ.split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
    const scored = list
      .map((item) => {
        if (!cleanQ) return { item, score: 1 };
        const text = getText(item).toLowerCase();
        let score = text.includes(cleanQ) ? 50 : 0;
        for (const t of terms) {
          if (text.includes(t)) score += 10;
          else if (t.length >= 4 && text.includes(t.slice(0, t.length - 1))) score += 5;
        }
        return { item, score };
      })
      .filter((x) => x.score > 0);

    if (sortAZ) {
      scored.sort((a, b) => getLabel(a.item).localeCompare(getLabel(b.item)));
    } else if (cleanQ) {
      scored.sort((a, b) => b.score - a.score);
    }
    return scored.map((x) => x.item);
  };

  const filteredVideos = matchPreviewRelated(
    extractResult?.videos ?? [],
    (v) => `${v.title} ${v.description} ${v.channelName || ''} ${v.videoUrl} ${v.streamFormat || ''}`,
    (v) => v.title
  );
  const filteredDocuments = matchPreviewRelated(
    extractResult?.documents ?? [],
    (d) => `${d.title} ${d.fileType} ${d.url} ${d.sourcePage}`,
    (d) => d.title
  );
  const filteredItems = matchPreviewRelated(
    extractResult?.items ?? [],
    (it) => `${it.title} ${it.description} ${it.meta || ''}`,
    (it) => it.title
  );
  const filteredSections = matchPreviewRelated(
    extractResult?.sections ?? [],
    (sec) => `${sec.heading} ${sec.content}`,
    (sec) => sec.heading
  );
  const filteredLinks = matchPreviewRelated(
    extractResult?.links ?? [],
    (lnk) => `${lnk.text} ${lnk.url} ${lnk.extractedFrom}`,
    (lnk) => lnk.text
  );

  const jsonOutputString = extractResult
    ? JSON.stringify(
        {
          status: extractResult.status,
          sourceUrl: extractResult.sourceUrl,
          crawlDepth: extractResult.crawlDepth,
          crawledPagesCount: extractResult.crawledPagesCount,
          category: extractResult.overview.category,
          overview: extractResult.overview,
          backendTrace: extractResult.backendTrace,
          counts: {
            videos: extractResult.videos.length,
            documents: extractResult.documents.length,
            items: extractResult.items.length,
            sections: extractResult.sections.length,
            tables: extractResult.tables.length,
            links: extractResult.links.length,
            customItems: extractResult.customItems.length,
          },
          videos: extractResult.videos,
          documents: extractResult.documents,
          items: extractResult.items,
          sections: extractResult.sections,
          tables: extractResult.tables,
          links: extractResult.links,
          ...(extractResult.builderMode === 'custom'
            ? { customItems: extractResult.customItems }
            : {}),
        },
        null,
        2
      )
    : '';

  const codeSnippets: Record<CodeLang, string> = {
    external: `<!-- Paste into ANY external HTML site (CORS-enabled public GET API) -->
<div id="course-feed">Loading courses &amp; notes...</div>
<script>
  fetch("${liveEndpointUrl}")
    .then((res) => res.json())
    .then((api) => {
      const box = document.getElementById("course-feed");
      const docs = api.documents.map((d) =>
        \`<li>[\${d.fileType}] <a href="\${d.url}">\${d.title}</a></li>\`
      ).join("");
      const vids = api.videos.map((v) =>
        \`<li>[Video · \${v.streamFormat || "Stream"}] <a href="\${v.videoUrl}">\${v.title}</a></li>\`
      ).join("");
      box.innerHTML = \`<h3>\${api.overview.title}</h3><ul>\${vids}\${docs}</ul>\`;
    });
</script>`,
    javascript: `// Option 1: GET with ?q= (or ?query= / ?search=) and ?limit=all
const getRes = await fetch("${liveSearchEndpointUrl}");
const api = await getRes.json();

// Option 2: POST JSON body
const postRes = await fetch("${origin}/api/v1/${cleanSlug}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ q: "dbms", limit: "${limitParam}", type: "all" })
});
const postApi = await postRes.json();

console.log("Videos:", api.videos);
console.log("PDF Notes & Docs:", api.documents);`,
    python: `import requests

# GET with ?q= / ?query= and unlimited results
res = requests.get("${origin}/api/v1/${cleanSlug}", params={
    "q": "dbms",
    "limit": "${limitParam}"
}, timeout=15)

# Or POST JSON body
res_post = requests.post("${origin}/api/v1/${cleanSlug}", json={
    "q": "dbms",
    "limit": "${limitParam}"
}, timeout=15)

data = res.json()
for doc in data["documents"]:
    print(f"[{doc['fileType']}] {doc['title']} -> {doc['url']}")
for v in data["videos"]:
    print(f"[Video: {v.get('streamFormat')}] {v['title']} -> {v['videoUrl']}")`,
    curl: `# GET ALL extracted videos, PDF notes, courses, and links (CORS enabled)
curl -s "${liveEndpointUrl}"

# POST JSON search query
curl -s -X POST "${origin}/api/v1/${cleanSlug}" \\
  -H "Content-Type: application/json" \\
  -d '{"q":"dbms","limit":"${limitParam}"}'

# Universal ad-hoc URL extractor
curl -s "${origin}/api/v1/extract?url=${encodeURIComponent(url || 'https://books.toscrape.com/')}&limit=all"`,
    express: `import express from "express";
import * as cheerio from "cheerio";

const app = express();
app.use(express.json());

app.all("/api/v1/${cleanSlug}", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  const q = String(req.query.q || req.query.query || req.body?.q || "").trim();
  const response = await fetch(${JSON.stringify(url || 'https://example.edu/bca-public-courses')});
  const html = await response.text();
  const $ = cheerio.load(html);

  const documents = $("a[href$='.pdf'], a[href$='.pptx'], a[download]")
    .map((_, el) => ({ title: $(el).text().trim(), url: $(el).attr("href") }))
    .get();

  res.json({ title: $("title").text().trim(), query: q || null, documents });
});`,
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Header */}
      <section aria-label="Universal Website to API Header" className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Universal Website-to-API Builder
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Enter any website, college admission portal, course page, or video site — extract all courses, notices, video streams, PDFs, tables, and publish a limitless CORS-enabled API.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start lg:self-auto">
            <button
              type="button"
              onClick={() => onSourceModeChange('url')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceMode === 'url'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Website URL
            </button>
            <button
              type="button"
              onClick={() => onSourceModeChange('html')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sourceMode === 'html'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Raw HTML Input
            </button>
          </div>
        </div>
      </section>

      {/* Main Two-Column Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: URL Input, Crawl Depth, Mode & Publish */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-5">
          {/* Source Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="target-url-input" className="text-sm font-semibold text-slate-900">
                {sourceMode === 'url' ? '1. Website, Course or Post URL' : '1. Paste Webpage HTML'}
              </label>
              <span className="text-xs text-slate-500">
                {sourceMode === 'url' ? 'Any public site or post' : 'Offline HTML'}
              </span>
            </div>

            {sourceMode === 'url' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onRunExtract();
                }}
                className="flex gap-2"
              >
                <div className="relative flex-1 min-w-0">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="target-url-input"
                    type="text"
                    value={url}
                    onChange={(e) => onUrlChange(e.target.value)}
                    placeholder="https://college-site.edu/course or any URL"
                    className="w-full pl-9 pr-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={extracting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  {extracting ? 'Building...' : 'Build API'}
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                <textarea
                  id="target-url-input"
                  rows={5}
                  value={rawHtml}
                  onChange={(e) => onRawHtmlChange(e.target.value)}
                  placeholder="Paste HTML of any college course page, video page, or book listing..."
                  className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={onRunExtract}
                    disabled={extracting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {extracting ? 'Parsing...' : 'Build API from HTML'}
                  </button>
                </div>
              </div>
            )}

            {sourceMode === 'url' && (
              <div className="mt-3 space-y-1.5">
                <span className="block text-xs font-medium text-slate-700">
                  Site Discovery Depth (Auto-crawl linked courses, videos &amp; PDFs)
                </span>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  {(
                    [
                      { id: 'single', label: 'Current Page' },
                      { id: 'linked', label: 'Linked (20)' },
                      { id: 'deep', label: 'Deep Site (100)' },
                    ] as Array<{ id: CrawlDepth; label: string }>
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onCrawlDepthChange(opt.id)}
                      className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        crawlDepth === opt.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  {crawlDepth === 'single'
                    ? 'Extracts only the entered webpage.'
                    : crawlDepth === 'linked'
                      ? 'Follows up to 20 linked admission, course, video, or notice pages on the same site.'
                      : 'Deep-crawls up to 100 linked pages and pagination links across the site.'}
                </p>
              </div>
            )}
          </div>

          {/* Extraction Strategy Switch */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">2. Extraction Engine</span>
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => onBuilderModeChange('auto')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    builderMode === 'auto'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Smart Auto
                </button>
                <button
                  type="button"
                  onClick={() => onBuilderModeChange('custom')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    builderMode === 'custom'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Custom CSS
                </button>
              </div>
            </div>

            {builderMode === 'auto' ? (
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-600">
                <p className="font-medium text-slate-800">
                  Deep Backend, Video Stream &amp; Document Extraction
                </p>
                <p className="leading-relaxed">
                  Extracts courses, videos (<span className="font-mono">MP4/M3U8/YouTube/Embed</span>), downloadable study PDFs &amp; PPTs, syllabus tables, and embedded JSON (<span className="font-mono">ytInitialData</span>, <span className="font-mono">__NEXT_DATA__</span>, <span className="font-mono">JSON-LD</span>).
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                  <span className="text-slate-700 font-medium">Result Limit</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onLimitChange(limit === 0 ? 50 : 0)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        limit === 0
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      All (No Limit)
                    </button>
                    {limit !== 0 && (
                      <input
                        id="auto-limit"
                        type="number"
                        min={1}
                        value={limit}
                        aria-label="Custom numeric item limit"
                        onChange={(e) =>
                          onLimitChange(Math.max(1, Number(e.target.value) || 50))
                        }
                        className="w-24 px-2 py-1 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-md text-slate-900"
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={containerSelector}
                    onChange={(e) => onContainerSelectorChange(e.target.value)}
                    placeholder="Container e.g. .course-card"
                    aria-label="Container CSS selector"
                    className="sm:col-span-3 px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => onLimitChange(limit === 0 ? 50 : 0)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
                      limit === 0
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {limit === 0 ? 'All' : `Max ${limit}`}
                  </button>
                </div>

                {extractResult && extractResult.detectedSelectors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {extractResult.detectedSelectors.map((det) => (
                      <button
                        key={det.selector}
                        type="button"
                        onClick={() => onContainerSelectorChange(det.selector)}
                        className="px-2 py-1 text-xs font-mono bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md cursor-pointer"
                      >
                        {det.selector} ({det.count})
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div key={rule.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <input
                        type="text"
                        value={rule.key}
                        onChange={(e) => updateRule(rule.id, { key: e.target.value })}
                        placeholder="key"
                        aria-label="JSON key"
                        className="col-span-4 px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                      />
                      <input
                        type="text"
                        value={rule.selector}
                        onChange={(e) => updateRule(rule.id, { selector: e.target.value })}
                        placeholder="selector"
                        aria-label="CSS selector"
                        className="col-span-4 px-2 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
                      />
                      <select
                        value={rule.attribute}
                        onChange={(e) =>
                          updateRule(rule.id, { attribute: e.target.value as ExtractAttribute })
                        }
                        aria-label="Attribute"
                        className="col-span-3 px-1.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md"
                      >
                        <option value="text">Text</option>
                        <option value="href">Href</option>
                        <option value="src">Src</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeRule(rule.id)}
                        disabled={rules.length <= 1}
                        aria-label="Remove rule"
                        className="col-span-1 flex justify-center text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addRule}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Field Rule
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Publish Live Searchable Endpoint */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">3. Publish CORS-Enabled REST API</h2>
              <p className="text-xs text-slate-500">
                Publishes <span className="font-mono">/api/v1/{cleanSlug}</span> + OpenAPI spec so any external website or app can fetch and search via <span className="font-mono">?q=</span>.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex flex-1 min-w-0 items-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-600/20 focus-within:border-blue-600">
                <span className="px-2.5 py-2 text-xs font-mono text-slate-500 bg-slate-100 border-r border-slate-200 whitespace-nowrap shrink-0">
                  /api/v1/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => onSlugChange(e.target.value)}
                  placeholder="my-site-api"
                  aria-label="API endpoint slug"
                  className="w-full px-2.5 py-2 text-sm font-mono bg-transparent text-slate-900 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={onPublishEndpoint}
                disabled={publishing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5" />
                {publishing ? 'Saving...' : 'Publish API'}
              </button>
            </div>

            {publishMessage && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                  publishMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <span className="font-medium">{publishMessage.text}</span>
                {publishMessage.livePath && (
                  <button
                    type="button"
                    onClick={() => onNavigateToEndpoints(cleanSlug)}
                    className="px-2.5 py-1 bg-white border border-emerald-300 text-emerald-800 rounded-md font-medium hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Test &amp; Search API
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Rich Visual, Backend Trace, & JSON Inspector */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[620px]">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'preview', label: 'Visual Preview' },
                  { id: 'trace', label: 'F12 Network Trace' },
                  { id: 'json', label: 'JSON Response' },
                  { id: 'code', label: 'API & External Tester' },
                  { id: 'source', label: 'Source HTML' },
                ] as Array<{ id: OutputTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOutputTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    outputTab === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {extractResult && outputTab === 'json' && (
              <button
                type="button"
                onClick={() => void handleCopy(jsonOutputString, 'json')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedId === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'json' ? 'Copied' : 'Copy JSON'}
              </button>
            )}
          </div>

          {extractResult && (
            <div className="px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-600 bg-white">
              <span className="font-mono font-semibold text-emerald-700">
                HTTP {extractResult.status} {extractResult.status < 400 ? 'OK' : '(Content Extracted)'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">{extractResult.overview.category}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{extractResult.responseTimeMs} ms</span>
              {extractResult.crawledPagesCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-blue-700">
                    +{extractResult.crawledPagesCount} crawled pages
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {extractResult.videos.length} videos · {extractResult.documents.length} PDFs/notes · {extractResult.items.length} items · {extractResult.tables.length} tables · {extractResult.links.length} links
              </span>
            </div>
          )}

          <div className="flex-1 p-5 overflow-auto">
            {extractError && (
              <div className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-900 text-sm flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Could not fetch or parse this website</p>
                    <p className="text-xs text-red-800 mt-0.5 leading-relaxed">{extractError}</p>
                  </div>
                </div>
                {sourceMode === 'url' && (
                  <button
                    type="button"
                    onClick={() => onSourceModeChange('html')}
                    className="px-2.5 py-1 text-xs font-medium bg-white border border-red-300 text-red-800 rounded-md hover:bg-red-100 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Use Raw HTML
                  </button>
                )}
              </div>
            )}

            {outputTab === 'preview' && (
              <>
                {extracting ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-20 bg-slate-100 rounded-lg" />
                    <div className="h-32 bg-slate-100 rounded-lg" />
                    <div className="h-24 bg-slate-100 rounded-lg" />
                  </div>
                ) : !extractResult ? (
                  <div className="h-80 flex flex-col items-center justify-center text-center px-6">
                    <Globe className="w-9 h-9 text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-800">Enter any website URL to build its API</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                      Click Build API to extract courses, video streams, PDF notes, tables, and link sources into a searchable JSON endpoint.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {extractResult.backendTrace.notes.length > 0 && (
                      <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                        {extractResult.backendTrace.notes.map((n, i) => (
                          <p key={i}>{n}</p>
                        ))}
                      </div>
                    )}

                    {/* Site Overview + Quick Search */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                      <div className="space-y-1 min-w-0">
                        <h2 className="text-base font-bold text-slate-900 leading-snug">
                          {extractResult.overview.title}
                        </h2>
                        {extractResult.overview.description && (
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {extractResult.overview.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
                          <span>{extractResult.overview.siteName}</span>
                          {extractResult.overview.author && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>By {extractResult.overview.author}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{extractResult.overview.wordCount} words</span>
                          {extractResult.searchForm && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-blue-700 font-medium">Live Search Supported</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                        <div className="relative flex-1 sm:w-52">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={previewSearch}
                            onChange={(e) => setPreviewSearch(e.target.value)}
                            placeholder="Filter A–Z / related..."
                            aria-label="Filter extracted data"
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSortAZ((prev) => !prev)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border whitespace-nowrap cursor-pointer ${
                            sortAZ
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          A–Z
                        </button>
                      </div>
                    </div>

                    {/* PDFs, Notes & Study Downloads */}
                    {filteredDocuments.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <h3 className="text-sm font-semibold text-slate-900">
                            PDFs, Study Notes &amp; Downloads ({filteredDocuments.length})
                          </h3>
                        </div>
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                          {filteredDocuments.map((doc, idx) => (
                            <div
                              key={`${doc.url}-${idx}`}
                              className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70"
                            >
                              <div className="min-w-0 space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-blue-700">
                                    {doc.fileType}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300">·</span>
                                  <p className="text-xs font-semibold text-slate-900 truncate">
                                    {doc.title}
                                  </p>
                                </div>
                                <p className="text-xs font-mono text-slate-400 truncate">
                                  {doc.url}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => void handleCopy(doc.url, `doc-${idx}`)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
                                >
                                  {copiedId === `doc-${idx}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  Link
                                </button>
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-blue-700 hover:bg-blue-50"
                                >
                                  <Download className="w-3 h-3" />
                                  Open
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Extracted Videos & Streams */}
                    {filteredVideos.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Film className="w-4 h-4 text-blue-600" />
                          <h3 className="text-sm font-semibold text-slate-900">
                            Extracted Videos &amp; Stream Links ({filteredVideos.length})
                          </h3>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {filteredVideos.map((vid, idx) => {
                            const vidKey = `${vid.videoUrl}-${idx}`;
                            const canPlayInline =
                              Boolean(vid.embedUrl) ||
                              vid.playableType === 'youtube-embed' ||
                              vid.playableType === 'hls' ||
                              vid.playableType === 'html5' ||
                              vid.playableType === 'iframe' ||
                              /\.(mp4|m3u8|webm|ogg|ogv|mov)(\?|$)/i.test(vid.videoUrl);
                            const isPlaying = Boolean(playingVideos[vidKey]);
                            return (
                              <div
                                key={vidKey}
                                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2.5"
                              >
                                <div className="flex flex-col sm:flex-row gap-3">
                                  {vid.thumbnail && (
                                    <img
                                      src={vid.thumbnail}
                                      alt={vid.title}
                                      referrerPolicy="no-referrer"
                                      className="w-full sm:w-36 h-20 object-cover rounded-md bg-slate-200 shrink-0"
                                    />
                                  )}
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                                        {vid.title}
                                      </p>
                                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                        {canPlayInline && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setPlayingVideos((prev) => ({
                                                ...prev,
                                                [vidKey]: !prev[vidKey],
                                              }))
                                            }
                                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                                              isPlaying
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                            }`}
                                          >
                                            <Play className="w-3 h-3" />
                                            {isPlaying ? 'Hide Player' : 'Play Stream'}
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => void handleCopy(vid.videoUrl, `vid-${idx}`)}
                                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        >
                                          {copiedId === `vid-${idx}` ? (
                                            <Check className="w-3 h-3 text-emerald-600" />
                                          ) : (
                                            <Copy className="w-3 h-3" />
                                          )}
                                          Stream URL
                                        </button>
                                        {vid.downloadable ? (
                                          <a
                                            href={vid.proxyStreamUrl || vid.videoUrl}
                                            download
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-emerald-700 hover:bg-emerald-50"
                                          >
                                            <Download className="w-3 h-3" />
                                            Download
                                          </a>
                                        ) : (
                                          <a
                                            href={vid.videoUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded-md text-blue-700 hover:bg-blue-50"
                                          >
                                            Open
                                            <ExternalLink className="w-3 h-3" />
                                          </a>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      {vid.streamFormat && (
                                        <span className="font-mono font-medium text-blue-700">
                                          {vid.streamFormat}
                                        </span>
                                      )}
                                      {vid.downloadable && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="text-emerald-700 font-medium">Direct Downloadable</span>
                                        </>
                                      )}
                                      {vid.channelName && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-medium text-slate-700">{vid.channelName}</span>
                                        </>
                                      )}
                                      {vid.duration && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-mono tabular-nums">{vid.duration}</span>
                                        </>
                                      )}
                                      {vid.views && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="tabular-nums">{vid.views}</span>
                                        </>
                                      )}
                                    </div>

                                    {vid.description && (
                                      <p className="text-xs text-slate-600 leading-relaxed">{vid.description}</p>
                                    )}

                                    <p className="text-xs font-mono text-slate-400 truncate">
                                      {vid.extractedFrom} · {vid.videoUrl}
                                    </p>
                                  </div>
                                </div>

                                {isPlaying && <UniversalVideoPlayer video={vid} />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Custom Mode Table */}
                    {extractResult.builderMode === 'custom' && extractResult.customItems.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Custom CSS Selector Results ({extractResult.customItems.length})
                        </h3>
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                {Object.keys(extractResult.customItems[0]).map((col) => (
                                  <th key={col} className="py-2 px-3 font-mono font-semibold text-slate-800">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {extractResult.customItems.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  {Object.values(row).map((val, j) => (
                                    <td key={j} className="py-2 px-3 text-slate-700 max-w-xs truncate">
                                      {val || '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Courses, Posts, Books & Cards */}
                    {filteredItems.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-600" />
                          <h3 className="text-sm font-semibold text-slate-900">
                            Courses, Posts, Books &amp; Items ({filteredItems.length})
                          </h3>
                        </div>
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                          {filteredItems.map((item, idx) => (
                            <div key={idx} className="p-3.5 flex items-start justify-between gap-4 hover:bg-slate-50/70">
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                                  {item.meta && (
                                    <span className="text-xs font-mono text-slate-500">{item.meta}</span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                                )}
                                {item.extractedFrom && (
                                  <p className="text-xs font-mono text-slate-400">
                                    From: {item.extractedFrom}
                                    {item.sourcePage ? ` · ${item.sourcePage}` : ''}
                                  </p>
                                )}
                              </div>
                              {item.url && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline shrink-0"
                                >
                                  Source
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tables */}
                    {extractResult.tables.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Extracted Tables &amp; Schedules ({extractResult.tables.length})
                        </h3>
                        {extractResult.tables.map((tbl, tIdx) => (
                          <div key={tIdx} className="border border-slate-200 rounded-lg overflow-x-auto">
                            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-800">
                              {tbl.caption}
                            </div>
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/50">
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

                    {/* Educational Article Sections */}
                    {filteredSections.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Article &amp; Syllabus Sections ({filteredSections.length})
                        </h3>
                        <div className="space-y-2.5">
                          {filteredSections.map((sec, idx) => (
                            <div key={idx} className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1">
                              <p className="text-xs font-semibold text-slate-900">{sec.heading}</p>
                              <p className="text-xs text-slate-600 leading-relaxed">{sec.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Links Summary */}
                    {filteredLinks.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-slate-500" />
                          <h3 className="text-sm font-semibold text-slate-900">
                            Extracted Links &amp; Origins ({filteredLinks.length})
                          </h3>
                        </div>
                        <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
                          {filteredLinks.map((lnk, idx) => (
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
              </>
            )}

            {/* F12 Network Trace Tab */}
            {outputTab === 'trace' && (
              <>
                {!extractResult ? (
                  <p className="text-sm text-slate-500">
                    Build an API first to inspect F12 Network headers, Fetch/XHR endpoints, discovered media streams, and redirect flows.
                  </p>
                ) : (
                  <NetworkInspector
                    trace={extractResult.backendTrace}
                    upstreamStatus={extractResult.status}
                  />
                )}
              </>
            )}

            {outputTab === 'json' && (
              <pre className="p-4 rounded-lg bg-[#0F172A] text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto max-h-[540px]">
                {jsonOutputString || 'Build an API first to inspect its JSON payload.'}
              </pre>
            )}

            {outputTab === 'code' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">CORS Enabled + OpenAPI 3.0 Spec: </span>
                    <span className="font-mono text-slate-600">{openApiUrl}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(openApiUrl, 'openapi-url')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    {copiedId === 'openapi-url' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copiedId === 'openapi-url' ? 'Copied Spec URL' : 'Copy OpenAPI URL'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                    {(
                      [
                        { id: 'external', label: 'Live External HTML Tester' },
                        { id: 'javascript', label: 'JS Fetch (GET/POST)' },
                        { id: 'python', label: 'Python' },
                        { id: 'curl', label: 'cURL' },
                        { id: 'express', label: 'Express Backend' },
                      ] as Array<{ id: CodeLang; label: string }>
                    ).map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setCodeLang(lang.id)}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          codeLang === lang.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                  {codeLang !== 'external' && (
                    <button
                      type="button"
                      onClick={() => void handleCopy(codeSnippets[codeLang], 'code')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                    >
                      {copiedId === 'code' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === 'code' ? 'Copied' : 'Copy Code'}
                    </button>
                  )}
                </div>

                {codeLang === 'external' ? (
                  <ExternalHtmlTester
                    origin={origin}
                    slug={cleanSlug}
                    targetUrl={url}
                    samplePayload={
                      extractResult
                        ? {
                            api: `/api/v1/${cleanSlug}`,
                            methodUsed: 'GET',
                            sourceUrl: extractResult.sourceUrl,
                            counts: {
                              videos: extractResult.videos.length,
                              documents: extractResult.documents.length,
                              items: extractResult.items.length,
                              links: extractResult.links.length,
                            },
                            videos: extractResult.videos.slice(0, 2),
                            documents: extractResult.documents.slice(0, 2),
                          }
                        : undefined
                    }
                  />
                ) : (
                  <pre className="p-4 rounded-lg bg-[#0F172A] text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto max-h-[460px]">
                    {codeSnippets[codeLang]}
                  </pre>
                )}
              </div>
            )}

            {outputTab === 'source' && (
              <div className="space-y-4">
                {extractResult ? (
                  <>
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <p className="font-semibold text-slate-900">Live Search Endpoint Detection</p>
                      {extractResult.searchForm ? (
                        <p className="text-slate-700 font-mono">
                          Detected GET search: {extractResult.searchForm.actionUrl}?{extractResult.searchForm.queryParam}=&lt;query&gt;
                        </p>
                      ) : (
                        <p className="text-slate-600">
                          Uses built-in full-text search across all extracted courses, videos, PDFs, articles, and links via <span className="font-mono">?q=</span>.
                        </p>
                      )}
                    </div>
                    <pre className="p-4 rounded-lg bg-[#0F172A] text-slate-200 text-xs font-mono leading-relaxed overflow-x-auto max-h-[420px]">
                      {extractResult.rawHtmlPreview}
                    </pre>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">Build an API first to inspect source HTML.</p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
