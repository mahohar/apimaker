export type ExtractAttribute = 'text' | 'href' | 'src';
export type BuilderMode = 'auto' | 'custom';
export type CrawlDepth = 'single' | 'linked' | 'deep';
export type EndpointDataFilter =
  | 'all'
  | 'videos'
  | 'documents'
  | 'items'
  | 'sections'
  | 'links'
  | 'tables';

export interface ExtractionRule {
  id: string;
  key: string;
  selector: string;
  attribute: ExtractAttribute;
}

export interface SitePreset {
  id: string;
  label: string;
  sourceMode: 'url' | 'html';
  builderMode: BuilderMode;
  url: string;
  rawHtml?: string;
  containerSelector: string;
  rules: ExtractionRule[];
  suggestedSlug: string;
  description: string;
}

export interface DetectedSelector {
  selector: string;
  count: number;
  sampleText: string;
}

export interface SiteOverview {
  title: string;
  description: string;
  author: string;
  publishedDate: string;
  siteName: string;
  thumbnail: string;
  canonicalUrl: string;
  category: string;
  wordCount: number;
  readingTimeMinutes: number;
}

export interface ExtractedVideo {
  title: string;
  description: string;
  videoUrl: string;
  embedUrl?: string;
  proxyStreamUrl?: string;
  playableType?: 'youtube-embed' | 'hls' | 'html5' | 'iframe';
  pageUrl?: string;
  sourcePage?: string;
  thumbnail?: string;
  duration?: string;
  streamFormat?: string;
  downloadable?: boolean;
  channelName?: string;
  views?: string;
  publishedTime?: string;
  extractedFrom: string;
  sourceType:
    | 'html5-video'
    | 'youtube-data'
    | 'youtube-embed'
    | 'vimeo-embed'
    | 'iframe-embed'
    | 'opengraph'
    | 'json-ld'
    | 'script-stream'
    | 'video-link';
}

export interface ExtractedDocument {
  title: string;
  url: string;
  fileType: 'PDF' | 'PPT' | 'DOC' | 'ZIP' | 'SPREADSHEET' | 'EBOOK' | 'NOTES';
  sourcePage: string;
  extractedFrom: string;
}

export interface ExtractedItem {
  title: string;
  description: string;
  url?: string;
  image?: string;
  meta?: string;
  sourcePage?: string;
  extractedFrom?: string;
  kind: 'article' | 'book' | 'course' | 'card' | 'list-item';
}

export interface ExtractedSection {
  heading: string;
  content: string;
  sourcePage?: string;
}

export interface ExtractedTable {
  caption: string;
  headers: string[];
  rows: Array<Record<string, string>>;
}

export interface ExtractedLink {
  text: string;
  url: string;
  category: 'video' | 'document' | 'article' | 'external' | 'internal';
  extractedFrom: string;
  sourcePage?: string;
}

export interface DetectedSearchForm {
  actionUrl: string;
  method: string;
  queryParam: string;
}

export interface EmbeddedPayloadInfo {
  name: string;
  kind: 'script-state' | 'json-ld' | 'feed' | 'api-endpoint';
  detail: string;
}

export interface NetworkTraceEntry {
  id: string;
  method: string;
  url: string;
  resourceType: 'document' | 'xhr-discovered' | 'media-stream' | 'crawl-page';
  status: number | string;
  durationMs: number;
  bytes: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  initiator: string;
  responsePreview?: string;
}

export interface BackendTrace {
  requestUrl: string;
  finalUrl: string;
  redirectChain: Array<{ url: string; status: number }>;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  htmlBytes: number;
  embeddedPayloads: EmbeddedPayloadInfo[];
  linkSourceBreakdown: Array<{ source: string; count: number }>;
  crawledUrls: string[];
  networkEntries: NetworkTraceEntry[];
  notes: string[];
}

export interface PageMetadata {
  pageTitle: string;
  metaDescription: string;
  totalLinks: number;
  totalHeadings: number;
  totalImages: number;
  totalVideos: number;
  totalDocuments: number;
}

export interface ExtractResponse {
  ok: boolean;
  status: number;
  responseTimeMs: number;
  sourceMode: 'url' | 'html';
  builderMode: BuilderMode;
  crawlDepth: CrawlDepth;
  sourceUrl: string;
  overview: SiteOverview;
  metadata: PageMetadata;
  videos: ExtractedVideo[];
  documents: ExtractedDocument[];
  items: ExtractedItem[];
  sections: ExtractedSection[];
  tables: ExtractedTable[];
  links: ExtractedLink[];
  images: Array<{ alt: string; src: string }>;
  customItems: Array<Record<string, string>>;
  searchForm: DetectedSearchForm | null;
  backendTrace: BackendTrace;
  crawledPagesCount: number;
  detectedSelectors: DetectedSelector[];
  rawHtmlPreview: string;
  error?: string;
}

export interface DynamicVariableSpec {
  name: string;
  location: 'path' | 'query' | 'body' | 'timestamp';
  placeholder: string;
  demoValue: string;
}

export interface CapturedPattern {
  kind: 'json-api' | 'html-search';
  baseUrl: string;
  staticUrlTemplate?: string;
  method: 'GET' | 'POST';
  queryParam?: string;
  idParam?: string;
  pageParam?: string;
  timestampParam?: string;
  requestHeaders?: Record<string, string>;
  postBodyTemplate?: string;
  sampleQuery?: string;
  sampleId?: string;
  samplePage?: string;
  dynamicVariables?: DynamicVariableSpec[];
  multiRoutes?: {
    latestUrl?: string;
    searchUrl?: string;
    detailUrl?: string;
  };
  collectAll?: boolean;
  siteUrl?: string;
}

export interface CapturedF12Event {
  id: string;
  sessionId: string;
  timestamp: string;
  method: string;
  url: string;
  resourceType: 'document' | 'search' | 'xhr' | 'fetch' | 'media' | 'pdf';
  status: number | string;
  contentType: string;
  durationMs: number;
  bytes: number;
  initiator: string;
  detectedQueryParam?: string;
  detectedQueryValue?: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  responsePreview: string;
  isJson?: boolean;
  extractedSummary?: {
    title: string;
    videosCount: number;
    documentsCount: number;
    itemsCount: number;
    linksCount: number;
  };
  videos?: ExtractedVideo[];
  documents?: ExtractedDocument[];
  items?: ExtractedItem[];
  links?: ExtractedLink[];
}

export interface PublishedEndpoint {
  slug: string;
  name: string;
  sourceMode: 'url' | 'html';
  builderMode: BuilderMode;
  crawlDepth: CrawlDepth;
  url: string;
  rawHtml?: string;
  containerSelector: string;
  rules: ExtractionRule[];
  limit: number; // 0 means unlimited (all extracted items)
  createdAt: string;
  hitCount: number;
  hasSearchForm?: boolean;
  capturedPattern?: CapturedPattern;
}

export interface LiveApiPayload {
  api: string;
  openApiSpec: string;
  methodUsed?: string;
  acceptedParams?: string[];
  name: string;
  sourceUrl: string;
  category: string;
  fetchedAt: string;
  cached: boolean;
  responseTimeMs: number;
  query: string | null;
  filterType: EndpointDataFilter;
  limitApplied: number | 'unlimited';
  siteSearchUsed: boolean;
  searchFormAvailable: boolean;
  crawledPagesCount: number;
  overview: SiteOverview;
  backendTrace: BackendTrace;
  counts: {
    videos: number;
    documents: number;
    items: number;
    sections: number;
    tables: number;
    links: number;
    customItems: number;
  };
  videos: ExtractedVideo[];
  documents: ExtractedDocument[];
  items: ExtractedItem[];
  sections: ExtractedSection[];
  tables: ExtractedTable[];
  links: ExtractedLink[];
  customItems?: Array<Record<string, string>>;
  capturedPattern?: CapturedPattern;
  capturedUpstreamData?: unknown;
}

export interface LiveEndpointTestResult {
  status: number;
  responseTimeMs: number;
  headers: Record<string, string>;
  body: LiveApiPayload | { error?: string };
}
