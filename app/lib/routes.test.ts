import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  attachCachedRoutes,
  getCachedRoute,
  _resetRouteCacheForTests,
  _seedRouteCacheForTests,
  type FlightRoute,
} from './routes';

const POS = { lat: 54.19, lon: 22.82, track: 32 };

const SOF: FlightRoute = {
  destIcao: 'LBSF',
  destIata: 'SOF',
  destName: 'Sofia',
  destLat: 42.69669342041016,
  destLon: 23.411436080932617,
  originIata: 'BGY',
  originIcao: 'LIME',
  originLat: 45.673901,
  originLon: 9.70417,
};

const KUN: FlightRoute = {
  destIcao: 'EYKA',
  destIata: 'KUN',
  destName: 'Kaunas',
  destLat: 54.96390151977539,
  destLon: 24.084800720214844,
  originIata: 'AGP',
  originIcao: 'LEMG',
  originLat: 36.6749,
  originLon: -4.49911,
};

test('cached SOF is not served for the AGP–KUN position (no 6h wrong dest)', () => {
  _resetRouteCacheForTests();
  _seedRouteCacheForTests('RYR35DU', SOF);
  assert.equal(getCachedRoute('RYR35DU', POS), undefined);
});

test('cached KUN is served for the AGP–KUN position', () => {
  _resetRouteCacheForTests();
  _seedRouteCacheForTests('RYR35DU', KUN);
  const route = getCachedRoute('RYR35DU', POS);
  assert.ok(route);
  assert.equal(route.destIata, 'KUN');
});

test('attachCachedRoutes never attaches SOF for this position', () => {
  _resetRouteCacheForTests();
  _seedRouteCacheForTests('RYR35DU', SOF);
  const [ac] = attachCachedRoutes([
    { callsign: 'RYR35DU', lat: POS.lat, lon: POS.lon, track: POS.track },
  ]);
  assert.equal(ac.destIata, undefined);
  assert.equal(ac.destLat, undefined);
});

test('rejected miss is not treated as a found route', () => {
  _resetRouteCacheForTests();
  _seedRouteCacheForTests('RYR35DU', null);
  assert.equal(getCachedRoute('RYR35DU', POS), null);
});
