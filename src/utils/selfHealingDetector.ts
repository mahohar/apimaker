export interface AutoDetectedMediaLink {
  label: string;
  url: string;
  quality: string;
  size: string;
  kind: 'stream' | 'download';
}

export interface AutoDetectedCard {
  title: string;
  description: string;
  poster: string;
  meta: Record<string, string>;
  links: AutoDetectedMediaLink[];
}

export interface AutoDetectedSummary {
  titles: string[];
  posters: string[];
  descriptions: string[];
  metadata: Record<string, string>;
  mediaLinks: AutoDetectedMediaLink[];
  cards: AutoDetectedCard[];
  detectedKeys: string[];
}

function resolveMaybeRelativeUrl(raw: string, sourceOrigin?: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (sourceOrigin && (s.startsWith('/') || /\.(jpg|jpeg|png|webp|gif|avif|mp4|m3u8|mkv|pdf|zip)(\?|$)/i.test(s))) {
    try {
      return new URL(s, sourceOrigin).toString();
    } catch {
      return s;
    }
  }
  return s;
}

function isImageUrl(url: string, key = ''): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (/\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/i.test(url)) return true;
  if (/image\.tmdb\.org\/t\/p\//i.test(url)) return true;
  if (/poster|backdrop|thumb|avatar|cover|image/i.test(key) && !/\.(mp4|m3u8|mkv|zip|pdf)(\?|$)/i.test(url)) {
    return true;
  }
  return false;
}

function isMediaOrDownloadUrl(url: string, key = ''): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (isImageUrl(url, key)) return false;
  if (/(\/dl\/|workers\.dev|\.mkv|\.mp4|\.m3u8|\.webm|\.mov|\.pdf|\.zip|\.rar)/i.test(url)) {
    return true;
  }
  return /(url|link|stream|dl|file|src|download|mirror|watch|embed)/i.test(key);
}

function extractQualityAndSize(contextText: string, obj?: Record<string, unknown>): {
  quality: string;
  size: string;
} {
  const qualityRaw =
    (obj && typeof obj.quality === 'string' && obj.quality) ||
    (obj && typeof obj.res === 'string' && obj.res) ||
    (obj && typeof obj.resolution === 'string' && obj.resolution) ||
    '';
  const sizeRaw =
    (obj && typeof obj.size === 'string' && obj.size) ||
    (obj && typeof obj.file_size === 'string' && obj.file_size) ||
    (obj && typeof obj.filesize === 'string' && obj.filesize) ||
    '';

  const qMatch = (qualityRaw || contextText).match(/\b(2160p|4k|1080p|720p|480p|360p|hd|fhd|uhd)\b/i);
  const sMatch = (sizeRaw || contextText).match(/\b(\d+(?:\.\d+)?\s*(?:TB|GB|MB|KB))\b/i);

  return {
    quality: qualityRaw || (qMatch ? qMatch[1].toUpperCase() : ''),
    size: sizeRaw || (sMatch ? sMatch[1] : ''),
  };
}

export function detectJsonSchemaRecursively(
  json: unknown,
  sourceOrigin?: string
): AutoDetectedSummary {
  const titles: string[] = [];
  const posters: string[] = [];
  const descriptions: string[] = [];
  const metadata: Record<string, string> = {};
  const mediaLinks: AutoDetectedMediaLink[] = [];
  const cards: AutoDetectedCard[] = [];
  const detectedKeysSet = new Set<string>();

  const seenTitles = new Set<string>();
  const seenPosters = new Set<string>();
  const seenLinks = new Set<string>();

  const walk = (
    node: unknown,
    currentKey = '',
    contextTitle = '',
    parentObj?: Record<string, unknown>
  ): void => {
    if (node === null || node === undefined) return;

    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item, currentKey, contextTitle, parentObj);
      }
      return;
    }

    if (typeof node === 'string' || typeof node === 'number') {
      const rawStr = String(node).trim();
      if (!rawStr) return;

      const resolvedUrl =
        typeof node === 'string' ? resolveMaybeRelativeUrl(rawStr, sourceOrigin) : rawStr;

      if (typeof node === 'string' && /^https?:\/\//i.test(resolvedUrl)) {
        if (isImageUrl(resolvedUrl, currentKey)) {
          if (!seenPosters.has(resolvedUrl)) {
            seenPosters.add(resolvedUrl);
            posters.push(resolvedUrl);
          }
        } else if (isMediaOrDownloadUrl(resolvedUrl, currentKey)) {
          if (!seenLinks.has(resolvedUrl)) {
            seenLinks.add(resolvedUrl);
            const { quality, size } = extractQualityAndSize(`${contextTitle} ${resolvedUrl}`, parentObj);
            const isStream = /\.(mp4|m3u8|webm|mov)(\?|$)/i.test(resolvedUrl) || /stream|watch|embed/i.test(currentKey);
            mediaLinks.push({
              label:
                (parentObj && typeof parentObj.label === 'string' && parentObj.label) ||
                (parentObj && typeof parentObj.server === 'string' && parentObj.server) ||
                contextTitle ||
                currentKey ||
                'Media Link',
              url: resolvedUrl,
              quality,
              size,
              kind: isStream ? 'stream' : 'download',
            });
          }
        }
        return;
      }

      if (/title|name|movie|show|course|heading|headline|label/i.test(currentKey) && rawStr.length >= 2 && rawStr.length <= 220) {
        if (!seenTitles.has(rawStr)) {
          seenTitles.add(rawStr);
          titles.push(rawStr);
        }
      } else if (/desc|overview|plot|summary|synopsis/i.test(currentKey) && rawStr.length >= 10) {
        if (!descriptions.includes(rawStr)) {
          descriptions.push(rawStr);
        }
      } else if (/year|date|rating|duration|season|episode|language|genre|category|imdb/i.test(currentKey) && rawStr.length <= 80) {
        if (!metadata[currentKey]) {
          metadata[currentKey] = rawStr;
        }
      }
      return;
    }

    if (typeof node === 'object') {
      const rec = node as Record<string, unknown>;
      let localTitle = contextTitle;
      let localDesc = '';
      let localPoster = '';
      const localMeta: Record<string, string> = {};
      const localLinks: AutoDetectedMediaLink[] = [];

      for (const [k, v] of Object.entries(rec)) {
        detectedKeysSet.add(k);
        if (typeof v === 'string' || typeof v === 'number') {
          const valStr = String(v).trim();
          if (!valStr) continue;
          const resolved = typeof v === 'string' ? resolveMaybeRelativeUrl(valStr, sourceOrigin) : valStr;
          if (/title|name|movie|show|course|heading|headline|label/i.test(k) && !localTitle) {
            localTitle = valStr;
          } else if (/desc|overview|plot|summary|synopsis/i.test(k) && !localDesc) {
            localDesc = valStr;
          } else if (/year|date|rating|duration|season|episode|language|genre|quality|size/i.test(k)) {
            localMeta[k] = valStr;
          } else if (typeof v === 'string' && isImageUrl(resolved, k) && !localPoster) {
            localPoster = resolved;
          } else if (typeof v === 'string' && isMediaOrDownloadUrl(resolved, k)) {
            const { quality, size } = extractQualityAndSize(`${localTitle} ${resolved}`, rec);
            const isStream = /\.(mp4|m3u8|webm|mov)(\?|$)/i.test(resolved) || /stream|watch|embed/i.test(k);
            localLinks.push({
              label:
                (typeof rec.label === 'string' && rec.label) ||
                (typeof rec.server === 'string' && rec.server) ||
                localTitle ||
                k,
              url: resolved,
              quality,
              size,
              kind: isStream ? 'stream' : 'download',
            });
          }
        }
      }

      if (localTitle && (localLinks.length > 0 || localPoster || localDesc)) {
        cards.push({
          title: localTitle,
          description: localDesc,
          poster: localPoster,
          meta: localMeta,
          links: localLinks,
        });
      }

      for (const [k, v] of Object.entries(rec)) {
        walk(v, k, localTitle || contextTitle, rec);
      }
    }
  };

  walk(json);

  return {
    titles,
    posters,
    descriptions,
    metadata,
    mediaLinks,
    cards,
    detectedKeys: Array.from(detectedKeysSet).slice(0, 40),
  };
}

export function buildAutoDetectingIndexHtml(
  apiBaseUrl: string,
  defaultInputValue: string,
  sourceOrigin?: string
): string {
  const safeApiBase = apiBaseUrl || 'https://MY-DOMAIN.com/api.php';
  const safeDefault = defaultInputValue || '';
  const safeOrigin = sourceOrigin || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Self-Healing Universal API Viewer</title>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; background: #0f172a; color: #f8fafc; padding: 20px; }
    .container { max-width: 1120px; margin: 0 auto; }
    .bar { display: flex; gap: 10px; flex-wrap: wrap; background: #1e293b; padding: 14px; border-radius: 12px; border: 1px solid #334155; }
    select, input { padding: 10px 12px; border-radius: 8px; border: 1px solid #475569; background: #0f172a; color: #f8fafc; font-size: 13px; }
    input { flex: 1; min-width: 220px; }
    button { padding: 10px 18px; border-radius: 8px; border: none; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
    button.secondary { background: #334155; }
    button:hover { opacity: 0.92; }
    .status { font-size: 12px; color: #94a3b8; margin: 12px 0; font-family: monospace; word-break: break-all; }
    .hero { display: grid; grid-template-columns: 180px 1fr; gap: 18px; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 18px; }
    .hero img { width: 100%; border-radius: 8px; object-fit: cover; background: #0f172a; }
    .meta-line { font-size: 12px; color: #94a3b8; margin-top: 8px; font-family: monospace; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
    .card-meta { font-size: 11px; color: #94a3b8; font-family: monospace; }
    .btn-link { display: inline-flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-radius: 8px; background: #2563eb; color: #fff; text-decoration: none; font-size: 12px; font-weight: 600; }
    video { width: 100%; max-height: 280px; border-radius: 8px; background: #000; margin-top: 6px; }
    @media (max-width: 640px) { .hero { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <h2>Self-Healing Universal API Viewer (Auto-Detects Any JSON Depth)</h2>
    <div class="bar">
      <select id="modeSelect">
        <option value="auto">Auto Detect (Search / ID / URL)</option>
        <option value="q">Search (?q=)</option>
        <option value="id">Item ID (?id=)</option>
        <option value="url">Full Link (?url=)</option>
        <option value="latest">Latest (?action=latest)</option>
      </select>
      <input id="queryInput" type="text" value="${safeDefault.replace(/"/g, '&quot;')}" placeholder="Enter search keyword, ID, or target URL (leave blank for Demo Fallback)" />
      <button onclick="loadUniversalApi()">Fetch &amp; Auto-Detect</button>
      <button class="secondary" onclick="loadDemoFallback()">Demo Fallback</button>
    </div>
    <div id="status" class="status">API Base: ${safeApiBase}</div>
    <div id="viewer"></div>
  </div>

  <script>
    const API_BASE = ${JSON.stringify(safeApiBase)};
    const SOURCE_ORIGIN = ${JSON.stringify(safeOrigin)};

    function esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function absUrl(u) {
      const s = String(u ?? '').trim();
      if (!s) return '';
      if (/^https?:\\/\\//i.test(s)) return s;
      if (s.startsWith('//')) return 'https:' + s;
      if (SOURCE_ORIGIN && s.startsWith('/')) {
        try { return new URL(s, SOURCE_ORIGIN).toString(); } catch {}
      }
      return s;
    }
    function isImg(u, k) {
      return /^https?:\\/\\//i.test(u) && (/\\.(jpg|jpeg|png|webp|gif|avif)(\\?|$)/i.test(u) || /image\\.tmdb\\.org/i.test(u) || (/poster|backdrop|thumb|image|cover/i.test(k) && !/\\.(mp4|m3u8|mkv)/i.test(u)));
    }
    function isMedia(u, k) {
      return /^https?:\\/\\//i.test(u) && !isImg(u, k) && (/(\\/dl\\/|workers\\.dev|\\.(mkv|mp4|m3u8|webm|pdf|zip))/i.test(u) || /url|link|stream|dl|file|src|download/i.test(k));
    }

    // Recursive Tree Scanner (Rule 5: Zero hardcoded field names)
    function autoDetectTree(node, key, titleCtx, parentObj, out) {
      if (node == null) return;
      if (Array.isArray(node)) {
        node.forEach((item) => autoDetectTree(item, key, titleCtx, parentObj, out));
        return;
      }
      if (typeof node === "string" || typeof node === "number") {
        const raw = String(node).trim();
        if (!raw) return;
        const resolved = typeof node === "string" ? absUrl(raw) : raw;
        if (typeof node === "string" && /^https?:\\/\\//i.test(resolved)) {
          if (isImg(resolved, key) && !out.posters.includes(resolved)) out.posters.push(resolved);
          else if (isMedia(resolved, key) && !out.links.some((l) => l.url === resolved)) {
            const ctx = (titleCtx + " " + resolved);
            const q = (parentObj && (parentObj.quality || parentObj.res)) || (ctx.match(/\\b(2160p|4k|1080p|720p|480p|360p)\\b/i) || [])[1] || "";
            const sz = (parentObj && (parentObj.size || parentObj.file_size)) || (ctx.match(/\\b(\\d+(?:\\.\\d+)?\\s*(?:GB|MB|KB))\\b/i) || [])[1] || "";
            out.links.push({
              label: (parentObj && (parentObj.label || parentObj.server)) || titleCtx || key || "Download / Stream",
              url: resolved,
              quality: String(q).toUpperCase(),
              size: String(sz)
            });
          }
          return;
        }
        if (/title|name|headline|movie|show|course/i.test(key) && raw.length > 1 && !out.titles.includes(raw)) out.titles.push(raw);
        else if (/desc|overview|plot|summary/i.test(key) && raw.length > 10 && !out.descriptions.includes(raw)) out.descriptions.push(raw);
        else if (/year|date|rating|duration|season|episode|language/i.test(key) && !out.meta[key]) out.meta[key] = raw;
        return;
      }
      if (typeof node === "object") {
        let localTitle = titleCtx;
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === "string" && /title|name|headline|movie|show/i.test(k)) { localTitle = v; break; }
        }
        for (const [k, v] of Object.entries(node)) {
          autoDetectTree(v, k, localTitle, node, out);
        }
      }
    }

    function loadDemoFallback() {
      document.getElementById("queryInput").value = "";
      loadUniversalApi();
    }

    async function loadUniversalApi() {
      const mode = document.getElementById("modeSelect").value;
      const val = document.getElementById("queryInput").value.trim();
      const statusEl = document.getElementById("status");
      const viewerEl = document.getElementById("viewer");
      viewerEl.innerHTML = "";

      let queryStr = "";
      if (mode === "latest") queryStr = "action=latest";
      else if (mode === "url" || (mode === "auto" && /^https?:\\/\\//i.test(val))) queryStr = "url=" + encodeURIComponent(val);
      else if (mode === "id" || (mode === "auto" && /^\\d{2,}$/.test(val))) queryStr = "id=" + encodeURIComponent(val);
      else if (val) queryStr = "q=" + encodeURIComponent(val);

      const callUrl = queryStr ? (API_BASE + (API_BASE.includes("?") ? "&" : "?") + queryStr) : API_BASE;
      statusEl.textContent = "Calling: " + callUrl;

      try {
        const res = await fetch(callUrl);
        const raw = await res.text();
        if (raw.trimStart().startsWith("<")) {
          throw new Error("Server returned HTML instead of JSON (HTTP " + res.status + ")");
        }
        const json = JSON.parse(raw);
        const detected = { titles: [], posters: [], descriptions: [], meta: {}, links: [] };
        autoDetectTree(json, "", "", null, detected);

        statusEl.textContent = "OK · " + detected.titles.length + " title(s) · " + detected.posters.length + " image(s) · " + detected.links.length + " stream/download link(s)";

        const metaLine = Object.entries(detected.meta).map(([k, v]) => esc(k) + ": " + esc(v)).join(" · ");
        const heroHtml = '<div class="hero">' +
          (detected.posters[0] ? '<img src="' + esc(detected.posters[0]) + '" alt="Poster" />' : '<div></div>') +
          '<div><h3 style="margin:0 0 8px 0">' + esc(detected.titles[0] || "Detected API Response") + '</h3>' +
          (detected.descriptions[0] ? '<p style="font-size:13px;color:#cbd5e1">' + esc(detected.descriptions[0]) + '</p>' : '') +
          (metaLine ? '<div class="meta-line">' + metaLine + '</div>' : '') +
          '</div></div>';

        const cardsHtml = '<div class="grid">' + detected.links.map((lnk, i) => {
          const isVideo = /\\.(mp4|m3u8|webm)(\\?|$)/i.test(lnk.url);
          const tag = [lnk.quality, lnk.size].filter(Boolean).join(" · ") || "Direct";
          return '<div class="card"><strong>' + esc(lnk.label) + '</strong><span class="card-meta">' + esc(tag) + '</span>' +
            (isVideo ? '<video id="vid-' + i + '" controls src="' + esc(lnk.url) + '"></video>' : '') +
            '<a class="btn-link" href="' + esc(lnk.url) + '" target="_blank" rel="noopener noreferrer">Open / Download ↗</a></div>';
        }).join("") + '</div>';

        viewerEl.innerHTML = heroHtml + cardsHtml;
      } catch (err) {
        statusEl.textContent = "Error: " + err.message;
      }
    }
    loadUniversalApi();
  </script>
</body>
</html>`;
}
