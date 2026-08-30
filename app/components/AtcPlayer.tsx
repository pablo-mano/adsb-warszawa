'use client';

import { useCallback, useEffect, useState } from 'react';
import { EPWA_ATC, EPWA_ATC_MSG_SOURCE } from '../lib/epwa';

export type AtcStatus = 'idle' | 'loading' | 'playing' | 'error';

export function useEpwaAtc() {
  const [status, setStatus] = useState<AtcStatus>('idle');
  const [frameKey, setFrameKey] = useState(0);
  const [frameOn, setFrameOn] = useState(false);

  const stop = useCallback(() => {
    setFrameOn(false);
    setStatus('idle');
  }, []);

  const play = useCallback(() => {
    setStatus('loading');
    setFrameKey((k) => k + 1);
    setFrameOn(true);
  }, []);

  const toggle = useCallback(() => {
    if (status === 'playing' || status === 'loading') {
      stop();
    } else {
      play();
    }
  }, [play, status, stop]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.source !== EPWA_ATC_MSG_SOURCE) return;
      if (data.type === 'playing') setStatus('playing');
      if (data.type === 'error') {
        setFrameOn(false);
        setStatus('error');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const frame = frameOn ? (
    <iframe
      key={frameKey}
      src="/atc/epwa"
      title="EPWA ATC"
      allow="autoplay"
      referrerPolicy="no-referrer"
      className="pointer-events-none absolute h-px w-px overflow-hidden opacity-0"
      aria-hidden
    />
  ) : null;

  return { status, play, stop, toggle, frame };
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
