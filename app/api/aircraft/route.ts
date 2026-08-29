import { NextResponse } from 'next/server';
import { upsertPositions, purgeOldPositions, type PositionRow } from '@/app/lib/db';

export const dynamic = 'force-dynamic';

interface RawAircraft {
  hex?: string;
  r?: string;
  t?: string;
  flight?: string;
  alt_baro?: number | string;
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  lat?: number;
  lon?: number;
  seen?: number;
  seen_pos?: number;
  type?: string;
  squawk?: string;
  dst?: number;
}

interface NormalizedAircraft {
  hex: string;
  callsign?: string;
  lat: number;
  lon: number;
  alt?: number;
  altGeom?: number;
  track?: number;
  gs?: number;
  ts?: number;
  onGround: boolean;
  squawk?: string;
  reg?: string;
  typeCode?: string;
  src?: string;
  seen?: number;
  dstNm?: number;
}

const ENDPOINTS = [
  'https://opendata.adsb.fi/api/v3/lat/52.1657/lon/20.9671/dist/80',
  'https://api.adsb.lol/v2/lat/52.1657/lon/20.9671/dist/80'
];

const USER_AGENT = 'adsb-warsaw-mvp/0.1 (personal; +https://datamano.com)';

let lastRequestTime = 0;

async function fetchWithRateLimit(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
    },
    next: { revalidate: 2 }
  });
}

function normalizeAircraft(raw: RawAircraft, nowSeconds: number): NormalizedAircraft | null {
  if (!raw.hex || typeof raw.lat !== 'number' || typeof raw.lon !== 'number') {
    return null;
  }

  if (raw.type === 'adsb_icao_nt') {
    return null;
  }

  let alt: number | undefined = undefined;
  let onGround = false;

  if (raw.alt_baro === 'ground') {
    onGround = true;
  } else if (typeof raw.alt_baro === 'number') {
    alt = raw.alt_baro;
  }

  const ts = typeof raw.seen_pos === 'number' ? Math.floor(nowSeconds - raw.seen_pos) : undefined;
  const track = raw.track !== undefined ? raw.track : raw.true_heading;

  return {
    hex: raw.hex,
    callsign: raw.flight?.trim(),
    lat: raw.lat,
    lon: raw.lon,
    alt,
    altGeom: raw.alt_geom,
    track,
    gs: raw.gs,
    ts,
    onGround,
    squawk: raw.squawk,
    reg: raw.r,
    typeCode: raw.t,
    src: raw.type,
    seen: raw.seen,
    dstNm: raw.dst,
  };
}

export async function GET() {
  let lastError: Error | null = null;

  for (let i = 0; i < ENDPOINTS.length; i++) {
    const endpoint = ENDPOINTS[i];
    try {
      const response = await fetchWithRateLimit(endpoint);

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const aircraft: RawAircraft[] = data.ac || data.aircraft || [];
      
      const nowRaw: number = data.now || Date.now();
      const nowSeconds = nowRaw >= 1e12 ? Math.floor(nowRaw / 1000) : Math.floor(nowRaw);
      const source = endpoint.includes('adsb.fi') ? 'adsb.fi' : 'adsb.lol';

      const normalized = aircraft
        .map(ac => normalizeAircraft(ac, nowSeconds))
        .filter((a): a is NormalizedAircraft => a !== null);

      // Upsert positions to DB (non-blocking, no failure propagation)
      const positionsToStore: PositionRow[] = normalized
        .filter(ac => ac.hex && ac.lat != null && ac.lon != null && ac.ts != null)
        .map(ac => ({
          hex: ac.hex,
          ts: ac.ts!,
          lat: ac.lat,
          lon: ac.lon,
          alt: ac.alt,
          track: ac.track,
          gs: ac.gs,
          callsign: ac.callsign,
        }));
      
      if (positionsToStore.length > 0) {
        upsertPositions(positionsToStore).catch(err => 
          console.error('Background DB write failed:', err)
        );
        purgeOldPositions().catch(err => 
          console.error('Background DB purge failed:', err)
        );
      }

      return NextResponse.json(
        { 
          aircraft: normalized, 
          count: normalized.length,
          source,
          now: nowSeconds
        },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=2',
          },
        }
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      continue;
    }
  }

  return NextResponse.json(
    { error: 'All endpoints failed', details: lastError?.message },
    { 
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
