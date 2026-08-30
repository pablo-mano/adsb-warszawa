import { publishedIataCallsign, isRoutePlausible, type RoutePosition } from './routePlausibility';

const USER_AGENT = 'adsb-warsaw-mvp/0.1 (personal; +https://datamano.com)';

export interface FlightRoute {
  destIcao?: string;
  destIata?: string;
  destName?: string;
  destLat: number;
  destLon: number;
  originIata?: string;
  originIcao?: string;
  originLat?: number;
  originLon?: number;
}

export interface RouteLookupTarget extends RoutePosition {
  callsign: string;
}

interface CacheEntry {
  route: FlightRoute | null;
  expiresAt: number;
}

const FOUND_TTL_MS = 6 * 60 * 60 * 1000;
/** Implausible or unresolved dest — retry soon; never treat as a 6h hit. */
const REJECTED_TTL_MS = 5 * 60 * 1000;
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

export function getCachedRoute(
  callsign: string,
  pos?: RoutePosition
): FlightRoute | null | undefined {
  const key = normalizeCallsign(callsign);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  if (entry.route && pos && !isRoutePlausible(entry.route, pos)) {
    cache.delete(key);
    return undefined;
  }
  return entry.route;
}

function setCache(callsign: string, route: FlightRoute | null) {
  const ttl = route ? FOUND_TTL_MS : REJECTED_TTL_MS;
  cache.set(normalizeCallsign(callsign), {
    route,
    expiresAt: Date.now() + ttl,
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
      callsign_iata?: string;
      airline?: { iata?: string };
      origin?: AdsbdbAirport;
      destination?: AdsbdbAirport;
    };
  };
}

interface AdsbdbLookup {
  route: FlightRoute;
  airlineIata?: string;
}

function airportRoute(dest: AdsbdbAirport, origin?: AdsbdbAirport): FlightRoute | null {
  if (
    typeof dest.latitude !== 'number' ||
    typeof dest.longitude !== 'number' ||
    !Number.isFinite(dest.latitude) ||
    !Number.isFinite(dest.longitude)
  ) {
    return null;
  }
  return {
    destIcao: dest.icao_code,
    destIata: dest.iata_code,
    destName: dest.municipality || dest.name,
    destLat: dest.latitude,
    destLon: dest.longitude,
    originIata: origin?.iata_code,
    originIcao: origin?.icao_code,
    originLat: typeof origin?.latitude === 'number' ? origin.latitude : undefined,
    originLon: typeof origin?.longitude === 'number' ? origin.longitude : undefined,
  };
}

async function lookupCallsign(callsign: string): Promise<AdsbdbLookup | null> {
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
    if (!dest) return null;
    const route = airportRoute(dest, origin);
    if (!route) return null;
    return {
      route,
      airlineIata: data.response?.flightroute?.airline?.iata,
    };
  } catch (err) {
    console.error('Route lookup failed:', key, err);
    return null;
  }
}

interface RoutesetAirport {
  icao?: string;
  iata?: string;
  name?: string;
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
}

interface RoutesetRow {
  airport_codes?: string;
  _airport_codes_iata?: string;
  airports?: RoutesetAirport[];
}

async function lookupRouteset(target: RouteLookupTarget): Promise<FlightRoute | null> {
  try {
    const res = await fetch('https://api.adsb.lol/api/0/routeset', {
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planes: [
          {
            callsign: normalizeCallsign(target.callsign),
            lat: target.lat,
            lng: target.lon,
          },
        ],
      }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    const rows = Array.isArray(data) ? (data as RoutesetRow[]) : [];
    const row = rows[0];
    const airports = row?.airports;
    if (!airports || airports.length === 0) return null;
    const dest = airports[airports.length - 1];
    const origin = airports.length > 1 ? airports[0] : undefined;
    const destLat = dest.lat ?? dest.latitude;
    const destLon = dest.lon ?? dest.longitude;
    if (typeof destLat !== 'number' || typeof destLon !== 'number') return null;
    return {
      destIcao: dest.icao,
      destIata: dest.iata,
      destName: dest.name,
      destLat,
      destLon,
      originIata: origin?.iata,
      originIcao: origin?.icao,
      originLat: origin?.lat ?? origin?.latitude,
      originLon: origin?.lon ?? origin?.longitude,
    };
  } catch (err) {
    console.error('Routeset lookup failed:', normalizeCallsign(target.callsign), err);
    return null;
  }
}

function pickPlausible(route: FlightRoute | null | undefined, pos: RoutePosition): FlightRoute | null {
  if (!route) return null;
  return isRoutePlausible(route, pos) ? route : null;
}

/**
 * Resolve dest from adsbdb (ICAO, then published IATA form) and optional
 * position-aware routeset. Returns null when nothing is geographically plausible.
 */
export async function resolveRoute(target: RouteLookupTarget): Promise<FlightRoute | null> {
  const icao = await lookupCallsign(target.callsign);
  const fromIcao = pickPlausible(icao?.route, target);
  if (fromIcao) return fromIcao;

  const iataCs = publishedIataCallsign(target.callsign, icao?.airlineIata);
  if (iataCs) {
    const iata = await lookupCallsign(iataCs);
    const fromIata = pickPlausible(iata?.route, target);
    if (fromIata) return fromIata;
  }

  const fromRouteset = pickPlausible(await lookupRouteset(target), target);
  if (fromRouteset) return fromRouteset;

  return null;
}

export async function waitForLookups(ms: number) {
  const start = Date.now();
  while (inflight.size > 0 && Date.now() - start < ms) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function scheduleRouteLookups(targets: RouteLookupTarget[]) {
  const pending: RouteLookupTarget[] = [];
  const seen = new Set<string>();

  for (const raw of targets) {
    const target: RouteLookupTarget | null =
      raw.callsign && Number.isFinite(raw.lat) && Number.isFinite(raw.lon)
        ? { ...raw, callsign: normalizeCallsign(raw.callsign) }
        : null;
    if (!target) continue;
    if (seen.has(target.callsign)) continue;
    seen.add(target.callsign);
    if (inflight.has(target.callsign)) continue;
    if (getCachedRoute(target.callsign, target) !== undefined) continue;
    pending.push(target);
  }

  pending.slice(0, 12).forEach((target) => {
    inflight.add(target.callsign);
    resolveRoute(target)
      .then((route) => setCache(target.callsign, route))
      .finally(() => inflight.delete(target.callsign));
  });
}

export function attachCachedRoutes<
  T extends { callsign?: string; lat: number; lon: number; track?: number; destLat?: number; destLon?: number },
>(aircraft: T[]): T[] {
  return aircraft.map((ac) => {
    if (!ac.callsign) return ac;
    const route = getCachedRoute(ac.callsign, ac);
    if (!route) return ac;
    return {
      ...ac,
      destIcao: route.destIcao,
      destIata: route.destIata,
      destName: route.destName,
      destLat: route.destLat,
      destLon: route.destLon,
      originIata: route.originIata,
    };
  });
}

/** Test helper: seed or clear the in-memory route cache. */
export function _resetRouteCacheForTests() {
  cache.clear();
  inflight.clear();
}

export function _seedRouteCacheForTests(callsign: string, route: FlightRoute | null) {
  setCache(callsign, route);
}
