import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Play, RotateCcw } from 'lucide-react';

interface ExternalHtmlTesterProps {
  origin: string;
  slug: string;
  targetUrl: string;
  samplePayload?: unknown;
}

function buildStarterHtml(origin: string, slug: string): string {
  const endpoint = `${origin}/api/v1/${slug}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>External Website API Consumer</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; color: #0f172a; background: #f8fafc; }
    .bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    input, select, button { padding: 8px 10px; border-radius: 6px; border: 1px solid #cbd5e1; font-size: 13px; }
    button { background: #2563eb; color: #fff; border: none; cursor: pointer; font-weight: 600; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .meta { font-size: 12px; color: #475569; margin: 4px 0; }
    iframe, video { width: 100%; max-height: 240px; border-radius: 6px; margin-top: 8px; background: #000; border: 0; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script>
</head>
<body>
  <div class="bar">
    <input id="q" type="text" placeholder="Search topic (e.g. dbms, python, pdf)..." style="flex:1; min-width:180px;" />
    <select id="method">
      <option value="GET">GET ?q=...&limit=all</option>
      <option value="POST">POST JSON Body</option>
    </select>
    <button onclick="loadApi()">Fetch API</button>
  </div>
  <div id="status" class="meta">Ready to call ${endpoint}</div>
  <div id="results"></div>

  <script>
    const ENDPOINT = "${endpoint}";

    async function loadApi() {
      const q = document.getElementById("q").value.trim();
      const method = document.getElementById("method").value;
      const statusEl = document.getElementById("status");
      const outEl = document.getElementById("results");
      statusEl.textContent = "Fetching via " + method + "...";
      outEl.innerHTML = "";

      try {
        let res;
        if (method === "POST") {
          res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: q || undefined, limit: "all" })
          });
        } else {
          const params = new URLSearchParams({ limit: "all" });
          if (q) params.set("q", q);
          res = await fetch(ENDPOINT + "?" + params.toString());
        }
        const rawText = await res.text();
        if (rawText.trimStart().startsWith("<")) {
          throw new Error("Server returned HTML instead of JSON (HTTP " + res.status + "). Ensure the endpoint URL is reachable.");
        }
        const data = JSON.parse(rawText);
        if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));

        statusEl.textContent = "HTTP " + res.status + " · " + data.counts.videos + " videos · " + data.counts.documents + " PDFs/notes · " + data.counts.items + " items";

        data.videos.forEach((v, idx) => {
          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = "<strong>" + v.title + "</strong><div class='meta'>" + (v.streamFormat || "Video") + " · " + v.videoUrl + "</div>";
          if (v.playableType === "youtube-embed" && v.embedUrl) {
            card.innerHTML += "<iframe src='" + v.embedUrl + "' allowfullscreen></iframe>";
          } else if (v.playableType === "hls" || /\\.m3u8/i.test(v.videoUrl)) {
            const vid = document.createElement("video");
            vid.controls = true;
            vid.id = "hls-" + idx;
            card.appendChild(vid);
            setTimeout(() => {
              const streamUrl = v.proxyStreamUrl ? ("${origin}" + v.proxyStreamUrl) : v.videoUrl;
              if (window.Hls && Hls.isSupported()) {
                const hls = new Hls();
                hls.loadSource(streamUrl);
                hls.attachMedia(vid);
              } else {
                vid.src = streamUrl;
              }
            }, 0);
          } else if (v.playableType === "html5") {
            const src = v.proxyStreamUrl ? ("${origin}" + v.proxyStreamUrl) : v.videoUrl;
            card.innerHTML += "<video controls src='" + src + "'></video>";
          }
          outEl.appendChild(card);
        });

        data.documents.forEach((d) => {
          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = "<strong>[" + d.fileType + "] " + d.title + "</strong><div class='meta'><a href='" + d.url + "' target='_blank'>" + d.url + "</a></div>";
          outEl.appendChild(card);
        });
      } catch (err) {
        statusEl.textContent = "Error: " + err.message;
      }
    }
    loadApi();
  </script>
</body>
</html>`;
}

export function ExternalHtmlTester({
  origin,
  slug,
  targetUrl,
  samplePayload,
}: ExternalHtmlTesterProps) {
  const starterHtml = useMemo(() => buildStarterHtml(origin, slug), [origin, slug]);
  const [htmlCode, setHtmlCode] = useState(starterHtml);
  const [previewSrcDoc, setPreviewSrcDoc] = useState(starterHtml);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setHtmlCode(starterHtml);
    setPreviewSrcDoc(starterHtml);
  }, [starterHtml]);

  const endpointBase = `${origin}/api/v1/${slug}`;
  const extractApiUrl = `${origin}/api/v1/extract?url=${encodeURIComponent(
    targetUrl || 'https://example.edu'
  )}&limit=all`;

  const sampleJsonText = useMemo(() => {
    if (samplePayload) {
      return JSON.stringify(samplePayload, null, 2);
    }
    return JSON.stringify(
      {
        api: `/api/v1/${slug}`,
        methodUsed: 'GET',
        acceptedParams: ['q', 'query', 'search', 'keyword', 'url', 'type', 'limit', 'sort'],
        query: 'dbms',
        limitApplied: 'unlimited',
        counts: { videos: 2, documents: 1, items: 4, links: 12 },
        videos: [
          {
            title: 'DBMS Complete Lecture Series',
            videoUrl: 'https://www.youtube.com/watch?v=example123',
            embedUrl: 'https://www.youtube.com/embed/example123',
            playableType: 'youtube-embed',
            streamFormat: 'YouTube',
          },
        ],
        documents: [
          {
            title: 'Unit 1 DBMS Handwritten Notes',
            url: 'https://example.edu/notes/dbms-unit1.pdf',
            fileType: 'PDF',
          },
        ],
      },
      null,
      2
    );
  }, [samplePayload, slug]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-5">
      {/* Exact Working Request Format Guide */}
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-slate-900">
            Exact Working Request Formats (Use your live server domain, not placeholder domains)
          </p>
          <span className="font-mono text-emerald-700">CORS: GET, POST, OPTIONS (*)</span>
        </div>

        <div className="space-y-2 font-mono">
          <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-md">
            <span className="text-slate-800 truncate">
              <strong className="text-emerald-700">GET</strong> {endpointBase}?q=dbms&amp;limit=all
            </span>
            <button
              type="button"
              onClick={() => void handleCopy(`${endpointBase}?q=dbms&limit=all`, 'req-get-q')}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-600 hover:text-slate-900 shrink-0 cursor-pointer"
            >
              {copiedId === 'req-get-q' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              Copy
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-md">
            <span className="text-slate-800 truncate">
              <strong className="text-emerald-700">GET</strong> {endpointBase}?query=python&amp;type=videos&amp;limit=all
            </span>
            <button
              type="button"
              onClick={() =>
                void handleCopy(`${endpointBase}?query=python&type=videos&limit=all`, 'req-get-query')
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-600 hover:text-slate-900 shrink-0 cursor-pointer"
            >
              {copiedId === 'req-get-query' ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-md">
            <span className="text-slate-800 truncate">
              <strong className="text-emerald-700">GET</strong> {extractApiUrl}
            </span>
            <button
              type="button"
              onClick={() => void handleCopy(extractApiUrl, 'req-extract')}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-600 hover:text-slate-900 shrink-0 cursor-pointer"
            >
              {copiedId === 'req-extract' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              Copy
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-md">
            <span className="text-slate-800 truncate">
              <strong className="text-emerald-700">GET</strong> {endpointBase}?q=dbms&amp;format=universal
            </span>
            <button
              type="button"
              onClick={() =>
                void handleCopy(`${endpointBase}?q=dbms&format=universal`, 'req-universal')
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-600 hover:text-slate-900 shrink-0 cursor-pointer"
            >
              {copiedId === 'req-universal' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              Copy
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 p-2 bg-white border border-slate-200 rounded-md">
            <span className="text-slate-800 truncate">
              <strong className="text-blue-700">POST</strong> {endpointBase}{' '}
              {`{"q": "dbms", "limit": "all", "type": "all"}`}
            </span>
            <button
              type="button"
              onClick={() =>
                void handleCopy(
                  `fetch("${endpointBase}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ q: "dbms", limit: "all" })\n}).then(async r => {\n  const t = await r.text();\n  if (t.trimStart().startsWith("<")) throw new Error("HTML returned instead of JSON");\n  return JSON.parse(t);\n})`,
                  'req-post'
                )
              }
              className="inline-flex items-center gap-1 px-2 py-0.5 text-slate-600 hover:text-slate-900 shrink-0 cursor-pointer"
            >
              {copiedId === 'req-post' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Live External HTML Website Sandbox */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-900">
              Live External Website Sandbox (Calls {endpointBase})
            </p>
            <p className="text-[11px] text-slate-500">
              Edit HTML/JS below and click Run External Page to demonstrate live cross-origin API calls, search, and video playback.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setHtmlCode(starterHtml);
                setPreviewSrcDoc(starterHtml);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => void handleCopy(htmlCode, 'full-html')}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              {copiedId === 'full-html' ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy HTML
            </button>
            <button
              type="button"
              onClick={() => setPreviewSrcDoc(htmlCode)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
            >
              <Play className="w-3 h-3" />
              Run External Page
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-200">
          <textarea
            value={htmlCode}
            onChange={(e) => setHtmlCode(e.target.value)}
            rows={14}
            aria-label="External HTML test code"
            className="w-full p-3 text-xs font-mono bg-[#0F172A] text-slate-100 focus:outline-none resize-y"
          />
          <iframe
            title="External Website Live Preview"
            srcDoc={previewSrcDoc}
            sandbox="allow-scripts allow-popups allow-forms"
            className="w-full h-[320px] xl:h-auto min-h-[320px] bg-white"
          />
        </div>
      </div>

      {/* Sample JSON Output */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-900">Sample JSON Response</p>
          <button
            type="button"
            onClick={() => void handleCopy(sampleJsonText, 'sample-json')}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 cursor-pointer"
          >
            {copiedId === 'sample-json' ? (
              <Check className="w-3 h-3 text-emerald-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            Copy Sample JSON
          </button>
        </div>
        <pre className="p-3.5 rounded-lg bg-[#0F172A] text-slate-100 text-xs font-mono leading-relaxed overflow-x-auto max-h-56">
          {sampleJsonText}
        </pre>
      </div>
    </div>
  );
}
