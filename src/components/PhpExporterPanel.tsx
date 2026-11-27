import { useMemo, useState } from 'react';
import { Check, Code2, Copy, Download } from 'lucide-react';
import type { CapturedPattern } from '../types/api';
import { generateStandalonePhpApi } from '../utils/phpApiGenerator';
import { buildAutoDetectingIndexHtml } from '../utils/selfHealingDetector';

interface PhpExporterPanelProps {
  defaultBaseUrl: string;
  defaultSampleItemUrl?: string;
  defaultCapturedPayload?: string;
  capturedPattern?: CapturedPattern;
  detectedQueryParam?: string;
}

export function PhpExporterPanel({
  defaultBaseUrl,
  defaultSampleItemUrl,
  defaultCapturedPayload,
  capturedPattern,
  detectedQueryParam,
}: PhpExporterPanelProps) {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [sampleItemUrl, setSampleItemUrl] = useState(defaultSampleItemUrl || defaultBaseUrl);
  const [capturedJsonText, setCapturedJsonText] = useState(defaultCapturedPayload || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sourceOrigin = useMemo(() => {
    try {
      return new URL(baseUrl || defaultBaseUrl).origin;
    } catch {
      return undefined;
    }
  }, [baseUrl, defaultBaseUrl]);

  const generated = useMemo(
    () =>
      generateStandalonePhpApi({
        baseUrl: baseUrl || defaultBaseUrl,
        sampleItemUrl: sampleItemUrl || baseUrl || defaultBaseUrl,
        capturedJsonText,
        capturedPattern,
        detectedQueryParam,
      }),
    [baseUrl, sampleItemUrl, capturedJsonText, capturedPattern, detectedQueryParam, defaultBaseUrl]
  );

  const autoDetectHtml = useMemo(
    () =>
      buildAutoDetectingIndexHtml(
        'https://MY-DOMAIN.com/api.php',
        capturedPattern?.sampleQuery || capturedPattern?.sampleId || '',
        sourceOrigin
      ),
    [capturedPattern?.sampleId, capturedPattern?.sampleQuery, sourceOrigin]
  );

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // ignore clipboard restriction
    }
  };

  const handleDownloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Phase 1 Inputs: Target Website, Sample Item, Optional Captured Network JSON */}
      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">
              Standalone PHP Backend Generator (2-Part Split + Relative Asset Fix + time() + Multi-Route)
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Generates a single production-ready <span className="font-mono">api.php</span> with{' '}
              <span className="font-mono">urlencode()</span> / <span className="font-mono">json_encode()</span>, Demo Fallback mode, and <span className="font-mono">index.html</span> auto-detecting viewer.
            </p>
          </div>
          <span className="font-mono text-emerald-700 font-medium">PHP 7.4+ / 8.x cURL</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block font-medium text-slate-700">Base Website URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://targetsite.com"
              className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
          <div className="space-y-1">
            <label className="block font-medium text-slate-700">Sample Item / Target URL</label>
            <input
              type="text"
              value={sampleItemUrl}
              onChange={(e) => setSampleItemUrl(e.target.value)}
              placeholder="https://targetsite.com/api/id/308007"
              className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="block font-medium text-slate-700">
            Captured Network XHR/Fetch URL or POST JSON Template (Optional)
          </label>
          <textarea
            rows={2}
            value={capturedJsonText}
            onChange={(e) => setCapturedJsonText(e.target.value)}
            placeholder="Paste captured F12 Fetch/XHR API URL or POST JSON payload (supports {q}, {id}, {page}, {timestamp})..."
            className="w-full px-3 py-2 font-mono bg-white border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Ready-to-Use Calling URLs */}
      <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-2.5">
        <p className="font-semibold text-slate-900">
          Multi-Route Calling URLs (Host <span className="font-mono">api.php</span> at{' '}
          <span className="font-mono">https://MY-DOMAIN.com/api.php</span>)
        </p>

        <div className="space-y-2 font-mono">
          {(
            [
              { id: 'php-latest', label: 'Latest (?action=latest)', url: generated.callingUrls.latest },
              { id: 'php-search', label: 'Search (?action=search&q=)', url: generated.callingUrls.search },
              { id: 'php-id', label: 'Detail (?action=detail&id=)', url: generated.callingUrls.shortcutId },
              { id: 'php-detail', label: 'Dynamic (?url=)', url: generated.callingUrls.detail },
              { id: 'php-proxy', label: 'Media Proxy (?proxy=)', url: generated.callingUrls.proxy },
            ] as const
          ).map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md"
            >
              <div className="min-w-0 flex items-center gap-2">
                <span className="font-sans font-semibold text-slate-700 shrink-0">{row.label}:</span>
                <span className="text-slate-900 truncate" title={row.url}>
                  {row.url}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void handleCopy(row.url, row.id)}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 hover:text-slate-900 shrink-0 cursor-pointer"
              >
                {copiedId === row.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Standalone api.php Output */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-900">2. Complete api.php (Single-File Multi-Platform Backend)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy(generated.phpCode, 'php-code')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {copiedId === 'php-code' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              Copy api.php
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownloadFile(
                  generated.phpCode,
                  'api.php',
                  'application/x-php;charset=utf-8'
                )
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              Download api.php
            </button>
          </div>
        </div>
        <pre className="p-3.5 bg-[#0F172A] text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-80">
          {generated.phpCode}
        </pre>
      </div>

      {/* Rule 5 & 6: Self-Healing Auto-Detecting Frontend (index.html) */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-900">
              3. Complete index.html (Self-Healing Auto-Detecting Frontend Viewer)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy(autoDetectHtml, 'auto-html')}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {copiedId === 'auto-html' ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy index.html
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownloadFile(autoDetectHtml, 'index.html', 'text/html;charset=utf-8')
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              Download index.html
            </button>
          </div>
        </div>
        <pre className="p-3.5 bg-[#0F172A] text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-72">
          {autoDetectHtml}
        </pre>
      </div>

      {/* Lightweight JavaScript fetch() Snippet */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <span className="font-semibold text-slate-900">JavaScript fetch() Integration Snippet</span>
          <button
            type="button"
            onClick={() => void handleCopy(generated.jsSnippet, 'js-snippet')}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {copiedId === 'js-snippet' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            Copy JS
          </button>
        </div>
        <pre className="p-3.5 bg-[#0F172A] text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto">
          {generated.jsSnippet}
        </pre>
      </div>
    </div>
  );
}
