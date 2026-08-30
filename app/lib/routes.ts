const USER_AGENT = 'adsb-warsaw-mvp/0.1 (personal; +https://datamano.com)';

export interface FlightRoute {
  destIcao?: string;
  destIata?: string;
  destName?: string;
  destLat?: number;
  destLon?: number;
  originIata?: string;
  originIcao?: string;
  originName?: string;
}

interface CacheEntry {
  route: FlightRoute | null;
  expiresAt: number;
}

const FOUND_TTL_MS = 6 * 60 * 60 * 1000;
const MISS_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inflight = new Set<string>();

export function normalizeCallsign(callsign: string): string {
  return callsign.replace(/\s+/g, '').toUpperCase();
}

export function isFlightCallsign(callsign?: string, reg?: string): boolean {
  if (!callsign) return false;
  const cs = normalizeCallsign(callsign);
  if (cs.length < 4 || !/\d/.test(cs)) return false;
  if (reg && cs === reg.replace(/[-\s]/g, '').toUpperCase()) return false;
  return true;
}

export function getCachedRoute(callsign: string): FlightRoute | null | undefined {
  const key = normalizeCallsign(callsign);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.route;
}

function setCache(callsign: string, route: FlightRoute | null) {
  cache.set(normalizeCallsign(callsign), {
    route,
    expiresAt: Date.now() + (route ? FOUND_TTL_MS : MISS_TTL_MS),
  });
}

interface AdsbdbAirport {
  icao_code?: string;
  iata_code?: string;
  name?: string;
  municipality?: string;
  latitude?: number;
  longitude?: number;
}

interface AdsbdbResponse {
  response?: {
    flightroute?: {
      origin?: AdsbdbAirport;
      destination?: AdsbdbAirport;
    };
  };
}

async function lookupCallsign(callsign: string): Promise<FlightRoute | null> {
  const key = normalizeCallsign(callsign);
  try {
    const res = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(key)}`, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AdsbdbResponse;
    const dest = data.response?.flightroute?.destination;
    const origin = data.response?.flightroute?.origin;
    const destCoordsOk =
      typeof dest?.latitude === 'number' &&
      typeof dest?.longitude === 'number' &&
      Number.isFinite(dest.latitude) &&
      Number.isFinite(dest.longitude);
    const originName = origin?.municipality || origin?.name;
    const hasOrigin = Boolean(origin?.iata_code || origin?.icao_code || originName);
    if (!destCoordsOk && !hasOrigin) {
      return null;
    }
    return {
      destIcao: dest?.icao_code,
      destIata: dest?.iata_code,
      destName: dest?.municipality || dest?.name,
      destLat: destCoordsOk ? dest.latitude : undefined,
      destLon: destCoordsOk ? dest.longitude : undefined,
      originIata: origin?.iata_code,
      originIcao: origin?.icao_code,
      originName,
    };
  } catch (err) {
    console.error('Route lookup failed:', key, err);
    return null;
  }
}

export async function waitForLookups(ms: number) {
  const start = Date.now();
  while (inflight.size > 0 && Date.now() - start < ms) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function scheduleRouteLookups(callsigns: string[]) {
  const unique = [...new Set(callsigns.map(normalizeCallsign))].filter((cs) => {
    if (inflight.has(cs)) return false;
    if (getCachedRoute(cs) !== undefined) return false;
    return true;
  });

  unique.slice(0, 12).forEach((cs) => {
    inflight.add(cs);
    lookupCallsign(cs)
      .then((route) => setCache(cs, route))
      .finally(() => inflight.delete(cs));
  });
}

export function attachCachedRoutes<T extends { callsign?: string; destLat?: number; destLon?: number }>(
  aircraft: T[]
): T[] {
  return aircraft.map((ac) => {
    if (!ac.callsign) return ac;
    const route = getCachedRoute(ac.callsign);
    if (!route) return ac;
    return {
      ...ac,
      destIcao: route.destIcao,
      destIata: route.destIata,
      destName: route.destName,
      destLat: route.destLat,
      destLon: route.destLon,
      originIata: route.originIata,
      originIcao: route.originIcao,
      originName: route.originName,
    };
  });
}
