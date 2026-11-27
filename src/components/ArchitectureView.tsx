import { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';

interface PipelineStage {
  step: number;
  title: string;
  subtitle: string;
  role: string;
  explanation: string;
  hinglishTip: string;
  artifactTitle: string;
  artifactCode: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    step: 1,
    title: '01. Client Request',
    subtitle: 'Browser or mobile app requests JSON data',
    role: 'Client Layer',
    explanation:
      'A frontend app cannot directly fetch HTML from most external websites because browsers enforce CORS (Cross-Origin Resource Sharing). Instead, the client calls our own Express API route using fetch().',
    hinglishTip:
      'Examiner ko batayein: Browser CORS policy ki wajah se dusri site ko direct fetch nahi kar sakta, isliye hum apna backend API endpoint banate hain.',
    artifactTitle: 'HTTP Request Sent by Client',
    artifactCode: `GET /api/v1/quotes-demo?limit=2 HTTP/1.1
Host: localhost:3000
Accept: application/json`,
  },
  {
    step: 2,
    title: '02. URL Safety & Gateway',
    subtitle: 'Express validates request and target URL',
    role: 'API Gateway',
    explanation:
      'Before contacting any external server, the Express backend parses the target URL, allows only HTTP/HTTPS schemes, and blocks private or local network IP addresses to keep the server safe.',
    hinglishTip:
      'Examiner ko batayein: Server pe pehle URL validate hota hai taaki koi local/private IP ya invalid protocol access na ho sake.',
    artifactTitle: 'Server-Side Validation Check',
    artifactCode: `const parsed = new URL(targetUrl);
// Verify protocol is http: or https:
// Verify DNS resolves to public IP (not 127.0.0.1 or 192.168.x.x)
// Enforce 8.5s timeout and 2 MB response cap`,
  },
  {
    step: 3,
    title: '03. Server-Side HTML Fetch',
    subtitle: 'Backend downloads raw HTML document',
    role: 'Upstream Fetcher',
    explanation:
      'Unlike a browser, a Node.js server is not restricted by CORS. It sends an HTTP GET request with a User-Agent header to the target website and receives the raw HTML document.',
    hinglishTip:
      'Examiner ko batayein: Server-to-server communication pe CORS lagu nahi hota, isliye Node.js target website ka raw HTML easily download kar leta hai.',
    artifactTitle: 'Raw HTML Received from Website',
    artifactCode: `<div class="quote">
  <span class="text">“The world as we have created it is a process of our thinking.”</span>
  <span>by <small class="author">Albert Einstein</small></span>
  <a href="/author/Albert-Einstein">(about)</a>
</div>`,
  },
  {
    step: 4,
    title: '04. Cheerio DOM Parsing',
    subtitle: 'CSS selectors extract exact fields',
    role: 'HTML Parser',
    explanation:
      'Cheerio loads the raw HTML string into a fast server-side DOM tree. Using CSS selectors like .quote, .text, and .author, we extract only the useful text or href attributes.',
    hinglishTip:
      'Examiner ko batayein: Cheerio HTML ko DOM tree mein badalta hai, phir CSS selectors (.quote, .author) se hum exact data nikalte hain.',
    artifactTitle: 'CSS Selector Extraction Logic',
    artifactCode: `const $ = cheerio.load(html);
$(".quote").each((_, el) => {
  items.push({
    quote: $(el).find(".text").text().trim(),
    author: $(el).find(".author").text().trim(),
    authorUrl: $(el).find("span a").attr("href")
  });
});`,
  },
  {
    step: 5,
    title: '05. Structured JSON API',
    subtitle: 'Clean REST response delivered to any app',
    role: 'JSON Output',
    explanation:
      'The extracted array is wrapped with metadata (status, count, timestamp) and sent back with Content-Type: application/json. Now React, Android, Python, or Postman can consume it!',
    hinglishTip:
      'Examiner ko batayein: Unstructured HTML ab clean structured JSON ban chuka hai jise koi bhi mobile app, website, ya Postman use kar sakta hai.',
    artifactTitle: 'Final JSON API Response (200 OK)',
    artifactCode: `{
  "api": "/api/v1/quotes-demo",
  "count": 2,
  "data": [
    {
      "quote": "The world as we have created it is a process of our thinking.",
      "author": "Albert Einstein",
      "authorUrl": "https://quotes.toscrape.com/author/Albert-Einstein"
    }
  ]
}`,
  },
];

export function ArchitectureView() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % PIPELINE_STAGES.length);
    }, 3200);
    return () => clearInterval(timer);
  }, [playing]);

  const activeStage = PIPELINE_STAGES[activeIndex];

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            How Any Website Becomes an API
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Step through the 5-stage server pipeline that converts unstructured HTML pages into structured JSON endpoints.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {playing ? 'Pause Auto-Step' : 'Auto-Play Flow'}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setActiveIndex(0);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </section>

      {/* Interactive 5-Node Horizontal Pipeline */}
      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isActive = idx === activeIndex;
            const isCompleted = idx < activeIndex;
            return (
              <button
                key={stage.step}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setActiveIndex(idx);
                }}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : isCompleted
                      ? 'bg-emerald-50/60 text-slate-900 border-emerald-200 hover:border-emerald-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    className={`text-xs font-mono ${
                      isActive ? 'text-blue-300' : isCompleted ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {stage.role}
                  </span>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <ArrowRight
                      className={`w-3.5 h-3.5 hidden md:block ${
                        isActive ? 'text-slate-400' : 'text-slate-300'
                      }`}
                    />
                  )}
                </div>
                <p className="text-sm font-semibold leading-snug">{stage.title}</p>
                <p
                  className={`text-xs mt-1 leading-relaxed ${
                    isActive ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {stage.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Stage Deep-Dive */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="text-xs font-mono text-blue-700">
              Stage {activeStage.step} of {PIPELINE_STAGES.length} · {activeStage.role}
            </div>
            <h2 className="text-xl font-bold text-slate-900">{activeStage.title}</h2>
            <p className="text-sm text-slate-700 leading-relaxed">{activeStage.explanation}</p>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs font-semibold text-slate-900 mb-1">
                Presentation Speaking Point
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">{activeStage.hinglishTip}</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => {
                setPlaying(false);
                setActiveIndex((i) => Math.max(0, i - 1));
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {activeStage.step} / {PIPELINE_STAGES.length}
            </span>
            <button
              type="button"
              disabled={activeIndex === PIPELINE_STAGES.length - 1}
              onClick={() => {
                setPlaying(false);
                setActiveIndex((i) => Math.min(PIPELINE_STAGES.length - 1, i + 1));
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#0F172A] border border-slate-800 rounded-xl p-6 flex flex-col justify-between text-slate-100">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-800">
              <span className="text-xs font-mono text-slate-400">{activeStage.artifactTitle}</span>
              <span className="text-xs font-mono text-emerald-400">Live Pipeline Step</span>
            </div>
            <pre className="text-xs sm:text-sm font-mono leading-relaxed text-slate-100 whitespace-pre-wrap overflow-x-auto">
              {activeStage.artifactCode}
            </pre>
          </div>

          <div className="pt-4 mt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Input: Website URL / HTML</span>
            <span>Output: Standard JSON REST API</span>
          </div>
        </div>
      </section>
    </div>
  );
}
