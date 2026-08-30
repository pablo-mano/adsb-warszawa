'use client';

import { useEffect } from 'react';
import { EPWA_ATC, EPWA_ATC_MSG_SOURCE } from '../../lib/epwa';

function setMediaReferrerPolicy(audio: HTMLAudioElement) {
  audio.setAttribute('referrerpolicy', 'no-referrer');
  audio.removeAttribute('crossorigin');
  (audio as HTMLAudioElement & { referrerPolicy: string }).referrerPolicy = 'no-referrer';
}

export default function EpwaAtcFrame() {
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    setMediaReferrerPolicy(audio);
    let index = 0;
    let stopped = false;

    const notify = (type: 'playing' | 'error') => {
      window.parent.postMessage({ source: EPWA_ATC_MSG_SOURCE, type }, window.location.origin);
    };

    const playFrom = (i: number) => {
      if (stopped) return;
      if (i >= EPWA_ATC.streamUrls.length) {
        notify('error');
        return;
      }
      index = i;
      setMediaReferrerPolicy(audio);
      audio.src = EPWA_ATC.streamUrls[i];
      void audio.play().catch(() => {
        if (!stopped) playFrom(i + 1);
      });
    };

    const failTimer = window.setTimeout(() => {
      if (!stopped) notify('error');
    }, 15000);

    const onPlaying = () => {
      if (!stopped) {
        window.clearTimeout(failTimer);
        notify('playing');
      }
    };
    const onError = () => {
      if (!stopped) playFrom(index + 1);
    };

    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('error', onError);
    playFrom(0);

    return () => {
      stopped = true;
      window.clearTimeout(failTimer);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
