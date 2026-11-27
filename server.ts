import express from 'express';
import type { Request, Response } from 'express';
import * as cheerio from 'cheerio';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type {
  BackendTrace,
  BuilderMode,
  CapturedF12Event,
  CapturedPattern,
  CrawlDepth,
  DetectedSearchForm,
  DetectedSelector,
  EmbeddedPayloadInfo,
  EndpointDataFilter,
  ExtractResponse,
  ExtractedDocument,
  ExtractedItem,
  ExtractedLink,
  ExtractedSection,
  ExtractedTable,
  ExtractedVideo,
  ExtractionRule,
  LiveApiPayload,
  NetworkTraceEntry,
  PageMetadata,
  PublishedEndpoint,
  SiteOverview,
  SitePreset,
} from './src/types/api.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MAX_HTML_BYTES = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 25_000;
const CRAWL_BUDGET_MS = 45_000;
const MAX_REDIRECTS = 12;
const CACHE_TTL_MS = 60_000;
const UNLIMITED_SAFE_CAP = Number.MAX_SAFE_INTEGER;

const OFFLINE_COLLEGE_COURSES_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>National Open College — Free BCA Courses, Video Lectures &amp; PDF Notes</title>
    <meta name="description" content="Public open-access BCA semester courses with downloadable PDF notes, lecture slides, syllabus tables, and HD video streams." />
    <meta name="author" content="Department of Computer Applications" />
    <meta property="og:site_name" content="National Open College Portal" />
    <meta property="article:published_time" content="2026-11-22" />
  </head>
  <body>
    <header>
      <h1>BCA Public Courseware &amp; Student Resource Portal</h1>
      <form action="https://en.wikipedia.org/w/index.php" method="get">
        <input type="search" name="search" placeholder="Search courses or topics..." />
      </form>
    </header>
    <main>
      <article class="course-card">
        <h2 class="course-title">BCA-301: Web Technologies &amp; RESTful APIs</h2>
        <p class="course-desc">Full semester module covering HTTP methods, JSON serialization, Express.js routing, and converting web pages into APIs.</p>
        <span class="duration">24:15</span>
        <video controls poster="https://example.edu/posters/bca301-web-apis.jpg">
          <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4" />
        </video>
        <a href="https://example.edu/notes/bca301-rest-api-complete-notes.pdf" download>Download Unit 1-4 PDF Notes</a>
        <a href="https://example.edu/slides/bca301-express-architecture.pptx">Lecture Slides (PPTX)</a>
      </article>

      <article class="course-card">
        <h2 class="course-title">BCA-302: Database Management Systems (DBMS)</h2>
        <p class="course-desc">Relational algebra, ER diagrams, 1NF to BCNF normalization, SQL queries, and transaction ACID properties.</p>
        <span class="duration">31:40</span>
        <video controls poster="https://example.edu/posters/bca302-dbms.jpg">
          <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
        </video>
        <a href="https://example.edu/notes/bca302-dbms-normalization-handout.pdf">DBMS Complete Notes (PDF)</a>
        <a href="https://example.edu/assignments/bca302-sql-lab-workbook.docx">SQL Lab Workbook (DOCX)</a>
      </article>

      <article class="course-card">
        <h2 class="course-title">BCA-303: Data Structures &amp; Algorithms in C++</h2>
        <p class="course-desc">Arrays, linked lists, stacks, queues, binary search trees, graph traversals (BFS/DFS), and time complexity analysis.</p>
        <span class="duration">28:10</span>
        <iframe src="https://www.youtube.com/embed/RBSGKlAvoiM" title="Data Structures Complete Course"></iframe>
        <a href="https://example.edu/notes/bca303-dsa-revision-notes.pdf">DSA Revision Notes PDF</a>
        <a href="https://example.edu/code/bca303-dsa-programs.zip">C++ Lab Programs Bundle (ZIP)</a>
      </article>

      <article class="course-card">
        <h2 class="course-title">BCA-304: Operating Systems &amp; Shell Scripting</h2>
        <p class="course-desc">Process scheduling algorithms, deadlocks, virtual memory paging, Linux file permissions, and Bash automation.</p>
        <span class="duration">19:50</span>
        <a href="https://example.edu/streams/bca304-os-scheduling.mp4">Download / Stream Lecture MP4</a>
        <a href="https://example.edu/notes/bca304-os-question-bank.pdf">Previous Year Question Bank (PDF)</a>
      </article>

      <article class="course-card">
        <h2 class="course-title">BCA-305: Python Programming &amp; Data Parsing</h2>
        <p class="course-desc">Functions, file I/O, JSON &amp; CSV handling, requests library, and consuming REST APIs in Python.</p>
        <span class="duration">21:30</span>
        <a href="https://example.edu/notes/bca305-python-api-guide.pdf">Python API Guide (PDF)</a>
        <a href="https://example.edu/sheets/bca305-practical-marks-rubric.xlsx">Practical Assessment Rubric (XLSX)</a>
      </article>

      <table>
        <caption>BCA Semester Public Course Schedule</caption>
        <thead>
          <tr>
            <th>Code</th>
            <th>Course Title</th>
            <th>Instructor</th>
            <th>Credits</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>BCA-301</td>
            <td>Web Technologies &amp; RESTful APIs</td>
            <td>Prof. Aarav Mehta</td>
            <td>4</td>
          </tr>
          <tr>
            <td>BCA-302</td>
            <td>Database Management Systems</td>
            <td>Dr. Priya Sharma</td>
            <td>4</td>
          </tr>
          <tr>
            <td>BCA-303</td>
            <td>Data Structures &amp; Algorithms</td>
            <td>Prof. Rohan Verma</td>
            <td>4</td>
          </tr>
          <tr>
            <td>BCA-304</td>
            <td>Operating Systems</td>
            <td>Dr. Kavita Nair</td>
            <td>3</td>
          </tr>
        </tbody>
      </table>

      <section>
        <h2>How Public College Course Portals Work with APIs</h2>
        <p>Universities publish syllabi, lecture videos, and PDF study notes as HTML pages. A server-side Website-to-API wrapper extracts every course card, downloadable PDF, video stream URL, and schedule table into one clean JSON API that any student app or external website can consume.</p>
        <h2>Using Extracted APIs in External Websites</h2>
        <p>With CORS enabled on the public GET endpoint and an auto-generated OpenAPI 3.0 specification, any external HTML page, React dashboard, or mobile application can fetch course lists and search notes live.</p>
      </section>
    </main>
  </body>
</html>`;

const OFFLINE_EDU_VIDEO_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>OpenLearn Computing — Video Lectures &amp; BCA Study Hub</title>
    <meta name="description" content="Free computer science video lectures, REST API tutorials, DBMS lessons, and programming notes for BCA students." />
    <meta name="author" content="Prof. Aarav Mehta" />
    <meta property="og:site_name" content="OpenLearn Computing" />
    <meta property="article:published_time" content="2026-11-20" />
  </head>
  <body>
    <header>
      <h1>BCA Video Lectures &amp; Web Engineering Portal</h1>
      <form action="https://en.wikipedia.org/w/index.php" method="get">
        <input type="search" name="search" placeholder="Search topics..." />
      </form>
    </header>
    <main>
      <article class="video-card">
        <h2 class="video-title">Lecture 01: How REST APIs &amp; HTTP Methods Work</h2>
        <p class="video-desc">Complete explanation of GET, POST, PUT, DELETE requests, JSON payloads, and status codes with live Node.js examples.</p>
        <span class="duration">14:25</span>
        <video controls poster="https://example.edu/posters/rest-api.jpg">
          <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4" />
        </video>
        <a href="https://example.edu/courses/rest-api-basics-notes.pdf">Open Lesson Notes (PDF)</a>
      </article>

      <article class="video-card">
        <h2 class="video-title">Lecture 02: Turning Any Website HTML into JSON using Cheerio</h2>
        <p class="video-desc">Learn how server-side DOM parsing extracts headings, tables, book catalogs, and video metadata from web pages.</p>
        <span class="duration">18:40</span>
        <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="DOM Parsing Tutorial"></iframe>
        <a href="https://example.edu/courses/cheerio-dom-parsing-slides.pptx">Download Lecture Slides</a>
      </article>

      <article class="video-card">
        <h2 class="video-title">Lecture 03: Database Normalization &amp; SQL Joins Explained</h2>
        <p class="video-desc">Step-by-step BCA DBMS lecture covering 1NF, 2NF, 3NF, BCNF, and inner vs left outer joins.</p>
        <span class="duration">22:10</span>
        <video controls poster="https://example.edu/posters/dbms.jpg">
          <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
        </video>
        <a href="https://example.edu/courses/dbms-normalization-handout.pdf">Download DBMS Handout PDF</a>
      </article>

      <article class="video-card">
        <h2 class="video-title">Lecture 04: Python &amp; JavaScript Fetch API Integration</h2>
        <p class="video-desc">Consume live JSON endpoints inside React web apps and Python scripts with error handling and search query filters.</p>
        <span class="duration">16:05</span>
        <a href="https://example.edu/videos/fetch-integration.mp4">Watch Direct MP4 Stream</a>
      </article>

      <section>
        <h2>Why Convert Websites into Structured APIs?</h2>
        <p>Many educational portals, college notice boards, and book catalogs publish useful information only in HTML. Wrapping them in a server-side API converts messy HTML tags into clean JSON objects that mobile apps and search tools can query instantly.</p>
        <h2>Key Components of a Web-to-API Pipeline</h2>
        <p>Every Web-to-API wrapper uses four stages: URL safety validation, HTTP document fetching, DOM parsing via CSS selectors, and JSON response formatting with query filters like ?q= and ?limit=all.</p>
      </section>
    </main>
  </body>
</html>`;

const PRESETS: SitePreset[] = [
  {
    id: 'college-courses',
    label: 'College Courses & Notes',
    sourceMode: 'html',
    builderMode: 'auto',
    url: 'https://example.edu/bca-public-courses',
    rawHtml: OFFLINE_COLLEGE_COURSES_HTML,
    containerSelector: '.course-card',
    suggestedSlug: 'college-courses',
    description: 'Offline-safe public college courses portal with video streams, PDF notes, PPT slides, ZIP labs, and syllabus table.',
    rules: [
      { id: 'r1', key: 'title', selector: '.course-title', attribute: 'text' },
      { id: 'r2', key: 'description', selector: '.course-desc', attribute: 'text' },
      { id: 'r3', key: 'duration', selector: '.duration', attribute: 'text' },
      { id: 'r4', key: 'notesPdf', selector: 'a[href$=".pdf"]', attribute: 'href' },
    ],
  },
  {
    id: 'youtube-edu',
    label: 'YouTube (Edu Demo)',
    sourceMode: 'url',
    builderMode: 'auto',
    url: 'https://www.youtube.com/',
    containerSelector: '',
    suggestedSlug: 'youtube-edu',
    description: 'Extracts educational video titles, channels, views, durations, and supports live ?q= search on YouTube.',
    rules: [{ id: 'r1', key: 'title', selector: 'title', attribute: 'text' }],
  },
  {
    id: 'edu-video-portal',
    label: 'Offline Video Portal',
    sourceMode: 'html',
    builderMode: 'auto',
    url: 'https://example.edu/bca-video-portal',
    rawHtml: OFFLINE_EDU_VIDEO_HTML,
    containerSelector: '.video-card',
    suggestedSlug: 'edu-videos',
    description: 'Offline-safe educational portal with video lectures, descriptions, durations, PDF notes, and searchable topics.',
    rules: [
      { id: 'r1', key: 'title', selector: '.video-title', attribute: 'text' },
      { id: 'r2', key: 'description', selector: '.video-desc', attribute: 'text' },
      { id: 'r3', key: 'duration', selector: '.duration', attribute: 'text' },
      { id: 'r4', key: 'link', selector: 'a', attribute: 'href' },
    ],
  },
  {
    id: 'books-toscrape',
    label: 'Books Catalog',
    sourceMode: 'url',
    builderMode: 'auto',
    url: 'https://books.toscrape.com/',
    containerSelector: 'article.product_pod',
    suggestedSlug: 'books-store',
    description: 'Live bookstore website automatically converted into a multi-page searchable Books JSON API.',
    rules: [
      { id: 'r1', key: 'title', selector: 'h3 a', attribute: 'text' },
      { id: 'r2', key: 'price', selector: '.price_color', attribute: 'text' },
      { id: 'r3', key: 'link', selector: 'h3 a', attribute: 'href' },
    ],
  },
  {
    id: 'wikipedia-api',
    label: 'Wikipedia Article',
    sourceMode: 'url',
    builderMode: 'auto',
    url: 'https://en.wikipedia.org/wiki/Application_programming_interface',
    containerSelector: '',
    suggestedSlug: 'wiki-api-guide',
    description: 'Educational encyclopedia post extracted into readable sections, links, and live Wikipedia search.',
    rules: [
      { id: 'r1', key: 'heading', selector: 'h2', attribute: 'text' },
      { id: 'r2', key: 'paragraph', selector: '#mw-content-text p', attribute: 'text' },
    ],
  },
  {
    id: 'hacker-news',
    label: 'Tech News Posts',
    sourceMode: 'url',
    builderMode: 'auto',
    url: 'https://news.ycombinator.com/',
    containerSelector: '.athing',
    suggestedSlug: 'tech-news',
    description: 'Real-time technology news headlines and links turned into a searchable feed API.',
    rules: [
      { id: 'r1', key: 'title', selector: '.titleline > a', attribute: 'text' },
      { id: 'r2', key: 'link', selector: '.titleline > a', attribute: 'href' },
    ],
  },
  {
    id: 'quotes-toscrape',
    label: 'Quotes Sandbox',
    sourceMode: 'url',
    builderMode: 'auto',
    url: 'https://quotes.toscrape.com/',
    containerSelector: '.quote',
    suggestedSlug: 'quotes-feed',
    description: 'Clean literary quotes website with authors and searchable quote texts.',
    rules: [
      { id: 'r1', key: 'quote', selector: '.text', attribute: 'text' },
      { id: 'r2', key: 'author', selector: '.author', attribute: 'text' },
      { id: 'r3', key: 'authorUrl', selector: 'span a', attribute: 'href' },
    ],
  },
];

interface CachedExtraction {
  expiresAt: number;
  extracted: Omit<ExtractResponse, 'ok' | 'status' | 'responseTimeMs'>;
}

const publishedEndpoints = new Map<string, PublishedEndpoint>();
const endpointCache = new Map<string, CachedExtraction>();

publishedEndpoints.set('college-courses', {
  slug: 'college-courses',
  name: 'National Open College — Free BCA Courses & Notes API',
  sourceMode: 'html',
  builderMode: 'auto',
  crawlDepth: 'linked',
  url: 'https://example.edu/bca-public-courses',
  rawHtml: OFFLINE_COLLEGE_COURSES_HTML,
  containerSelector: '.course-card',
  rules: [
    { id: 'r1', key: 'title', selector: '.course-title', attribute: 'text' },
    { id: 'r2', key: 'description', selector: '.course-desc', attribute: 'text' },
  ],
  limit: 0,
  createdAt: new Date().toISOString(),
  hitCount: 0,
  hasSearchForm: false,
});

publishedEndpoints.set('youtube-edu', {
  slug: 'youtube-edu',
  name: 'YouTube Educational Video Search API',
  sourceMode: 'url',
  builderMode: 'auto',
  crawlDepth: 'single',
  url: 'https://www.youtube.com/',
  containerSelector: '',
  rules: [{ id: 'r1', key: 'title', selector: 'title', attribute: 'text' }],
  limit: 0,
  createdAt: new Date().toISOString(),
  hitCount: 0,
  hasSearchForm: true,
});

publishedEndpoints.set('edu-videos', {
  slug: 'edu-videos',
  name: 'OpenLearn Computing — Video Lectures API',
  sourceMode: 'html',
  builderMode: 'auto',
  crawlDepth: 'single',
  url: 'https://example.edu/bca-video-portal',
  rawHtml: OFFLINE_EDU_VIDEO_HTML,
  containerSelector: '.video-card',
  rules: [
    { id: 'r1', key: 'title', selector: '.video-title', attribute: 'text' },
    { id: 'r2', key: 'description', selector: '.video-desc', attribute: 'text' },
  ],
  limit: 0,
  createdAt: new Date().toISOString(),
  hitCount: 0,
  hasSearchForm: false,
});

publishedEndpoints.set('books-store', {
  slug: 'books-store',
  name: 'Books Catalog Live API',
  sourceMode: 'url',
  builderMode: 'auto',
  crawlDepth: 'linked',
  url: 'https://books.toscrape.com/',
  containerSelector: 'article.product_pod',
  rules: [
    { id: 'r1', key: 'title', selector: 'h3 a', attribute: 'text' },
    { id: 'r2', key: 'price', selector: '.price_color', attribute: 'text' },
  ],
  limit: 0,
  createdAt: new Date().toISOString(),
  hitCount: 0,
  hasSearchForm: false,
});

function setPublicApiCorsHeaders(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Range');
}

function resolveLimitCap(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return UNLIMITED_SAFE_CAP;
  return Math.max(1, Math.floor(limit));
}

function parseCrawlDepth(raw: unknown): CrawlDepth {
  if (raw === 'single' || raw === 'linked' || raw === 'deep') return raw;
  return 'linked';
}

function normalizeInputUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    num = (num << 8) + octet;
  }
  return num >>> 0;
}

function isPrivateIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true;
  const ranges: Array<[number, number]> = [
    [0x00000000, 0x00ffffff],
    [0x0a000000, 0x0affffff],
    [0x64400000, 0x647fffff],
    [0x7f000000, 0x7fffffff],
    [0xa9fe0000, 0xa9feffff],
    [0xac100000, 0xac1fffff],
    [0xc0000000, 0xc00000ff],
    [0xc0000200, 0xc00002ff],
    [0xc0a80000, 0xc0a8ffff],
    [0xc6120000, 0xc613ffff],
    [0xc6336400, 0xc63364ff],
    [0xcb007100, 0xcb0071ff],
    [0xe0000000, 0xffffffff],
  ];
  return ranges.some(([start, end]) => n >= start && n <= end);
}

function isPrivateOrReservedIp(rawIp: string): boolean {
  const ip = rawIp.toLowerCase();
  if (net.isIPv4(ip)) return isPrivateIpv4(ip);
  if (net.isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('::ffff:')) {
      const mapped = ip.slice('::ffff:'.length);
      if (net.isIPv4(mapped)) return isPrivateIpv4(mapped);
    }
    const firstHex = ip.split(':')[0] || '';
    if (firstHex.startsWith('fc') || firstHex.startsWith('fd')) return true;
    if (/^fe[89ab]/i.test(firstHex)) return true;
    if (firstHex.startsWith('ff')) return true;
    return false;
  }
  return true;
}

async function validatePublicUrl(rawUrl: string): Promise<URL> {
  const normalized = normalizeInputUrl(rawUrl);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error('Invalid URL format. Example: https://example.edu/admissions');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// URLs are supported.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed.');
  }
  if (parsed.port) {
    const portNum = Number(parsed.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error('Invalid URL port number.');
    }
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.arpa')
  ) {
    throw new Error('Local or internal hostnames are blocked for security.');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error('Private or loopback IP addresses are blocked.');
    }
    return parsed;
  }

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await dns.lookup(host, { all: true });
  } catch {
    throw new Error(`Could not resolve domain "${host}". Check the URL or try Raw HTML Input mode.`);
  }

  if (!resolved.length) {
    throw new Error(`No DNS records found for "${host}".`);
  }

  for (const record of resolved) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new Error('Target resolves to a private or restricted network address.');
    }
  }

  return parsed;
}

interface SafeFetchResult {
  html: string;
  requestUrl: string;
  finalUrl: string;
  status: number;
  durationMs: number;
  redirectChain: Array<{ url: string; status: number }>;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  htmlBytes: number;
  fetchNotes?: string[];
}

function updateCookieJar(jar: Map<string, string>, setCookieHeaders: string[]) {
  for (const raw of setCookieHeaders) {
    const firstPart = raw.split(';')[0]?.trim();
    if (!firstPart) continue;
    const eqIdx = firstPart.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = firstPart.slice(0, eqIdx).trim();
    const val = firstPart.slice(eqIdx + 1).trim();
    if (name) jar.set(name, val);
  }
}

function serializeCookieJar(jar: Map<string, string>): string {
  if (jar.size === 0) return '';
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function buildBrowserHeaders(
  profile: 'chrome' | 'firefox' | 'safari' | 'googlebot' | 'minimal',
  referer?: string,
  cookieHeader?: string
): Record<string, string> {
  const base: Record<string, string> =
    profile === 'chrome'
      ? {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8,hi;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        }
      : profile === 'firefox'
        ? {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
          }
        : profile === 'googlebot'
          ? {
              'User-Agent':
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate',
            }
          : profile === 'minimal'
            ? {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                Accept: '*/*',
                'Accept-Encoding': 'gzip, deflate',
              }
            : {
                'User-Agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate',
              };

  if (referer) base.Referer = referer;
  if (cookieHeader) base.Cookie = cookieHeader;
  return base;
}

function collectInterestingHeaders(
  getHeader: (name: string) => string | undefined
): Record<string, string> {
  const responseHeaders: Record<string, string> = {};
  const interestingHeaders = [
    'server',
    'content-type',
    'cache-control',
    'content-length',
    'date',
    'x-frame-options',
    'x-powered-by',
    'vary',
  ];
  for (const h of interestingHeaders) {
    const val = getHeader(h);
    if (val) responseHeaders[h] = val;
  }
  return responseHeaders;
}

function isHtmlLikePayload(contentType: string, htmlSample: string): boolean {
  const ct = contentType.toLowerCase();
  if (
    !ct ||
    ct.includes('text/html') ||
    ct.includes('application/xhtml') ||
    ct.includes('text/plain') ||
    ct.includes('application/xml') ||
    ct.includes('text/xml')
  ) {
    return true;
  }
  const trimmed = htmlSample.trimStart().slice(0, 512).toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<head') ||
    trimmed.includes('<body') ||
    trimmed.includes('<title')
  );
}

function isBotChallengeHtml(html: string): boolean {
  const sample = html.slice(0, 6000).toLowerCase();
  if (
    sample.includes('just a moment...') ||
    sample.includes('cf-browser-verification') ||
    sample.includes('/cdn-cgi/challenge-platform') ||
    sample.includes('checking your browser before accessing') ||
    sample.includes('attention required! | cloudflare') ||
    sample.includes('enable javascript and cookies to continue') ||
    sample.includes('ddos-guard') ||
    sample.includes('incapsula incident') ||
    sample.includes('sucuri website firewall')
  ) {
    return true;
  }
  const titleMatch = sample.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] || '').trim();
  const linkCount = (html.match(/<a\b/gi) || []).length;
  if (
    linkCount < 3 &&
    html.length < 4000 &&
    /(503|403|429|service unavailable|service temporarily unavailable|access denied|attention required|blocked|under maintenance)/i.test(
      title
    )
  ) {
    return true;
  }
  return false;
}

function isUsableSoftErrorHtml(status: number, contentType: string, html: string): boolean {
  if (![403, 429, 500, 502, 503, 504].includes(status)) return false;
  if (!isHtmlLikePayload(contentType, html)) return false;
  if (isBotChallengeHtml(html)) return false;
  if (html.length < 1200) return false;
  const hasRichMarkup =
    /<a\b/i.test(html) && /<(h1|h2|h3|article|section|table|video|p)\b/i.test(html);
  return hasRichMarkup;
}

function parseRetryAfterMs(headerVal?: string | null): number {
  if (!headerVal) return 700;
  const sec = Number(headerVal);
  if (Number.isFinite(sec) && sec > 0) {
    return Math.min(2500, Math.max(400, Math.round(sec * 1000)));
  }
  return 700;
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchViaNodeHttp(
  urlObj: URL,
  headers: Record<string, string>,
  tolerantTls: boolean
): Promise<{
  status: number;
  statusMessage: string;
  headers: Record<string, string>;
  setCookies: string[];
  body: Buffer;
}> {
  return new Promise((resolve, reject) => {
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.request(
      urlObj,
      {
        method: 'GET',
        headers,
        timeout: FETCH_TIMEOUT_MS,
        ...(urlObj.protocol === 'https:'
          ? {
              rejectUnauthorized: !tolerantTls,
              ALPNProtocols: ['http/1.1'],
            }
          : {}),
      },
      (res) => {
        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (encoding.includes('br')) {
          stream = res.pipe(zlib.createBrotliDecompress());
        } else if (encoding.includes('gzip')) {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding.includes('deflate')) {
          stream = res.pipe(zlib.createInflate());
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        let finished = false;

        const done = () => {
          if (finished) return;
          finished = true;
          const flatHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') flatHeaders[k.toLowerCase()] = v;
            else if (Array.isArray(v) && v.length > 0) flatHeaders[k.toLowerCase()] = v.join(', ');
          }
          const setCookies = Array.isArray(res.headers['set-cookie'])
            ? res.headers['set-cookie']
            : typeof res.headers['set-cookie'] === 'string'
              ? [res.headers['set-cookie']]
              : [];

          resolve({
            status: res.statusCode || 200,
            statusMessage: res.statusMessage || '',
            headers: flatHeaders,
            setCookies,
            body: Buffer.concat(chunks),
          });
        };

        stream.on('data', (chunk: Buffer) => {
          if (totalBytes < MAX_HTML_BYTES) {
            const remaining = MAX_HTML_BYTES - totalBytes;
            chunks.push(chunk.length > remaining ? chunk.subarray(0, remaining) : chunk);
            totalBytes += Math.min(chunk.length, remaining);
            if (totalBytes >= MAX_HTML_BYTES) {
              res.destroy();
              done();
            }
          }
        });
        stream.on('end', done);
        stream.on('error', (err) => {
          if (chunks.length > 0) done();
          else reject(err);
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s`));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runFetchAttempt(
  rawUrl: string,
  options: {
    mode: 'undici' | 'node-http';
    profile: 'chrome' | 'firefox' | 'safari' | 'googlebot' | 'minimal';
    tolerantTls?: boolean;
    warmupOrigin?: boolean;
    jar?: Map<string, string>;
  }
): Promise<SafeFetchResult> {
  let currentUrl = await validatePublicUrl(rawUrl);
  const requestUrl = currentUrl.toString();
  const redirectChain: Array<{ url: string; status: number }> = [];
  const jar = options.jar ?? new Map<string, string>();
  const startedAt = performance.now();
  let referer = '';

  if (options.warmupOrigin && currentUrl.pathname !== '/' && currentUrl.pathname !== '') {
    try {
      const originUrl = new URL('/', currentUrl);
      if (options.mode === 'undici') {
        const warmRes = await fetch(originUrl.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(10_000),
          headers: buildBrowserHeaders(options.profile),
        });
        const getSetCookie = (warmRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
        if (typeof getSetCookie === 'function') {
          updateCookieJar(jar, getSetCookie.call(warmRes.headers));
        }
        await warmRes.body?.cancel().catch(() => {});
      } else {
        const warmRes = await fetchViaNodeHttp(
          originUrl,
          buildBrowserHeaders(options.profile),
          Boolean(options.tolerantTls)
        );
        updateCookieJar(jar, warmRes.setCookies);
      }
      referer = originUrl.toString();
    } catch {
      // Ignore origin warmup failures
    }
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const cookieHeader = serializeCookieJar(jar);
    const headers = buildBrowserHeaders(options.profile, referer || undefined, cookieHeader || undefined);

    if (options.mode === 'undici') {
      const response = await fetch(currentUrl.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers,
      });

      const getSetCookie = (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
      if (typeof getSetCookie === 'function') {
        updateCookieJar(jar, getSetCookie.call(response.headers));
      } else {
        const sc = response.headers.get('set-cookie');
        if (sc) updateCookieJar(jar, [sc]);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel().catch(() => {});
        if (!location) {
          throw new Error(`Redirect (${response.status}) returned without Location header.`);
        }
        if (hop === MAX_REDIRECTS) {
          throw new Error('Too many redirects from target website.');
        }
        referer = currentUrl.toString();
        redirectChain.push({ url: currentUrl.toString(), status: response.status });
        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = await validatePublicUrl(nextUrl);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      const responseHeaders = collectInterestingHeaders((h) => response.headers.get(h) ?? undefined);

      const reader = response.body?.getReader();
      let html = '';
      let totalBytes = 0;
      if (!reader) {
        const text = await response.text();
        html = text.slice(0, MAX_HTML_BYTES);
        totalBytes = Buffer.byteLength(html, 'utf8');
      } else {
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            if (totalBytes + value.byteLength > MAX_HTML_BYTES) {
              const keep = MAX_HTML_BYTES - totalBytes;
              if (keep > 0) {
                chunks.push(value.subarray(0, keep));
                totalBytes += keep;
              }
              await reader.cancel().catch(() => {});
              break;
            }
            totalBytes += value.byteLength;
            chunks.push(value);
          }
        }
        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        html = new TextDecoder('utf-8', { fatal: false }).decode(merged);
      }

      if (!response.ok) {
        if (isUsableSoftErrorHtml(response.status, contentType, html)) {
          return {
            html,
            requestUrl,
            finalUrl: currentUrl.toString(),
            status: response.status,
            durationMs: Math.round(performance.now() - startedAt),
            redirectChain,
            requestHeaders: headers,
            responseHeaders,
            htmlBytes: totalBytes,
            fetchNotes: [
              `Target website returned HTTP ${response.status} header, but served valid HTML content which was extracted automatically.`,
            ],
          };
        }
        const err = new Error(
          `Target website responded with HTTP ${response.status} ${response.statusText}.`
        ) as Error & { httpStatus?: number; retryAfterMs?: number };
        err.httpStatus = response.status;
        err.retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
        throw err;
      }

      if (!isHtmlLikePayload(contentType, html)) {
        throw new Error(`Unsupported content type "${contentType}". Target must be an HTML webpage.`);
      }

      if (isBotChallengeHtml(html)) {
        const err = new Error('Target website returned a bot-protection challenge page.') as Error & {
          httpStatus?: number;
        };
        err.httpStatus = 503;
        throw err;
      }

      return {
        html,
        requestUrl,
        finalUrl: currentUrl.toString(),
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        redirectChain,
        requestHeaders: headers,
        responseHeaders,
        htmlBytes: totalBytes,
      };
    }

    // Native node:http / node:https HTTP/1.1 mode with cookie jar + optional tolerant TLS
    const nodeRes = await fetchViaNodeHttp(currentUrl, headers, Boolean(options.tolerantTls));
    updateCookieJar(jar, nodeRes.setCookies);

    if (nodeRes.status >= 300 && nodeRes.status < 400) {
      const location = nodeRes.headers.location;
      if (!location) {
        throw new Error(`Redirect (${nodeRes.status}) returned without Location header.`);
      }
      if (hop === MAX_REDIRECTS) {
        throw new Error('Too many redirects from target website.');
      }
      referer = currentUrl.toString();
      redirectChain.push({ url: currentUrl.toString(), status: nodeRes.status });
      const nextUrl = new URL(location, currentUrl).toString();
      currentUrl = await validatePublicUrl(nextUrl);
      continue;
    }

    const html = new TextDecoder('utf-8', { fatal: false }).decode(nodeRes.body);
    const contentType = nodeRes.headers['content-type'] || '';
    const responseHeaders = collectInterestingHeaders((h) => nodeRes.headers[h]);

    if (nodeRes.status < 200 || nodeRes.status >= 400) {
      if (isUsableSoftErrorHtml(nodeRes.status, contentType, html)) {
        return {
          html,
          requestUrl,
          finalUrl: currentUrl.toString(),
          status: nodeRes.status,
          durationMs: Math.round(performance.now() - startedAt),
          redirectChain,
          requestHeaders: headers,
          responseHeaders,
          htmlBytes: nodeRes.body.byteLength,
          fetchNotes: [
            `Target website returned HTTP ${nodeRes.status} header, but served valid HTML content which was extracted automatically.`,
          ],
        };
      }
      const err = new Error(
        `Target website responded with HTTP ${nodeRes.status} ${nodeRes.statusMessage}`.trim()
      ) as Error & { httpStatus?: number; retryAfterMs?: number };
      err.httpStatus = nodeRes.status;
      err.retryAfterMs = parseRetryAfterMs(nodeRes.headers['retry-after']);
      throw err;
    }

    if (!isHtmlLikePayload(contentType, html)) {
      throw new Error(`Unsupported content type "${contentType}". Target must be an HTML webpage.`);
    }

    if (isBotChallengeHtml(html)) {
      const err = new Error('Target website returned a bot-protection challenge page.') as Error & {
        httpStatus?: number;
      };
      err.httpStatus = 503;
      throw err;
    }

    return {
      html,
      requestUrl,
      finalUrl: currentUrl.toString(),
      status: nodeRes.status,
      durationMs: Math.round(performance.now() - startedAt),
      redirectChain,
      requestHeaders: headers,
      responseHeaders,
      htmlBytes: nodeRes.body.byteLength,
    };
  }

  throw new Error('Failed to fetch target URL after redirects.');
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function convertMarkdownToSemanticHtml(markdown: string, pageUrl: string): string {
  const lines = markdown.split(/\r?\n/);
  let title = '';
  const bodyParts: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('Title:')) {
      title = line.slice(6).trim();
      continue;
    }
    if (line.startsWith('URL Source:') || line.startsWith('Markdown Content:')) continue;

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(4, headingMatch[1].length);
      const text = headingMatch[2].replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
        return `<a href="${escapeHtmlAttr(href)}">${escapeHtmlAttr(label)}</a>`;
      });
      bodyParts.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    let htmlLine = line
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (_, alt, src) => {
        return `<img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(alt)}" />`;
      })
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, href) => {
        return `<a href="${escapeHtmlAttr(href)}">${escapeHtmlAttr(label)}</a>`;
      });

    if (htmlLine === line) {
      htmlLine = escapeHtmlAttr(line).replace(
        /(https?:\/\/[^\s<>"')]+)/g,
        (u) => `<a href="${u}">${u}</a>`
      );
    }
    bodyParts.push(`<p>${htmlLine}</p>`);
  }

  const finalTitle = escapeHtmlAttr(title || pageUrl);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${finalTitle}</title></head><body><main>${bodyParts.join('\n')}</main></body></html>`;
}

async function tryJinaReaderFallback(rawUrl: string): Promise<SafeFetchResult | null> {
  try {
    const cleanUrl = (await validatePublicUrl(rawUrl)).toString();
    const proxyEndpoint = `https://r.jina.ai/${cleanUrl}`;
    const startedAt = performance.now();

    // 1. Request full rendered HTML via Jina cloud headless browser
    const htmlHeaders = {
      Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
      'X-Return-Format': 'html',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };
    const htmlRes = await fetch(proxyEndpoint, {
      signal: AbortSignal.timeout(18_000),
      headers: htmlHeaders,
    });

    if (htmlRes.ok) {
      const rawBody = (await htmlRes.text()).slice(0, MAX_HTML_BYTES);
      if (
        rawBody.trim().length > 300 &&
        isHtmlLikePayload(htmlRes.headers.get('content-type') || 'text/html', rawBody) &&
        !isBotChallengeHtml(rawBody)
      ) {
        return {
          html: rawBody,
          requestUrl: cleanUrl,
          finalUrl: cleanUrl,
          status: 200,
          durationMs: Math.round(performance.now() - startedAt),
          redirectChain: [{ url: proxyEndpoint, status: 200 }],
          requestHeaders: htmlHeaders,
          responseHeaders: {
            'x-rendered-via': 'cloud-browser-relay',
            'content-type': htmlRes.headers.get('content-type') || 'text/html',
          },
          htmlBytes: Buffer.byteLength(rawBody, 'utf8'),
          fetchNotes: [
            'Target website blocked direct server requests (HTTP 503/403 challenge); automatically retrieved live rendered HTML via cloud browser relay.',
          ],
        };
      }
    }

    // 2. Fallback to structured markdown extraction and normalize to semantic HTML
    const mdRes = await fetch(proxyEndpoint, {
      signal: AbortSignal.timeout(18_000),
      headers: { Accept: 'text/plain' },
    });
    if (mdRes.ok) {
      const mdText = (await mdRes.text()).slice(0, MAX_HTML_BYTES);
      if (mdText.trim().length > 120 && !/just a moment|checking your browser/i.test(mdText)) {
        const html = convertMarkdownToSemanticHtml(mdText, cleanUrl);
        return {
          html,
          requestUrl: cleanUrl,
          finalUrl: cleanUrl,
          status: 200,
          durationMs: Math.round(performance.now() - startedAt),
          redirectChain: [{ url: proxyEndpoint, status: 200 }],
          requestHeaders: { Accept: 'text/plain' },
          responseHeaders: {
            'x-rendered-via': 'cloud-reader-fallback',
            'content-type': 'text/html; charset=utf-8',
          },
          htmlBytes: Buffer.byteLength(html, 'utf8'),
          fetchNotes: [
            'Target website restricted direct datacenter access (HTTP 503/403); extracted live page headings, links, PDFs, and content via cloud reader relay.',
          ],
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function tryWaybackArchiveFallback(rawUrl: string): Promise<SafeFetchResult | null> {
  try {
    const cleanUrl = (await validatePublicUrl(rawUrl)).toString();
    let snapshotTimestamp = '';
    let snapshotOrigUrl = cleanUrl;

    // 1. Query Wayback CDX API (finds 200 OK captures faster and more reliably)
    try {
      const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(cleanUrl)}&output=json&limit=1&filter=statuscode:200&fl=timestamp,original&from=2022`;
      const cdxRes = await fetch(cdxUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/json' },
      });
      if (cdxRes.ok) {
        const rows = (await cdxRes.json()) as string[][];
        if (Array.isArray(rows) && rows.length > 1 && rows[1]?.[0]) {
          snapshotTimestamp = rows[1][0];
          snapshotOrigUrl = rows[1][1] || cleanUrl;
        }
      }
    } catch {
      // Fall through to wayback/available API
    }

    // 2. Fallback to archive.org/wayback/available if CDX returned empty
    if (!snapshotTimestamp) {
      const apiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(cleanUrl)}`;
      const availRes = await fetch(apiUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/json' },
      });
      if (availRes.ok) {
        const availJson = (await availRes.json()) as {
          archived_snapshots?: { closest?: { available?: boolean; timestamp?: string } };
        };
        if (availJson.archived_snapshots?.closest?.available && availJson.archived_snapshots.closest.timestamp) {
          snapshotTimestamp = availJson.archived_snapshots.closest.timestamp;
        }
      }
    }

    if (!snapshotTimestamp) return null;

    const startedAt = performance.now();
    const rawSnapshotUrl = `https://web.archive.org/web/${snapshotTimestamp}id_/${snapshotOrigUrl}`;
    const snapHeaders = buildBrowserHeaders('chrome');
    const snapRes = await fetch(rawSnapshotUrl, {
      signal: AbortSignal.timeout(18_000),
      headers: snapHeaders,
    });
    if (!snapRes.ok) return null;
    const html = (await snapRes.text()).slice(0, MAX_HTML_BYTES);
    if (!html.trim() || isBotChallengeHtml(html)) return null;

    return {
      html,
      requestUrl: cleanUrl,
      finalUrl: cleanUrl,
      status: 200,
      durationMs: Math.round(performance.now() - startedAt),
      redirectChain: [{ url: rawSnapshotUrl, status: 200 }],
      requestHeaders: snapHeaders,
      responseHeaders: {
        'x-archive-snapshot': snapshotTimestamp,
        'content-type': snapRes.headers.get('content-type') || 'text/html',
      },
      htmlBytes: Buffer.byteLength(html, 'utf8'),
      fetchNotes: [
        `Target origin blocked direct datacenter requests; automatically retrieved public Web Archive snapshot (${snapshotTimestamp}) for ${cleanUrl}.`,
      ],
    };
  } catch {
    return null;
  }
}

async function safeFetchHtml(
  rawUrl: string,
  options?: { fastMode?: boolean }
): Promise<SafeFetchResult> {
  const validated = await validatePublicUrl(rawUrl);
  const targetStr = validated.toString();
  const fastMode = Boolean(options?.fastMode);
  let lastErr: (Error & { httpStatus?: number; retryAfterMs?: number }) | null = null;

  const attempts: Array<() => Promise<SafeFetchResult>> = fastMode
    ? [
        () => runFetchAttempt(targetStr, { mode: 'undici', profile: 'chrome' }),
        () =>
          runFetchAttempt(targetStr, {
            mode: 'node-http',
            profile: 'firefox',
            tolerantTls: true,
          }),
      ]
    : [
        () => runFetchAttempt(targetStr, { mode: 'undici', profile: 'chrome' }),
        () =>
          runFetchAttempt(targetStr, {
            mode: 'node-http',
            profile: 'firefox',
            tolerantTls: true,
            warmupOrigin: true,
          }),
        () =>
          runFetchAttempt(targetStr, {
            mode: 'node-http',
            profile: 'safari',
            tolerantTls: true,
            warmupOrigin: false,
          }),
        () =>
          runFetchAttempt(targetStr, {
            mode: 'undici',
            profile: 'googlebot',
          }),
        () =>
          runFetchAttempt(targetStr, {
            mode: 'node-http',
            profile: 'minimal',
            tolerantTls: true,
          }),
      ];

  if (!fastMode && validated.protocol === 'https:') {
    const httpMirror = targetStr.replace(/^https:/i, 'http:');
    attempts.push(() =>
      runFetchAttempt(httpMirror, { mode: 'node-http', profile: 'chrome', tolerantTls: true })
    );
  }

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      lastErr = (err instanceof Error ? err : new Error(String(err))) as Error & {
        httpStatus?: number;
        retryAfterMs?: number;
      };
      const msg = lastErr.message.toLowerCase();
      if (
        msg.includes('blocked for security') ||
        msg.includes('private or loopback') ||
        msg.includes('private or restricted') ||
        msg.includes('unsupported content type')
      ) {
        throw lastErr;
      }
      if (!fastMode && (lastErr.httpStatus === 503 || lastErr.httpStatus === 429)) {
        await sleepMs(lastErr.retryAfterMs || 650);
      }
    }
  }

  if (!fastMode) {
    // Public headless browser relay fallback (handles HTTP 503 / 403 / Cloudflare JS challenges)
    const jinaResult = await tryJinaReaderFallback(targetStr);
    if (jinaResult) {
      return jinaResult;
    }

    // Public Web Archive CDX & Wayback fallback
    const archiveResult = await tryWaybackArchiveFallback(targetStr);
    if (archiveResult) {
      return archiveResult;
    }
  }

  const baseMsg = lastErr?.message || 'Could not reach target website.';
  if (
    baseMsg.includes('503') ||
    baseMsg.includes('403') ||
    baseMsg.includes('429') ||
    baseMsg.includes('bot-protection')
  ) {
    throw new Error(
      `Target website returned ${baseMsg.replace('Target website responded with ', '')} after browser-header, cookie-warmup, Googlebot, cloud-browser relay, and Web Archive fallbacks. Open the page in your browser, copy View Page Source, and paste it into Raw HTML Input mode to extract 100% of its API data.`
    );
  }
  throw lastErr || new Error('Failed to fetch target URL.');
}

function sanitizeExtractedUrl(raw: string, baseUrl: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return '';
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return '';
  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

function isYouTubeHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be';
  } catch {
    return false;
  }
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
      if (u.searchParams.get('v')) return u.searchParams.get('v');
    }
    if (host === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null;
    }
  } catch {
    return null;
  }
  return null;
}

function detectStreamFormat(videoUrl: string): {
  streamFormat: string;
  downloadable: boolean;
  playableType: ExtractedVideo['playableType'];
} {
  const lower = videoUrl.toLowerCase();
  if (/\.m3u8(\?|$)/i.test(lower)) {
    return { streamFormat: 'HLS (.m3u8)', downloadable: false, playableType: 'hls' };
  }
  if (/\.mp4(\?|$)/i.test(lower)) {
    return { streamFormat: 'MP4', downloadable: true, playableType: 'html5' };
  }
  if (/\.webm(\?|$)/i.test(lower)) {
    return { streamFormat: 'WebM', downloadable: true, playableType: 'html5' };
  }
  if (/\.ogg(\?|$)|\.ogv(\?|$)/i.test(lower)) {
    return { streamFormat: 'OGG', downloadable: true, playableType: 'html5' };
  }
  if (/\.mov(\?|$)/i.test(lower)) {
    return { streamFormat: 'MOV', downloadable: true, playableType: 'html5' };
  }
  if (/\.mpd(\?|$)/i.test(lower)) {
    return { streamFormat: 'DASH (.mpd)', downloadable: false, playableType: 'html5' };
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return { streamFormat: 'YouTube', downloadable: false, playableType: 'youtube-embed' };
  }
  if (lower.includes('vimeo.com')) {
    return { streamFormat: 'Vimeo', downloadable: false, playableType: 'iframe' };
  }
  return { streamFormat: 'Stream / Embed', downloadable: false, playableType: 'iframe' };
}

function buildProxyStreamUrl(videoUrl: string, playableType: ExtractedVideo['playableType']): string | undefined {
  if (!videoUrl) return undefined;
  if (playableType === 'hls' || playableType === 'html5') {
    return `/api/media-proxy?url=${encodeURIComponent(videoUrl)}`;
  }
  return undefined;
}

function isVideoLikeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    /\.(mp4|webm|m3u8|mpd|mov|ogg|ogv)(\?|$)/i.test(lower) ||
    lower.includes('youtube.com/watch') ||
    lower.includes('youtube.com/embed') ||
    lower.includes('youtube.com/shorts') ||
    lower.includes('youtu.be/') ||
    lower.includes('vimeo.com/') ||
    lower.includes('dailymotion.com/video') ||
    lower.includes('/video/') ||
    lower.includes('/videos/') ||
    lower.includes('/stream') ||
    lower.includes('/lecture')
  );
}

function classifyDocumentUrl(
  url: string,
  anchorText: string,
  hasDownloadAttr: boolean
): ExtractedDocument['fileType'] | null {
  const lowerUrl = url.toLowerCase();
  const lowerText = anchorText.toLowerCase();

  if (/\.pdf(\?|$)/i.test(lowerUrl)) return 'PDF';
  if (/\.(ppt|pptx|odp)(\?|$)/i.test(lowerUrl)) return 'PPT';
  if (/\.(doc|docx|odt|rtf)(\?|$)/i.test(lowerUrl)) return 'DOC';
  if (/\.(zip|rar|7z|tar\.gz|tgz)(\?|$)/i.test(lowerUrl)) return 'ZIP';
  if (/\.(xls|xlsx|csv|ods)(\?|$)/i.test(lowerUrl)) return 'SPREADSHEET';
  if (/\.(epub|mobi|azw3)(\?|$)/i.test(lowerUrl)) return 'EBOOK';

  if (isVideoLikeUrl(url)) return null;

  const isDocKeyword =
    hasDownloadAttr ||
    /\b(pdf|notes|syllabus|handout|slides|workbook|assignment|question[- ]?bank|study[- ]?material|ebook|cheat[- ]?sheet|module[- ]?notes|prospectus|brochure|admission|merit|circular|notice|timetable|fee[- ]?structure|guideline|notification|form)\b/i.test(
      `${lowerUrl} ${lowerText}`
    );

  if (isDocKeyword) {
    if (lowerText.includes('pdf') || lowerUrl.includes('/pdf')) return 'PDF';
    if (lowerText.includes('ppt') || lowerText.includes('slide')) return 'PPT';
    if (lowerText.includes('doc')) return 'DOC';
    return 'NOTES';
  }

  return null;
}

function parseJsonLdObjects($: cheerio.CheerioAPI): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const visit = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          for (const item of node) visit(item);
          return;
        }
        const rec = node as Record<string, unknown>;
        results.push(rec);
        if (Array.isArray(rec['@graph'])) {
          for (const g of rec['@graph']) visit(g);
        }
      };
      visit(parsed);
    } catch {
      // ignore malformed JSON-LD
    }
  });
  return results;
}

function extractBalancedJsonFromText(scriptText: string, marker: string): unknown | null {
  const idx = scriptText.indexOf(marker);
  if (idx === -1) return null;
  const braceStart = scriptText.indexOf('{', idx + marker.length);
  if (braceStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = braceStart; i < scriptText.length; i++) {
    const ch = scriptText[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        const jsonSlice = scriptText.slice(braceStart, i + 1);
        try {
          return JSON.parse(jsonSlice);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function readYtText(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return '';
  const rec = obj as Record<string, unknown>;
  if (typeof rec.simpleText === 'string') return rec.simpleText;
  if (Array.isArray(rec.runs)) {
    return rec.runs
      .map((r) => (r && typeof r === 'object' ? String((r as Record<string, unknown>).text || '') : ''))
      .join('');
  }
  return '';
}

function extractEmbeddedPayloadsAndYouTube(
  $: cheerio.CheerioAPI,
  baseUrl: string
): {
  embeddedPayloads: EmbeddedPayloadInfo[];
  ytVideos: ExtractedVideo[];
  scriptStreams: ExtractedVideo[];
} {
  const embeddedPayloads: EmbeddedPayloadInfo[] = [];
  const ytVideos: ExtractedVideo[] = [];
  const scriptStreams: ExtractedVideo[] = [];
  const seenVideoIds = new Set<string>();
  const seenStreamUrls = new Set<string>();
  const seenApiPaths = new Set<string>();

  const pushYtVideo = (renderer: Record<string, unknown>, sourceLabel: string) => {
    const videoId = typeof renderer.videoId === 'string' ? renderer.videoId : '';
    if (!videoId || seenVideoIds.has(videoId)) return;
    seenVideoIds.add(videoId);

    const title =
      readYtText(renderer.title) ||
      readYtText(renderer.headline) ||
      `YouTube Video (${videoId})`;
    const channelName =
      readYtText(renderer.ownerText) ||
      readYtText(renderer.shortBylineText) ||
      readYtText(renderer.longBylineText) ||
      undefined;
    const duration = readYtText(renderer.lengthText) || undefined;
    const views =
      readYtText(renderer.viewCountText) ||
      readYtText(renderer.shortViewCountText) ||
      undefined;
    const publishedTime = readYtText(renderer.publishedTimeText) || undefined;

    let snippet = '';
    if (Array.isArray(renderer.detailedMetadataSnippets)) {
      const firstSnippet = renderer.detailedMetadataSnippets[0] as Record<string, unknown> | undefined;
      if (firstSnippet && firstSnippet.snippetText) {
        snippet = readYtText(firstSnippet.snippetText);
      }
    }
    if (!snippet) {
      snippet = readYtText(renderer.descriptionSnippet);
    }

    const metaParts = [channelName, duration, views, publishedTime].filter(Boolean);
    const description = snippet || (metaParts.length ? metaParts.join(' · ') : 'YouTube Video');

    ytVideos.push({
      title: cleanText(title),
      description: cleanText(description).slice(0, 280),
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      pageUrl: baseUrl,
      sourcePage: baseUrl,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration,
      streamFormat: 'YouTube',
      downloadable: false,
      channelName,
      views,
      publishedTime,
      extractedFrom: sourceLabel,
      sourceType: 'youtube-data',
    });
  };

  $('link[rel="alternate"]').each((_, el) => {
    const type = $(el).attr('type') || '';
    const href = sanitizeExtractedUrl($(el).attr('href') || '', baseUrl);
    if (href && (type.includes('rss') || type.includes('atom') || type.includes('json'))) {
      embeddedPayloads.push({
        name: $(el).attr('title') || type || 'Alternate Feed',
        kind: 'feed',
        detail: href,
      });
    }
  });

  const nextDataRaw = $('script#__NEXT_DATA__').text().trim();
  if (nextDataRaw) {
    try {
      const parsed = JSON.parse(nextDataRaw) as Record<string, unknown>;
      const keys = Object.keys(parsed).slice(0, 6).join(', ');
      embeddedPayloads.push({
        name: '__NEXT_DATA__ (Next.js SSR State)',
        kind: 'script-state',
        detail: `Top-level keys: ${keys} (${Math.round(nextDataRaw.length / 1024)} KB)`,
      });
      const harvestedNext = extractMediaAndItemsFromJson(parsed, baseUrl, 200);
      for (const vid of harvestedNext.videos) {
        if (!seenStreamUrls.has(vid.videoUrl)) {
          seenStreamUrls.add(vid.videoUrl);
          scriptStreams.push({
            ...vid,
            extractedFrom: '<script id="__NEXT_DATA__"> Next.js JSON',
          });
        }
      }
    } catch {
      // ignore
    }
  }

  const pageTitle = cleanText($('title').first().text()) || 'Embedded Stream';

  $('script').each((_, el) => {
    const text = $(el).text();
    if (!text) return;

    if (text.includes('ytInitialData')) {
      const ytData =
        extractBalancedJsonFromText(text, 'var ytInitialData =') ||
        extractBalancedJsonFromText(text, 'window["ytInitialData"] =') ||
        extractBalancedJsonFromText(text, 'ytInitialData =');

      if (ytData && typeof ytData === 'object') {
        const beforeCount = ytVideos.length;
        const walk = (node: unknown) => {
          if (!node || typeof node !== 'object') return;
          const rec = node as Record<string, unknown>;
          if (rec.videoRenderer && typeof rec.videoRenderer === 'object') {
            pushYtVideo(rec.videoRenderer as Record<string, unknown>, '<script> ytInitialData -> videoRenderer');
          }
          if (rec.gridVideoRenderer && typeof rec.gridVideoRenderer === 'object') {
            pushYtVideo(rec.gridVideoRenderer as Record<string, unknown>, '<script> ytInitialData -> gridVideoRenderer');
          }
          if (rec.compactVideoRenderer && typeof rec.compactVideoRenderer === 'object') {
            pushYtVideo(rec.compactVideoRenderer as Record<string, unknown>, '<script> ytInitialData -> compactVideoRenderer');
          }
          if (rec.playlistVideoRenderer && typeof rec.playlistVideoRenderer === 'object') {
            pushYtVideo(rec.playlistVideoRenderer as Record<string, unknown>, '<script> ytInitialData -> playlistVideoRenderer');
          }
          for (const val of Object.values(rec)) {
            if (val && typeof val === 'object') walk(val);
          }
        };
        walk(ytData);

        embeddedPayloads.push({
          name: 'ytInitialData (YouTube Backend JSON)',
          kind: 'script-state',
          detail: `Parsed ${ytVideos.length - beforeCount} videos from server-rendered JSON state`,
        });
      }
    }

    if (text.includes('ytInitialPlayerResponse')) {
      const playerResp =
        extractBalancedJsonFromText(text, 'var ytInitialPlayerResponse =') ||
        extractBalancedJsonFromText(text, 'ytInitialPlayerResponse =');
      if (playerResp && typeof playerResp === 'object') {
        const vd = (playerResp as Record<string, unknown>).videoDetails as Record<string, unknown> | undefined;
        if (vd && typeof vd.videoId === 'string') {
          const vid = vd.videoId;
          if (!seenVideoIds.has(vid)) {
            seenVideoIds.add(vid);
            const lenSec = Number(vd.lengthSeconds);
            const duration =
              Number.isFinite(lenSec) && lenSec > 0
                ? `${Math.floor(lenSec / 60)}:${String(lenSec % 60).padStart(2, '0')}`
                : undefined;
            ytVideos.push({
              title: cleanText(String(vd.title || 'YouTube Video')),
              description: cleanText(String(vd.shortDescription || '')).slice(0, 280),
              videoUrl: `https://www.youtube.com/watch?v=${vid}`,
              embedUrl: `https://www.youtube.com/embed/${vid}`,
              pageUrl: baseUrl,
              sourcePage: baseUrl,
              thumbnail: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
              duration,
              streamFormat: 'YouTube',
              downloadable: false,
              channelName: typeof vd.author === 'string' ? vd.author : undefined,
              views: typeof vd.viewCount === 'string' ? `${Number(vd.viewCount).toLocaleString()} views` : undefined,
              extractedFrom: '<script> ytInitialPlayerResponse -> videoDetails',
              sourceType: 'youtube-data',
            });
          }
          embeddedPayloads.push({
            name: 'ytInitialPlayerResponse (Player Stream Metadata)',
            kind: 'script-state',
            detail: `Video ID ${vd.videoId} · ${String(vd.author || 'YouTube')}`,
          });
        }
      }
    }

    // Direct .mp4 / .m3u8 / .webm / .ogg / .mov stream URLs embedded inside inline player scripts
    if (!isYouTubeHost(baseUrl)) {
      const mediaMatches = text.match(
        /https?:\/\/[^"'\s\\<>]+\.(?:mp4|m3u8|webm|ogg|ogv|mov|mpd)(?:\?[^"'\s\\<>]*)?/gi
      );
      if (mediaMatches) {
        for (const rawMedia of mediaMatches) {
          const cleanMedia = sanitizeExtractedUrl(rawMedia.replace(/\\u002F/g, '/'), baseUrl);
          if (!cleanMedia || seenStreamUrls.has(cleanMedia)) continue;
          seenStreamUrls.add(cleanMedia);
          const { streamFormat, downloadable, playableType } = detectStreamFormat(cleanMedia);
          scriptStreams.push({
            title: `${pageTitle} (${streamFormat} Stream)`,
            description: 'Direct video stream URL discovered inside page script configuration.',
            videoUrl: cleanMedia,
            proxyStreamUrl: buildProxyStreamUrl(cleanMedia, playableType),
            playableType,
            pageUrl: baseUrl,
            sourcePage: baseUrl,
            streamFormat,
            downloadable,
            extractedFrom: '<script> inline stream URL',
            sourceType: 'script-stream',
          });
        }
      }
    }

    const apiMatches = text.match(
      /["'](\/(?:api|graphql|wp-json|v1|v2)\/[a-zA-Z0-9_/?=&.-]+|https?:\/\/[^"'\s]+\/(?:api|graphql|wp-json)\/[a-zA-Z0-9_/?=&.-]+)["']/g
    );
    if (apiMatches) {
      for (const rawMatch of apiMatches) {
        const cleaned = rawMatch.slice(1, -1);
        if (!seenApiPaths.has(cleaned)) {
          seenApiPaths.add(cleaned);
          embeddedPayloads.push({
            name: 'Referenced Fetch / XHR API Path',
            kind: 'api-endpoint',
            detail: cleaned,
          });
        }
      }
    }
  });

  return { embeddedPayloads, ytVideos, scriptStreams };
}

function extractDocumentsFromDom($: cheerio.CheerioAPI, baseUrl: string): ExtractedDocument[] {
  const docs: ExtractedDocument[] = [];
  const seen = new Set<string>();

  const pushDoc = (url: string, rawTitle: string, fileType: ExtractedDocument['fileType'], extractedFrom: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    let fallbackName = 'Study Document';
    try {
      const pathSeg = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
      if (pathSeg) fallbackName = decodeURIComponent(pathSeg);
    } catch {
      fallbackName = 'Study Document';
    }
    docs.push({
      title: (cleanText(rawTitle) || fallbackName).slice(0, 160),
      url,
      fileType,
      sourcePage: baseUrl,
      extractedFrom,
    });
  };

  $('a[href]').each((_, el) => {
    const anchor = $(el);
    const resolved = sanitizeExtractedUrl(anchor.attr('href') || '', baseUrl);
    if (!resolved) return;

    const hasDownload = anchor.attr('download') !== undefined;
    const rawText = cleanText(anchor.text()) || cleanText(anchor.attr('title') || '');
    const fileType = classifyDocumentUrl(resolved, rawText, hasDownload);
    if (!fileType) return;

    const card = anchor.closest('article, .course-card, .video-card, .card, li, tr');
    const cardTitle = cleanText(card.find('h1, h2, h3, h4, .course-title').first().text());
    const combinedTitle =
      rawText && rawText.length >= 4
        ? cardTitle && !rawText.toLowerCase().includes(cardTitle.toLowerCase().slice(0, 12))
          ? `${rawText} — ${cardTitle}`
          : rawText
        : cardTitle || resolved;

    pushDoc(resolved, combinedTitle, fileType, 'HTML <a href> document / download link');
  });

  $('embed[src], object[data]').each((_, el) => {
    const node = $(el);
    const rawSrc = node.attr('src') || node.attr('data') || '';
    const resolved = sanitizeExtractedUrl(rawSrc, baseUrl);
    if (!resolved) return;
    const type = (node.attr('type') || '').toLowerCase();
    if (type.includes('pdf') || /\.pdf(\?|$)/i.test(resolved)) {
      pushDoc(resolved, node.attr('title') || 'Embedded PDF Document', 'PDF', 'HTML <embed>/<object> PDF');
    }
  });

  return docs;
}

function detectSelectors($: cheerio.CheerioAPI): DetectedSelector[] {
  const candidates = [
    '.course-card',
    'article.product_pod',
    '.video-card',
    '.quote',
    '.athing',
    'article',
    '.post',
    '.card',
    'table tbody tr',
    'main section',
    'h2',
    'h3',
    'video',
    'iframe',
  ];

  const results: DetectedSelector[] = [];
  for (const sel of candidates) {
    try {
      const matched = $(sel);
      if (matched.length > 0) {
        const sample = cleanText(matched.first().text()).slice(0, 80) || `<${sel}> element`;
        results.push({
          selector: sel,
          count: matched.length,
          sampleText: sample,
        });
      }
    } catch {
      // ignore invalid selector
    }
  }
  return results;
}

function detectSearchForm($: cheerio.CheerioAPI, baseUrl: string): DetectedSearchForm | null {
  if (isYouTubeHost(baseUrl)) {
    return {
      actionUrl: 'https://www.youtube.com/results',
      method: 'GET',
      queryParam: 'search_query',
    };
  }

  let detected: DetectedSearchForm | null = null;
  $('form').each((_, formEl) => {
    if (detected) return;
    const form = $(formEl);
    const method = (form.attr('method') || 'get').toLowerCase();
    if (method !== 'get') return;

    const searchInput = form
      .find(
        'input[type="search"], input[name="q"], input[name="s"], input[name="search"], input[name="search_query"], input[name="query"], input[name="keyword"], input[name="k"]'
      )
      .first();

    if (!searchInput.length) return;
    const queryParam = searchInput.attr('name') || '';
    if (!queryParam) return;

    const rawAction = form.attr('action') || baseUrl;
    const actionUrl = sanitizeExtractedUrl(rawAction, baseUrl) || baseUrl;
    detected = {
      actionUrl,
      method: 'GET',
      queryParam,
    };
  });
  return detected;
}

function extractVideosFromDom(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  jsonLd: Array<Record<string, unknown>>,
  pageTitle: string,
  ytVideos: ExtractedVideo[],
  scriptStreams: ExtractedVideo[],
  maxVideos: number
): ExtractedVideo[] {
  const seen = new Set<string>();
  const videos: ExtractedVideo[] = [];

  const pushVideo = (v: ExtractedVideo) => {
    const dedupeKey = (v.videoUrl || v.embedUrl || v.pageUrl || '').trim();
    if (!dedupeKey || seen.has(dedupeKey) || videos.length >= maxVideos) return;
    seen.add(dedupeKey);
    const detected = detectStreamFormat(v.videoUrl || v.embedUrl || '');
    const playableType = v.playableType || detected.playableType;
    const proxyStreamUrl = v.proxyStreamUrl || buildProxyStreamUrl(v.videoUrl, playableType);
    videos.push({
      ...v,
      playableType,
      proxyStreamUrl,
      sourcePage: v.sourcePage || baseUrl,
    });
  };

  for (const yt of ytVideos) {
    pushVideo(yt);
  }

  for (const obj of jsonLd) {
    const typeVal = String(obj['@type'] || '');
    if (typeVal.toLowerCase().includes('video')) {
      const contentUrl = typeof obj.contentUrl === 'string' ? sanitizeExtractedUrl(obj.contentUrl, baseUrl) : '';
      const embedUrl = typeof obj.embedUrl === 'string' ? sanitizeExtractedUrl(obj.embedUrl, baseUrl) : '';
      const thumbRaw = Array.isArray(obj.thumbnailUrl) ? obj.thumbnailUrl[0] : obj.thumbnailUrl;
      const thumbnail = typeof thumbRaw === 'string' ? sanitizeExtractedUrl(thumbRaw, baseUrl) : '';
      const finalVidUrl = contentUrl || embedUrl;
      if (finalVidUrl) {
        const { streamFormat, downloadable } = detectStreamFormat(finalVidUrl);
        pushVideo({
          title: cleanText(String(obj.name || pageTitle || 'Video')),
          description: cleanText(String(obj.description || '')).slice(0, 280),
          videoUrl: finalVidUrl,
          embedUrl: embedUrl || undefined,
          pageUrl: baseUrl,
          sourcePage: baseUrl,
          thumbnail: thumbnail || undefined,
          duration: typeof obj.duration === 'string' ? obj.duration : undefined,
          streamFormat,
          downloadable,
          extractedFrom: '<script type="application/ld+json"> VideoObject',
          sourceType: 'json-ld',
        });
      }
    }
  }

  $('video').each((idx, el) => {
    const vid = $(el);
    const rawSrc =
      vid.attr('src') ||
      vid.find('source[src]').first().attr('src') ||
      vid.attr('data-src') ||
      vid.attr('data-hls') ||
      vid.attr('data-stream') ||
      '';
    const videoUrl = sanitizeExtractedUrl(rawSrc, baseUrl);
    if (!videoUrl) return;

    const card = vid.closest('article, .course-card, .video-card, .card, section, figure, div');
    const title =
      cleanText(vid.attr('title') || '') ||
      cleanText(card.find('h1, h2, h3, h4, figcaption, .video-title, .course-title').first().text()) ||
      `${pageTitle} — Video ${idx + 1}`;
    const description =
      cleanText(card.find('p, .video-desc, .course-desc, .description').first().text()).slice(0, 280) ||
      cleanText(vid.attr('aria-label') || '');
    const duration = cleanText(card.find('.duration, time').first().text()) || undefined;
    const posterRaw = vid.attr('poster') || '';
    const thumbnail = posterRaw ? sanitizeExtractedUrl(posterRaw, baseUrl) || undefined : undefined;
    const { streamFormat, downloadable } = detectStreamFormat(videoUrl);

    pushVideo({
      title,
      description,
      videoUrl,
      pageUrl: baseUrl,
      sourcePage: baseUrl,
      thumbnail,
      duration,
      streamFormat,
      downloadable,
      extractedFrom: 'HTML <video><source src>',
      sourceType: 'html5-video',
    });
  });

  $('iframe').each((idx, el) => {
    const frame = $(el);
    const rawSrc = frame.attr('src') || frame.attr('data-src') || '';
    const embedUrl = sanitizeExtractedUrl(rawSrc, baseUrl);
    if (!embedUrl) return;

    const lower = embedUrl.toLowerCase();
    const ytId = extractYouTubeId(embedUrl);
    const isVimeo = lower.includes('vimeo.com');
    const isVideoIframe =
      Boolean(ytId) ||
      isVimeo ||
      lower.includes('dailymotion.com') ||
      lower.includes('wistia') ||
      lower.includes('streamable') ||
      lower.includes('video') ||
      lower.includes('player');

    if (!isVideoIframe) return;

    const card = frame.closest('article, .course-card, .video-card, .card, section, div');
    const title =
      cleanText(frame.attr('title') || '') ||
      cleanText(card.find('h1, h2, h3, h4, .video-title, .course-title').first().text()) ||
      `${pageTitle} — Embedded Video ${idx + 1}`;
    const description = cleanText(card.find('p, .video-desc, .course-desc').first().text()).slice(0, 280);
    const duration = cleanText(card.find('.duration, time').first().text()) || undefined;

    const watchUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : embedUrl;
    const thumbnail = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined;
    const { streamFormat, downloadable } = detectStreamFormat(watchUrl);

    pushVideo({
      title,
      description,
      videoUrl: watchUrl,
      embedUrl,
      pageUrl: baseUrl,
      sourcePage: baseUrl,
      thumbnail,
      duration,
      streamFormat,
      downloadable,
      extractedFrom: 'HTML <iframe src>',
      sourceType: ytId ? 'youtube-embed' : isVimeo ? 'vimeo-embed' : 'iframe-embed',
    });
  });

  const ogVideo =
    $('meta[property="og:video:secure_url"]').attr('content') ||
    $('meta[property="og:video:url"]').attr('content') ||
    $('meta[property="og:video"]').attr('content') ||
    $('meta[name="twitter:player"]').attr('content') ||
    '';
  const resolvedOgVideo = sanitizeExtractedUrl(ogVideo, baseUrl);
  if (resolvedOgVideo) {
    const ytId = extractYouTubeId(resolvedOgVideo);
    const watchUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : resolvedOgVideo;
    const { streamFormat, downloadable } = detectStreamFormat(watchUrl);
    pushVideo({
      title: cleanText($('meta[property="og:title"]').attr('content') || pageTitle || 'Featured Video'),
      description: cleanText($('meta[property="og:description"]').attr('content') || '').slice(0, 280),
      videoUrl: watchUrl,
      embedUrl: resolvedOgVideo,
      pageUrl: baseUrl,
      sourcePage: baseUrl,
      thumbnail: sanitizeExtractedUrl($('meta[property="og:image"]').attr('content') || '', baseUrl) || undefined,
      streamFormat,
      downloadable,
      extractedFrom: '<meta property="og:video">',
      sourceType: 'opengraph',
    });
  }

  for (const s of scriptStreams) {
    pushVideo(s);
  }

  $('a[href]').each((_, el) => {
    if (videos.length >= maxVideos) return;
    const anchor = $(el);
    const resolved = sanitizeExtractedUrl(anchor.attr('href') || '', baseUrl);
    if (!resolved || !isVideoLikeUrl(resolved)) return;

    const ytId = extractYouTubeId(resolved);
    const card = anchor.closest('article, .course-card, .video-card, .card, li, tr, div');
    const title =
      cleanText(anchor.text()) ||
      cleanText(anchor.attr('title') || '') ||
      cleanText(card.find('h1, h2, h3, h4, .course-title').first().text()) ||
      'Video Link';
    const description = cleanText(card.find('p, .description, .summary, .course-desc').first().text()).slice(0, 240);
    const { streamFormat, downloadable } = detectStreamFormat(resolved);

    pushVideo({
      title: title.slice(0, 140),
      description,
      videoUrl: resolved,
      embedUrl: ytId ? `https://www.youtube.com/embed/${ytId}` : undefined,
      pageUrl: baseUrl,
      sourcePage: baseUrl,
      thumbnail: ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : undefined,
      streamFormat,
      downloadable,
      extractedFrom: 'HTML <a href> video link',
      sourceType: 'video-link',
    });
  });

  return videos;
}

function scoreCrawlCandidate(url: string, anchorText: string): number {
  const lower = `${url} ${anchorText}`.toLowerCase();
  if (
    /\.(jpg|jpeg|png|gif|svg|webp|ico|css|js|pdf|ppt|pptx|doc|docx|zip|rar|mp4|webm|mp3|xlsx|csv)(\?|$)/i.test(
      url
    )
  ) {
    return -100;
  }
  if (/(login|signin|sign-in|logout|register|signup|cart|checkout|mailto:|tel:|#)/i.test(lower)) {
    return -100;
  }

  let score = 1;
  if (
    /(admission|course|program|degree|bca|btech|mba|eligibility|fee|prospectus|notice|circular|result|faculty|department|lecture|lesson|module|syllabus|video|watch|tutorial|notes|study|semester|exam|academic|brochure)/i.test(
      lower
    )
  ) {
    score += 10;
  }
  if (/(next|page=|\/page\/|catalogue\/page|category|curriculum|article|post|book|news|update)/i.test(lower)) {
    score += 6;
  }
  if (/(privacy|terms|cookie|disclaimer)/i.test(lower)) {
    score -= 2;
  }
  return score;
}

function extractUniversalContent(
  html: string,
  baseUrl: string,
  cap: number,
  fetchMeta: {
    requestUrl: string;
    finalUrl: string;
    status?: number;
    durationMs?: number;
    redirectChain: Array<{ url: string; status: number }>;
    requestHeaders?: Record<string, string>;
    responseHeaders: Record<string, string>;
    htmlBytes: number;
    notes: string[];
  }
): {
  overview: SiteOverview;
  metadata: PageMetadata;
  videos: ExtractedVideo[];
  documents: ExtractedDocument[];
  items: ExtractedItem[];
  sections: ExtractedSection[];
  tables: ExtractedTable[];
  links: ExtractedLink[];
  images: Array<{ alt: string; src: string }>;
  searchForm: DetectedSearchForm | null;
  backendTrace: BackendTrace;
  detectedSelectors: DetectedSelector[];
  candidateCrawlUrls: Array<{ url: string; score: number }>;
} {
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLdObjects($);

  const { embeddedPayloads, ytVideos, scriptStreams } = extractEmbeddedPayloadsAndYouTube($, baseUrl);
  for (const obj of jsonLd) {
    const t = String(obj['@type'] || 'Schema');
    embeddedPayloads.push({
      name: `JSON-LD (${t})`,
      kind: 'json-ld',
      detail: cleanText(String(obj.name || obj.headline || obj.url || 'Structured Schema.org metadata')).slice(0, 120),
    });
  }

  const rawOgTitle = cleanText($('meta[property="og:title"]').attr('content') || '');
  const rawHeadTitle = cleanText($('title').first().text());
  const rawH1 = cleanText($('h1').first().text());
  const validH1 = rawH1 && !/^\d+$/.test(rawH1) ? rawH1 : '';
  const pageTitle = rawOgTitle || rawHeadTitle || validH1 || rawH1 || 'Untitled Webpage';

  const metaDescription =
    cleanText($('meta[name="description"]').attr('content') || '') ||
    cleanText($('meta[property="og:description"]').attr('content') || '') ||
    cleanText($('main p, article p, p').first().text()).slice(0, 260);

  const author =
    cleanText($('meta[name="author"]').attr('content') || '') ||
    cleanText($('[rel="author"], .author, .byline').first().text()).slice(0, 80);

  const publishedDate =
    cleanText($('meta[property="article:published_time"]').attr('content') || '') ||
    cleanText($('time[datetime]').first().attr('datetime') || '') ||
    cleanText($('time, .date, .published').first().text()).slice(0, 40);

  const siteName =
    cleanText($('meta[property="og:site_name"]').attr('content') || '') ||
    (() => {
      try {
        return new URL(baseUrl).hostname.replace(/^www\./, '');
      } catch {
        return 'website';
      }
    })();

  const thumbnail = sanitizeExtractedUrl(
    $('meta[property="og:image"]').attr('content') || $('article img, main img, img').first().attr('src') || '',
    baseUrl
  );

  const canonicalUrl =
    sanitizeExtractedUrl($('link[rel="canonical"]').attr('href') || '', baseUrl) || baseUrl;

  const bodyClone = $.root().clone();
  bodyClone.find('script, style, noscript, svg').remove();
  const bodyWords = cleanText(bodyClone.find('body').text() || bodyClone.text()).split(' ').filter(Boolean);
  const wordCount = bodyWords.length;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  const videos = extractVideosFromDom($, baseUrl, jsonLd, pageTitle, ytVideos, scriptStreams, cap);
  const documents = extractDocumentsFromDom($, baseUrl).slice(0, cap);

  const items: ExtractedItem[] = [];
  const seenItemTitles = new Set<string>();

  const specificSelectors: Array<{ sel: string; kind: ExtractedItem['kind'] }> = [
    { sel: '.course-card, .course-item, .course, .program-card, .department-card', kind: 'course' },
    { sel: '.notice, .admission, .admission-item, .news-item, .announcement', kind: 'article' },
    { sel: 'article.product_pod', kind: 'book' },
    { sel: '.book, .book-card, .product-card', kind: 'book' },
    { sel: '.quote', kind: 'article' },
    { sel: '.athing', kind: 'article' },
    { sel: 'article', kind: 'article' },
    { sel: '.post, .blog-post, .entry, .video-card', kind: 'article' },
  ];

  const collectFromSelector = (sel: string, kind: ExtractedItem['kind']) => {
    const matched = $(sel);
    if (matched.length === 0) return;
    matched.slice(0, cap).each((_, el) => {
      if (items.length >= cap) return;
      const card = $(el);
      const titleNode = card
        .find('h1, h2, h3, h4, .titleline > a, .title, .text, .course-title, .video-title')
        .first();
      const title =
        cleanText(titleNode.attr('title') || titleNode.text()) ||
        cleanText(card.find('a').first().text()).slice(0, 200);

      if (!title || seenItemTitles.has(title.toLowerCase())) return;
      seenItemTitles.add(title.toLowerCase());

      const linkHref =
        card.find('h2 a, h3 a, .titleline > a, a').first().attr('href') || '';
      const url = sanitizeExtractedUrl(linkHref, baseUrl) || undefined;

      const description = cleanText(
        card.find('p, .description, .summary, .course-desc, .video-desc, .searchresult').first().text()
      ).slice(0, 1000);

      const metaParts = [
        cleanText(card.find('.price_color, .price').first().text()),
        cleanText(card.find('.author, .byline, .instructor').first().text()),
        cleanText(card.find('.duration, time, .date').first().text()),
      ].filter(Boolean);

      const imgSrc = card.find('img').first().attr('src') || card.find('img').first().attr('data-src') || '';
      const image = sanitizeExtractedUrl(imgSrc, baseUrl) || undefined;

      items.push({
        title: title.slice(0, 260),
        description,
        url,
        image,
        meta: metaParts.join(' · ') || undefined,
        sourcePage: baseUrl,
        extractedFrom: `HTML container (${sel})`,
        kind,
      });
    });
  };

  for (const { sel, kind } of specificSelectors) {
    collectFromSelector(sel, kind);
  }

  if (items.length < 2) {
    collectFromSelector('.card, .result, .search-result, .mw-search-result, .list-group-item, .panel, .accordion-item', 'card');
  }

  if (items.length < 2) {
    for (const obj of jsonLd) {
      const t = String(obj['@type'] || '').toLowerCase();
      if (t.includes('book') || t.includes('product') || t.includes('course') || t.includes('article')) {
        const title = cleanText(String(obj.name || obj.headline || ''));
        if (!title || seenItemTitles.has(title.toLowerCase())) continue;
        seenItemTitles.add(title.toLowerCase());
        items.push({
          title,
          description: cleanText(String(obj.description || '')).slice(0, 1000),
          url: typeof obj.url === 'string' ? sanitizeExtractedUrl(obj.url, baseUrl) : undefined,
          sourcePage: baseUrl,
          extractedFrom: `JSON-LD (${String(obj['@type'])})`,
          kind: t.includes('course') ? 'course' : t.includes('book') ? 'book' : 'article',
        });
      }
    }
  }

  // Fallback: extract repeating list links inside <main> / <article> / body if still sparse
  if (items.length < 2) {
    $('main li, article li, .content li, ul li').slice(0, cap).each((_, el) => {
      if (items.length >= cap) return;
      const li = $(el);
      const anchor = li.find('a[href]').first();
      const title = cleanText(anchor.text() || li.text()).slice(0, 220);
      if (!title || title.length < 4 || seenItemTitles.has(title.toLowerCase())) return;
      seenItemTitles.add(title.toLowerCase());
      const href = sanitizeExtractedUrl(anchor.attr('href') || '', baseUrl) || undefined;
      items.push({
        title,
        description: cleanText(li.text()).slice(0, 600),
        url: href,
        sourcePage: baseUrl,
        extractedFrom: 'HTML <li> list item',
        kind: 'list-item',
      });
    });
  }

  const sections: ExtractedSection[] = [];
  const contentRoot = $('#mw-content-text, article, main').first().length
    ? $('#mw-content-text, article, main').first()
    : $('body');

  contentRoot.find('h1, h2, h3, h4').slice(0, cap).each((_, headingEl) => {
    const heading = cleanText($(headingEl).text()).replace(/\[edit\]$/i, '').trim();
    if (!heading || heading.length < 2) return;

    const paragraphs: string[] = [];
    let sibling = $(headingEl).next();
    let steps = 0;
    while (sibling.length && steps < 12) {
      const tag = (sibling.prop('tagName') || '').toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') break;
      if (tag === 'p' || tag === 'ul' || tag === 'ol' || tag === 'blockquote' || tag === 'div') {
        const text = cleanText(sibling.text());
        if (text.length > 20) paragraphs.push(text);
      }
      sibling = sibling.next();
      steps += 1;
    }

    if (paragraphs.length > 0) {
      sections.push({
        heading,
        content: paragraphs.join(' ').slice(0, 4000),
        sourcePage: baseUrl,
      });
    }
  });

  if (sections.length === 0) {
    const paras = contentRoot
      .find('p')
      .map((_, p) => cleanText($(p).text()))
      .get()
      .filter((t) => t.length > 25);
    if (paras.length > 0) {
      sections.push({
        heading: pageTitle,
        content: paras.join(' ').slice(0, 6000),
        sourcePage: baseUrl,
      });
    }
  }

  const tables: ExtractedTable[] = [];
  $('table').slice(0, cap).each((tIdx, tableEl) => {
    const tbl = $(tableEl);
    const headers = tbl
      .find('thead th, tr:first-child th')
      .map((i, th) => cleanText($(th).text()) || `col_${i + 1}`)
      .get();

    const rows: Array<Record<string, string>> = [];
    tbl.find('tbody tr, tr').slice(0, cap).each((_, trEl) => {
      const cells = $(trEl).find('td');
      if (!cells.length) return;
      const rowObj: Record<string, string> = {};
      cells.each((cIdx, tdEl) => {
        const key = headers[cIdx] || `column_${cIdx + 1}`;
        rowObj[key] = cleanText($(tdEl).text());
      });
      if (Object.values(rowObj).some(Boolean)) {
        rows.push(rowObj);
      }
    });

    if (rows.length > 0) {
      tables.push({
        caption: cleanText(tbl.find('caption').text()) || `Table ${tIdx + 1}`,
        headers: headers.length ? headers : Object.keys(rows[0]),
        rows,
      });
    }
  });

  const links: ExtractedLink[] = [];
  const seenLinks = new Set<string>();
  const candidateMap = new Map<string, number>();

  let baseHostname = '';
  try {
    baseHostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    baseHostname = '';
  }

  for (const v of videos) {
    if (!seenLinks.has(v.videoUrl) && links.length < cap) {
      seenLinks.add(v.videoUrl);
      links.push({
        text: v.title.slice(0, 140),
        url: v.videoUrl,
        category: 'video',
        extractedFrom: v.extractedFrom,
        sourcePage: baseUrl,
      });
    }
  }

  for (const d of documents) {
    if (!seenLinks.has(d.url) && links.length < cap) {
      seenLinks.add(d.url);
      links.push({
        text: `${d.title} (${d.fileType})`.slice(0, 140),
        url: d.url,
        category: 'document',
        extractedFrom: d.extractedFrom,
        sourcePage: baseUrl,
      });
    }
  }

  $('a[href]').each((_, el) => {
    const anchor = $(el);
    const resolved = sanitizeExtractedUrl(anchor.attr('href') || '', baseUrl);
    if (!resolved) return;

    const text = cleanText(anchor.text()) || cleanText(anchor.attr('title') || '') || resolved;
    let linkHost = '';
    try {
      linkHost = new URL(resolved).hostname.toLowerCase();
    } catch {
      linkHost = '';
    }

    const parentTag = anchor.closest('nav, header, footer, main, article, section').prop('tagName')?.toLowerCase() || 'body';
    const isVideo = isVideoLikeUrl(resolved);
    const isDoc = classifyDocumentUrl(resolved, text, anchor.attr('download') !== undefined) !== null;
    const isSameHost = baseHostname !== '' && linkHost === baseHostname;
    const lowerUrl = resolved.toLowerCase();
    const isArticle =
      lowerUrl.includes('/article') ||
      lowerUrl.includes('/post') ||
      lowerUrl.includes('/blog') ||
      lowerUrl.includes('/wiki/') ||
      lowerUrl.includes('/course') ||
      lowerUrl.includes('/lesson') ||
      lowerUrl.includes('/book') ||
      lowerUrl.includes('/catalogue/');

    const category: ExtractedLink['category'] = isVideo
      ? 'video'
      : isDoc
        ? 'document'
        : isArticle
          ? 'article'
          : isSameHost
            ? 'internal'
            : 'external';

    if (!seenLinks.has(resolved) && links.length < cap) {
      seenLinks.add(resolved);
      links.push({
        text: text.slice(0, 140),
        url: resolved,
        category,
        extractedFrom: `HTML <a href> inside <${parentTag}>`,
        sourcePage: baseUrl,
      });
    }

    if (isSameHost && !isYouTubeHost(resolved) && resolved !== baseUrl) {
      const score = scoreCrawlCandidate(resolved, text);
      if (score > 0) {
        const prev = candidateMap.get(resolved) ?? 0;
        if (score > prev) candidateMap.set(resolved, score);
      }
    }
  });

  const candidateCrawlUrls = Array.from(candidateMap.entries())
    .map(([url, score]) => ({ url, score }))
    .sort((a, b) => b.score - a.score);

  const sourceCounts = new Map<string, number>();
  for (const lnk of links) {
    sourceCounts.set(lnk.extractedFrom, (sourceCounts.get(lnk.extractedFrom) ?? 0) + 1);
  }
  const linkSourceBreakdown = Array.from(sourceCounts.entries()).map(([source, count]) => ({
    source,
    count,
  }));

  const images: Array<{ alt: string; src: string }> = [];
  const seenImgs = new Set<string>();
  $('img').each((_, el) => {
    if (images.length >= cap) return;
    const rawSrc = $(el).attr('src') || $(el).attr('data-src') || '';
    const src = sanitizeExtractedUrl(rawSrc, baseUrl);
    if (!src || seenImgs.has(src)) return;
    seenImgs.add(src);
    images.push({
      alt: cleanText($(el).attr('alt') || 'Image'),
      src,
    });
  });

  const lowerTitle = `${pageTitle} ${metaDescription}`.toLowerCase();
  let category = 'General Website';
  if (items.some((i) => i.kind === 'course') || documents.length > 0 || lowerTitle.includes('course') || lowerTitle.includes('bca') || lowerTitle.includes('syllabus')) {
    category = 'Courses & Study Portal';
  } else if (videos.length > 0 || isYouTubeHost(baseUrl) || lowerTitle.includes('video') || lowerTitle.includes('lecture')) {
    category = 'Video & Media';
  } else if (items.some((i) => i.kind === 'book') || lowerTitle.includes('book') || lowerTitle.includes('catalog')) {
    category = 'Books & Catalog';
  } else if (sections.length >= 2 || lowerTitle.includes('tutorial') || lowerTitle.includes('api') || baseUrl.includes('wikipedia.org')) {
    category = 'Educational / Article';
  } else if (items.length >= 2) {
    category = 'News & Posts';
  }

  const metadata: PageMetadata = {
    pageTitle,
    metaDescription,
    totalLinks: $('a[href]').length + ytVideos.length,
    totalHeadings: $('h1, h2, h3').length,
    totalImages: $('img').length,
    totalVideos: videos.length,
    totalDocuments: documents.length,
  };

  const networkEntries: NetworkTraceEntry[] = [
    {
      id: `doc-${fetchMeta.finalUrl}`,
      method: 'GET',
      url: fetchMeta.finalUrl,
      resourceType: 'document',
      status: fetchMeta.status ?? 200,
      durationMs: fetchMeta.durationMs ?? 0,
      bytes: fetchMeta.htmlBytes,
      requestHeaders: fetchMeta.requestHeaders ?? {},
      responseHeaders: fetchMeta.responseHeaders,
      initiator: fetchMeta.requestUrl !== fetchMeta.finalUrl ? `Redirect from ${fetchMeta.requestUrl}` : 'Direct Navigation',
      responsePreview: html.slice(0, 1500),
    },
  ];

  for (let i = 0; i < embeddedPayloads.length; i++) {
    const p = embeddedPayloads[i];
    if (p.kind === 'api-endpoint' || p.kind === 'feed') {
      const resolvedApi = sanitizeExtractedUrl(p.detail, baseUrl) || p.detail;
      networkEntries.push({
        id: `xhr-${i}-${resolvedApi}`,
        method: 'GET',
        url: resolvedApi,
        resourceType: 'xhr-discovered',
        status: 'Discovered',
        durationMs: 0,
        bytes: 0,
        requestHeaders: { Accept: 'application/json, */*' },
        responseHeaders: {},
        initiator: p.name,
        responsePreview: p.detail,
      });
    }
  }

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    if (v.playableType === 'hls' || v.playableType === 'html5') {
      networkEntries.push({
        id: `media-${i}-${v.videoUrl}`,
        method: 'GET',
        url: v.videoUrl,
        resourceType: 'media-stream',
        status: 'Stream Found',
        durationMs: 0,
        bytes: 0,
        requestHeaders: { Range: 'bytes=0-' },
        responseHeaders: { 'content-type': v.streamFormat || 'video/mp4' },
        initiator: v.extractedFrom,
        responsePreview: JSON.stringify({ title: v.title, format: v.streamFormat, proxyUrl: v.proxyStreamUrl }, null, 2),
      });
    }
  }

  const backendTrace: BackendTrace = {
    requestUrl: fetchMeta.requestUrl,
    finalUrl: fetchMeta.finalUrl,
    redirectChain: fetchMeta.redirectChain,
    requestHeaders: fetchMeta.requestHeaders ?? {},
    responseHeaders: fetchMeta.responseHeaders,
    htmlBytes: fetchMeta.htmlBytes,
    embeddedPayloads,
    linkSourceBreakdown,
    crawledUrls: [fetchMeta.finalUrl],
    networkEntries,
    notes: fetchMeta.notes,
  };

  return {
    overview: {
      title: pageTitle,
      description: metaDescription,
      author,
      publishedDate,
      siteName,
      thumbnail,
      canonicalUrl,
      category,
      wordCount,
      readingTimeMinutes,
    },
    metadata,
    videos,
    documents,
    items,
    sections,
    tables,
    links,
    images,
    searchForm: detectSearchForm($, baseUrl),
    backendTrace,
    detectedSelectors: detectSelectors($),
    candidateCrawlUrls,
  };
}

function readNodeValue(
  $: cheerio.CheerioAPI,
  node: ReturnType<cheerio.CheerioAPI>,
  attr: ExtractionRule['attribute'],
  baseUrl: string
): string {
  if (!node.length) return '';
  if (attr === 'href') {
    return sanitizeExtractedUrl(node.first().attr('href') || '', baseUrl);
  }
  if (attr === 'src') {
    const src = node.first().attr('src') || node.first().attr('data-src') || '';
    return sanitizeExtractedUrl(src, baseUrl);
  }
  return cleanText(node.first().text());
}

function extractCustomSelectors(
  html: string,
  baseUrl: string,
  containerSelector: string,
  rules: ExtractionRule[],
  cap: number
): Array<Record<string, string>> {
  const $ = cheerio.load(html);
  const cleanContainer = containerSelector.trim();
  const validRules = rules.filter((r) => r.key.trim() && r.selector.trim());
  if (validRules.length === 0) return [];

  const customItems: Array<Record<string, string>> = [];

  if (cleanContainer) {
    try {
      $(cleanContainer)
        .slice(0, cap)
        .each((_, el) => {
          const row: Record<string, string> = {};
          for (const rule of validRules) {
            const sel = rule.selector.trim();
            const target = sel === '.' || sel === ':self' ? $(el) : $(el).find(sel);
            row[rule.key.trim()] = readNodeValue($, target, rule.attribute, baseUrl);
          }
          if (Object.values(row).some(Boolean)) customItems.push(row);
        });
    } catch {
      return [];
    }
    return customItems;
  }

  const colMap: Record<string, string[]> = {};
  for (const rule of validRules) {
    const values: string[] = [];
    try {
      $(rule.selector.trim())
        .slice(0, cap)
        .each((_, el) => {
          const val = readNodeValue($, $(el), rule.attribute, baseUrl);
          if (val) values.push(val);
        });
    } catch {
      // ignore
    }
    colMap[rule.key.trim()] = values;
  }

  const maxRows = Math.max(0, ...Object.values(colMap).map((arr) => arr.length));
  for (let i = 0; i < maxRows; i++) {
    const row: Record<string, string> = {};
    for (const key of Object.keys(colMap)) {
      row[key] = colMap[key][i] ?? '';
    }
    customItems.push(row);
  }
  return customItems;
}

async function runFullExtraction(params: {
  sourceMode: 'url' | 'html';
  builderMode: BuilderMode;
  crawlDepth: CrawlDepth;
  url: string;
  rawHtml?: string;
  containerSelector: string;
  rules: ExtractionRule[];
  limit: number;
}): Promise<{
  status: number;
  extracted: Omit<ExtractResponse, 'ok' | 'status' | 'responseTimeMs'>;
}> {
  const cap = resolveLimitCap(params.limit);
  let html = '';
  let sourceUrl = params.url || 'https://example.edu/offline-demo';
  let requestUrl = sourceUrl;
  let upstreamStatus = 200;
  let upstreamDurationMs = 0;
  let redirectChain: Array<{ url: string; status: number }> = [];
  let requestHeaders: Record<string, string> = {};
  let responseHeaders: Record<string, string> = {};
  let htmlBytes = 0;
  const notes: string[] = [];

  if (params.sourceMode === 'html') {
    html = (params.rawHtml || '').slice(0, MAX_HTML_BYTES);
    if (!html.trim()) {
      throw new Error('HTML input cannot be empty in Raw HTML mode.');
    }
    htmlBytes = Buffer.byteLength(html, 'utf8');
    notes.push('Parsed directly from pasted HTML input (offline mode).');
  } else {
    const fetched = await safeFetchHtml(params.url);
    html = fetched.html;
    requestUrl = fetched.requestUrl;
    sourceUrl = fetched.finalUrl;
    upstreamStatus = fetched.status;
    upstreamDurationMs = fetched.durationMs;
    redirectChain = fetched.redirectChain;
    requestHeaders = fetched.requestHeaders;
    responseHeaders = fetched.responseHeaders;
    htmlBytes = fetched.htmlBytes;
    if (fetched.fetchNotes?.length) {
      notes.push(...fetched.fetchNotes);
    }
  }

  let universal = extractUniversalContent(html, sourceUrl, cap, {
    requestUrl,
    finalUrl: sourceUrl,
    status: upstreamStatus,
    durationMs: upstreamDurationMs,
    redirectChain,
    requestHeaders,
    responseHeaders,
    htmlBytes,
    notes,
  });

  if (params.sourceMode === 'url' && isYouTubeHost(sourceUrl) && universal.videos.length === 0) {
    const parsedYt = new URL(sourceUrl);
    if (parsedYt.pathname === '/' || parsedYt.pathname === '') {
      const eduFallbackUrl =
        'https://www.youtube.com/results?search_query=computer+science+programming+educational+tutorial';
      const ytFetched = await safeFetchHtml(eduFallbackUrl);
      notes.push(
        'YouTube root homepage hides recommendations without browser cookies. Automatically queried YouTube public educational search (/results?search_query=computer+science+programming+educational+tutorial) and enabled live ?q= YouTube search.'
      );
      universal = extractUniversalContent(ytFetched.html, ytFetched.finalUrl, cap, {
        requestUrl,
        finalUrl: ytFetched.finalUrl,
        status: ytFetched.status,
        durationMs: ytFetched.durationMs,
        redirectChain: [...redirectChain, { url: ytFetched.finalUrl, status: 200 }],
        requestHeaders: ytFetched.requestHeaders,
        responseHeaders: ytFetched.responseHeaders,
        htmlBytes: ytFetched.htmlBytes,
        notes,
      });
    }
  }

  // Multi-page Crawl Depth ('single' | 'linked' up to 20 | 'deep' up to 100)
  let crawledPagesCount = 0;
  const maxExtraPages =
    params.sourceMode !== 'url' || isYouTubeHost(sourceUrl)
      ? 0
      : params.crawlDepth === 'deep'
        ? 100
        : params.crawlDepth === 'linked'
          ? 20
          : 0;

  if (maxExtraPages > 0 && universal.candidateCrawlUrls.length > 0) {
    const crawlStarted = Date.now();
    const visitedUrls = new Set<string>([sourceUrl]);
    const queue = universal.candidateCrawlUrls.map((c) => c.url);

    const seenVideos = new Set(universal.videos.map((v) => v.videoUrl));
    const seenDocs = new Set(universal.documents.map((d) => d.url));
    const seenItems = new Set(universal.items.map((it) => `${it.title.toLowerCase()}|${it.url || ''}`));
    const seenSections = new Set(universal.sections.map((s) => s.heading.toLowerCase()));
    const seenLinks = new Set(universal.links.map((l) => l.url));
    const seenTables = new Set(
      universal.tables.map((t) => `${t.caption}|${t.headers.join(',')}|${t.rows.length}`)
    );

    while (
      queue.length > 0 &&
      crawledPagesCount < maxExtraPages &&
      Date.now() - crawlStarted < CRAWL_BUDGET_MS
    ) {
      const batch: string[] = [];
      while (queue.length > 0 && batch.length < 6 && crawledPagesCount + batch.length < maxExtraPages) {
        const nextUrl = queue.shift();
        if (nextUrl && !visitedUrls.has(nextUrl)) {
          visitedUrls.add(nextUrl);
          batch.push(nextUrl);
        }
      }
      if (batch.length === 0) break;

      const settled = await Promise.allSettled(
        batch.map((u) => safeFetchHtml(u, { fastMode: true }))
      );
      for (const res of settled) {
        if (res.status !== 'fulfilled') continue;
        crawledPagesCount += 1;
        const pageUrl = res.value.finalUrl;
        universal.backendTrace.crawledUrls.push(pageUrl);
        universal.backendTrace.networkEntries.push({
          id: `crawl-${crawledPagesCount}-${pageUrl}`,
          method: 'GET',
          url: pageUrl,
          resourceType: 'crawl-page',
          status: res.value.status,
          durationMs: res.value.durationMs,
          bytes: res.value.htmlBytes,
          requestHeaders: res.value.requestHeaders,
          responseHeaders: res.value.responseHeaders,
          initiator: `Crawler (${params.crawlDepth} mode)`,
          responsePreview: res.value.html.slice(0, 1200),
        });

        const sub = extractUniversalContent(res.value.html, pageUrl, cap, {
          requestUrl: res.value.requestUrl,
          finalUrl: pageUrl,
          status: res.value.status,
          durationMs: res.value.durationMs,
          redirectChain: res.value.redirectChain,
          requestHeaders: res.value.requestHeaders,
          responseHeaders: res.value.responseHeaders,
          htmlBytes: res.value.htmlBytes,
          notes: [],
        });

        for (const v of sub.videos) {
          if (!seenVideos.has(v.videoUrl) && universal.videos.length < cap) {
            seenVideos.add(v.videoUrl);
            universal.videos.push(v);
          }
        }
        for (const d of sub.documents) {
          if (!seenDocs.has(d.url) && universal.documents.length < cap) {
            seenDocs.add(d.url);
            universal.documents.push(d);
          }
        }
        for (const it of sub.items) {
          const key = `${it.title.toLowerCase()}|${it.url || ''}`;
          if (!seenItems.has(key) && universal.items.length < cap) {
            seenItems.add(key);
            universal.items.push(it);
          }
        }
        for (const sec of sub.sections) {
          const key = sec.heading.toLowerCase();
          if (!seenSections.has(key) && universal.sections.length < cap) {
            seenSections.add(key);
            universal.sections.push(sec);
          }
        }
        for (const tbl of sub.tables) {
          const tKey = `${tbl.caption}|${tbl.headers.join(',')}|${tbl.rows.length}`;
          if (!seenTables.has(tKey) && universal.tables.length < cap) {
            seenTables.add(tKey);
            universal.tables.push(tbl);
          }
        }
        for (const lnk of sub.links) {
          if (!seenLinks.has(lnk.url) && universal.links.length < cap) {
            seenLinks.add(lnk.url);
            universal.links.push(lnk);
          }
        }

        if (params.crawlDepth === 'deep') {
          for (const nextCand of sub.candidateCrawlUrls) {
            if (!visitedUrls.has(nextCand.url) && !queue.includes(nextCand.url)) {
              queue.push(nextCand.url);
            }
          }
        }
      }
    }

    if (crawledPagesCount > 0) {
      universal.backendTrace.notes.push(
        `Crawled ${crawledPagesCount} additional same-site page(s) (${params.crawlDepth} mode) to aggregate all public courses, videos, PDF notes, tables, and links.`
      );
    }

    const sourceCounts = new Map<string, number>();
    for (const lnk of universal.links) {
      sourceCounts.set(lnk.extractedFrom, (sourceCounts.get(lnk.extractedFrom) ?? 0) + 1);
    }
    universal.backendTrace.linkSourceBreakdown = Array.from(sourceCounts.entries()).map(([source, count]) => ({
      source,
      count,
    }));
    universal.metadata.totalVideos = universal.videos.length;
    universal.metadata.totalDocuments = universal.documents.length;
    universal.metadata.totalLinks = universal.links.length;
  }

  const customItems =
    params.builderMode === 'custom'
      ? extractCustomSelectors(html, sourceUrl, params.containerSelector, params.rules, cap)
      : [];

  return {
    status: upstreamStatus,
    extracted: {
      sourceMode: params.sourceMode,
      builderMode: params.builderMode,
      crawlDepth: params.crawlDepth,
      sourceUrl,
      overview: universal.overview,
      metadata: universal.metadata,
      videos: universal.videos.slice(0, cap),
      documents: universal.documents.slice(0, cap),
      items: universal.items.slice(0, cap),
      sections: universal.sections.slice(0, cap),
      tables: universal.tables.slice(0, cap),
      links: universal.links.slice(0, cap),
      images: universal.images.slice(0, cap),
      customItems,
      searchForm: universal.searchForm,
      backendTrace: universal.backendTrace,
      crawledPagesCount,
      detectedSelectors: universal.detectedSelectors,
      rawHtmlPreview: html.slice(0, 50_000),
    },
  };
}

function isOneEditAway(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
    } else {
      edits += 1;
      if (edits > 1) return false;
      if (a.length > b.length) i += 1;
      else if (b.length > a.length) j += 1;
      else {
        i += 1;
        j += 1;
      }
    }
  }
  if (i < a.length || j < b.length) edits += 1;
  return edits <= 1;
}

function scoreSearchMatch(haystack: string, query: string): number {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return 1;
  const lower = haystack.toLowerCase();
  let score = 0;

  if (lower.includes(cleanQuery)) {
    score += 100;
  }

  const terms = cleanQuery
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  if (terms.length === 0) {
    return lower.includes(cleanQuery) ? 10 : 0;
  }

  const tokens = lower.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  let matchedTerms = 0;

  for (const term of terms) {
    if (lower.includes(term)) {
      matchedTerms += 1;
      score += 20;
      continue;
    }
    const stem = term.length >= 4 ? term.slice(0, Math.max(3, term.length - 1)) : term;
    if (stem.length >= 3 && tokens.some((w) => w.startsWith(stem))) {
      matchedTerms += 1;
      score += 10;
      continue;
    }
    if (term.length >= 4 && tokens.some((w) => Math.abs(w.length - term.length) <= 1 && isOneEditAway(w, term))) {
      matchedTerms += 1;
      score += 6;
    }
  }

  if (matchedTerms === terms.length) {
    score += 40;
  }

  return score;
}

function filterAndRankItems<T>(
  list: T[],
  getHaystack: (item: T) => string,
  getLabel: (item: T) => string,
  query: string,
  sortMode: 'relevance' | 'az' | 'za'
): T[] {
  const cleanQ = query.trim();
  let scored = list
    .map((item) => ({
      item,
      score: cleanQ ? scoreSearchMatch(getHaystack(item), cleanQ) : 1,
    }))
    .filter((entry) => entry.score > 0);

  if (sortMode === 'az') {
    scored.sort((a, b) => getLabel(a.item).localeCompare(getLabel(b.item)));
  } else if (sortMode === 'za') {
    scored.sort((a, b) => getLabel(b.item).localeCompare(getLabel(a.item)));
  } else if (cleanQ) {
    scored.sort((a, b) => b.score - a.score || getLabel(a.item).localeCompare(getLabel(b.item)));
  }

  return scored.map((entry) => entry.item);
}

function normalizeRules(input: unknown): ExtractionRule[] {
  if (!Array.isArray(input)) return [];
  const clean: ExtractionRule[] = [];
  for (let i = 0; i < Math.min(input.length, 100); i++) {
    const item = input[i] as Partial<ExtractionRule> | null;
    if (!item || typeof item !== 'object') continue;
    const key = typeof item.key === 'string' ? item.key.trim().slice(0, 40) : '';
    const selector = typeof item.selector === 'string' ? item.selector.trim().slice(0, 120) : '';
    const attribute =
      item.attribute === 'href' || item.attribute === 'src' || item.attribute === 'text'
        ? item.attribute
        : 'text';
    if (key && selector) {
      clean.push({
        id: typeof item.id === 'string' && item.id ? item.id : `rule-${i + 1}`,
        key,
        selector,
        attribute,
      });
    }
  }
  return clean;
}

const f12CaptureSessions = new Map<string, CapturedF12Event[]>();

function recordF12Event(sessionId: string, event: CapturedF12Event) {
  if (!sessionId) return;
  const list = f12CaptureSessions.get(sessionId) ?? [];
  const filtered = list.filter((e) => e.id !== event.id);
  filtered.unshift(event);
  if (filtered.length > 250) filtered.length = 250;
  f12CaptureSessions.set(sessionId, filtered);
}

function sanitizeCapturedHeaders(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const blocked = new Set([
    'host',
    'content-length',
    'connection',
    'keep-alive',
    'transfer-encoding',
    'upgrade',
    'accept-encoding',
    'te',
    'trailer',
  ]);
  const clean: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (count >= 40) break;
    const key = k.replace(/[\r\n:]+/g, '').trim();
    if (!key || blocked.has(key.toLowerCase())) continue;
    const val = String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
    if (!val) continue;
    clean[key] = val.slice(0, 4000);
    count += 1;
  }
  return Object.keys(clean).length > 0 ? clean : undefined;
}

function normalizeJsonAssetsRecursively(
  node: unknown,
  sourceBaseUrl: string,
  currentKey = '',
  depth = 0
): unknown {
  if (depth > 16 || node === null || node === undefined) return node;
  if (Array.isArray(node)) {
    return node.map((item) => normalizeJsonAssetsRecursively(item, sourceBaseUrl, currentKey, depth + 1));
  }
  if (typeof node === 'object') {
    const rec = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) {
      out[k] = normalizeJsonAssetsRecursively(v, sourceBaseUrl, k, depth + 1);
    }
    return out;
  }
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (!trimmed) return node;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    const looksRelative =
      (trimmed.startsWith('/') && !trimmed.startsWith('//')) ||
      /^[^\s]+\.(jpg|jpeg|png|webp|gif|avif|mp4|m3u8|mkv|pdf|zip)(\?.*)?$/i.test(trimmed);
    const isAssetKey = /(poster|thumb|thumbnail|image|cover|backdrop|avatar|url|link|stream|dl|file|src|download)/i.test(
      currentKey
    );
    if (looksRelative && (trimmed.startsWith('/') || isAssetKey)) {
      try {
        return new URL(trimmed, sourceBaseUrl).toString();
      } catch {
        return node;
      }
    }
  }
  return node;
}

function buildTemplatedPatternUrl(
  template: string,
  vars: { q?: string; id?: string; page?: number | string }
): string {
  const tsVal = String(Math.floor(Date.now() / 1000));
  const qVal = encodeURIComponent(vars.q || '');
  const idVal = encodeURIComponent(vars.id || '');
  const pageVal = encodeURIComponent(String(vars.page || '1'));

  let out = template
    .replace(/\{q\}|\{\{QUERY\}\}/g, qVal)
    .replace(/\{id\}|\{slug\}/g, idVal)
    .replace(/\{page\}/g, pageVal)
    .replace(/\{timestamp\}|\{ts\}/g, tsVal);

  out = out.replace(/([?&](?:t|ts|timestamp|_)=)\d{10,13}/gi, `$1${tsVal}`);
  return out;
}

async function sanitizeCapturedPatternInput(cp: Partial<CapturedPattern>): Promise<CapturedPattern | undefined> {
  if (typeof cp.baseUrl !== 'string' || !cp.baseUrl.trim()) return undefined;
  const validatedPatternBase = (await validatePublicUrl(cp.baseUrl.trim())).toString();
  const validatedSiteUrl =
    typeof cp.siteUrl === 'string' && cp.siteUrl.trim()
      ? (await validatePublicUrl(cp.siteUrl.trim())).toString()
      : undefined;

  let staticUrlTemplate: string | undefined;
  if (typeof cp.staticUrlTemplate === 'string' && cp.staticUrlTemplate.trim()) {
    // Validate template host by substituting safe sample tokens first
    const testCandidate = buildTemplatedPatternUrl(cp.staticUrlTemplate.trim(), {
      q: cp.sampleQuery || 'test',
      id: cp.sampleId || '1',
      page: cp.samplePage || '1',
    });
    await validatePublicUrl(testCandidate);
    staticUrlTemplate = cp.staticUrlTemplate.trim().slice(0, 2000);
  }

  let multiRoutes: CapturedPattern['multiRoutes'] | undefined;
  if (cp.multiRoutes && typeof cp.multiRoutes === 'object') {
    const mr = cp.multiRoutes;
    const validateRouteTpl = async (raw?: unknown) => {
      if (typeof raw !== 'string' || !raw.trim()) return undefined;
      const testCandidate = buildTemplatedPatternUrl(raw.trim(), {
        q: cp.sampleQuery || 'test',
        id: cp.sampleId || '1',
        page: '1',
      });
      await validatePublicUrl(testCandidate);
      return raw.trim().slice(0, 2000);
    };
    const latestUrl = await validateRouteTpl(mr.latestUrl);
    const searchUrl = await validateRouteTpl(mr.searchUrl);
    const detailUrl = await validateRouteTpl(mr.detailUrl);
    if (latestUrl || searchUrl || detailUrl) {
      multiRoutes = { latestUrl, searchUrl, detailUrl };
    }
  }

  return {
    kind: cp.kind === 'json-api' ? 'json-api' : 'html-search',
    baseUrl: validatedPatternBase,
    staticUrlTemplate,
    method: cp.method === 'POST' ? 'POST' : 'GET',
    queryParam: typeof cp.queryParam === 'string' ? cp.queryParam.trim().slice(0, 60) : undefined,
    idParam: typeof cp.idParam === 'string' ? cp.idParam.trim().slice(0, 60) : undefined,
    pageParam: typeof cp.pageParam === 'string' ? cp.pageParam.trim().slice(0, 60) : undefined,
    timestampParam: typeof cp.timestampParam === 'string' ? cp.timestampParam.trim().slice(0, 60) : undefined,
    requestHeaders: sanitizeCapturedHeaders(cp.requestHeaders),
    postBodyTemplate:
      typeof cp.postBodyTemplate === 'string' && cp.postBodyTemplate.trim()
        ? cp.postBodyTemplate.slice(0, 20_000)
        : undefined,
    sampleQuery: typeof cp.sampleQuery === 'string' ? cp.sampleQuery.trim().slice(0, 120) : undefined,
    sampleId: typeof cp.sampleId === 'string' ? cp.sampleId.trim().slice(0, 120) : undefined,
    samplePage: typeof cp.samplePage === 'string' ? cp.samplePage.trim().slice(0, 30) : undefined,
    multiRoutes,
    collectAll: cp.collectAll !== false,
    siteUrl: validatedSiteUrl,
  };
}

function buildDynamicPostBody(
  template: string | undefined,
  queryParam: string | undefined,
  queryText: string,
  sampleQuery: string | undefined,
  pageParam?: string,
  pageNum?: number,
  idText?: string
): string | undefined {
  const tsVal = String(Math.floor(Date.now() / 1000));
  if (!template) {
    if (!queryText && !pageNum && !idText) return undefined;
    const obj: Record<string, unknown> = {};
    if (queryText) obj[queryParam || 'q'] = queryText;
    if (idText) obj.id = idText;
    if (pageNum && pageParam) obj[pageParam] = pageNum;
    return JSON.stringify(obj);
  }

  let out = template;
  if (out.trimStart().startsWith('{')) {
    try {
      const parsed = JSON.parse(out) as Record<string, unknown>;
      const replacePlaceholders = (node: unknown): unknown => {
        if (Array.isArray(node)) return node.map(replacePlaceholders);
        if (node && typeof node === 'object') {
          const rec = node as Record<string, unknown>;
          const next: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(rec)) {
            next[k] = replacePlaceholders(v);
          }
          return next;
        }
        if (typeof node === 'string') {
          if (node === '{q}' || node === '{{QUERY}}') return queryText || sampleQuery || '';
          if (node === '{id}' || node === '{slug}') return idText || queryText || '';
          if (node === '{page}') return String(pageNum || 1);
          if (node === '{timestamp}' || node === '{ts}') return tsVal;
        }
        return node;
      };
      const replaced = replacePlaceholders(parsed) as Record<string, unknown>;
      if (queryText && queryParam && queryParam in replaced && !template.includes('{q}') && !template.includes('{{QUERY}}')) {
        replaced[queryParam] = queryText;
      }
      if (pageNum && pageParam) {
        replaced[pageParam] = pageNum;
      }
      return JSON.stringify(replaced);
    } catch {
      // fallback below
    }
  }

  out = out
    .replace(/\{q\}|\{\{QUERY\}\}/g, queryText || sampleQuery || '')
    .replace(/\{id\}|\{slug\}/g, idText || queryText || '')
    .replace(/\{page\}/g, String(pageNum || 1))
    .replace(/\{timestamp\}|\{ts\}/g, tsVal);
  if (queryText && sampleQuery && sampleQuery.length > 0 && out.includes(sampleQuery)) {
    out = out.split(sampleQuery).join(queryText);
  }
  return out;
}

function findNextPageUrlFromJson(obj: unknown, currentUrl: string): string | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const rec = obj as Record<string, unknown>;
  for (const key of ['next', 'next_page', 'nextPage', 'next_url', 'nextUrl']) {
    const val = rec[key];
    if (typeof val === 'string' && val.trim() && !/^(null|none|false)$/i.test(val.trim())) {
      const abs = sanitizeExtractedUrl(val.trim(), currentUrl);
      if (abs && abs !== currentUrl) return abs;
    }
  }
  if (rec.links && typeof rec.links === 'object') {
    const nested = findNextPageUrlFromJson(rec.links, currentUrl);
    if (nested) return nested;
  }
  if (rec.pagination && typeof rec.pagination === 'object') {
    const nested = findNextPageUrlFromJson(rec.pagination, currentUrl);
    if (nested) return nested;
  }
  return null;
}

function getServerOrigin(req: Request): string {
  const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
  const protoHeader = req.get('x-forwarded-proto');
  let proto = (protoHeader ? protoHeader.split(',')[0].trim() : '') || req.protocol || 'http';
  if (host.endsWith('.run.app')) {
    proto = 'https';
  }
  return `${proto}://${host}`;
}

function detectSearchQueryParam(rawUrl: string): { param: string; value: string } | undefined {
  try {
    const u = new URL(rawUrl);
    const preferred = [
      'q',
      'query',
      'search',
      'search_query',
      's',
      'k',
      'keyword',
      'keywords',
      'term',
      'text',
      'find',
      'filter',
      'topic',
      'course',
    ];
    for (const key of preferred) {
      const val = u.searchParams.get(key);
      if (val && val.trim()) {
        return { param: key, value: val.trim() };
      }
    }
    const skip = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'hl', 'lang', 'page']);
    for (const [key, val] of u.searchParams.entries()) {
      if (!skip.has(key.toLowerCase()) && val.trim() && val.length <= 100) {
        return { param: key, value: val.trim() };
      }
    }
  } catch {
    // ignore malformed URL
  }
  return undefined;
}

function extractMediaAndItemsFromJson(
  jsonData: unknown,
  baseUrl: string,
  cap: number
): {
  videos: ExtractedVideo[];
  documents: ExtractedDocument[];
  items: ExtractedItem[];
  links: ExtractedLink[];
} {
  const videos: ExtractedVideo[] = [];
  const documents: ExtractedDocument[] = [];
  const items: ExtractedItem[] = [];
  const links: ExtractedLink[] = [];
  const seenVideos = new Set<string>();
  const seenDocs = new Set<string>();
  const seenLinks = new Set<string>();
  const seenItems = new Set<string>();

  const visit = (node: unknown, contextTitle = '') => {
    if (!node || videos.length >= cap && items.length >= cap) return;
    if (Array.isArray(node)) {
      for (const el of node) visit(el, contextTitle);
      return;
    }
    if (typeof node === 'string') {
      const clean = node.trim();
      if (/^https?:\/\//i.test(clean) || (clean.startsWith('/') && /\.(mp4|m3u8|webm|pdf|pptx|docx)/i.test(clean))) {
        const abs = sanitizeExtractedUrl(clean, baseUrl);
        if (!abs) return;
        if (isVideoLikeUrl(abs) && !seenVideos.has(abs)) {
          seenVideos.add(abs);
          const { streamFormat, downloadable, playableType } = detectStreamFormat(abs);
          videos.push({
            title: contextTitle || `${streamFormat} Stream`,
            description: 'Stream URL captured from upstream JSON API payload.',
            videoUrl: abs,
            embedUrl: extractYouTubeId(abs) ? `https://www.youtube.com/embed/${extractYouTubeId(abs)}` : undefined,
            proxyStreamUrl: buildProxyStreamUrl(abs, playableType),
            playableType,
            pageUrl: baseUrl,
            sourcePage: baseUrl,
            streamFormat,
            downloadable,
            extractedFrom: 'JSON API field',
            sourceType: 'script-stream',
          });
        } else {
          const docType = classifyDocumentUrl(abs, contextTitle, false);
          if (docType && !seenDocs.has(abs)) {
            seenDocs.add(abs);
            documents.push({
              title: contextTitle || abs.split('/').pop() || 'Document',
              url: abs,
              fileType: docType,
              sourcePage: baseUrl,
              extractedFrom: 'JSON API field',
            });
          } else if (!seenLinks.has(abs)) {
            seenLinks.add(abs);
            links.push({
              text: contextTitle || abs,
              url: abs,
              category: isVideoLikeUrl(abs) ? 'video' : docType ? 'document' : 'external',
              extractedFrom: 'JSON API field',
              sourcePage: baseUrl,
            });
          }
        }
      }
      return;
    }
    if (typeof node === 'object') {
      const rec = node as Record<string, unknown>;
      const titleCandidate =
        (typeof rec.title === 'string' && rec.title) ||
        (typeof rec.name === 'string' && rec.name) ||
        (typeof rec.headline === 'string' && rec.headline) ||
        (typeof rec.label === 'string' && rec.label) ||
        (typeof rec.courseName === 'string' && rec.courseName) ||
        contextTitle;
      const descCandidate =
        (typeof rec.description === 'string' && rec.description) ||
        (typeof rec.summary === 'string' && rec.summary) ||
        (typeof rec.snippet === 'string' && rec.snippet) ||
        (typeof rec.body === 'string' && rec.body) ||
        '';
      const urlCandidate =
        (typeof rec.url === 'string' && rec.url) ||
        (typeof rec.link === 'string' && rec.link) ||
        (typeof rec.href === 'string' && rec.href) ||
        (typeof rec.streamUrl === 'string' && rec.streamUrl) ||
        (typeof rec.videoUrl === 'string' && rec.videoUrl) ||
        '';

      if (titleCandidate && titleCandidate.length >= 2 && (descCandidate || urlCandidate)) {
        const key = `${titleCandidate.toLowerCase()}|${urlCandidate}`;
        if (!seenItems.has(key) && items.length < cap) {
          seenItems.add(key);
          items.push({
            title: cleanText(titleCandidate).slice(0, 180),
            description: cleanText(descCandidate).slice(0, 320),
            url: urlCandidate ? sanitizeExtractedUrl(urlCandidate, baseUrl) || undefined : undefined,
            sourcePage: baseUrl,
            extractedFrom: 'JSON API object',
            kind: 'card',
          });
        }
      }

      for (const val of Object.values(rec)) {
        visit(val, titleCandidate || contextTitle);
      }
    }
  };

  visit(jsonData);
  return {
    videos: videos.slice(0, cap),
    documents: documents.slice(0, cap),
    items: items.slice(0, cap),
    links: links.slice(0, cap),
  };
}

function buildProxiedHtml(
  rawHtml: string,
  finalUrl: string,
  serverOrigin: string,
  sessionId: string,
  pageEvent: CapturedF12Event
): string {
  const $ = cheerio.load(rawHtml);

  // Strip restrictive CSP or frame-busting meta tags inside the proxied frame
  $('meta[http-equiv="Content-Security-Policy"], meta[http-equiv="X-Frame-Options"]').remove();

  // Rewrite links to stay inside the interactive F12 proxy browser
  $('a[href]').each((_, el) => {
    const rawHref = ($(el).attr('href') || '').trim();
    if (!rawHref || rawHref.startsWith('#') || /^(javascript|mailto|tel|data):/i.test(rawHref)) {
      return;
    }
    const abs = sanitizeExtractedUrl(rawHref, finalUrl);
    if (!abs) return;

    const isDirectFile = /\.(pdf|ppt|pptx|doc|docx|zip|rar|xls|xlsx|mp4|webm|m3u8|mov)(\?|$)/i.test(abs);
    if (isDirectFile) {
      $(el).attr('href', abs);
      $(el).attr('target', '_blank');
      $(el).attr('rel', 'noopener noreferrer');
      $(el).attr('data-s2a-media', abs);
    } else {
      const proxied = `${serverOrigin}/api/browser-proxy?url=${encodeURIComponent(abs)}&sessionId=${encodeURIComponent(sessionId)}`;
      $(el).attr('href', proxied);
      $(el).removeAttr('target');
    }
  });

  // Rewrite forms so searching inside ANY website submits through our proxy and records query params
  $('form').each((_, el) => {
    const rawAction = ($(el).attr('action') || '').trim();
    const absAction = rawAction ? sanitizeExtractedUrl(rawAction, finalUrl) || finalUrl : finalUrl;
    const method = ($(el).attr('method') || 'GET').toUpperCase();
    $(el).removeAttr('target');

    if (method === 'POST') {
      $(el).attr(
        'action',
        `${serverOrigin}/api/browser-proxy?url=${encodeURIComponent(absAction)}&sessionId=${encodeURIComponent(sessionId)}`
      );
    } else {
      $(el).attr('method', 'GET');
      $(el).attr('action', `${serverOrigin}/api/browser-proxy`);
      $(el).find('input[name="__proxy_target"], input[name="__session_id"]').remove();
      $(el).prepend(
        `<input type="hidden" name="__proxy_target" value="${escapeHtmlAttr(absAction)}" />` +
          `<input type="hidden" name="__session_id" value="${escapeHtmlAttr(sessionId)}" />`
      );
    }
  });

  const safeEventPayload = JSON.stringify({
    source: 'site2api-f12',
    type: 'event',
    sessionId,
    event: {
      ...pageEvent,
      videos: (pageEvent.videos || []).slice(0, 60),
      documents: (pageEvent.documents || []).slice(0, 60),
      items: (pageEvent.items || []).slice(0, 60),
      links: (pageEvent.links || []).slice(0, 80),
    },
  }).replace(/<\/script/gi, '<\\/script');

  const hookScript = `
<base href="${escapeHtmlAttr(finalUrl)}" />
<script data-s2a-hook="1">
(function () {
  var SERVER_ORIGIN = ${JSON.stringify(serverOrigin)};
  var SESSION_ID = ${JSON.stringify(sessionId)};
  var PAGE_URL = ${JSON.stringify(finalUrl)};

  function notifyParent(evt) {
    try {
      window.parent.postMessage({ source: 'site2api-f12', type: 'event', sessionId: SESSION_ID, event: evt }, '*');
    } catch (e) {}
  }

  try {
    var initMsg = ${safeEventPayload};
    window.parent.postMessage(initMsg, '*');
  } catch (e) {}

  function resolveTarget(u) {
    try { return new URL(u, PAGE_URL).toString(); } catch (e) { return String(u || ''); }
  }

  // Intercept client-side fetch() inside proxied site so AJAX searches work & appear in F12
  try {
    var origFetch = window.fetch;
    if (typeof origFetch === 'function') {
      window.fetch = function (input, init) {
        var rawUrl = typeof input === 'string' ? input : (input && input.url) || '';
        if (!rawUrl || rawUrl.indexOf(SERVER_ORIGIN + '/api/') === 0) {
          return origFetch.apply(this, arguments);
        }
        var absUrl = resolveTarget(rawUrl);
        if (!/^https?:/i.test(absUrl)) {
          return origFetch.apply(this, arguments);
        }
        var proxiedXhr = SERVER_ORIGIN + '/api/browser-proxy-xhr?url=' + encodeURIComponent(absUrl) + '&sessionId=' + encodeURIComponent(SESSION_ID);
        return origFetch.call(this, proxiedXhr, init).then(function (resp) {
          try {
            var clone = resp.clone();
            clone.text().then(function (txt) {
              notifyParent({
                id: 'xhr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
                sessionId: SESSION_ID,
                timestamp: new Date().toISOString(),
                method: (init && init.method) || 'GET',
                url: absUrl,
                resourceType: 'fetch',
                status: resp.status,
                contentType: resp.headers.get('content-type') || 'application/json',
                durationMs: 0,
                bytes: txt.length,
                initiator: 'Page fetch()',
                requestHeaders: (init && init.headers) ? init.headers : {},
                responseHeaders: {},
                responsePreview: txt.slice(0, 4000),
                isJson: (resp.headers.get('content-type') || '').indexOf('json') !== -1
              });
            }).catch(function () {});
          } catch (e) {}
          return resp;
        });
      };
    }
  } catch (e) {}

  // Intercept XMLHttpRequest inside proxied site
  try {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__s2aMethod = method || 'GET';
      this.__s2aRawUrl = url;
      var absUrl = resolveTarget(url);
      if (absUrl && /^https?:/i.test(absUrl) && absUrl.indexOf(SERVER_ORIGIN + '/api/') !== 0) {
        this.__s2aTargetUrl = absUrl;
        var proxiedUrl = SERVER_ORIGIN + '/api/browser-proxy-xhr?url=' + encodeURIComponent(absUrl) + '&sessionId=' + encodeURIComponent(SESSION_ID);
        return origOpen.call(this, method, proxiedUrl, true);
      }
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var self = this;
      if (self.__s2aTargetUrl) {
        self.addEventListener('load', function () {
          try {
            var txt = typeof self.responseText === 'string' ? self.responseText : '';
            notifyParent({
              id: 'xhr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
              sessionId: SESSION_ID,
              timestamp: new Date().toISOString(),
              method: self.__s2aMethod || 'GET',
              url: self.__s2aTargetUrl,
              resourceType: 'xhr',
              status: self.status,
              contentType: self.getResponseHeader('content-type') || 'text/plain',
              durationMs: 0,
              bytes: txt.length,
              initiator: 'XMLHttpRequest',
              requestHeaders: {},
              responseHeaders: {},
              responsePreview: txt.slice(0, 4000),
              isJson: (self.getResponseHeader('content-type') || '').indexOf('json') !== -1
            });
          } catch (e) {}
        });
      }
      return origSend.apply(this, arguments);
    };
  } catch (e) {}

  // Sniff video/audio/iframe streams & PDF clicks live in the rendered page
  var reportedMedia = {};
  function reportMedia(src, kind) {
    if (!src || reportedMedia[src] || !/^https?:/i.test(src)) return;
    reportedMedia[src] = true;
    var evt = {
      id: 'media-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      sessionId: SESSION_ID,
      timestamp: new Date().toISOString(),
      method: 'GET',
      url: src,
      resourceType: kind || 'media',
      status: 200,
      contentType: kind === 'pdf' ? 'application/pdf' : 'video/stream',
      durationMs: 0,
      bytes: 0,
      initiator: 'Live DOM / Player Sniffer',
      requestHeaders: {},
      responseHeaders: {},
      responsePreview: 'Captured live ' + (kind || 'media') + ' source from page: ' + src
    };
    notifyParent(evt);
    try {
      fetch(SERVER_ORIGIN + '/api/f12-captures/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: SESSION_ID, event: evt })
      }).catch(function () {});
    } catch (e) {}
  }

  function scanMediaNodes() {
    try {
      var vids = document.querySelectorAll('video, video source, audio, audio source, iframe[src]');
      for (var i = 0; i < vids.length; i++) {
        var s = vids[i].currentSrc || vids[i].getAttribute('src') || vids[i].getAttribute('data-src');
        if (s) reportMedia(resolveTarget(s), 'media');
      }
    } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', scanMediaNodes);
  document.addEventListener('play', function (e) {
    var t = e && e.target;
    if (t) {
      var s = t.currentSrc || t.getAttribute('src');
      if (s) reportMedia(resolveTarget(s), 'media');
    }
  }, true);
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a[data-s2a-media]') : null;
    if (el) {
      var href = el.getAttribute('href');
      var isPdf = /\\.(pdf|ppt|pptx|doc|docx|zip|xls|xlsx)(\\?|$)/i.test(href || '');
      reportMedia(href, isPdf ? 'pdf' : 'media');
    }
  }, true);
  try {
    new MutationObserver(scanMediaNodes).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
})();
</script>`;

  if ($('head').length > 0) {
    $('head').prepend(hookScript);
  } else {
    $.root().prepend(`<head>${hookScript}</head>`);
  }

  return $.html();
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', endpoints: publishedEndpoints.size, timestamp: new Date().toISOString() });
  });

  app.get('/api/presets', (_req: Request, res: Response) => {
    res.json({ presets: PRESETS });
  });

  app.post('/api/extract', async (req: Request, res: Response) => {
    const startedAt = performance.now();
    try {
      const body = req.body ?? {};
      const sourceMode = body.sourceMode === 'html' ? 'html' : 'url';
      const builderMode: BuilderMode = body.builderMode === 'custom' ? 'custom' : 'auto';
      const crawlDepth = parseCrawlDepth(body.crawlDepth);
      const containerSelector =
        typeof body.containerSelector === 'string' ? body.containerSelector.slice(0, 120) : '';
      const rules = normalizeRules(body.rules);
      const limit =
        body.limit === 0 || body.limit === 'all'
          ? 0
          : typeof body.limit === 'number' && Number.isFinite(body.limit)
            ? Math.max(1, Math.min(UNLIMITED_SAFE_CAP, Math.floor(body.limit)))
            : 0;
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      const rawHtml = typeof body.rawHtml === 'string' ? body.rawHtml : '';

      if (sourceMode === 'url' && !url) {
        res.status(400).json({
          ok: false,
          status: 400,
          responseTimeMs: Math.round(performance.now() - startedAt),
          error: 'Please enter a website URL to build its API.',
        });
        return;
      }

      if (builderMode === 'custom' && rules.length === 0) {
        res.status(400).json({
          ok: false,
          status: 400,
          responseTimeMs: Math.round(performance.now() - startedAt),
          error: 'Custom mode requires at least one CSS selector field, or switch to Smart Auto.',
        });
        return;
      }

      const { status, extracted } = await runFullExtraction({
        sourceMode,
        builderMode,
        crawlDepth,
        url,
        rawHtml,
        containerSelector,
        rules,
        limit,
      });

      const payload: ExtractResponse = {
        ok: true,
        status,
        responseTimeMs: Math.round(performance.now() - startedAt),
        ...extracted,
      };
      res.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed.';
      res.status(422).json({
        ok: false,
        status: 422,
        responseTimeMs: Math.round(performance.now() - startedAt),
        error: message,
      });
    }
  });

  app.get('/api/endpoints', (_req: Request, res: Response) => {
    const list = Array.from(publishedEndpoints.values()).map((ep) => ({
      ...ep,
      rawHtml: undefined,
    }));
    res.json({ endpoints: list });
  });

  app.post('/api/endpoints', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const rawSlug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
      const slug = rawSlug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

      if (!slug || slug.length < 2 || slug.length > 96) {
        res.status(400).json({ error: 'Endpoint slug must be 2–96 lowercase letters, numbers, or hyphens.' });
        return;
      }

      const sourceMode = body.sourceMode === 'html' ? 'html' : 'url';
      const builderMode: BuilderMode = body.builderMode === 'custom' ? 'custom' : 'auto';
      const crawlDepth = parseCrawlDepth(body.crawlDepth);
      const rawUrl =
        typeof body.url === 'string' && body.url.trim() ? body.url.trim() : 'https://example.edu/offline-demo';
      let validatedUrl = rawUrl;
      if (sourceMode === 'url') {
        validatedUrl = (await validatePublicUrl(rawUrl)).toString();
      }

      const rules = normalizeRules(body.rules);
      const containerSelector =
        typeof body.containerSelector === 'string' ? body.containerSelector.trim().slice(0, 120) : '';
      const name =
        typeof body.name === 'string' && body.name.trim()
          ? body.name.trim().slice(0, 90)
          : `API (${slug})`;
      const limit =
        body.limit === 0 || body.limit === 'all'
          ? 0
          : typeof body.limit === 'number' && Number.isFinite(body.limit)
            ? Math.max(1, Math.min(UNLIMITED_SAFE_CAP, Math.floor(body.limit)))
            : 0;
      const rawHtml =
        sourceMode === 'html' && typeof body.rawHtml === 'string'
          ? body.rawHtml.slice(0, MAX_HTML_BYTES)
          : undefined;

      if (sourceMode === 'html' && (!rawHtml || !rawHtml.trim())) {
        res.status(400).json({ error: 'Raw HTML content is required for an offline HTML endpoint.' });
        return;
      }

      let capturedPattern: CapturedPattern | undefined;
      if (body.capturedPattern && typeof body.capturedPattern === 'object') {
        capturedPattern = await sanitizeCapturedPatternInput(body.capturedPattern as Partial<CapturedPattern>);
      }

      const endpoint: PublishedEndpoint = {
        slug,
        name,
        sourceMode,
        builderMode,
        crawlDepth,
        url: validatedUrl,
        rawHtml,
        containerSelector,
        rules,
        limit,
        createdAt: new Date().toISOString(),
        hitCount: publishedEndpoints.get(slug)?.hitCount ?? 0,
        hasSearchForm: sourceMode === 'url' && (Boolean(body.hasSearchForm) || isYouTubeHost(validatedUrl)),
        capturedPattern,
      };

      publishedEndpoints.set(slug, endpoint);
      endpointCache.delete(slug);

      res.status(201).json({
        endpoint: { ...endpoint, rawHtml: undefined },
        livePath: `/api/v1/${slug}`,
        openApiPath: `/api/v1/${slug}/openapi.json`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to publish endpoint.';
      res.status(400).json({ error: message });
    }
  });

  app.delete('/api/endpoints/:slug', (req: Request, res: Response) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!publishedEndpoints.has(slug)) {
      res.status(404).json({ error: 'Endpoint not found.' });
      return;
    }
    publishedEndpoints.delete(slug);
    endpointCache.delete(slug);
    res.json({ deleted: slug });
  });

  // F12 Captured Session Management Routes
  app.get('/api/f12-captures', (req: Request, res: Response) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    const events = sessionId ? f12CaptureSessions.get(sessionId) ?? [] : [];
    res.json({ sessionId, events });
  });

  app.post('/api/f12-captures/record', (req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    const body = req.body ?? {};
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const evt = body.event as CapturedF12Event | undefined;
    if (sessionId && evt && typeof evt.url === 'string') {
      recordF12Event(sessionId, evt);
    }
    res.json({ ok: true });
  });

  app.delete('/api/f12-captures', (req: Request, res: Response) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    if (sessionId) f12CaptureSessions.delete(sessionId);
    res.json({ ok: true });
  });

  // Live preview test for Manual F12 captured requests before/during publishing
  app.post('/api/manual-f12/test', async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const cp = body.capturedPattern as Partial<CapturedPattern> | undefined;
      const pattern = cp ? await sanitizeCapturedPatternInput(cp) : undefined;
      if (!pattern) {
        res.status(400).json({ error: 'Request URL is required to test Manual F12 capture.' });
        return;
      }
      const testEndpoint: PublishedEndpoint = {
        slug: 'manual-preview',
        name: 'Manual F12 Capture Preview',
        sourceMode: 'url',
        builderMode: 'auto',
        crawlDepth: pattern.collectAll ? 'deep' : 'single',
        url: pattern.siteUrl || pattern.baseUrl,
        containerSelector: '',
        rules: [],
        limit: 0,
        createdAt: new Date().toISOString(),
        hitCount: 0,
        hasSearchForm: Boolean(pattern.queryParam),
        capturedPattern: pattern,
      };
      await executeLiveApiEndpoint(req, res, testEndpoint, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Manual F12 test failed.';
      res.status(400).json({ error: msg });
    }
  });

  // Reverse-Proxy XHR/Fetch Bridge for sandboxed in-app browser
  app.options('/api/browser-proxy-xhr', (_req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    res.status(204).end();
  });

  app.all('/api/browser-proxy-xhr', async (req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    const rawTarget = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : 'default';
    if (!rawTarget) {
      res.status(400).json({ error: 'Missing ?url= parameter.' });
      return;
    }
    const startedAt = performance.now();
    try {
      const validated = await validatePublicUrl(rawTarget);
      const method = req.method === 'POST' ? 'POST' : 'GET';
      const reqHeaders = buildBrowserHeaders('chrome');
      let bodyPayload: string | undefined;
      if (method === 'POST' && req.body) {
        reqHeaders['Content-Type'] = req.get('content-type') || 'application/json';
        bodyPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const upstream = await fetch(validated.toString(), {
        method,
        headers: reqHeaders,
        body: bodyPayload,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      const ct = upstream.headers.get('content-type') || 'application/octet-stream';
      const text = (await upstream.text()).slice(0, MAX_HTML_BYTES);
      const durationMs = Math.round(performance.now() - startedAt);
      const detected = detectSearchQueryParam(validated.toString());

      let parsedJson: unknown = null;
      let isJson = ct.toLowerCase().includes('json');
      if (!isJson && (text.trimStart().startsWith('{') || text.trimStart().startsWith('['))) {
        try {
          parsedJson = JSON.parse(text);
          isJson = true;
        } catch {
          isJson = false;
        }
      } else if (isJson) {
        try {
          parsedJson = JSON.parse(text);
        } catch {
          // keep raw preview
        }
      }

      const extractedFromJson = parsedJson
        ? extractMediaAndItemsFromJson(parsedJson, validated.toString(), UNLIMITED_SAFE_CAP)
        : undefined;

      const respHeaders: Record<string, string> = {};
      upstream.headers.forEach((v, k) => {
        if (!['content-security-policy', 'x-frame-options'].includes(k.toLowerCase())) {
          respHeaders[k] = v;
        }
      });

      recordF12Event(sessionId, {
        id: `xhr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sessionId,
        timestamp: new Date().toISOString(),
        method,
        url: validated.toString(),
        resourceType: 'fetch',
        status: upstream.status,
        contentType: ct,
        durationMs,
        bytes: Buffer.byteLength(text, 'utf8'),
        initiator: 'Browser Fetch/XHR',
        detectedQueryParam: detected?.param,
        detectedQueryValue: detected?.value,
        requestHeaders: reqHeaders,
        responseHeaders: respHeaders,
        responsePreview: text.slice(0, 6000),
        isJson,
        extractedSummary: extractedFromJson
          ? {
              title: detected?.value ? `API Results for "${detected.value}"` : validated.pathname,
              videosCount: extractedFromJson.videos.length,
              documentsCount: extractedFromJson.documents.length,
              itemsCount: extractedFromJson.items.length,
              linksCount: extractedFromJson.links.length,
            }
          : undefined,
        videos: extractedFromJson?.videos,
        documents: extractedFromJson?.documents,
        items: extractedFromJson?.items,
        links: extractedFromJson?.links,
      });

      res.status(upstream.status);
      res.setHeader('Content-Type', ct);
      res.send(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'XHR proxy error.';
      res.status(502).json({ error: msg });
    }
  });

  // Interactive In-App Browser Reverse Proxy (GET & POST form submissions stay inside frame)
  app.all('/api/browser-proxy', async (req: Request, res: Response) => {
    const serverOrigin = getServerOrigin(req);
    const sessionId = String(req.query.sessionId || req.query.__session_id || 'default').trim();
    let targetRaw = '';

    if (typeof req.query.__proxy_target === 'string' && req.query.__proxy_target.trim()) {
      try {
        const targetObj = new URL(req.query.__proxy_target.trim());
        for (const [k, v] of Object.entries(req.query)) {
          if (k === '__proxy_target' || k === '__session_id' || k === 'sessionId') continue;
          if (typeof v === 'string') {
            targetObj.searchParams.set(k, v);
          }
        }
        targetRaw = targetObj.toString();
      } catch {
        targetRaw = req.query.__proxy_target.trim();
      }
    } else if (typeof req.query.url === 'string' && req.query.url.trim()) {
      targetRaw = req.query.url.trim();
    } else if (req.body && typeof req.body.url === 'string') {
      targetRaw = req.body.url.trim();
    }

    if (!targetRaw) {
      res.status(400).send('<h3>Missing website URL</h3>');
      return;
    }

    try {
      const validated = await validatePublicUrl(targetRaw);
      const targetStr = validated.toString();
      const detected = detectSearchQueryParam(targetStr);

      // Handle direct video/PDF links cleanly inside the frame while logging to F12
      if (/\.(mp4|m3u8|webm|ogg|mov|pdf)(\?|$)/i.test(targetStr)) {
        const isPdf = /\.pdf(\?|$)/i.test(targetStr);
        recordF12Event(sessionId, {
          id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sessionId,
          timestamp: new Date().toISOString(),
          method: 'GET',
          url: targetStr,
          resourceType: isPdf ? 'pdf' : 'media',
          status: 200,
          contentType: isPdf ? 'application/pdf' : 'video/stream',
          durationMs: 0,
          bytes: 0,
          initiator: 'Direct Media/PDF Navigation',
          requestHeaders: {},
          responseHeaders: {},
          responsePreview: targetStr,
        });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(
          `<!doctype html><html><body style="font-family:sans-serif;padding:24px;background:#f8fafc;">` +
            `<h3>Captured ${isPdf ? 'PDF Document' : 'Video Stream'}</h3>` +
            `<p style="font-family:monospace;word-break:break-all;">${escapeHtmlAttr(targetStr)}</p>` +
            (isPdf
              ? `<a href="${escapeHtmlAttr(targetStr)}" target="_blank" rel="noopener noreferrer">Open PDF in New Tab</a>`
              : `<video controls autoplay src="${escapeHtmlAttr(serverOrigin + '/api/media-proxy?url=' + encodeURIComponent(targetStr))}" style="width:100%;max-height:420px;background:#000;"></video>`) +
            `</body></html>`
        );
        return;
      }

      const fetched = await safeFetchHtml(targetStr);
      const extracted = extractUniversalContent(fetched.html, fetched.finalUrl, UNLIMITED_SAFE_CAP, {
        requestUrl: fetched.requestUrl,
        finalUrl: fetched.finalUrl,
        status: fetched.status,
        durationMs: fetched.durationMs,
        redirectChain: fetched.redirectChain,
        requestHeaders: fetched.requestHeaders,
        responseHeaders: fetched.responseHeaders,
        htmlBytes: fetched.htmlBytes,
        notes: fetched.fetchNotes || [],
      });

      const docEvent: CapturedF12Event = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        sessionId,
        timestamp: new Date().toISOString(),
        method: req.method === 'POST' ? 'POST' : 'GET',
        url: fetched.finalUrl,
        resourceType: detected ? 'search' : 'document',
        status: fetched.status,
        contentType: fetched.responseHeaders['content-type'] || 'text/html',
        durationMs: fetched.durationMs,
        bytes: fetched.htmlBytes,
        initiator: detected ? `Search (?${detected.param}=${detected.value})` : 'Page Navigation',
        detectedQueryParam: detected?.param,
        detectedQueryValue: detected?.value,
        requestHeaders: fetched.requestHeaders,
        responseHeaders: fetched.responseHeaders,
        responsePreview: fetched.html.slice(0, 6000),
        extractedSummary: {
          title: extracted.overview.title,
          videosCount: extracted.videos.length,
          documentsCount: extracted.documents.length,
          itemsCount: extracted.items.length,
          linksCount: extracted.links.length,
        },
        videos: extracted.videos,
        documents: extracted.documents,
        items: extracted.items,
        links: extracted.links,
      };

      recordF12Event(sessionId, docEvent);

      // Also record any discovered XHR/API endpoints & media stream URLs into this F12 session
      for (const vid of extracted.videos.slice(0, 25)) {
        if (vid.playableType === 'hls' || vid.playableType === 'html5' || vid.playableType === 'youtube-embed') {
          recordF12Event(sessionId, {
            id: `stream-${Buffer.from(vid.videoUrl).toString('base64').slice(0, 16)}`,
            sessionId,
            timestamp: new Date().toISOString(),
            method: 'GET',
            url: vid.videoUrl,
            resourceType: 'media',
            status: 200,
            contentType: vid.streamFormat || 'video/stream',
            durationMs: 0,
            bytes: 0,
            initiator: vid.extractedFrom,
            requestHeaders: {},
            responseHeaders: {},
            responsePreview: JSON.stringify({ title: vid.title, streamUrl: vid.videoUrl, embedUrl: vid.embedUrl, format: vid.streamFormat }, null, 2),
            videos: [vid],
          });
        }
      }
      for (const p of extracted.backendTrace.embeddedPayloads.slice(0, 15)) {
        if (p.kind === 'api-endpoint') {
          const absApi = sanitizeExtractedUrl(p.detail, fetched.finalUrl);
          if (absApi) {
            const apiQuery = detectSearchQueryParam(absApi);
            recordF12Event(sessionId, {
              id: `api-${Buffer.from(absApi).toString('base64').slice(0, 16)}`,
              sessionId,
              timestamp: new Date().toISOString(),
              method: 'GET',
              url: absApi,
              resourceType: 'xhr',
              status: 200,
              contentType: 'application/json',
              durationMs: 0,
              bytes: 0,
              initiator: p.name,
              detectedQueryParam: apiQuery?.param,
              detectedQueryValue: apiQuery?.value,
              requestHeaders: {},
              responseHeaders: {},
              responsePreview: `Discovered embedded backend API route: ${absApi}`,
            });
          }
        }
      }

      const proxiedHtml = buildProxiedHtml(fetched.html, fetched.finalUrl, serverOrigin, sessionId, docEvent);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.removeHeader('X-Frame-Options');
      res.removeHeader('Content-Security-Policy');
      res.send(proxiedHtml);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load website in proxy browser.';
      res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(
        `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:24px;background:#fef2f2;color:#7f1d1d;">` +
          `<h3 style="margin-top:0;">Could not load this page inside the browser preview</h3>` +
          `<p style="font-size:13px;line-height:1.5;">${escapeHtmlAttr(msg)}</p>` +
          `</body></html>`
      );
    }
  });

  // Public CORS-enabled media stream proxy for .m3u8 / .ts / .mp4 / .webm streams
  app.options('/api/media-proxy', (_req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    res.status(204).end();
  });

  app.get('/api/media-proxy', async (req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    const rawTarget = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawTarget) {
      res.status(400).json({ error: 'Missing ?url= media URL parameter.' });
      return;
    }
    try {
      const validated = await validatePublicUrl(rawTarget);
      const upstreamHeaders: Record<string, string> = {
        ...buildBrowserHeaders('chrome', `${validated.origin}/`),
        Accept: '*/*',
      };
      if (typeof req.headers.range === 'string') {
        upstreamHeaders.Range = req.headers.range;
      }

      const upstream = await fetch(validated.toString(), {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
        headers: upstreamHeaders,
      });

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).json({ error: `Upstream stream returned HTTP ${upstream.status}` });
        return;
      }

      const ct = (upstream.headers.get('content-type') || '').toLowerCase();
      const lowerUrl = validated.toString().toLowerCase();
      const isM3u8 =
        ct.includes('mpegurl') ||
        ct.includes('x-mpegurl') ||
        /\.m3u8(\?|$)/i.test(lowerUrl);

      if (isM3u8) {
        const playlistText = await upstream.text();
        const rewritten = playlistText
          .split(/\r?\n/)
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith('#')) {
              return line.replace(/URI="([^"]+)"/gi, (_m, uri: string) => {
                try {
                  const abs = new URL(uri, validated).toString();
                  return `URI="/api/media-proxy?url=${encodeURIComponent(abs)}"`;
                } catch {
                  return `URI="${uri}"`;
                }
              });
            }
            try {
              const abs = new URL(trimmed, validated).toString();
              return `/api/media-proxy?url=${encodeURIComponent(abs)}`;
            } catch {
              return line;
            }
          })
          .join('\n');

        res.status(200);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.send(rewritten);
        return;
      }

      res.status(upstream.status);
      if (ct) res.setHeader('Content-Type', ct);
      const cl = upstream.headers.get('content-length');
      if (cl) res.setHeader('Content-Length', cl);
      const cr = upstream.headers.get('content-range');
      if (cr) res.setHeader('Content-Range', cr);
      const ar = upstream.headers.get('accept-ranges');
      if (ar) res.setHeader('Accept-Ranges', ar);

      if (!upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      req.on('close', () => {
        void reader.cancel().catch(() => {});
      });
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          res.write(Buffer.from(value));
        }
      }
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Media stream proxy error.';
      if (!res.headersSent) {
        res.status(502).json({ error: message });
      } else {
        res.end();
      }
    }
  });

  // Public CORS preflight for universal extract, generated REST endpoints & OpenAPI specs
  app.options('/api/v1/extract', (_req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    res.status(200).end();
  });

  app.options('/api/v1/:slug', (_req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    res.status(200).end();
  });

  app.options('/api/v1/:slug/openapi.json', (_req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    res.status(200).end();
  });

  // OpenAPI 3.0.3 Specification for external websites & API clients
  app.get('/api/v1/:slug/openapi.json', (req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    const slug = String(req.params.slug || '').toLowerCase();
    const endpoint = publishedEndpoints.get(slug);
    if (!endpoint) {
      res.status(404).json({ error: 'API endpoint not found', slug });
      return;
    }

    const host = req.get('host') || `localhost:${PORT}`;
    const protocol = req.protocol || 'http';
    const serverOrigin = `${protocol}://${host}`;

    const sharedParams = [
      {
        name: 'q',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Search across videos, PDFs, courses, sections, tables, and links (aliases: ?query=, ?search=).',
      },
      {
        name: 'url',
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: 'Optional override URL to extract on the fly.',
      },
      {
        name: 'type',
        in: 'query',
        required: false,
        schema: {
          type: 'string',
          enum: ['all', 'videos', 'documents', 'items', 'sections', 'links', 'tables'],
        },
        description: 'Filter response payload by category.',
      },
      {
        name: 'limit',
        in: 'query',
        required: false,
        schema: { type: 'string', default: 'all' },
        description: 'Use "all" (or 0) for unlimited results with no cap, or pass a positive integer.',
      },
      {
        name: 'sort',
        in: 'query',
        required: false,
        schema: { type: 'string', enum: ['relevance', 'az', 'za'], default: 'relevance' },
        description: 'Sort order: relevance (default), az (alphabetical A-Z), or za (Z-A).',
      },
      {
        name: 'siteSearch',
        in: 'query',
        required: false,
        schema: { type: 'boolean' },
        description: 'If true and the target website exposes a GET search form, forwards ?q= to the target website.',
      },
      {
        name: 'fresh',
        in: 'query',
        required: false,
        schema: { type: 'boolean' },
        description: 'Bypass 60s server cache and re-crawl target website.',
      },
    ];

    res.json({
      openapi: '3.0.3',
      info: {
        title: endpoint.name,
        version: '1.0.0',
        description: `Auto-generated CORS-enabled REST API wrapping ${endpoint.url} (supports GET query params & POST JSON body).`,
      },
      servers: [{ url: serverOrigin }],
      paths: {
        [`/api/v1/${endpoint.slug}`]: {
          get: {
            summary: `GET structured data from ${endpoint.name}`,
            parameters: sharedParams,
            responses: {
              '200': {
                description: 'Structured JSON payload containing videos, documents, items, sections, tables, and F12 network trace.',
                content: { 'application/json': { schema: { type: 'object' } } },
              },
            },
          },
          post: {
            summary: `POST JSON query to ${endpoint.name}`,
            requestBody: {
              required: false,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      q: { type: 'string' },
                      query: { type: 'string' },
                      url: { type: 'string' },
                      type: { type: 'string' },
                      limit: { type: 'string' },
                      sort: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Structured JSON payload.',
                content: { 'application/json': { schema: { type: 'object' } } },
              },
            },
          },
        },
      },
    });
  });

  function readFlexibleApiParams(req: Request) {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const pickStr = (...vals: unknown[]): string => {
      for (const v of vals) {
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return '';
    };

    const queryText = pickStr(
      req.query.q,
      req.query.query,
      req.query.search,
      req.query.keyword,
      body.q,
      body.query,
      body.search,
      body.keyword
    );
    const idText = pickStr(req.query.id, body.id);
    const overrideUrl = pickStr(req.query.url, body.url);
    const filterTypeRaw = pickStr(req.query.type, body.type) || 'all';
    const filterType: EndpointDataFilter = [
      'videos',
      'documents',
      'items',
      'sections',
      'links',
      'tables',
    ].includes(filterTypeRaw)
      ? (filterTypeRaw as EndpointDataFilter)
      : 'all';

    const rawLimitVal = req.query.limit ?? body.limit;
    const rawLimitStr =
      typeof rawLimitVal === 'number'
        ? String(rawLimitVal)
        : typeof rawLimitVal === 'string'
          ? rawLimitVal.trim().toLowerCase()
          : '';

    const rawSort = (pickStr(req.query.sort, body.sort) || 'relevance').toLowerCase();
    const sortMode: 'relevance' | 'az' | 'za' =
      rawSort === 'az' ? 'az' : rawSort === 'za' ? 'za' : 'relevance';

    const forceFresh = req.query.fresh === 'true' || body.fresh === true || body.fresh === 'true';
    const explicitSiteSearch =
      req.query.siteSearch !== undefined
        ? String(req.query.siteSearch)
        : body.siteSearch !== undefined
          ? String(body.siteSearch)
          : undefined;

    const crawlDepth = parseCrawlDepth(req.query.crawlDepth ?? body.crawlDepth);

    return {
      queryText,
      idText,
      overrideUrl,
      filterType,
      rawLimitStr,
      sortMode,
      forceFresh,
      explicitSiteSearch,
      crawlDepth,
    };
  }

  async function executeLiveApiEndpoint(req: Request, res: Response, endpoint: PublishedEndpoint, isAdhocExtract = false) {
    setPublicApiCorsHeaders(res);
    const startedAt = performance.now();

    try {
      const {
        queryText,
        idText,
        overrideUrl,
        filterType,
        rawLimitStr,
        sortMode,
        forceFresh,
        explicitSiteSearch,
      } = readFlexibleApiParams(req);

      let requestedLimit = endpoint.limit;
      if (rawLimitStr === 'all' || rawLimitStr === '0') {
        requestedLimit = 0;
      } else if (rawLimitStr !== '') {
        const parsedNum = Number(rawLimitStr);
        if (Number.isFinite(parsedNum) && parsedNum > 0) {
          requestedLimit = Math.min(UNLIMITED_SAFE_CAP, Math.floor(parsedNum));
        }
      }
      const cap = resolveLimitCap(requestedLimit);
      const limitApplied: number | 'unlimited' = requestedLimit === 0 ? 'unlimited' : cap;

      const targetSourceMode: 'url' | 'html' = overrideUrl ? 'url' : endpoint.sourceMode;
      const targetUrl = overrideUrl || endpoint.url;

      const autoSearchSite =
        targetSourceMode === 'url' &&
        queryText.length > 0 &&
        (explicitSiteSearch === 'true' ||
          (explicitSiteSearch !== 'false' && isYouTubeHost(targetUrl)));

      let extracted: Omit<ExtractResponse, 'ok' | 'status' | 'responseTimeMs'> | null = null;
      let cachedHit = false;
      let siteSearchUsed = false;
      let capturedUpstreamData: unknown = undefined;

      // Dynamic ?url= override: supports both direct JSON API targets and HTML pages with automatic Origin/Referer
      if (overrideUrl) {
        try {
          const validatedOverride = (await validatePublicUrl(overrideUrl)).toString();
          const overrideOrigin = new URL(validatedOverride).origin;
          const capturedHeaders = sanitizeCapturedHeaders(endpoint.capturedPattern?.requestHeaders);
          const dynamicHeaders: Record<string, string> = {
            ...buildBrowserHeaders('chrome'),
            Accept: 'application/json, text/html, */*;q=0.9',
            ...capturedHeaders,
            Origin: overrideOrigin,
            Referer: `${overrideOrigin}/`,
          };
          const probeRes = await fetch(validatedOverride, {
            method: 'GET',
            headers: dynamicHeaders,
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          const probeCt = (probeRes.headers.get('content-type') || '').toLowerCase();
          const probeText = (await probeRes.text()).slice(0, MAX_HTML_BYTES);
          const looksJson =
            probeCt.includes('json') ||
            probeText.trimStart().startsWith('{') ||
            probeText.trimStart().startsWith('[');
          if (looksJson) {
            const rawParsedJson = JSON.parse(probeText) as unknown;
            const parsedOverrideJson = normalizeJsonAssetsRecursively(
              rawParsedJson,
              probeRes.url || validatedOverride
            );
            capturedUpstreamData = parsedOverrideJson;
            const harvest = extractMediaAndItemsFromJson(parsedOverrideJson, probeRes.url || validatedOverride, cap);
            const firstTitle =
              (typeof parsedOverrideJson === 'object' &&
                parsedOverrideJson !== null &&
                !Array.isArray(parsedOverrideJson) &&
                String(
                  (parsedOverrideJson as Record<string, unknown>).title ||
                    (parsedOverrideJson as Record<string, unknown>).name ||
                    ''
                )) ||
              harvest.items[0]?.title ||
              `${endpoint.name} (?url= JSON)`;

            extracted = {
              sourceMode: 'url',
              builderMode: endpoint.builderMode,
              crawlDepth: 'single',
              sourceUrl: probeRes.url || validatedOverride,
              overview: {
                title: firstTitle,
                description: `Dynamic ?url= JSON response from ${new URL(validatedOverride).hostname}`,
                author: '',
                publishedDate: '',
                siteName: new URL(validatedOverride).hostname,
                thumbnail: harvest.items[0]?.image || '',
                canonicalUrl: probeRes.url || validatedOverride,
                category: 'Dynamic ?url= JSON API',
                wordCount: 0,
                readingTimeMinutes: 0,
              },
              metadata: {
                pageTitle: firstTitle,
                metaDescription: '',
                totalLinks: harvest.links.length,
                totalHeadings: 0,
                totalImages: 0,
                totalVideos: harvest.videos.length,
                totalDocuments: harvest.documents.length,
              },
              videos: harvest.videos,
              documents: harvest.documents,
              items: harvest.items,
              sections: [],
              tables: [],
              links: harvest.links,
              images: [],
              customItems: [],
              searchForm: null,
              backendTrace: {
                requestUrl: validatedOverride,
                finalUrl: probeRes.url || validatedOverride,
                redirectChain: [],
                requestHeaders: dynamicHeaders,
                responseHeaders: { 'content-type': probeCt || 'application/json' },
                htmlBytes: Buffer.byteLength(probeText, 'utf8'),
                embeddedPayloads: [
                  {
                    name: 'Dynamic ?url= JSON API',
                    kind: 'api-endpoint',
                    detail: `HTTP ${probeRes.status} JSON response auto-parsed`,
                  },
                ],
                linkSourceBreakdown: [{ source: 'Dynamic ?url= JSON', count: harvest.links.length }],
                crawledUrls: [probeRes.url || validatedOverride],
                networkEntries: [
                  {
                    id: 'dynamic-url-override',
                    method: 'GET',
                    url: validatedOverride,
                    resourceType: 'xhr-discovered',
                    status: probeRes.status,
                    durationMs: Math.round(performance.now() - startedAt),
                    bytes: Buffer.byteLength(probeText, 'utf8'),
                    requestHeaders: dynamicHeaders,
                    responseHeaders: { 'content-type': probeCt || 'application/json' },
                    initiator: 'Dynamic ?url= Parameter Mode',
                    responsePreview: probeText.slice(0, 2000),
                  },
                ],
                notes: [`Fetched dynamic ?url= JSON target with auto Origin/Referer (${overrideOrigin}).`],
              },
              crawledPagesCount: 1,
              detectedSelectors: [],
              rawHtmlPreview: probeText.slice(0, 50_000),
            };
          }
        } catch {
          // Fall through to HTML/standard extraction below if non-JSON or handled by runFullExtraction
        }
      }

      if (extracted) {
        // already extracted above from dynamic ?url= JSON target
      } else if (endpoint.capturedPattern && !overrideUrl) {
        const pattern = endpoint.capturedPattern;
        const rawReqBody =
          req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const collectAllRequested =
          req.query.collectAll === 'true' ||
          rawReqBody.collectAll === true ||
          (req.query.collectAll !== 'false' &&
            rawReqBody.collectAll !== false &&
            (Boolean(pattern.collectAll) || endpoint.crawlDepth === 'deep'));
        const explicitPageRaw = req.query.page ?? rawReqBody.page;
        const explicitPageNum =
          explicitPageRaw !== undefined && Number(explicitPageRaw) > 0
            ? Math.floor(Number(explicitPageRaw))
            : undefined;
        const actionParam = String(req.query.action ?? rawReqBody.action ?? '').trim().toLowerCase();
        const pageParam = pattern.pageParam?.trim() || undefined;
        const effectiveQ = queryText || pattern.sampleQuery || '';
        const effectiveId = idText || pattern.sampleId || '';
        const effectiveQueryOrId = queryText || idText || effectiveQ || effectiveId;
        const effectiveParamKey = pattern.queryParam || (idText ? 'id' : '');

        // Pick multi-route template if ?action=latest|search|detail is supplied, else staticUrlTemplate
        const selectedTemplate =
          actionParam === 'latest' && pattern.multiRoutes?.latestUrl
            ? pattern.multiRoutes.latestUrl
            : actionParam === 'search' && pattern.multiRoutes?.searchUrl
              ? pattern.multiRoutes.searchUrl
              : (actionParam === 'detail' || Boolean(idText)) && pattern.multiRoutes?.detailUrl
                ? pattern.multiRoutes.detailUrl
                : pattern.staticUrlTemplate || '';

        const buildPageTargetUrl = (pageNumber?: number) => {
          const pNum = pageNumber || Number(pattern.samplePage || 1) || 1;
          if (selectedTemplate && /\{(q|id|slug|page|timestamp|ts)\}|[?&](?:t|ts|timestamp|_)=\d{10,13}/i.test(selectedTemplate)) {
            const templated = buildTemplatedPatternUrl(selectedTemplate, {
              q: effectiveQ,
              id: effectiveId || queryText,
              page: pNum,
            });
            const u = new URL(templated);
            if (pageNumber && pageParam && !selectedTemplate.includes('{page}')) {
              u.searchParams.set(pageParam, String(pageNumber));
            }
            return u.toString();
          }
          const u = new URL(selectedTemplate || pattern.baseUrl);
          if (effectiveQueryOrId && effectiveParamKey && pattern.method !== 'POST') {
            u.searchParams.set(effectiveParamKey, effectiveQueryOrId);
          }
          if (pageNumber && pageParam) {
            u.searchParams.set(pageParam, String(pageNumber));
          }
          return u.toString();
        };

        const liveTargetUrl = buildPageTargetUrl(explicitPageNum);
        const mergedHeaders: Record<string, string> = {
          ...buildBrowserHeaders('chrome'),
          Accept:
            pattern.kind === 'json-api'
              ? 'application/json, text/plain, */*'
              : 'text/html, application/json, */*',
          ...(pattern.requestHeaders || {}),
        };

        if (pattern.kind === 'json-api') {
          const maxPages = collectAllRequested && !explicitPageNum ? 10 : 1;
          const allPagesData: unknown[] = [];
          const harvestedVideos: ExtractedVideo[] = [];
          const harvestedDocs: ExtractedDocument[] = [];
          const harvestedItems: ExtractedItem[] = [];
          const harvestedLinks: ExtractedLink[] = [];
          const seenV = new Set<string>();
          const seenD = new Set<string>();
          const seenI = new Set<string>();
          const seenL = new Set<string>();
          const visitedApiUrls = new Set<string>();
          const networkEntries: NetworkTraceEntry[] = [];
          const crawledUrls: string[] = [];
          let lastStatus = 200;
          let lastContentType = 'application/json';
          let totalBytes = 0;
          let firstRawText = '';

          let nextUrlToFetch: string | null = liveTargetUrl;
          let currentPage = explicitPageNum || 1;

          for (let pIdx = 0; pIdx < maxPages && nextUrlToFetch; pIdx++) {
            const validatedPatternUrl = await validatePublicUrl(nextUrlToFetch);
            const urlKey = validatedPatternUrl.toString();
            const postBody =
              pattern.method === 'POST'
                ? buildDynamicPostBody(
                    pattern.postBodyTemplate,
                    effectiveParamKey || undefined,
                    effectiveQ,
                    pattern.sampleQuery,
                    pageParam,
                    pageParam ? currentPage : undefined,
                    effectiveId
                  )
                : undefined;

            const dedupeFetchKey = `${urlKey}|${postBody || ''}`;
            if (visitedApiUrls.has(dedupeFetchKey)) break;
            visitedApiUrls.add(dedupeFetchKey);

            const reqHdrs = { ...mergedHeaders };
            if (postBody && !Object.keys(reqHdrs).some((k) => k.toLowerCase() === 'content-type')) {
              reqHdrs['Content-Type'] = postBody.trimStart().startsWith('{')
                ? 'application/json'
                : 'application/x-www-form-urlencoded';
            }

            const pStart = performance.now();
            const apiRes = await fetch(urlKey, {
              method: pattern.method || 'GET',
              headers: reqHdrs,
              body: postBody,
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });
            const rawText = (await apiRes.text()).slice(0, MAX_HTML_BYTES);
            const pDur = Math.round(performance.now() - pStart);
            const byteLen = Buffer.byteLength(rawText, 'utf8');
            totalBytes += byteLen;
            lastStatus = apiRes.status;
            lastContentType = apiRes.headers.get('content-type') || 'application/json';
            if (pIdx === 0) firstRawText = rawText;

            let jsonObj: unknown = rawText;
            try {
              jsonObj = normalizeJsonAssetsRecursively(JSON.parse(rawText), urlKey);
            } catch {
              // keep text if non-JSON
            }
            allPagesData.push(jsonObj);
            crawledUrls.push(urlKey);

            networkEntries.push({
              id: `f12-replay-${pIdx}`,
              method: pattern.method || 'GET',
              url: urlKey,
              resourceType: 'xhr-discovered',
              status: apiRes.status,
              durationMs: pDur,
              bytes: byteLen,
              requestHeaders: reqHdrs,
              responseHeaders: { 'content-type': lastContentType },
              initiator: `F12 Captured Replay (Page ${currentPage})`,
              responsePreview: rawText.slice(0, 2000),
            });

            const pageHarvest = extractMediaAndItemsFromJson(jsonObj, urlKey, cap);
            let addedOnPage = 0;
            for (const v of pageHarvest.videos) {
              if (!seenV.has(v.videoUrl) && harvestedVideos.length < cap) {
                seenV.add(v.videoUrl);
                harvestedVideos.push(v);
                addedOnPage += 1;
              }
            }
            for (const d of pageHarvest.documents) {
              if (!seenD.has(d.url) && harvestedDocs.length < cap) {
                seenD.add(d.url);
                harvestedDocs.push(d);
                addedOnPage += 1;
              }
            }
            for (const it of pageHarvest.items) {
              const ik = `${it.title.toLowerCase()}|${it.url || ''}`;
              if (!seenI.has(ik) && harvestedItems.length < cap) {
                seenI.add(ik);
                harvestedItems.push(it);
                addedOnPage += 1;
              }
            }
            for (const lnk of pageHarvest.links) {
              if (!seenL.has(lnk.url) && harvestedLinks.length < cap) {
                seenL.add(lnk.url);
                harvestedLinks.push(lnk);
                addedOnPage += 1;
              }
            }

            if (maxPages <= 1 || addedOnPage === 0) {
              nextUrlToFetch = null;
            } else {
              const explicitNext = findNextPageUrlFromJson(jsonObj, urlKey);
              if (explicitNext) {
                nextUrlToFetch = explicitNext;
                currentPage += 1;
              } else if (pageParam) {
                currentPage += 1;
                nextUrlToFetch = pattern.method === 'POST' ? urlKey : buildPageTargetUrl(currentPage);
              } else {
                nextUrlToFetch = null;
              }
            }
          }

          // Optional whole-site enrichment: crawl discovered item/site URLs for embedded streams & PDFs
          const extraSections: ExtractedSection[] = [];
          const extraTables: ExtractedTable[] = [];
          const notes = [
            `Replayed F12 captured ${pattern.method} API (${crawledUrls.length} page${crawledUrls.length === 1 ? '' : 's'})${
              pattern.queryParam && queryText ? ` with query "${queryText}"` : ''
            }.`,
          ];

          if (collectAllRequested) {
            const originHost = new URL(pattern.siteUrl || pattern.baseUrl).hostname.toLowerCase();
            const deepCandidates: string[] = [];
            if (pattern.siteUrl) deepCandidates.push(pattern.siteUrl);
            for (const it of harvestedItems) {
              if (it.url) {
                try {
                  if (new URL(it.url).hostname.toLowerCase() === originHost) {
                    deepCandidates.push(it.url);
                  }
                } catch {
                  // skip
                }
              }
            }
            const uniqueDeep = Array.from(new Set(deepCandidates)).slice(0, 8);
            for (const subUrl of uniqueDeep) {
              try {
                const subFetch = await safeFetchHtml(subUrl);
                if (!subFetch.html) continue;
                crawledUrls.push(subFetch.finalUrl);
                const subExt = extractUniversalContent(subFetch.html, subFetch.finalUrl, cap, {
                  requestUrl: subUrl,
                  finalUrl: subFetch.finalUrl,
                  status: subFetch.status,
                  durationMs: subFetch.durationMs,
                  redirectChain: subFetch.redirectChain,
                  requestHeaders: subFetch.requestHeaders,
                  responseHeaders: subFetch.responseHeaders,
                  htmlBytes: subFetch.htmlBytes,
                  notes: [],
                });
                for (const v of subExt.videos) {
                  if (!seenV.has(v.videoUrl) && harvestedVideos.length < cap) {
                    seenV.add(v.videoUrl);
                    harvestedVideos.push(v);
                  }
                }
                for (const d of subExt.documents) {
                  if (!seenD.has(d.url) && harvestedDocs.length < cap) {
                    seenD.add(d.url);
                    harvestedDocs.push(d);
                  }
                }
                for (const it of subExt.items) {
                  const ik = `${it.title.toLowerCase()}|${it.url || ''}`;
                  if (!seenI.has(ik) && harvestedItems.length < cap) {
                    seenI.add(ik);
                    harvestedItems.push(it);
                  }
                }
                for (const sec of subExt.sections) {
                  if (extraSections.length < cap) extraSections.push(sec);
                }
                for (const tbl of subExt.tables) {
                  if (extraTables.length < cap) extraTables.push(tbl);
                }
                for (const lnk of subExt.links) {
                  if (!seenL.has(lnk.url) && harvestedLinks.length < cap) {
                    seenL.add(lnk.url);
                    harvestedLinks.push(lnk);
                  }
                }
              } catch {
                // ignore individual subpage errors
              }
            }
            if (uniqueDeep.length > 0) {
              notes.push(
                `Whole-site deep enrichment crawled ${uniqueDeep.length} associated site pages for full videos, PDFs, tables, and metadata.`
              );
            }
          }

          capturedUpstreamData = allPagesData.length === 1 ? allPagesData[0] : allPagesData;

          extracted = {
            sourceMode: 'url',
            builderMode: endpoint.builderMode,
            crawlDepth: collectAllRequested ? 'deep' : 'single',
            sourceUrl: crawledUrls[0] || liveTargetUrl,
            overview: {
              title: endpoint.name,
              description: `Live F12 Captured JSON API replay (${crawledUrls[0] || liveTargetUrl})`,
              author: '',
              publishedDate: '',
              siteName: new URL(crawledUrls[0] || liveTargetUrl).hostname,
              thumbnail: '',
              canonicalUrl: crawledUrls[0] || liveTargetUrl,
              category: 'Captured Live API',
              wordCount: 0,
              readingTimeMinutes: 0,
            },
            metadata: {
              pageTitle: endpoint.name,
              metaDescription: '',
              totalLinks: harvestedLinks.length,
              totalHeadings: extraSections.length,
              totalImages: 0,
              totalVideos: harvestedVideos.length,
              totalDocuments: harvestedDocs.length,
            },
            videos: harvestedVideos,
            documents: harvestedDocs,
            items: harvestedItems,
            sections: extraSections,
            tables: extraTables,
            links: harvestedLinks,
            images: [],
            customItems: [],
            searchForm: null,
            backendTrace: {
              requestUrl: liveTargetUrl,
              finalUrl: crawledUrls[0] || liveTargetUrl,
              redirectChain: [],
              requestHeaders: mergedHeaders,
              responseHeaders: { 'content-type': lastContentType },
              htmlBytes: totalBytes,
              embeddedPayloads: [
                {
                  name: 'F12 Captured Upstream JSON API',
                  kind: 'api-endpoint',
                  detail: `${crawledUrls.length} API page(s) replayed`,
                },
              ],
              linkSourceBreakdown: [{ source: 'JSON API + Site Crawl', count: harvestedLinks.length }],
              crawledUrls,
              networkEntries,
              notes,
            },
            crawledPagesCount: crawledUrls.length,
            detectedSelectors: [],
            rawHtmlPreview: firstRawText.slice(0, 50_000),
          };
          siteSearchUsed = Boolean(effectiveQueryOrId && effectiveParamKey);
        } else {
          const replayResult = await runFullExtraction({
            sourceMode: 'url',
            builderMode: endpoint.builderMode,
            crawlDepth: collectAllRequested ? 'deep' : endpoint.crawlDepth,
            url: liveTargetUrl,
            containerSelector: endpoint.containerSelector,
            rules: endpoint.rules,
            limit: requestedLimit,
          });
          extracted = replayResult.extracted;
          extracted.backendTrace.notes.push(
            `Replayed F12 captured search/page endpoint (${liveTargetUrl})`
          );
          siteSearchUsed = Boolean(effectiveQueryOrId && effectiveParamKey);
        }
      } else if (autoSearchSite && isYouTubeHost(targetUrl)) {
        const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryText)}`;
        const ytSearchResult = await runFullExtraction({
          sourceMode: 'url',
          builderMode: endpoint.builderMode,
          crawlDepth: 'single',
          url: ytSearchUrl,
          containerSelector: endpoint.containerSelector,
          rules: endpoint.rules,
          limit: requestedLimit,
        });
        extracted = ytSearchResult.extracted;
        extracted.backendTrace.notes.push(
          `Executed live YouTube search for "${queryText}" via ${ytSearchUrl}`
        );
        siteSearchUsed = true;
      } else {
        const canUseCache = !isAdhocExtract && !overrideUrl && !forceFresh;
        const cached = canUseCache ? endpointCache.get(endpoint.slug) : undefined;
        if (cached && cached.expiresAt > Date.now()) {
          extracted = cached.extracted;
          cachedHit = true;
        } else {
          const baseResult = await runFullExtraction({
            sourceMode: targetSourceMode,
            builderMode: endpoint.builderMode,
            crawlDepth: endpoint.crawlDepth,
            url: targetUrl,
            rawHtml: overrideUrl ? undefined : endpoint.rawHtml,
            containerSelector: endpoint.containerSelector,
            rules: endpoint.rules,
            limit: 0,
          });
          extracted = baseResult.extracted;
          if (!isAdhocExtract && !overrideUrl) {
            endpointCache.set(endpoint.slug, {
              expiresAt: Date.now() + CACHE_TTL_MS,
              extracted,
            });
          }
        }

        if (autoSearchSite && extracted.searchForm) {
          try {
            const searchTarget = new URL(extracted.searchForm.actionUrl);
            searchTarget.searchParams.set(extracted.searchForm.queryParam, queryText);
            const searchResult = await runFullExtraction({
              sourceMode: 'url',
              builderMode: endpoint.builderMode,
              crawlDepth: 'single',
              url: searchTarget.toString(),
              containerSelector: endpoint.containerSelector,
              rules: endpoint.rules,
              limit: requestedLimit,
            });
            const hasSearchHits =
              searchResult.extracted.videos.length > 0 ||
              searchResult.extracted.documents.length > 0 ||
              searchResult.extracted.items.length > 0 ||
              searchResult.extracted.sections.length > 0;
            if (hasSearchHits) {
              extracted = searchResult.extracted;
              extracted.backendTrace.notes.push(
                `Queried target website's own search endpoint (${searchTarget.toString()})`
              );
              siteSearchUsed = true;
            }
          } catch {
            // Fall back smoothly to local fuzzy/related search across crawled data
          }
        }
      }

      const effectiveQuery = siteSearchUsed ? '' : queryText;

      let videos = filterAndRankItems(
        extracted.videos,
        (v) => `${v.title} ${v.description} ${v.channelName || ''} ${v.videoUrl} ${v.streamFormat || ''} ${v.sourceType}`,
        (v) => v.title,
        effectiveQuery,
        sortMode
      );
      let documents = filterAndRankItems(
        extracted.documents,
        (d) => `${d.title} ${d.fileType} ${d.url} ${d.sourcePage}`,
        (d) => d.title,
        effectiveQuery,
        sortMode
      );
      let items = filterAndRankItems(
        extracted.items,
        (it) => `${it.title} ${it.description} ${it.meta || ''} ${it.url || ''}`,
        (it) => it.title,
        effectiveQuery,
        sortMode
      );
      let sections = filterAndRankItems(
        extracted.sections,
        (sec) => `${sec.heading} ${sec.content}`,
        (sec) => sec.heading,
        effectiveQuery,
        sortMode
      );
      let links = filterAndRankItems(
        extracted.links,
        (lnk) => `${lnk.text} ${lnk.url} ${lnk.category} ${lnk.extractedFrom}`,
        (lnk) => lnk.text,
        effectiveQuery,
        sortMode
      );
      let tables = extracted.tables
        .map((tbl) => ({
          ...tbl,
          rows: effectiveQuery
            ? filterAndRankItems(
                tbl.rows,
                (r) => Object.values(r).join(' '),
                (r) => Object.values(r)[0] || '',
                effectiveQuery,
                sortMode
              )
            : tbl.rows,
        }))
        .filter((t) => t.rows.length > 0);
      let customItems = filterAndRankItems(
        extracted.customItems,
        (row) => Object.values(row).join(' '),
        (row) => Object.values(row)[0] || '',
        effectiveQuery,
        sortMode
      );

      if (filterType !== 'all') {
        if (filterType !== 'videos') videos = [];
        if (filterType !== 'documents') documents = [];
        if (filterType !== 'items') items = [];
        if (filterType !== 'sections') sections = [];
        if (filterType !== 'links') links = [];
        if (filterType !== 'tables') tables = [];
      }

      videos = videos.slice(0, cap);
      documents = documents.slice(0, cap);
      items = items.slice(0, cap);
      sections = sections.slice(0, cap);
      links = links.slice(0, cap);
      tables = tables.slice(0, cap);
      customItems = customItems.slice(0, cap);

      if (!isAdhocExtract) {
        endpoint.hitCount += 1;
        endpoint.hasSearchForm = targetSourceMode === 'url' && Boolean(extracted.searchForm);
      }

      const elapsed = Math.round(performance.now() - startedAt);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-API-Source-Mode', targetSourceMode);
      res.setHeader('X-Response-Time-Ms', String(elapsed));

      const payload: LiveApiPayload = {
        api: isAdhocExtract ? '/api/v1/extract' : `/api/v1/${endpoint.slug}`,
        openApiSpec: isAdhocExtract ? `/api/v1/college-courses/openapi.json` : `/api/v1/${endpoint.slug}/openapi.json`,
        methodUsed: req.method,
        acceptedParams: ['q', 'query', 'search', 'id', 'url', 'page', 'collectAll', 'format', 'mode', 'type', 'limit', 'sort', 'siteSearch', 'fresh'],
        name: isAdhocExtract ? extracted.overview.title : endpoint.name,
        sourceUrl: extracted.sourceUrl,
        category: extracted.overview.category,
        fetchedAt: new Date().toISOString(),
        cached: cachedHit,
        responseTimeMs: elapsed,
        query: queryText || null,
        filterType,
        limitApplied,
        siteSearchUsed,
        searchFormAvailable: Boolean(extracted.searchForm),
        crawledPagesCount: extracted.crawledPagesCount,
        overview: extracted.overview,
        backendTrace: extracted.backendTrace,
        counts: {
          videos: videos.length,
          documents: documents.length,
          items: items.length,
          sections: sections.length,
          tables: tables.length,
          links: links.length,
          customItems: customItems.length,
        },
        videos,
        documents,
        items,
        sections,
        tables,
        links,
        ...(endpoint.builderMode === 'custom' ? { customItems } : {}),
        ...(endpoint.capturedPattern ? { capturedPattern: endpoint.capturedPattern } : {}),
        ...(capturedUpstreamData !== undefined ? { capturedUpstreamData } : {}),
      };

      const requestedFormat = String(req.query.format ?? (req.body && (req.body as Record<string, unknown>).format) ?? '').toLowerCase();
      if (requestedFormat === 'universal') {
        const rawMode = String(req.query.mode ?? (req.body && (req.body as Record<string, unknown>).mode) ?? '').toLowerCase();
        const pageNum = Math.max(1, Number(req.query.page ?? (req.body && (req.body as Record<string, unknown>).page) ?? 1) || 1);
        const mode: 'list' | 'detail' =
          rawMode === 'detail'
            ? 'detail'
            : rawMode === 'list'
              ? 'list'
              : (overrideUrl || idText) && !queryText
                ? 'detail'
                : 'list';

        if (mode === 'detail') {
          res.json({
            status: true,
            mode: 'detail',
            info: {
              title: extracted.overview.title,
              poster: extracted.overview.thumbnail || (extracted.images[0]?.src ?? ''),
              description: extracted.overview.description,
              meta: {
                Site: extracted.overview.siteName,
                Category: extracted.overview.category,
                Author: extracted.overview.author || 'N/A',
                Published: extracted.overview.publishedDate || 'N/A',
              },
            },
            streams: videos.map((v, idx) => ({
              server: v.channelName || `Server ${idx + 1} (${v.streamFormat || v.playableType || 'Stream'})`,
              type: v.playableType === 'hls' ? 'm3u8' : v.playableType === 'html5' ? 'mp4' : 'embed',
              url: v.videoUrl,
              embedUrl: v.embedUrl,
              proxyUrl: v.proxyStreamUrl,
            })),
            downloads: documents.map((d) => ({
              label: d.title,
              quality: d.fileType,
              size: '',
              server: extracted.overview.siteName || 'Direct',
              url: d.url,
            })),
            ...(capturedUpstreamData !== undefined ? { raw: capturedUpstreamData } : {}),
          });
          return;
        }

        const results = items.length > 0
          ? items.map((it) => ({
              title: it.title,
              url: it.url || extracted.sourceUrl,
              poster: it.image || extracted.overview.thumbnail || '',
              badge: it.meta || it.kind,
              description: it.description || '',
            }))
          : videos.map((v) => ({
              title: v.title,
              url: v.pageUrl || v.videoUrl,
              poster: v.thumbnail || extracted.overview.thumbnail || '',
              badge: v.streamFormat || v.duration || 'Video',
              description: v.description || '',
            }));

        res.json({
          status: true,
          mode: 'list',
          page: pageNum,
          has_next: links.some((l) => /page=|\/page\/|next/i.test(`${l.text} ${l.url}`)),
          results,
        });
        return;
      }

      res.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upstream website fetch failed.';
      res.status(502).json({
        api: isAdhocExtract ? '/api/v1/extract' : `/api/v1/${endpoint.slug}`,
        error: message,
        responseTimeMs: Math.round(performance.now() - startedAt),
      });
    }
  }

  // Universal ad-hoc public API route: GET or POST /api/v1/extract?url=...&q=...
  app.all('/api/v1/extract', async (req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
      return;
    }
    const { overrideUrl, crawlDepth } = readFlexibleApiParams(req);
    if (!overrideUrl) {
      res.status(400).json({
        error: 'Missing website URL. Pass ?url=https://example.com or JSON body {"url": "https://example.com"}.',
      });
      return;
    }
    await executeLiveApiEndpoint(
      req,
      res,
      {
        slug: 'extract',
        name: 'Universal On-Demand Website API',
        sourceMode: 'url',
        builderMode: 'auto',
        crawlDepth,
        url: overrideUrl,
        containerSelector: '',
        rules: [],
        limit: 0,
        createdAt: new Date().toISOString(),
        hitCount: 0,
      },
      true
    );
  });

  // Published API endpoints: accept both GET (?q=, ?query=, ?url=, ...) and POST JSON body
  app.all('/api/v1/:slug', async (req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
      return;
    }
    const slug = String(req.params.slug || '').toLowerCase();
    const endpoint = publishedEndpoints.get(slug);

    if (!endpoint) {
      res.status(404).json({
        error: 'API endpoint not found',
        slug,
        hint: 'Publish this endpoint slug from the API Builder first, or use /api/v1/extract?url=<website-url>.',
      });
      return;
    }

    await executeLiveApiEndpoint(req, res, endpoint, false);
  });

  // Guarantee /api/* routes ALWAYS return JSON (never fall through to Vite/SPA HTML <!doctype html>)
  app.all('/api/*', (req: Request, res: Response) => {
    setPublicApiCorsHeaders(res);
    res.status(404).json({
      status: false,
      error: `API route not found: ${req.method} ${req.originalUrl}`,
      hint: 'Use /api/v1/<slug>?q=...&limit=all or /api/v1/extract?url=<website-url>',
    });
  });

  app.use((err: unknown, req: Request, res: Response, next: (e?: unknown) => void) => {
    if (req.path.startsWith('/api/')) {
      setPublicApiCorsHeaders(res);
      const message = err instanceof Error ? err.message : 'Internal API server error.';
      res.status(500).json({ status: false, error: message });
      return;
    }
    next(err);
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Site2API Lab server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
