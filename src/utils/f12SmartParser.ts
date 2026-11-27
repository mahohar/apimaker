import type { DynamicVariableSpec } from '../types/api';

export interface SmartF12ParseResult {
  url: string;
  baseUrl: string;
  staticUrlTemplate: string;
  method: 'GET' | 'POST';
  kind: 'json-api' | 'html-search';
  siteUrl: string;
  essentialHeaders: Record<string, string>;
  authToken: string;
  strippedNoiseCount: number;
  responseHeaders: Record<string, string>;
  corsAllowed: string | null;
  responseContentType: string | null;
  proxyRequired: boolean;
  queryParam: string;
  idParam: string;
  pageParam: string;
  timestampParam: string;
  sampleQuery: string;
  sampleId: string;
  samplePage: string;
  postBody: string;
  staticPostTemplate: string;
  dynamicVariables: DynamicVariableSpec[];
  responseJsonText: string;
  parsedJson: unknown | null;
}

const ESSENTIAL_HEADER_KEYS = new Set([
  'origin',
  'referer',
  'user-agent',
  'accept',
  'content-type',
  'authorization',
  'x-requested-with',
  'x-api-key',
]);

const NOISE_KEYS = new Set([
  'remote address',
  'status code',
  'referrer policy',
  ':authority',
  ':method',
  ':path',
  ':scheme',
  'priority',
  'accept-encoding',
  'accept-language',
  'cf-ray',
  'cf-cache-status',
  'nel',
  'report-to',
  'server-timing',
  'alt-svc',
  'set-cookie',
  'cookie',
  'host',
  'content-length',
  'connection',
  'cache-control',
  'pragma',
  'upgrade-insecure-requests',
  'dnt',
  'te',
]);

function isNoiseKey(lowerKey: string): boolean {
  if (NOISE_KEYS.has(lowerKey)) return true;
  if (lowerKey.startsWith(':')) return true;
  if (lowerKey.startsWith('sec-ch-ua')) return true;
  if (lowerKey.startsWith('sec-fetch-')) return true;
  if (lowerKey.startsWith('x-koyeb-')) return true;
  if (lowerKey.startsWith('cf-')) return true;
  return false;
}

function normalizeHeaderName(lower: string): string {
  return lower
    .split('-')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join('-');
}

function unescapeShellToken(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function tryExtractJsonSubstring(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }
  }
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');
  const starts = [firstBrace, firstBracket].filter((i) => i >= 0).sort((a, b) => a - b);
  for (const start of starts) {
    const openChar = trimmed[start];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === openChar) depth += 1;
      if (ch === closeChar) {
        depth -= 1;
        if (depth === 0) {
          const candidate = trimmed.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}

const QUERY_KEYS = ['q', 'query', 'search', 'search_query', 's', 'k', 'keyword', 'keywords', 'term', 'filter', 'cat', 'category'];
const ID_KEYS = ['id', 'tmdb_id', 'imdb_id', 'movie_id', 'video_id', 'item_id', 'slug', 'post_id'];
const PAGE_KEYS = ['page', 'p', 'pg', 'paged', 'offset', 'start'];
const TIMESTAMP_KEYS = ['t', 'ts', 'timestamp', '_'];

function isUnixTimestampValue(key: string, val: string): boolean {
  if (/^\d{10}$/.test(val) || /^\d{13}$/.test(val)) {
    return TIMESTAMP_KEYS.includes(key.toLowerCase()) || Number(val) >= 1_500_000_000;
  }
  return false;
}

function splitUrlAndBodyIntoTwoParts(
  rawUrl: string,
  bodyText: string
): {
  staticUrlTemplate: string;
  baseUrl: string;
  queryParam: string;
  idParam: string;
  pageParam: string;
  timestampParam: string;
  sampleQuery: string;
  sampleId: string;
  samplePage: string;
  staticPostTemplate: string;
  dynamicVariables: DynamicVariableSpec[];
} {
  let staticUrlTemplate = rawUrl;
  let baseUrl = rawUrl;
  let queryParam = '';
  let idParam = '';
  let pageParam = '';
  let timestampParam = '';
  let sampleQuery = '';
  let sampleId = '';
  let samplePage = '';
  let staticPostTemplate = bodyText;
  const dynamicVariables: DynamicVariableSpec[] = [];

  if (rawUrl) {
    try {
      const u = new URL(rawUrl);
      const rawSegments = u.pathname.split('/');
      const templateSegments = [...rawSegments];
      const baseSegments = [...rawSegments];

      // Path segment dynamic detection: e.g. /api/id/308007 -> /api/id/{id}, or /movie/12345 -> /movie/{id}, or /item/my-slug -> /item/{slug}
      for (let i = 1; i < rawSegments.length; i++) {
        const seg = decodeURIComponent(rawSegments[i] || '');
        const prevSeg = (rawSegments[i - 1] || '').toLowerCase();
        if (!seg) continue;

        const isIdIndicatorPrev = /^(id|movie|movies|show|shows|item|items|post|posts|video|videos|course|courses|detail|details|title|episode|user|track)$/i.test(prevSeg);
        const isNumericSeg = /^\d{2,}$/.test(seg) && !/^v?\d$/.test(seg);
        const isSlugSeg =
          i === rawSegments.length - 1 &&
          isIdIndicatorPrev &&
          !/\.(json|php|html|htm|aspx|jsp)$/i.test(seg) &&
          seg.length >= 2;
        const isCompositeIdSeg =
          prevSeg === 'id' || (/^\d+$/.test(seg) && seg.length >= 2);

        if (isCompositeIdSeg || isNumericSeg || isSlugSeg) {
          const varName = prevSeg === 'slug' ? 'slug' : 'id';
          templateSegments[i] = `{${varName}}`;
          if (!idParam) idParam = varName;
          if (!sampleId) sampleId = seg;
          dynamicVariables.push({
            name: varName,
            location: 'path',
            placeholder: `{${varName}}`,
            demoValue: seg,
          });
          // Keep clean path up to parent segment for baseUrl if trailing
          if (i === rawSegments.length - 1) {
            baseSegments[i] = '';
          }
          break;
        }
      }

      const templateQueryParts: string[] = [];
      const cleanBaseUrlObj = new URL(u.origin + (baseSegments.join('/').replace(/\/+$/, '') || '/'));

      for (const [k, v] of u.searchParams.entries()) {
        const lk = k.toLowerCase();
        if (isUnixTimestampValue(lk, v)) {
          timestampParam = k;
          templateQueryParts.push(`${encodeURIComponent(k)}={timestamp}`);
          dynamicVariables.push({
            name: k,
            location: 'timestamp',
            placeholder: '{timestamp}',
            demoValue: 'time() dynamic Unix timestamp',
          });
        } else if (PAGE_KEYS.includes(lk)) {
          pageParam = k;
          samplePage = v;
          templateQueryParts.push(`${encodeURIComponent(k)}={page}`);
          dynamicVariables.push({
            name: 'page',
            location: 'query',
            placeholder: '{page}',
            demoValue: v || '1',
          });
        } else if (ID_KEYS.includes(lk)) {
          idParam = k;
          sampleId = v;
          templateQueryParts.push(`${encodeURIComponent(k)}={id}`);
          dynamicVariables.push({
            name: 'id',
            location: 'query',
            placeholder: '{id}',
            demoValue: v,
          });
        } else if (QUERY_KEYS.includes(lk)) {
          queryParam = k;
          sampleQuery = v;
          templateQueryParts.push(`${encodeURIComponent(k)}={q}`);
          dynamicVariables.push({
            name: 'q',
            location: 'query',
            placeholder: '{q}',
            demoValue: v,
          });
        } else if (!queryParam && v && v.length <= 80) {
          queryParam = k;
          sampleQuery = v;
          templateQueryParts.push(`${encodeURIComponent(k)}={q}`);
          dynamicVariables.push({
            name: 'q',
            location: 'query',
            placeholder: '{q}',
            demoValue: v,
          });
        } else {
          templateQueryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
          cleanBaseUrlObj.searchParams.set(k, v);
        }
      }

      const templatePath = templateSegments.join('/') || '/';
      staticUrlTemplate =
        u.origin +
        templatePath +
        (templateQueryParts.length > 0 ? `?${templateQueryParts.join('&')}` : '');
      baseUrl = cleanBaseUrlObj.toString();
    } catch {
      staticUrlTemplate = rawUrl;
      baseUrl = rawUrl;
    }
  }

  // POST JSON Payload splitting: {"query": "aaj ki news"} -> {"query": "{q}"}
  if (bodyText && bodyText.trimStart().startsWith('{')) {
    try {
      const obj = JSON.parse(bodyText) as Record<string, unknown>;
      const templatedObj: Record<string, unknown> = { ...obj };
      for (const [k, v] of Object.entries(obj)) {
        const lk = k.toLowerCase();
        if (typeof v === 'string' && isUnixTimestampValue(lk, v)) {
          timestampParam = timestampParam || k;
          templatedObj[k] = '{timestamp}';
          dynamicVariables.push({
            name: k,
            location: 'timestamp',
            placeholder: '{timestamp}',
            demoValue: 'time() dynamic Unix timestamp',
          });
        } else if (PAGE_KEYS.includes(lk) && (typeof v === 'string' || typeof v === 'number')) {
          pageParam = pageParam || k;
          samplePage = samplePage || String(v);
          templatedObj[k] = '{page}';
          if (!dynamicVariables.some((d) => d.name === 'page')) {
            dynamicVariables.push({
              name: 'page',
              location: 'body',
              placeholder: '{page}',
              demoValue: String(v),
            });
          }
        } else if (ID_KEYS.includes(lk) && (typeof v === 'string' || typeof v === 'number')) {
          idParam = idParam || k;
          sampleId = sampleId || String(v);
          templatedObj[k] = '{id}';
          if (!dynamicVariables.some((d) => d.name === 'id')) {
            dynamicVariables.push({
              name: 'id',
              location: 'body',
              placeholder: '{id}',
              demoValue: String(v),
            });
          }
        } else if (
          (QUERY_KEYS.includes(lk) || (!queryParam && typeof v === 'string' && v.length > 0 && v.length <= 120)) &&
          typeof v === 'string'
        ) {
          queryParam = queryParam || k;
          sampleQuery = sampleQuery || v;
          templatedObj[k] = '{q}';
          if (!dynamicVariables.some((d) => d.name === 'q')) {
            dynamicVariables.push({
              name: 'q',
              location: 'body',
              placeholder: '{q}',
              demoValue: v,
            });
          }
        }
      }
      staticPostTemplate = JSON.stringify(templatedObj, null, 2);
    } catch {
      staticPostTemplate = bodyText;
    }
  }

  return {
    staticUrlTemplate,
    baseUrl,
    queryParam,
    idParam,
    pageParam,
    timestampParam,
    sampleQuery,
    sampleId,
    samplePage,
    staticPostTemplate,
    dynamicVariables,
  };
}

export function parseSmartF12Dump(
  rawInput: string,
  prev?: Partial<SmartF12ParseResult>
): SmartF12ParseResult {
  const input = rawInput.trim();
  let url = prev?.url || '';
  let method: 'GET' | 'POST' = prev?.method || 'GET';
  const essentialHeaders: Record<string, string> = { ...(prev?.essentialHeaders || {}) };
  const responseHeaders: Record<string, string> = { ...(prev?.responseHeaders || {}) };
  let strippedNoiseCount = prev?.strippedNoiseCount || 0;
  let postBody = prev?.postBody || '';
  let responseJsonText = prev?.responseJsonText || '';
  let parsedJson: unknown | null = prev?.parsedJson ?? null;

  let section: string = 'general';

  // 1. Chrome Copy as fetch(...)
  const fetchMatch = input.match(/fetch\(\s*["']([^"']+)["']\s*(?:,\s*(\{[\s\S]*\}))?\s*\)/i);
  if (fetchMatch) {
    url = fetchMatch[1];
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
            const lk = k.toLowerCase();
            if (isNoiseKey(lk)) {
              strippedNoiseCount += 1;
            } else if (ESSENTIAL_HEADER_KEYS.has(lk)) {
              essentialHeaders[normalizeHeaderName(lk)] = String(v);
            } else {
              strippedNoiseCount += 1;
            }
          }
        }
        if (typeof opts.body === 'string') postBody = opts.body;
      } catch {
        // fallback below
      }
    }
  }

  // 2. Chrome Copy as cURL (bash)
  if (/^\s*curl\s+/i.test(input)) {
    const flat = input.replace(/\\\r?\n/g, ' ');
    const uMatch = flat.match(/https?:\/\/[^\s'"]+/i);
    if (uMatch) url = uMatch[0];
    const mFlag = flat.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i);
    if (mFlag && mFlag[1].toUpperCase() === 'POST') method = 'POST';

    const headerRegex = /(?:-H|--header)\s+(?:\$'([^']*)'|'([^']*)'|"([^"]*)")/g;
    let hm: RegExpExecArray | null;
    while ((hm = headerRegex.exec(flat)) !== null) {
      const line = unescapeShellToken(hm[1] || hm[2] || hm[3] || '');
      const colon = line.indexOf(':');
      if (colon > 0) {
        const k = line.slice(0, colon).trim();
        const v = line.slice(colon + 1).trim();
        const lk = k.toLowerCase();
        if (isNoiseKey(lk)) {
          strippedNoiseCount += 1;
        } else if (ESSENTIAL_HEADER_KEYS.has(lk)) {
          essentialHeaders[normalizeHeaderName(lk)] = v;
        } else {
          strippedNoiseCount += 1;
        }
      }
    }

    const dMatch = flat.match(
      /(?:--data-raw|--data-binary|--data-urlencode|--data|-d)\s+(?:\$'((?:\\.|[^'])*)'|'([^']*)'|"((?:\\.|[^"])*)")/
    );
    if (dMatch) {
      postBody = unescapeShellToken(dMatch[1] || dMatch[2] || dMatch[3] || '');
      method = 'POST';
    }
  }

  // 3. Raw Chrome DevTools General / Request Headers / Response Headers / Payload / JSON
  if (!fetchMatch && !/^\s*curl\s+/i.test(input)) {
    const lines = input.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) continue;

      if (/^general$/i.test(rawLine)) {
        section = 'general';
        continue;
      }
      if (/^request headers?$/i.test(rawLine)) {
        section = 'request';
        continue;
      }
      if (/^response headers?$/i.test(rawLine)) {
        section = 'response';
        continue;
      }
      if (/^(request payload|payload|query string parameters)$/i.test(rawLine)) {
        section = 'payload';
        continue;
      }

      const methodUrlMatch = rawLine.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(https?:\/\/\S+)$/i);
      if (methodUrlMatch) {
        method = methodUrlMatch[1].toUpperCase() === 'POST' ? 'POST' : 'GET';
        url = methodUrlMatch[2];
        continue;
      }

      if (/^https?:\/\/\S+$/i.test(rawLine) && !url) {
        url = rawLine;
        continue;
      }

      const colonIdx = rawLine.indexOf(':');
      let key = '';
      let val = '';
      if (colonIdx > 0 && !rawLine.startsWith('http://') && !rawLine.startsWith('https://')) {
        key = rawLine.slice(0, colonIdx).trim();
        val = rawLine.slice(colonIdx + 1).trim();
      } else if (rawLine.startsWith(':')) {
        const secondColon = rawLine.indexOf(':', 1);
        key = secondColon > 0 ? rawLine.slice(0, secondColon).trim() : rawLine;
        val = secondColon > 0 ? rawLine.slice(secondColon + 1).trim() : '';
      } else if (i + 1 < lines.length && /^[a-z0-9_:-]+$/i.test(rawLine)) {
        key = rawLine;
        val = lines[i + 1].trim();
        i += 1;
      } else {
        continue;
      }

      const lk = key.toLowerCase();
      if (lk === 'request url') {
        url = val;
        continue;
      }
      if (lk === 'request method') {
        method = val.toUpperCase() === 'POST' ? 'POST' : 'GET';
        continue;
      }

      if (isNoiseKey(lk)) {
        strippedNoiseCount += 1;
        continue;
      }

      if (lk === 'access-control-allow-origin' || (section === 'response' && lk === 'content-type')) {
        responseHeaders[normalizeHeaderName(lk)] = val;
        continue;
      }

      if (section === 'response') {
        strippedNoiseCount += 1;
        continue;
      }

      if (ESSENTIAL_HEADER_KEYS.has(lk)) {
        essentialHeaders[normalizeHeaderName(lk)] = val;
      } else {
        strippedNoiseCount += 1;
      }
    }
  }

  // 4. JSON Payload or JSON Response inside pasted text
  const maybeJson = tryExtractJsonSubstring(input);
  if (maybeJson !== null) {
    const pretty = JSON.stringify(maybeJson, null, 2);
    if (section === 'payload' && !postBody) {
      postBody = pretty;
    } else if (!fetchMatch && !/^\s*curl\s+/i.test(input)) {
      responseJsonText = pretty;
      parsedJson = maybeJson;
    }
  }

  const corsAllowed =
    responseHeaders['Access-Control-Allow-Origin'] ||
    (prev?.corsAllowed ?? null);
  const responseContentType =
    responseHeaders['Content-Type'] ||
    (prev?.responseContentType ?? null);
  const proxyRequired = !corsAllowed || (corsAllowed !== '*' && !corsAllowed.startsWith('http'));

  const split = splitUrlAndBodyIntoTwoParts(url, postBody);
  const authToken =
    essentialHeaders.Authorization ||
    essentialHeaders['X-Api-Key'] ||
    prev?.authToken ||
    '';

  const siteUrl =
    essentialHeaders.Referer ||
    essentialHeaders.Origin ||
    prev?.siteUrl ||
    (() => {
      try {
        return url ? new URL(url).origin : '';
      } catch {
        return '';
      }
    })();

  const isJsonApi =
    Boolean(parsedJson) ||
    method === 'POST' ||
    (responseContentType ? responseContentType.toLowerCase().includes('json') : false) ||
    /(api|graphql|wp-json|\.json|ajax|v1|v2|tmdb|imdb)/i.test(url) ||
    (essentialHeaders.Accept || '').toLowerCase().includes('json');

  return {
    url,
    baseUrl: split.baseUrl || url,
    staticUrlTemplate: split.staticUrlTemplate || url,
    method,
    kind: isJsonApi ? 'json-api' : 'html-search',
    siteUrl,
    essentialHeaders,
    authToken,
    strippedNoiseCount,
    responseHeaders,
    corsAllowed,
    responseContentType,
    proxyRequired,
    queryParam: split.queryParam || prev?.queryParam || '',
    idParam: split.idParam || prev?.idParam || '',
    pageParam: split.pageParam || prev?.pageParam || '',
    timestampParam: split.timestampParam || prev?.timestampParam || '',
    sampleQuery: split.sampleQuery || prev?.sampleQuery || '',
    sampleId: split.sampleId || prev?.sampleId || '',
    samplePage: split.samplePage || prev?.samplePage || '',
    postBody,
    staticPostTemplate: split.staticPostTemplate || postBody,
    dynamicVariables:
      split.dynamicVariables.length > 0
        ? split.dynamicVariables
        : prev?.dynamicVariables || [],
    responseJsonText,
    parsedJson,
  };
}
