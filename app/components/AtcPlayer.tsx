'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EPWA_ATC } from '../lib/epwa';

export type AtcStatus = 'idle' | 'loading' | 'playing' | 'error';

const PROXY_PATH = '/api/atc/epwa';

let workerReady: Promise<void> | null = null;

function ensureAtcServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve();
  }
  if (!workerReady) {
    workerReady = (async () => {
      await navigator.serviceWorker.register('/atc-sw.js');
      await navigator.serviceWorker.ready;
      if (navigator.serviceWorker.controller) return;
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(() => resolve(), 4000);
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            window.clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
      });
    })().catch((err) => {
      workerReady = null;
      console.warn('ATC service worker unavailable', err);
    });
  }
  return workerReady;
}

export function useEpwaAtc() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wantedRef = useRef(false);
  const [status, setStatus] = useState<AtcStatus>('idle');

  const stop = useCallback(() => {
    wantedRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setStatus('idle');
  }, []);

  const play = useCallback(async () => {
    wantedRef.current = true;
    setStatus('loading');
    await ensureAtcServiceWorker();
    const audio = audioRef.current;
    if (!audio || !wantedRef.current) return;
    audio.src = `${PROXY_PATH}?t=${Date.now()}`;
    try {
      await audio.play();
    } catch {
      if (wantedRef.current) setStatus('error');
    }
  }, []);

  const toggle = useCallback(() => {
    if (status === 'playing' || status === 'loading') {
      stop();
    } else {
      void play();
    }
  }, [play, status, stop]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;

    const onPlaying = () => {
      if (wantedRef.current) setStatus('playing');
    };
    const onWaiting = () => {
      if (wantedRef.current && audio.src) {
        setStatus((prev) => (prev === 'playing' ? prev : 'loading'));
      }
    };
    const onError = () => {
      if (wantedRef.current) setStatus('error');
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('error', onError);
    void ensureAtcServiceWorker();

    return () => {
      wantedRef.current = false;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('error', onError);
    };
  }, []);

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
