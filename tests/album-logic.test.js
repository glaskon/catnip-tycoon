const { test } = require('node:test');
const assert = require('node:assert/strict');
const { albumDayKey, isIanaTimeZone, advanceAlbum, noonEpochForDay } = require('../server/album-logic');

test('albumDayKey formats a timestamp as a calendar day in the given zone', () => {
  assert.equal(albumDayKey(Date.parse('2026-10-01T23:30:00Z'), 'Europe/Warsaw'), '2026-10-02');
  assert.equal(albumDayKey(Date.parse('2026-10-01T23:30:00Z'), 'UTC'), '2026-10-01');
});

test('isIanaTimeZone accepts only real zones', () => {
  assert.equal(isIanaTimeZone('Europe/Warsaw'), true);
  assert.equal(isIanaTimeZone('UTC'), true);
  assert.equal(isIanaTimeZone('Moon/Base'), false);
  assert.equal(isIanaTimeZone(null), false);
  assert.equal(isIanaTimeZone(''), false);
  assert.equal(isIanaTimeZone('x'.repeat(101)), false);
});

test('advanceAlbum seeds a fresh record, ignores invalid zones, and is idempotent same-day', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  const first = advanceAlbum(null, now, 'not-a-zone');
  assert.deepEqual(first, { timeZone: 'UTC', month: '2026-10', stamps: 1, lastStampDay: '2026-10-22', history: {} });
  const sameDay = advanceAlbum(first, now + 1000, 'Europe/Warsaw'); // zone change ignored once seeded
  assert.deepEqual(sameDay, first);
});

test('advanceAlbum grants exactly one stamp per new day and caps at ten', () => {
  let album = null;
  for (let day = 1; day <= 11; day++) {
    const now = Date.parse(`2026-10-${String(day).padStart(2, '0')}T12:00:00Z`);
    album = advanceAlbum(album, now, 'UTC');
    assert.equal(album.stamps, Math.min(day, 10));
  }
});

test('advanceAlbum archives the completed month and resets stamps on rollover', () => {
  let album = { timeZone: 'UTC', month: '2026-10', stamps: 7, lastStampDay: '2026-10-31', history: { '2026-09': 3 } };
  album = advanceAlbum(album, Date.parse('2026-11-01T12:00:00Z'), 'UTC');
  assert.deepEqual(album, { timeZone: 'UTC', month: '2026-11', stamps: 1, lastStampDay: '2026-11-01', history: { '2026-09': 3, '2026-10': 7 } });
});

test('noonEpochForDay reconstructs an epoch that formats back to the same day in the zone', () => {
  for (const [day, zone] of [['2026-10-22', 'UTC'], ['2026-11-01', 'Europe/Warsaw'],
    ['2026-01-15', 'Pacific/Kiritimati'], ['2026-06-15', 'Pacific/Honolulu'], ['2026-03-29', 'Europe/Warsaw']]) {
    assert.equal(albumDayKey(noonEpochForDay(day, zone), zone), day, `${day} in ${zone}`);
  }
});
