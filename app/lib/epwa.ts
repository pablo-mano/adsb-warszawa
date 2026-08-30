export const EPWA = {
  icao: 'EPWA',
  iata: 'WAW',
  name: 'Lotnisko Chopina',
  city: 'Warszawa',
  lat: 52.1657,
  lon: 20.9671,
} as const;

export const EPWA_ATC = {
  feedName: 'EPWA Tower',
  frequency: '118.300 MHz',
  mount: 'epwa_twr2',
  playlistUrl: 'https://www.liveatc.net/play/epwa_twr2.pls',
  listenPageUrl: 'https://www.liveatc.net/search/?icao=epwa',
  // LiveATC .pls (epwa_twr2) resolves to these Icecast mounts.
  // LiveATC Icecast 403s <audio src> when Referer is the Vercel origin.
  // The player uses same-origin /api/atc/epwa (service worker fetch, Edge fallback).
  streamUrls: [
    'https://s1-fmt2.liveatc.net/epwa_twr2',
    'https://s1-bos.liveatc.net/epwa_twr2',
  ],
} as const;

export function isEpwaAirport(icao?: string, iata?: string): boolean {
  return icao?.toUpperCase() === EPWA.icao || iata?.toUpperCase() === EPWA.iata;
}
