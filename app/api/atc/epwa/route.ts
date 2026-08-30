import { EPWA_ATC } from '@/app/lib/epwa';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  for (const url of EPWA_ATC.streamUrls) {
    try {
      const upstream = await fetch(url, {
        cache: 'no-store',
        headers: {
          Accept: 'audio/mpeg, audio/*, */*',
          'User-Agent': 'adsb-warsaw-atc/0.1',
        },
      });
      const contentType = upstream.headers.get('content-type') || '';
      if (!upstream.ok || !upstream.body || !contentType.includes('audio')) {
        continue;
      }
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      continue;
    }
  }
  return new Response('ATC stream unavailable', { status: 502 });
}
