const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createGame } = require('./game-harness');
const { validateAlbumState } = require('../public/js/album-state');
const { hasRealProgress } = require('../public/js/save-progress');
const ms = date => Date.parse(date);
function load(c, name) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', name + '.js'), 'utf8'), c);
}
function setup(zone = 'Europe/Warsaw') {
  const c = createGame();
  c.zone = zone;
  c.Intl = { DateTimeFormat: function(locale, options = {}) {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: options.timeZone || c.zone });
  } };
  c.document = { getElementById: () => null, addEventListener() {}, body: { children: [] } };
  c.i18n = { t: key => key === 'album.skin' ? 'Moon Cat · {month}' : key === 'album.calendar' ? '{zone}' : key };
  c.api = { token: null };
  c.setSaveStatus = () => {};
  c.AbortController = AbortController;
  c.setTimeout = setTimeout;
  c.clearTimeout = clearTimeout;
  for (const name of ['escape', 'shop', 'album']) load(c, name);
  c.game.isReady = true;
  return c;
}
function saved(c) { return JSON.parse(JSON.stringify(c.buildSaveState())); }
function visit(c, date) { return c.recordAlbumVisit(ms(date)); }
function earn(c, month = '2026-10') {
  for (let day = 1; day <= 10; day++) assert.equal(visit(c, `${month}-${String(day).padStart(2, '0')}T12:00:00Z`), true);
}

test('one stamp per local day, also after a saved guest reload and timezone change', async () => {
  const c = setup();
  assert.equal(visit(c, '2026-10-01T21:30:00Z'), true); // Warsaw Oct 1, 23:30
  assert.equal(c.game.album.stamps, 1);
  assert.equal(visit(c, '2026-10-01T21:59:59Z'), false);
  await c.saveGame();
  const snapshot = c.readLocalState();
  assert.equal(validateAlbumState(snapshot.album), true);
  const clone = setup('Pacific/Kiritimati'); // already tomorrow, but same album day
  clone.applyGameState(snapshot);
  assert.equal(visit(clone, '2026-10-01T21:59:59Z'), false);
  assert.equal(clone.game.album.timeZone, 'Europe/Warsaw');
  assert.equal(visit(clone, '2026-10-01T22:00:00Z'), true);
  assert.equal(clone.game.album.stamps, 2);
  clone.zone = 'Pacific/Honolulu';
  assert.equal(visit(clone, '2026-10-01T22:00:01Z'), false);
  assert.equal(visit(clone, '2026-09-30T22:00:01Z'), false);
});

test('calendar uses the first player local month rather than UTC; DST is calendar-safe', () => {
  const c = setup('America/Los_Angeles');
  visit(c, '2026-11-01T01:00:00Z');
  assert.equal(c.game.album.month, '2026-10');
  const dst = setup();
  visit(dst, '2026-03-28T23:00:00Z');
  assert.equal(dst.game.album.lastDay, '2026-03-29');
  assert.equal(visit(dst, '2026-03-29T21:59:59Z'), false);
  assert.equal(visit(dst, '2026-03-29T22:00:00Z'), true); // 23-hour day
  assert.equal(dst.game.album.stamps, 2);
  const autumn = setup();
  visit(autumn, '2026-10-24T22:00:00Z');
  assert.equal(visit(autumn, '2026-10-25T22:59:59Z'), false); // 25-hour day
  assert.equal(visit(autumn, '2026-10-25T23:00:00Z'), true);
});

test('tenth stamp awards only a cosmetic; later days cap at ten, next month retains history and skins', () => {
  const c = setup();
  c.applyGameState({ fish: 42, catnip: 8, diamonds: 3, elixirs: 2, cats: [{ id: 'dachowiec', count: 3 }],
    gacha: { pity: 9, totalPulls: 99, counts: {} } });
  const before = saved(c);
  for (let day = 1; day <= 9; day++) visit(c, `2026-10-0${day}T12:00:00Z`);
  assert.equal(c.hasItem('skin_album_2026-10'), false);
  visit(c, '2026-10-10T12:00:00Z');
  assert.equal(c.hasItem('skin_album_2026-10'), true);
  assert.equal(visit(c, '2026-10-10T20:00:00Z'), false);
  for (const key of Object.keys(before).filter(k => !['savedAt', 'album', 'purchasedItems'].includes(k))) {
    assert.deepEqual(saved(c)[key], before[key], key);
  }
  visit(c, '2026-10-20T12:00:00Z');
  assert.equal(c.game.album.stamps, 10);
  const clone = setup();
  clone.applyGameState(saved(c));
  visit(clone, '2026-11-01T12:00:00Z');
  assert.equal(clone.game.album.stamps, 1); // zero previous stamps plus today's first visit
  assert.equal(clone.game.album.history['2026-10'], 10);
  assert.equal(clone.hasItem('skin_album_2026-10'), true);
  assert.equal(clone.hasItem('skin_album_2026-11'), false);
  for (let day = 2; day <= 10; day++) visit(clone, `2026-11-${String(day).padStart(2, '0')}T12:00:00Z`);
  assert.equal(clone.hasItem('skin_album_2026-11'), true);
  assert.equal(clone.lastOwned('skin_'), 'skin_album_2026-11');
  clone.equipAlbumSkin('2026-10');
  assert.equal(clone.lastOwned('skin_'), 'skin_album_2026-10');
  assert.equal(clone.purchasedItems.length, 2);
  assert.notDeepEqual(clone.albumSkinPalette('skin_album_2026-10'), clone.albumSkinPalette('skin_album_2026-11'));
  clone.game.totalFishEarned = clone.getCatnipNeeded();
  clone.checkAchievements = () => {};
  assert.equal(clone.prestige(), true);
  assert.equal(clone.game.album.stamps, 10);
  assert.equal(clone.hasItem('skin_album_2026-10'), true);
});

test('missed months and incomplete albums remain honest: no backfilled stamps or rewards', () => {
  const c = setup();
  visit(c, '2026-12-31T12:00:00Z');
  visit(c, '2027-02-01T12:00:00Z');
  assert.equal(c.game.album.stamps, 1);
  assert.equal(c.game.album.month, '2027-02');
  assert.deepEqual({ ...c.game.album.history }, { '2026-12': 1 });
  assert.equal(c.hasItem('skin_album_2026-12'), false);
  assert.equal(hasRealProgress(saved(c)), true);
  const state = saved(c);
  c.applyGameState(state);
  assert.deepEqual(saved(c).album, state.album);
  c.applyGameState({ fish: 42 });
  assert.equal(c.game.album, null);
  assert.equal(c.game.fish, 42);
});

test('fresh health time ignores wall-clock jumps, reloads, and forward or backward client clock changes', async () => {
  const c = setup();
  let serverTime = '2026-10-01T12:00:00Z';
  c.fetch = async (url, options) => {
    assert.equal(url, '/api/health');
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ status: 'ok', timestamp: serverTime }) };
  };
  await c.refreshAlbum();
  const snapshot = saved(c);
  for (const wallTime of ['2036-10-01T12:00:00Z', '2000-01-01T12:00:00Z']) {
    c.Date = class extends Date {
      constructor(...args) { super(...(args.length ? args : [wallTime])); }
      static now() { return ms(wallTime); }
    };
    await c.refreshAlbum();
    assert.equal(c.game.album.stamps, 1);
    c.applyGameState(snapshot);
    await c.refreshAlbum();
    assert.equal(c.game.album.stamps, 1);
  }
  serverTime = '2026-10-02T12:00:00Z';
  await c.refreshAlbum();
  assert.equal(c.game.album.stamps, 2);
});

test('unavailable or invalid server time grants nothing; a retry automatically records the visit', async () => {
  const c = setup();
  const container = { innerHTML: '' };
  c.document.getElementById = id => id === 'albumContent' ? container : null;
  for (const response of [null, { ok: false }, { ok: true, json: async () => ({ status: 'ok', timestamp: 'bad' }) }]) {
    c.fetch = async () => { if (!response) throw new Error('offline'); return response; };
    await c.refreshAlbum();
    assert.equal(c.game.album, null);
    assert.match(container.innerHTML, /album.waiting/);
  }
  c.fetch = async () => ({ ok: true, json: async () => ({ status: 'ok', timestamp: '2026-10-01T12:00:00Z' }) });
  await c.refreshAlbum();
  assert.equal(c.game.album.stamps, 1);
  assert.match(container.innerHTML, /1\/10/);
  assert.match(container.innerHTML, /album.visited/);
});

test('concurrent refreshes and a delayed response during account switch cannot double-count or leak progress', async () => {
  const c = setup();
  let complete, calls = 0;
  c.fetch = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  const first = c.refreshAlbum();
  await c.refreshAlbum();
  assert.equal(calls, 1);
  c.applyGameState({ saveOwnerId: '2' });
  complete({ ok: true, json: async () => ({ status: 'ok', timestamp: '2026-10-01T12:00:00Z' }) });
  await first;
  assert.equal(c.game.album, null);
  c.game.isReady = false;
  assert.equal(visit(c, '2026-10-01T12:00:00Z'), false);
  await c.refreshAlbum();
  assert.equal(calls, 1);
  c.game.isReady = true;
  c.game.saveConflict = true;
  assert.equal(visit(c, '2026-10-01T12:00:00Z'), false);
});

test('history is visible and earned skins actually reach the canvas after restore', () => {
  const c = setup();
  earn(c);
  visit(c, '2026-11-01T12:00:00Z');
  const panel = { innerHTML: '' };
  c.document.getElementById = id => id === 'albumContent' ? panel : null;
  c.renderAlbum();
  assert.match(panel.innerHTML, /2026-10 · 10\/10 · album.earned/);
  assert.match(panel.innerHTML, /equipAlbumSkin\('2026-10'\)/);
  const clone = setup();
  clone.applyGameState(saved(c));
  const colors = [];
  const ctx = new Proxy({}, {
    get: (o, k) => o[k] || (() => {}),
    set: (o, k, v) => { if (k === 'fillStyle') colors.push(v); o[k] = v; return true; },
  });
  clone.document.getElementById = id => id === 'catCanvas' ? { width: 200, height: 200, getContext: () => ctx } : null;
  load(clone, 'render');
  clone.refreshAlbum = () => {};
  clone.endStateTransition();
  assert.equal(colors[0], clone.albumSkinPalette('skin_album_2026-10').fur);
});
