import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Play } from 'lucide-react';

interface PresentationViewProps {
  onOpenLiveDemo: () => void;
}

interface Slide {
  number: number;
  kicker: string;
  title: string;
  bullets: string[];
  codeExample?: string;
  speakingTip: string;
}

const SLIDES: Slide[] = [
  {
    number: 1,
    kicker: 'BCA Practical Presentation',
    title: 'How to Create an API for Any Website',
    bullets: [
      'Problem: Most useful websites only display data in HTML for human readers, without offering a public JSON API.',
      'Solution: Build an Express.js backend service that fetches HTML, parses the DOM using CSS selectors, and serves clean JSON endpoints.',
      'Outcome: Any mobile app, React dashboard, or Python script can consume live website data through a single REST endpoint.',
    ],
    speakingTip:
      'Shuruat aise karein: "Good morning sir/ma’am. Today my practical topic is how we can build a live JSON REST API for any website that does not provide an official API."',
  },
  {
    number: 2,
    kicker: 'Core Concept',
    title: 'What is an API & Why JSON?',
    bullets: [
      'API (Application Programming Interface) acts as a structured contract between a server and a client application.',
      'Websites return HTML (designed for browser layout with tags, styles, and ads).',
      'APIs return JSON (lightweight key-value data that programs can read immediately without UI clutter).',
    ],
    codeExample: `HTML (For Browsers)               JSON API (For Apps)
<h2 class="title">BCA Exam</h2>   { "title": "BCA Exam", "date": "2026-11-27" }`,
    speakingTip:
      'Simple line bolein: "HTML insaan ke padhne ke liye hota hai, aur JSON software ya mobile app ke padhne ke liye hota hai."',
  },
  {
    number: 3,
    kicker: 'System Architecture',
    title: 'Why We Need a Backend Server (CORS)',
    bullets: [
      'Browsers enforce the Same-Origin Policy (CORS), blocking frontend JavaScript from reading external websites directly.',
      'A Node.js + Express backend runs server-side, where CORS does not restrict outbound HTTP requests.',
      'The backend acts as a clean proxy: Client -> Express Server -> Target Website -> Cheerio Parser -> JSON Response.',
    ],
    speakingTip:
      'Agar teacher puche "React se direct fetch kyun nahi kiya?", toh jawab dein: "Browser CORS security policy block kar deti hai, isliye server-side Express proxy zaroori hai."',
  },
  {
    number: 4,
    kicker: 'DOM Parsing Engine',
    title: 'Extracting Data with CSS Selectors & Cheerio',
    bullets: [
      'Cheerio parses raw HTML strings on the server using familiar jQuery-style CSS selectors.',
      'Container Selector (e.g. .quote or article.notice-card) identifies each repeating item block.',
      'Field Selectors extract inner text (.text()) or link/image attributes (.attr("href"), .attr("src")).',
    ],
    codeExample: `const $ = cheerio.load(html);
const items = $(".quote").map((_, el) => ({
  quote: $(el).find(".text").text().trim(),
  author: $(el).find(".author").text().trim()
})).get();`,
    speakingTip:
      'Is slide pe batayein ki humne pure regex ki jagah Cheerio DOM parser use kiya hai jo CSS selectors se accurate data nikalta hai.',
  },
  {
    number: 5,
    kicker: 'REST Endpoint Design',
    title: 'Publishing Dynamic /api/v1/:slug Routes',
    bullets: [
      'POST /api/extract tests CSS selector rules live and previews the structured JSON output.',
      'POST /api/endpoints saves the extraction recipe under a clean URL slug such as /api/v1/quotes-feed.',
      'GET /api/v1/:slug dynamically executes extraction and returns HTTP 200 OK with query support (?limit=10).',
    ],
    speakingTip:
      'Yahan batayein ki humara project sirf ek static scraper nahi, balki ek dynamic API generator hai jo turant naya URL endpoint banata hai.',
  },
  {
    number: 6,
    kicker: 'Security & Ethics',
    title: 'Safe Fetching & Responsible API Wrapping',
    bullets: [
      'URL Validation: Allow only http:// and https:// protocols and block localhost or private IP ranges.',
      'Resource Limits: Enforce request timeouts (8.5s) and maximum HTML payload caps (2 MB).',
      'Ethical Rules: Only access public pages, respect robots.txt, avoid login bypassing, and cache responses to reduce load.',
    ],
    speakingTip:
      'Examiner security pe khush hote hain: "Humne private/local IP blocking aur timeout limits lagaye hain taaki server misuse na ho."',
  },
  {
    number: 7,
    kicker: 'Live Demonstration',
    title: 'Practical Demo Checklist',
    bullets: [
      'Step 1: Open API Builder and select Quotes Sandbox (or Offline Demo HTML if internet is off).',
      'Step 2: Click Extract to show raw HTML converting into structured JSON and Table rows.',
      'Step 3: Click Publish API and run a live GET request in the Live Endpoints tab.',
    ],
    speakingTip:
      'Ab "Open Live Builder Demo" button click karein aur teacher ke samne live API banakar dikhayein!',
  },
];

interface VivaQuestion {
  q: string;
  a: string;
}

const VIVA_QUESTIONS: VivaQuestion[] = [
  {
    q: '1. What is an API, and what does REST stand for?',
    a: 'API stands for Application Programming Interface—a set of rules allowing two software applications to exchange data. REST stands for Representational State Transfer, an architectural style using standard HTTP methods (GET, POST, PUT, DELETE) and stateless JSON responses.',
  },
  {
    q: '2. How can we create an API for a website that has no official API?',
    a: 'We build a backend wrapper using Node.js and Express. The server fetches the website’s public HTML page, parses the DOM tree with Cheerio using CSS selectors, extracts the required fields, and returns them as a structured JSON endpoint.',
  },
  {
    q: '3. Why cannot frontend JavaScript (React) directly scrape another website?',
    a: 'Browsers enforce CORS (Cross-Origin Resource Sharing) to protect users. Most external websites do not send Access-Control-Allow-Origin headers, so the browser blocks client-side fetch requests. A backend server does not have CORS restrictions.',
  },
  {
    q: '4. What is Cheerio and why use it instead of Regular Expressions (Regex)?',
    a: 'Cheerio is a fast Node.js library that parses HTML into a DOM tree and lets us query elements with CSS selectors. HTML has nested tags that break easily with Regex, whereas a DOM parser handles nesting reliably.',
  },
  {
    q: '5. What is the difference between HTML and JSON?',
    a: 'HTML (HyperText Markup Language) describes webpage structure and visual presentation for browsers. JSON (JavaScript Object Notation) is a lightweight key-value data format designed for machine-to-machine data exchange.',
  },
  {
    q: '6. What are CSS Selectors? Give three examples used in your project.',
    a: 'CSS Selectors are patterns used to locate HTML elements. Examples: Class selector (.quote), Tag selector (h2), and Child/Descendant selector (.titleline > a).',
  },
  {
    q: '7. Which HTTP status codes does your API return?',
    a: '200 OK for successful data extraction, 201 Created when publishing a new endpoint, 400 Bad Request for invalid slugs or empty rules, 404 Not Found for unknown endpoints, and 502 Bad Gateway if the target website fails to respond.',
  },
  {
    q: '8. What security safeguards are needed when a backend fetches user-supplied URLs?',
    a: 'We validate the URL scheme (only http/https), resolve DNS to block loopback/private IP ranges (such as 127.0.0.1 and 192.168.x.x), enforce strict request timeouts, and cap maximum download size.',
  },
  {
    q: '9. What is the difference between GET and POST in your application?',
    a: 'POST /api/extract and POST /api/endpoints send configuration payloads (URL and CSS rules) in the request body. GET /api/v1/:slug retrieves the live JSON output using URL query parameters like ?limit=10.',
  },
  {
    q: '10. Is extracting data from websites legal and ethical?',
    a: 'Extracting publicly accessible, non-copyrighted factual data for educational or personal use is common, provided we respect robots.txt, never bypass authentication/paywalls, and do not overload target servers with rapid requests.',
  },
];

export function PresentationView({ onOpenLiveDemo }: PresentationViewProps) {
  const [subTab, setSubTab] = useState<'slides' | 'viva' | 'record'>('slides');
  const [slideIndex, setSlideIndex] = useState(0);
  const [openVivaIdx, setOpenVivaIdx] = useState<number | null>(0);

  useEffect(() => {
    if (subTab !== 'slides') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setSlideIndex((i) => Math.min(SLIDES.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft') {
        setSlideIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [subTab]);

  const currentSlide = SLIDES[slideIndex];

  return (
    <div className="space-y-6">
      {/* Top Switcher */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            BCA Practical Presentation &amp; Viva Kit
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Use the slide deck during your classroom presentation, review examiner viva answers, or reference the practical file summary.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('slides')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'slides' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Slides ({SLIDES.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('viva')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'viva' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Viva Q&amp;A ({VIVA_QUESTIONS.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('record')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              subTab === 'record' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Practical Record
          </button>
        </div>
      </section>

      {/* Subtab 1: Slide Deck */}
      {subTab === 'slides' && (
        <div className="space-y-4">
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-mono font-semibold text-blue-700">
                  Slide {currentSlide.number} of {SLIDES.length}
                </span>
                <span aria-hidden="true">·</span>
                <span>{currentSlide.kicker}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenLiveDemo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  Open Live Builder Demo
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-10 min-h-[380px] flex flex-col justify-between gap-8">
              <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 max-w-3xl text-balance">
                  {currentSlide.title}
                </h2>

                <ul className="space-y-3.5 max-w-3xl">
                  {currentSlide.bullets.map((bullet, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-base text-slate-700 leading-relaxed">
                      <span className="font-mono text-xs font-semibold text-blue-600 mt-1.5 shrink-0">
                        0{idx + 1}
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                {currentSlide.codeExample && (
                  <pre className="p-4 rounded-lg bg-[#0F172A] text-slate-100 text-xs sm:text-sm font-mono leading-relaxed overflow-x-auto max-w-3xl">
                    {currentSlide.codeExample}
                  </pre>
                )}
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 max-w-3xl">
                <p className="text-xs font-semibold text-slate-900 mb-1">Presenter Speaking Cue</p>
                <p className="text-sm text-slate-600 leading-relaxed">{currentSlide.speakingTip}</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <button
                type="button"
                disabled={slideIndex === 0}
                onClick={() => setSlideIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous Slide
              </button>

              <div className="flex items-center gap-1.5">
                {SLIDES.map((s, idx) => (
                  <button
                    key={s.number}
                    type="button"
                    aria-label={`Go to slide ${s.number}`}
                    onClick={() => setSlideIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === slideIndex ? 'w-6 bg-blue-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                disabled={slideIndex === SLIDES.length - 1}
                onClick={() => setSlideIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Next Slide
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Subtab 2: Viva Q&A */}
      {subTab === 'viva' && (
        <section className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
          {VIVA_QUESTIONS.map((item, idx) => {
            const isOpen = openVivaIdx === idx;
            return (
              <div key={idx}>
                <button
                  type="button"
                  onClick={() => setOpenVivaIdx(isOpen ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="text-sm font-semibold text-slate-900">{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 pt-0 text-sm text-slate-600 leading-relaxed max-w-4xl">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Subtab 3: Practical Record Summary */}
      {subTab === 'record' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-1.5">Practical Aim</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                To design and implement a full-stack web application that converts any publicly accessible HTML website into a structured JSON REST API endpoint using Node.js, Express, and Cheerio DOM parsing.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 mb-1.5">Technologies Used</h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Frontend: React 19, TypeScript, Tailwind CSS. Backend: Node.js, Express.js, Cheerio HTML Parser, Fetch API, and RESTful JSON Endpoints.
              </p>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">Step-by-Step Algorithm</h2>
            <ol className="space-y-2 text-sm text-slate-700 list-decimal list-inside">
              <li>Accept a target public website URL (or raw HTML input) and CSS selector mapping rules from the user.</li>
              <li>Validate the URL protocol and verify DNS resolution blocks private/loopback network addresses.</li>
              <li>Fetch the target HTML document from the Express backend with timeout and size safeguards.</li>
              <li>Load the HTML string into Cheerio and iterate over the container selector to extract each mapped field.</li>
              <li>Publish the configuration under a dynamic REST route (<span className="font-mono text-xs">/api/v1/:slug</span>).</li>
              <li>Serve live JSON responses with HTTP status codes, item counts, and query limit filtering (<span className="font-mono text-xs">?limit=N</span>).</li>
            </ol>
          </div>

          <div className="pt-5 border-t border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 mb-1.5">Conclusion</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              This practical demonstrates how server-side HTML parsing bridges the gap between human-readable websites and machine-readable REST APIs while respecting browser security boundaries and ethical web access practices.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
