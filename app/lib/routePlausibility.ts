import { haversineKm, headingDeltaDeg, initialBearingDeg } from './geo';

export interface RouteEndpoints {
  destLat: number;
  destLon: number;
  destIcao?: string;
  destIata?: string;
  originLat?: number;
  originLon?: number;
}

export interface RoutePosition {
  lat: number;
  lon: number;
  track?: number;
}

/** Generous window: SIDs/STARs and airways can diverge from the great-circle. */
export const HEADING_WINDOW_DEG = 75;
/** Skip heading check when already near dest (or still near origin). */
export const NEAR_AIRPORT_KM = 80;
/** Extra path length allowed vs origin→dest great-circle. */
export const MAX_DETOUR_KM = 400;
export const MAX_DETOUR_FRACTION = 0.35;

const ICAO_TO_IATA: Record<string, string> = {
  RYR: 'FR',
  RYS: 'RR',
  EZY: 'U2',
  EJU: 'EC',
  EZS: 'DS',
  WZZ: 'W6',
  WMT: 'W4',
  LOT: 'LO',
  BTI: 'BT',
  AUA: 'OS',
  DLH: 'LH',
  SWR: 'LX',
  BAW: 'BA',
  KLM: 'KL',
  AFR: 'AF',
  SAS: 'SK',
  FIN: 'AY',
  NAX: 'DY',
  IBS: 'I2',
  VLG: 'VY',
  TAP: 'TP',
  AZA: 'AZ',
  AEE: 'A3',
  THY: 'TK',
  PGT: 'PC',
  EWG: 'EW',
  EIN: 'EI',
  CSN: 'CZ',
  UAE: 'EK',
  QTR: 'QR',
  AAL: 'AA',
  UAL: 'UA',
  DAL: 'DL',
};

/**
 * IATA form of an ICAO callsign, only when the suffix looks like a published
 * flight number (2–4 digits). Tactical/ops callsigns like RYR35DU are skipped.
 */
export function publishedIataCallsign(callsign: string, airlineIata?: string): string | null {
  const cs = callsign.replace(/\s+/g, '').toUpperCase();
  const match = cs.match(/^([A-Z]{3})(\d{2,4})$/);
  if (!match) return null;
  const iata = (airlineIata || ICAO_TO_IATA[match[1]] || '').replace(/\s+/g, '').toUpperCase();
  if (iata.length < 2 || iata.length > 3) return null;
  const derived = `${iata}${match[2]}`;
  return derived === cs ? null : derived;
}

export function isRoutePlausible(route: RouteEndpoints, pos: RoutePosition): boolean {
  if (
    !Number.isFinite(pos.lat) ||
    !Number.isFinite(pos.lon) ||
    !Number.isFinite(route.destLat) ||
    !Number.isFinite(route.destLon)
  ) {
    return false;
  }

  const distToDest = haversineKm(pos.lat, pos.lon, route.destLat, route.destLon);
  if (!Number.isFinite(distToDest)) return false;

  const nearDest = distToDest <= NEAR_AIRPORT_KM;
  const hasOrigin =
    route.originLat != null &&
    route.originLon != null &&
    Number.isFinite(route.originLat) &&
    Number.isFinite(route.originLon);
  const distToOrigin = hasOrigin
    ? haversineKm(pos.lat, pos.lon, route.originLat!, route.originLon!)
    : undefined;
  const nearOrigin = distToOrigin != null && distToOrigin <= NEAR_AIRPORT_KM;

  if (hasOrigin) {
    const originToDest = haversineKm(
      route.originLat!,
      route.originLon!,
      route.destLat,
      route.destLon
    );
    if (Number.isFinite(originToDest) && distToOrigin != null) {
      const detour = distToOrigin + distToDest - originToDest;
      const allowed = Math.max(MAX_DETOUR_KM, originToDest * MAX_DETOUR_FRACTION);
      if (detour > allowed && !nearDest && !nearOrigin) {
        return false;
      }
    }
  }

  const track = pos.track;
  if (
    !nearDest &&
    !nearOrigin &&
    track != null &&
    Number.isFinite(track) &&
    distToDest > NEAR_AIRPORT_KM
  ) {
    const bearing = initialBearingDeg(pos.lat, pos.lon, route.destLat, route.destLon);
    if (headingDeltaDeg(track, bearing) > HEADING_WINDOW_DEG) {
      return false;
    }
  }

  return true;
}
