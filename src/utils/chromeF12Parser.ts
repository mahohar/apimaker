export interface ParsedChromeGeneral {
  url: string;
  method: 'GET' | 'POST';
  siteUrl: string;
}

export interface ParsedResponseSummary {
  isJson: boolean;
  topKeys: string[];
  arrayPaths: Array<{ path: string; length: number; sampleKeys: string[] }>;
  streamUrls: string[];
  documentUrls: string[];
  detectedPaginationKeys: string[];
}

export function unescapeShellToken(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

export function parseChromeHeadersBlock(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip Chrome DevTools HTTP/2 pseudo-headers (:authority, :method, :path, :scheme)
    if (line.startsWith(':')) {
      // If value is on next line (2-line copy), skip next line too if it has no colon or is URL/method/host
      if (!line.slice(1).includes(':') && i + 1 < lines.length && !lines[i + 1].includes(':')) {
        i += 1;
      }
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      if (val) {
        out[key] = val;
        continue;
      }
      // Key ended with ':' and value is on the next line
      if (i + 1 < lines.length) {
        out[key] = lines[i + 1].trim();
        i += 1;
      }
      continue;
    }

    // Alternating 2-line DevTools header copy: line i = header-name, line i+1 = header-value
    if (/^[a-zA-Z0-9_-]+$/.test(line) && i + 1 < lines.length) {
      out[line] = lines[i + 1].trim();
      i += 1;
    }
  }

  return out;
}

export function formatHeadersMap(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

export function parseChromeGeneralBlock(raw: string): Partial<ParsedChromeGeneral> {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  // Multiline or single-line Chrome "General" block:
  // Request URL: https://...  OR  Request URL:\nhttps://...
  const urlLineMatch = trimmed.match(/Request\s*URL\s*:\s*\r?\n?\s*(https?:\/\/[^\s]+)/i);
  const directUrlMatch = trimmed.match(/https?:\/\/[^\s'"]+/i);
  const url = urlLineMatch ? urlLineMatch[1].trim() : directUrlMatch ? directUrlMatch[0].trim() : '';

  const methodMatch = trimmed.match(/Request\s*Method\s*:\s*\r?\n?\s*(GET|POST|PUT|PATCH|DELETE)/i);
  const method: 'GET' | 'POST' = methodMatch && methodMatch[1].toUpperCase() === 'POST' ? 'POST' : 'GET';

  let siteUrl = '';
  if (url) {
    try {
      siteUrl = new URL(url).origin;
    } catch {
      siteUrl = '';
    }
  }

  return {
    ...(url ? { url } : {}),
    method,
    ...(siteUrl ? { siteUrl } : {}),
  };
}

export function parseChromePayloadBlock(raw: string): {
  bodyText: string;
  queryParam: string;
  sampleQuery: string;
  pageParam: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { bodyText: '', queryParam: '', sampleQuery: '', pageParam: '' };
  }

  // Already JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const detected = detectParamsFromUrlOrJson('', trimmed);
    return { bodyText: trimmed, ...detected };
  }

  // Form Data / Query Params lines (`key: value` or alternating lines)
  const kv = parseChromeHeadersBlock(trimmed);
  const entries = Object.entries(kv);
  if (entries.length > 0) {
    const jsonObj: Record<string, string> = {};
    for (const [k, v] of entries) {
      jsonObj[k] = v;
    }
    const bodyText = JSON.stringify(jsonObj, null, 2);
    const detected = detectParamsFromUrlOrJson('', bodyText);
    return { bodyText, ...detected };
  }

  return { bodyText: trimmed, queryParam: '', sampleQuery: '', pageParam: '' };
}

export function detectParamsFromUrlOrJson(rawUrl: string, bodyText: string): {
  queryParam: string;
  sampleQuery: string;
  pageParam: string;
} {
  const queryCandidates = [
    'q',
    'query',
    'search',
    'search_query',
    's',
    'k',
    'keyword',
    'keywords',
    'term',
    'filter',
    'title',
    'name',
  ];
  const pageCandidates = ['page', 'p', 'pg', 'paged', 'offset', 'start', 'cursor'];
  let queryParam = '';
  let sampleQuery = '';
  let pageParam = '';

  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      for (const k of queryCandidates) {
        const v = u.searchParams.get(k);
        if (v !== null) {
          queryParam = k;
          sampleQuery = v;
          break;
        }
      }
      if (!queryParam) {
        for (const [k, v] of u.searchParams.entries()) {
          if (!pageCandidates.includes(k.toLowerCase()) && v && v.length <= 80) {
            queryParam = k;
            sampleQuery = v;
            break;
          }
        }
      }
      for (const p of pageCandidates) {
        if (u.searchParams.has(p)) {
          pageParam = p;
          break;
        }
      }
    } catch {
      // ignore invalid URL
    }
  }

  if (bodyText && bodyText.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(bodyText) as Record<string, unknown>;
      if (!queryParam) {
        for (const k of queryCandidates) {
          if (k in parsed && typeof parsed[k] === 'string') {
            queryParam = k;
            sampleQuery = String(parsed[k]);
            break;
          }
        }
      }
      if (!pageParam) {
        for (const p of pageCandidates) {
          if (p in parsed) {
            pageParam = p;
            break;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return { queryParam, sampleQuery, pageParam };
}

export function parsePastedCurlOrFetch(rawSnippet: string): {
  url: string;
  method: 'GET' | 'POST';
  headersText: string;
  bodyText: string;
  siteUrl: string;
  kind: 'json-api' | 'html-search';
  queryParam: string;
  sampleQuery: string;
  pageParam: string;
} {
  const cleaned = rawSnippet.replace(/\\\r?\n/g, ' ').trim();

  // Case 1: Chrome "Copy as fetch"
  const fetchMatch = cleaned.match(/fetch\(\s*["']([^"']+)["']\s*(?:,\s*(\{[\s\S]*\}))?\s*\)/i);
  if (fetchMatch) {
    const url = fetchMatch[1];
    let method: 'GET' | 'POST' = 'GET';
    const headerLines: string[] = [];
    let bodyText = '';
    if (fetchMatch[2]) {
      try {
        const opts = JSON.parse(fetchMatch[2]) as {
          method?: string;
          headers?: Record<string, string>;
          body?: string;
        };
        if (opts.method?.toUpperCase() === 'POST') method = 'POST';
        if (opts.headers) {
          for (const [k, v] of Object.entries(opts.headers)) {
            headerLines.push(`${k}: ${v}`);
          }
        }
        if (typeof opts.body === 'string') bodyText = opts.body;
      } catch {
        const mMethod = fetchMatch[2].match(/["']method["']\s*:\s*["']([^"']+)["']/i);
        if (mMethod && mMethod[1].toUpperCase() === 'POST') method = 'POST';
      }
    }
    const { queryParam, sampleQuery, pageParam } = detectParamsFromUrlOrJson(url, bodyText);
    const headersObj = parseChromeHeadersBlock(headerLines.join('\n'));
    const siteUrl =
      headersObj.Referer || headersObj.referer || headersObj.Origin || headersObj.origin || (() => {
        try {
          return new URL(url).origin;
        } catch {
          return '';
        }
      })();
    const isJsonApi =
      /(api|graphql|wp-json|\.json|ajax|search)/i.test(url) ||
      method === 'POST' ||
      Object.values(headersObj).some((v) => v.toLowerCase().includes('json'));

    return {
      url,
      method,
      headersText: headerLines.join('\n'),
      bodyText,
      siteUrl,
      kind: isJsonApi ? 'json-api' : 'html-search',
      queryParam,
      sampleQuery,
      pageParam,
    };
  }

  // Case 2: Chrome "Copy as cURL" OR raw General block OR plain URL
  const generalParsed = parseChromeGeneralBlock(rawSnippet);
  const urlMatch = cleaned.match(/https?:\/\/[^\s'"]+/i);
  const url = generalParsed.url || (urlMatch ? urlMatch[0] : '');

  let method: 'GET' | 'POST' = generalParsed.method || 'GET';
  const methodFlag = cleaned.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i);
  if (methodFlag && methodFlag[1].toUpperCase() === 'POST') {
    method = 'POST';
  }

  const headerLines: string[] = [];
  const headerRegex = /(?:-H|--header)\s+(?:\$'([^']*)'|'([^']*)'|"([^"]*)")/g;
  let hm: RegExpExecArray | null;
  while ((hm = headerRegex.exec(cleaned)) !== null) {
    const rawH = unescapeShellToken(hm[1] || hm[2] || hm[3] || '');
    if (rawH && !rawH.toLowerCase().startsWith('sec-ch-ua')) {
      headerLines.push(rawH);
    }
  }

  const cookieMatch = cleaned.match(/(?:-b|--cookie)\s+(?:\$'([^']*)'|'([^']*)'|"([^"]*)")/);
  if (cookieMatch) {
    const cVal = unescapeShellToken(cookieMatch[1] || cookieMatch[2] || cookieMatch[3] || '');
    if (cVal) headerLines.push(`Cookie: ${cVal}`);
  }

  let bodyText = '';
  const dataMatch = cleaned.match(
    /(?:--data-raw|--data-binary|--data-urlencode|--data|-d)\s+(?:\$'((?:\\.|[^'])*)'|'([^']*)'|"((?:\\.|[^"])*)")/
  );
  if (dataMatch) {
    bodyText = unescapeShellToken(dataMatch[1] || dataMatch[2] || dataMatch[3] || '');
    method = 'POST';
  }

  const { queryParam, sampleQuery, pageParam } = detectParamsFromUrlOrJson(url, bodyText);
  const headersObj = parseChromeHeadersBlock(headerLines.join('\n'));
  const siteUrl =
    headersObj.Referer ||
    headersObj.referer ||
    headersObj.Origin ||
    headersObj.origin ||
    generalParsed.siteUrl ||
    '';

  const isJsonApi =
    /(api|graphql|wp-json|\.json|ajax|v1|v2)/i.test(url) ||
    method === 'POST' ||
    Object.values(headersObj).some((v) => v.toLowerCase().includes('json'));

  return {
    url,
    method,
    headersText: headerLines.join('\n'),
    bodyText,
    siteUrl,
    kind: isJsonApi ? 'json-api' : 'html-search',
    queryParam,
    sampleQuery,
    pageParam,
  };
}

export function analyzePastedResponsePreview(raw: string): ParsedResponseSummary | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const streamMatches = trimmed.match(
    /https?:\/\/[^\s"'\\<>]+\.(?:mp4|m3u8|webm|ogg|mov)(?:\?[^\s"'\\<>]*)?/gi
  );
  const docMatches = trimmed.match(
    /https?:\/\/[^\s"'\\<>]+\.(?:pdf|ppt|pptx|doc|docx|zip|xlsx)(?:\?[^\s"'\\<>]*)?/gi
  );

  const streamUrls = Array.from(new Set((streamMatches || []).map((u) => u.replace(/\\\//g, '/')))).slice(0, 20);
  const documentUrls = Array.from(new Set((docMatches || []).map((u) => u.replace(/\\\//g, '/')))).slice(0, 20);

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const topKeys =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? Object.keys(parsed as Record<string, unknown>).slice(0, 12)
          : ['[root array]'];
      const arrayPaths: ParsedResponseSummary['arrayPaths'] = [];
      const paginationKeys = new Set<string>();

      const walk = (node: unknown, path: string, depth: number) => {
        if (!node || typeof node !== 'object' || depth > 4) return;
        if (Array.isArray(node)) {
          const firstObj =
            node.length > 0 && node[0] && typeof node[0] === 'object' && !Array.isArray(node[0])
              ? Object.keys(node[0] as Record<string, unknown>).slice(0, 8)
              : [];
          arrayPaths.push({ path: path || 'root', length: node.length, sampleKeys: firstObj });
          return;
        }
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (/^(next|next_page|nextPage|nextUrl|total|totalPages|page|has_next|hasMore)$/i.test(k)) {
            paginationKeys.add(k);
          }
          if (v && typeof v === 'object') {
            walk(v, path ? `${path}.${k}` : k, depth + 1);
          }
        }
      };
      walk(parsed, '', 0);

      return {
        isJson: true,
        topKeys,
        arrayPaths: arrayPaths.slice(0, 6),
        streamUrls,
        documentUrls,
        detectedPaginationKeys: Array.from(paginationKeys),
      };
    } catch {
      // fall through
    }
  }

  return {
    isJson: false,
    topKeys: [],
    arrayPaths: [],
    streamUrls,
    documentUrls,
    detectedPaginationKeys: [],
  };
}
