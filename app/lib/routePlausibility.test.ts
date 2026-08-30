import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRoutePlausible, publishedIataCallsign } from './routePlausibility';

const AGP_KUN_POS = { lat: 54.19, lon: 22.82, track: 32 };

const SOF = {
  destIcao: 'LBSF',
  destIata: 'SOF',
  destLat: 42.69669342041016,
  destLon: 23.411436080932617,
  originIcao: 'LIME',
  originIata: 'BGY',
  originLat: 45.673901,
  originLon: 9.70417,
};

const KUN = {
  destIcao: 'EYKA',
  destIata: 'KUN',
  destLat: 54.96390151977539,
  destLon: 24.084800720214844,
  originIcao: 'LEMG',
  originIata: 'AGP',
  originLat: 36.6749,
  originLon: -4.49911,
};

test('rejects SOF for NE Poland heading ~32° (FR5503 / RYR35DU case)', () => {
  assert.equal(isRoutePlausible(SOF, AGP_KUN_POS), false);
});

test('accepts KUN for NE Poland heading ~32°', () => {
  assert.equal(isRoutePlausible(KUN, AGP_KUN_POS), true);
});

test('accepts dest when already near the airport even if heading is off', () => {
  assert.equal(
    isRoutePlausible(SOF, { lat: 42.75, lon: 23.40, track: 32 }),
    true
  );
});

test('published IATA form only for numeric flight numbers', () => {
  assert.equal(publishedIataCallsign('RYR5503'), 'FR5503');
  assert.equal(publishedIataCallsign('RYR35DU'), null);
  assert.equal(publishedIataCallsign('FR5503'), null);
  assert.equal(publishedIataCallsign('LOT4CN'), null);
  assert.equal(publishedIataCallsign('WZZ6174'), 'W66174');
});
