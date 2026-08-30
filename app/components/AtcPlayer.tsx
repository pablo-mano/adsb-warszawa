'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EPWA_ATC } from '../lib/epwa';

export type AtcStatus = 'idle' | 'loading' | 'playing' | 'error';

function attachNoReferrer(audio: HTMLAudioElement) {
  // LiveATC Icecast returns 403 when Referer is the Vercel production origin.
  // Media requests must omit Referer; CORS mode is unnecessary for playback.
  audio.setAttribute('referrerpolicy', 'no-referrer');
  audio.removeAttribute('crossorigin');
}

export function useEpwaAtc() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const indexRef = useRef(0);
  const wantedRef = useRef(false);
  const failoverLockRef = useRef(false);
  const [status, setStatus] = useState<AtcStatus>('idle');

  const stop = useCallback(() => {
    wantedRef.current = false;
    failoverLockRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setStatus('idle');
  }, []);

  const playFrom = useCallback((index: number) => {
    const audio = audioRef.current;
    if (!audio || !wantedRef.current) return;
    if (index >= EPWA_ATC.streamUrls.length) {
      setStatus('error');
      return;
    }
    failoverLockRef.current = false;
    indexRef.current = index;
    setStatus('loading');
    attachNoReferrer(audio);
    audio.src = EPWA_ATC.streamUrls[index];
    void audio.play().catch(() => {
      if (!wantedRef.current) return;
      if (failoverLockRef.current) return;
      if (indexRef.current !== index) return;
      failoverLockRef.current = true;
      playFrom(index + 1);
    });
  }, []);

  const play = useCallback(() => {
    wantedRef.current = true;
    playFrom(0);
  }, [playFrom]);

  const toggle = useCallback(() => {
    if (status === 'playing' || status === 'loading') {
      stop();
    } else {
      play();
    }
  }, [play, status, stop]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.hidden = true;
    attachNoReferrer(audio);
    audio.setAttribute('playsinline', '');
    document.body.appendChild(audio);
    audioRef.current = audio;

    const onPlaying = () => {
      if (wantedRef.current) setStatus('playing');
    };
    const onWaiting = () => {
      if (!wantedRef.current || !audio.src) return;
      setStatus((prev) => (prev === 'playing' ? prev : 'loading'));
    };
    const onError = () => {
      if (!wantedRef.current) return;
      if (failoverLockRef.current) return;
      failoverLockRef.current = true;
      playFrom(indexRef.current + 1);
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);

    return () => {
      wantedRef.current = false;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error', onError);
      audio.remove();
    };
  }, [playFrom]);

  return { status, play, stop, toggle };
}

export default function AtcPlayer({
  status,
  onToggle,
}: {
  status: AtcStatus;
  onToggle: () => void;
}) {
  const isLive = status === 'playing';
  const isBusy = status === 'loading' || status === 'playing';

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          ATC live
        </span>
        {isLive && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            na żywo
          </span>
        )}
      </div>
      <div className="font-medium text-gray-900">{EPWA_ATC.feedName}</div>
      <div className="text-sm text-zinc-600 mb-3">{EPWA_ATC.frequency}</div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full h-11 rounded-md text-sm font-medium transition-colors ${
          isBusy
            ? 'bg-zinc-900 text-white hover:bg-zinc-800'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        aria-label={isBusy ? 'Zatrzymaj ATC' : 'Odtwórz ATC EPWA Tower'}
      >
        {status === 'loading' ? 'Łączenie…' : isLive ? 'Zatrzymaj' : 'Odtwórz ATC'}
      </button>
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-600">
          Nie udało się połączyć ze strumieniem. Spróbuj ponownie.
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        Źródło:{' '}
        <a
          href={EPWA_ATC.listenPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-900 hover:underline font-medium"
        >
          LiveATC.net
        </a>
        {' · '}
        <a
          href={EPWA_ATC.playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-900 hover:underline font-medium"
        >
          playlista
        </a>
      </p>
    </div>
  );
}
