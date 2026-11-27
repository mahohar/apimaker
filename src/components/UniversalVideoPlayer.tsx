import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { ExtractedVideo } from '../types/api';

interface UniversalVideoPlayerProps {
  video: ExtractedVideo;
}

function extractYouTubeId(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const match = rawUrl.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,15})/i
  );
  return match ? match[1] : null;
}

function detectEffectiveType(video: ExtractedVideo): 'youtube-embed' | 'hls' | 'html5' | 'iframe' {
  if (video.playableType) return video.playableType;
  const url = (video.videoUrl || '').toLowerCase();
  if (extractYouTubeId(video.embedUrl || video.videoUrl)) return 'youtube-embed';
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls';
  if (/\.(mp4|webm|ogg|ogv|mov)(\?|$)/i.test(url)) return 'html5';
  if (video.embedUrl) return 'iframe';
  return 'html5';
}

export function UniversalVideoPlayer({ video }: UniversalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [useProxy, setUseProxy] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const effectiveType = detectEffectiveType(video);
  const ytId = extractYouTubeId(video.embedUrl || video.videoUrl);
  const proxyUrl =
    video.proxyStreamUrl || `/api/media-proxy?url=${encodeURIComponent(video.videoUrl)}`;
  const activeStreamUrl = useProxy ? proxyUrl : video.videoUrl;

  useEffect(() => {
    setUseProxy(false);
    setPlayerError(null);
  }, [video.videoUrl]);

  useEffect(() => {
    if (effectiveType !== 'hls') return;
    const el = videoRef.current;
    if (!el) return;

    setPlayerError(null);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hls.loadSource(activeStreamUrl);
      hls.attachMedia(el);

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        if (!useProxy && proxyUrl && activeStreamUrl !== proxyUrl) {
          hls.destroy();
          setUseProxy(true);
        } else {
          setPlayerError(
            'HLS stream could not play inline (upstream blocked or requires login). Try opening the stream link directly.'
          );
          hls.destroy();
        }
      });

      return () => {
        hls.destroy();
      };
    }

    if (el.canPlayType('application/vnd.apple.mpegurl')) {
      el.src = activeStreamUrl;
      return;
    }

    setPlayerError('HLS playback is not supported in this browser.');
  }, [activeStreamUrl, effectiveType, proxyUrl, useProxy]);

  if (effectiveType === 'youtube-embed' && ytId) {
    return (
      <div className="space-y-1.5">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-200">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?rel=0`}
            title={video.title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <p className="text-xs text-slate-500">
          Official YouTube embed player ·{' '}
          <a
            href={`https://www.youtube.com/watch?v=${ytId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline"
          >
            Watch on YouTube
          </a>
        </p>
      </div>
    );
  }

  if (effectiveType === 'iframe' && video.embedUrl) {
    return (
      <div className="space-y-1.5">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-slate-950 border border-slate-200">
          <iframe
            src={video.embedUrl}
            title={video.title}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        <p className="text-xs text-slate-500">
          Embedded player · If blocked by source frame policy,{' '}
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-700 hover:underline"
          >
            open original page
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg overflow-hidden bg-slate-950 border border-slate-200">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          src={effectiveType === 'hls' ? undefined : activeStreamUrl}
          onError={() => {
            if (!useProxy && proxyUrl && activeStreamUrl !== proxyUrl) {
              setUseProxy(true);
            } else {
              setPlayerError(
                'Video stream could not load inline. Open the direct stream URL in a new tab.'
              );
            }
          }}
          className="w-full max-h-64 bg-slate-950"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="font-mono">
          {effectiveType === 'hls' ? 'HLS (.m3u8)' : video.streamFormat || 'HTML5 Video'} ·{' '}
          {useProxy ? 'CORS Media Proxy' : 'Direct Stream'}
        </span>
        <div className="flex items-center gap-3">
          {!useProxy && (
            <button
              type="button"
              onClick={() => {
                setPlayerError(null);
                setUseProxy(true);
              }}
              className="inline-flex items-center gap-1 text-slate-700 hover:text-blue-700 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Switch to CORS Proxy
            </button>
          )}
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
          >
            Direct URL
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {playerError && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {playerError}
        </p>
      )}
    </div>
  );
}
