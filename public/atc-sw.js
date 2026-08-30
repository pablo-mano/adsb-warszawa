/* Same-origin ATC proxy. LiveATC Icecast 403s when <audio> sends a Vercel Referer;
   fetch() from this origin does not, so the player uses /api/atc/epwa. */
const UPSTREAMS = [
  'https://s1-fmt2.liveatc.net/epwa_twr2',
  'https://s1-bos.liveatc.net/epwa_twr2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname !== '/api/atc/epwa') return;

  event.respondWith(proxyAtc());
});

async function proxyAtc() {
  for (const upstream of UPSTREAMS) {
    try {
      const res = await fetch(upstream, {
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'audio/mpeg, audio/*, */*' },
      });
      const type = res.headers.get('content-type') || '';
      if (res.ok && res.body && type.includes('audio')) {
        return res;
      }
    } catch (err) {
      // try next host
    }
  }
  return new Response('ATC stream unavailable', { status: 502 });
}
