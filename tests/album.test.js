const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createGame } = require('./game-harness');
const { validateAlbumState } = require('../public/js/album-state');
const { hasRealProgress } = require('../public/js/save-progress');

function load(c, name) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', name + '.js'), 'utf8'), c);
}
function setup() {
  const c = createGame();
  c.document = { getElementById: () => null, addEventListener() {}, body: { children: [] } };
  c.i18n = { t: key => key === 'album.skin' ? 'Moon Cat · {month}' : key === 'album.calendar' ? '{zone}' : key };
  c.api = { token: null };
  c.setSaveStatus = () => {};
  for (const name of ['escape', 'device', 'shop', 'gacha', 'album', 'wardrobe']) load(c, name);
  c.game.isReady = true;
  return c;
}
function saved(c) { return JSON.parse(JSON.stringify(c.buildSaveState())); }

// A response shaped exactly like POST /api/album/stamp or GET /api/album.
function response(month, stamps, { lastStampDay = `${month}-01`, history = {}, timeZone = 'Europe/Warsaw' } = {}) {
  return { month, stamps, lastStampDay, history, timeZone,
    lastStampAt: stamps >= 1 ? Date.parse(lastStampDay + 'T12:00:00Z') : null };
}

test('primeAlbumFromServer shows the server state immediately via GET, without attempting a stamp', async () => {
  const c = setup();
  let stampCalls = 0;
  const container = { innerHTML: '' };
  c.document.getElementById = id => id === 'albumContent' ? container : null;
  c.api.getAlbum = async deviceId => { assert.equal(deviceId, c.getDeviceId()); return response('2026-10', 4); };
  c.api.stampAlbum = async () => { stampCalls++; return response('2026-10', 4); };
  await c.primeAlbumFromServer();
  assert.equal(stampCalls, 0);
  assert.equal(c.game.album.stamps, 4);
  // A GET alone never confirms "today's visit" the way a stamp attempt does —
  // it shows a preview, exactly like an offline retry would.
  assert.match(container.innerHTML, /album\.offline/);
});

test('a failed primeAlbumFromServer leaves any existing preview untouched', async () => {
  const c = setup();
  c.api.stampAlbum = async () => response('2026-10', 2);
  await c.refreshAlbum();
  const before = saved(c).album;
  c.api.getAlbum = async () => { throw new Error('offline'); };
  await c.primeAlbumFromServer();
  assert.deepEqual(saved(c).album, before);
});

test('a confirmed response replaces game.album and the device id is sent with every request', async () => {
  const c = setup();
  const calls = [];
  c.api.stampAlbum = async (deviceId, zone) => { calls.push({ deviceId, zone }); return response('2026-10', 1); };
  await c.refreshAlbum();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].deviceId, c.getDeviceId());
  assert.deepEqual(saved(c).album, { timeZone: 'Europe/Warsaw', month: '2026-10', stamps: 1,
    lastDay: '2026-10-01', lastStampAt: Date.parse('2026-10-01T12:00:00Z'), history: {} });
  assert.equal(validateAlbumState(c.game.album), true);
  // The stored zone is sent back on the next call, not re-derived locally.
  c.api.stampAlbum = async (deviceId, zone) => { calls.push({ deviceId, zone }); return response('2026-10', 1); };
  await c.refreshAlbum();
  assert.equal(calls[1].zone, 'Europe/Warsaw');
});

test('a zero-stamp response (nothing earned yet) clears game.album rather than storing an empty object', async () => {
  const c = setup();
  c.api.stampAlbum = async () => response('2026-10', 0);
  await c.refreshAlbum();
  assert.equal(c.game.album, null);
});

test('a failed or offline request never grants a stamp and keeps the last confirmed state as a preview', async () => {
  const c = setup();
  c.api.stampAlbum = async () => response('2026-10', 3);
  await c.refreshAlbum();
  const confirmed = saved(c).album;
  for (const failure of [() => { throw new Error('network'); }, () => { throw new Error('HTTP 500'); }]) {
    c.api.stampAlbum = async () => failure();
    await c.refreshAlbum();
    assert.deepEqual(saved(c).album, confirmed); // unchanged, still showing the last confirmed stamp count
  }
});

test('refreshAlbum never runs twice concurrently; a stale response after an account switch is discarded', async () => {
  const c = setup();
  let complete, calls = 0;
  c.api.stampAlbum = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  const first = c.refreshAlbum();
  await c.refreshAlbum(); // second call while the first is in flight: no new request
  assert.equal(calls, 1);
  c.applyGameState({ saveOwnerId: '2' }); // switches account mid-flight (bumps the generation)
  complete(response('2026-10', 5));
  await first;
  assert.equal(c.game.album, null); // the stale response for the old account must not apply
  c.game.isReady = false;
  await c.refreshAlbum();
  assert.equal(calls, 1); // not ready: no request at all
  c.game.isReady = true;
  c.game.saveConflict = true;
  await c.refreshAlbum();
  assert.equal(calls, 1); // conflicted: no request either
});

test('tenth stamp awards only a cosmetic without touching currencies; later stamps do not re-award', () => {
  const c = setup();
  c.applyGameState({ fish: 42, catnip: 8, diamonds: 3, elixirs: 2, cats: [{ id: 'dachowiec', count: 3 }],
    gacha: { pity: 9, totalPulls: 99, counts: {} } });
  const before = saved(c);
  c.applyAlbumResponse(response('2026-10', 10));
  assert.equal(c.hasItem('skin_album_2026-10'), true);
  for (const key of Object.keys(before).filter(k => !['savedAt', 'album', 'purchasedItems'].includes(k))) {
    assert.deepEqual(saved(c)[key], before[key], key);
  }
  const owned = [...c.purchasedItems];
  c.applyAlbumResponse(response('2026-10', 10)); // a later idempotent response does not duplicate the item
  assert.deepEqual([...c.purchasedItems], owned);
});

test('month rollover history and already-owned skins are preserved exactly as the server reports them', () => {
  const c = setup();
  c.applyAlbumResponse(response('2026-10', 10));
  assert.equal(c.hasItem('skin_album_2026-10'), true);
  c.applyAlbumResponse(response('2026-11', 1, { history: { '2026-10': 10 } }));
  assert.equal(c.game.album.stamps, 1);
  assert.deepEqual(c.game.album.history, { '2026-10': 10 });
  assert.equal(c.hasItem('skin_album_2026-10'), true); // kept from last month
  assert.equal(c.hasItem('skin_album_2026-11'), false); // not yet earned this month
  const clone = setup();
  clone.applyGameState(saved(c));
  assert.deepEqual(saved(clone).album, saved(c).album);
  assert.equal(clone.hasItem('skin_album_2026-10'), true);
});

test('missed months stay honest: history the server never reports is never invented locally', () => {
  const c = setup();
  c.applyAlbumResponse(response('2027-02', 1, { history: { '2026-12': 1 } })); // January was skipped entirely
  assert.deepEqual(c.game.album.history, { '2026-12': 1 });
  assert.equal(c.hasItem('skin_album_2026-12'), false);
  assert.equal(hasRealProgress(saved(c)), true);
});

test('equipping a dated skin and rendering reach the canvas after a restore', () => {
  const c = setup();
  c.applyAlbumResponse(response('2026-10', 10));
  c.applyAlbumResponse(response('2026-11', 1, { history: { '2026-10': 10 } }));
  const panel = { innerHTML: '' };
  c.document.getElementById = id => id === 'albumContent' ? panel : null;
  c.renderAlbum();
  assert.match(panel.innerHTML, /2026-10 · 10\/10 · album.earned/);
  assert.match(panel.innerHTML, /equipAlbumSkin\('2026-10'\)/);
  c.drawCat = () => {};
  c.equipAlbumSkin('2026-10');
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

test('render shows visited, offline-preview or waiting status depending on confirmation state', async () => {
  const c = setup();
  const container = { innerHTML: '' };
  c.document.getElementById = id => id === 'albumContent' ? container : null;

  // Never confirmed yet, nothing to preview.
  c.api.stampAlbum = async () => { throw new Error('offline'); };
  await c.refreshAlbum();
  assert.equal(c.game.album, null);
  assert.match(container.innerHTML, /album\.waiting/);

  // First confirmation.
  c.api.stampAlbum = async () => response('2026-10', 1);
  await c.refreshAlbum();
  assert.match(container.innerHTML, /1\/10/);
  assert.match(container.innerHTML, /album\.visited/);

  // Confirmed before, now failing: preview the cached state, but say so.
  c.api.stampAlbum = async () => { throw new Error('offline again'); };
  await c.refreshAlbum();
  assert.match(container.innerHTML, /1\/10/);
  assert.match(container.innerHTML, /album\.offline/);
});

test('album rewards omit unknown palettes and preserve dated skin colors and equip buttons', () => {
  const c = setup();
  for (const month of ['unknown', '2026-00', '2026-13', '']) {
    for (const owned of [false, true]) {
      assert.equal(c.albumRewardHTML(month, owned), '');
    }
  }
  for (let month = 1; month <= 12; month++) {
    const date = `2026-${String(month).padStart(2, '0')}`;
    const hue = ((2026 * 12 + month) * 137.508) % 360;
    const html = c.albumRewardHTML(date, false);
    assert.ok(html.includes(`background:hsl(${hue}, 65%, 70%)`));
    assert.ok(html.includes(`Moon Cat · ${date}`));
    assert.doesNotMatch(html, /equipAlbumSkin/);
    assert.ok(c.albumRewardHTML(date, true).includes(`equipAlbumSkin('${date}')`));
  }
});

test('album renders valid and atypical current months and history without losing valid rewards', () => {
  const c = setup();
  c.applyAlbumResponse(response('2026-10', 10));
  c.applyAlbumResponse(response('2026-11', 1, { history: { '2026-10': 10 } }));
  const panel = { innerHTML: '' }, summary = { innerHTML: '' };
  c.document.getElementById = id => id === 'albumContent' ? panel : id === 'albumSummary' ? summary : null;
  for (const month of ['2026-11', 'unknown']) {
    c.game.album.month = month;
    for (const history of [{ '2026-10': 10 }, { '2026-10': 10, unknown: 2, '2026-13': 3 }]) {
      c.game.album.history = history;
      assert.doesNotThrow(() => c.renderAlbum());
      assert.match(summary.innerHTML, /1\/10/);
      assert.match(panel.innerHTML, /2026-10 · 10\/10 · album.earned/);
      assert.match(panel.innerHTML, /equipAlbumSkin\('2026-10'\)/);
      if ('unknown' in history) {
        assert.match(panel.innerHTML, /unknown · 2\/10 · album.missed/);
        assert.match(panel.innerHTML, /2026-13 · 3\/10 · album.missed/);
        assert.doesNotMatch(panel.innerHTML, /equipAlbumSkin\('(unknown|2026-13)'\)/);
      }
    }
  }
});
