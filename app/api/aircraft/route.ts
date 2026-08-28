import { NextResponse } from 'next/server';

export const revalidate = 2;

interface RawAircraft {
  hex?: string;
  r?: string;
  t?: string;
  flight?: string;
  alt_baro?: number | string;
  alt_geom?: number;
  gs?: number;
  track?: number;
  lat?: number;
  lon?: number;
  seen?: number;
  type?: string;
  squawk?: string;
  timestamp?: number;
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

function normalizeAircraft(raw: RawAircraft): NormalizedAircraft | null {
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

  return {
    hex: raw.hex,
    callsign: raw.flight?.trim(),
    lat: raw.lat,
    lon: raw.lon,
    alt,
    altGeom: raw.alt_geom,
    track: raw.track,
    gs: raw.gs,
    ts: raw.timestamp,
    onGround,
    squawk: raw.squawk,
    reg: raw.r,
    typeCode: raw.t,
    src: raw.type,
    seen: raw.seen,
  };
}

export async function GET() {
  let lastError: Error | null = null;

  for (const endpoint of ENDPOINTS) {
    try {
      const response = await fetchWithRateLimit(endpoint);

      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      const data = await response.json();
      const aircraft: RawAircraft[] = data.ac || data.aircraft || [];

      const normalized = aircraft
        .map(normalizeAircraft)
        .filter((a): a is NormalizedAircraft => a !== null);

      return NextResponse.json(
        { aircraft: normalized, count: normalized.length },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=3',
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
    { status: 503 }
  );
}
