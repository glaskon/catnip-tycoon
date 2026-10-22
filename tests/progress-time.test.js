const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');

const NOW = 1800000000000;
function setup() {
  const c = createGame();
  c.Date = class extends Date { static now() { return NOW; } };
  c.crypto = require('node:crypto').webcrypto;
  c.document = { getElementById: () => null, body: { children: [] } };
  c.i18n = { t: (key, fallback) => fallback || key };
  c.showDebug = () => {};
  for (const file of ['save-progress', 'prestige', 'catlife', 'device']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file + '.js'), 'utf8'), c);
  }
  c.showOfflineEarnings = context => { c.receipt = context; };
  c.showProgressNotice = text => { c.notice = text; };
  c.game.isReady = true;
  c.api = { token: null };
  return c;
}

function snapshot(extra = {}) {
  return { fish: 1000, savedAt: NOW - 3600000, cats: [{ id: 'dachowiec', count: 1 }], ...extra };
}

function account(c, initial) {
  let saved = structuredClone(initial);
  c.game.user = { id: 7 };
  c.api.token = 'token';
  c.writes = [];
  c.api.loadGameState = async () => ({ gameState: structuredClone(saved), updatedAt: new Date(NOW - 3600000).toISOString() });
  c.api.saveGameState = async (state, id, deviceId) => {
    saved = structuredClone(state);
    c.writes.push({ state: saved, id, deviceId });
    return { success: true };
  };
}

test('guest and account earn exactly 1935 fish for one hour with a 30s x10 boost', async () => {
  const state = snapshot({ activeBoosts: [{ kind: 'speed', mult: 10, remainingMs: 30000 }] });
  const guest = setup(), user = setup();
  guest.localStorage.setItem('catnip-save', JSON.stringify(state));
  guest.loadLocalGame();
  account(user, state);
  await user.loadGame(null);
  assert.equal(guest.game.fish, 2935);
  assert.equal(user.game.fish, guest.game.fish);
  assert.equal(guest.game.activeBoosts.length, 0);
  assert.equal(guest.game.speedMultiplier, 1);
  guest.loadLocalGame();
  await user.loadGame(null);
  assert.equal(guest.game.fish, 2935);
  assert.equal(user.game.fish, 2935);
});

test('overlapping speed, production and click boosts include autoclicker and expire individually', () => {
  const c = setup();
  c.restoreWithOffline(snapshot({
    upgrades: [{ id: 'autoclicker', purchased: true }],
    activeBoosts: [
      { kind: 'speed', mult: 10, remainingMs: 30000 },
      { kind: 'production', mult: 10, remainingMs: 60000 },
      { kind: 'click', mult: 5, remainingMs: 120000 },
    ],
  }));
  // 30*(5+5)*10 + 30*(5+5) + 60*(.5+5) + 3480*(.5+1)
  assert.equal(c.game.fish, 1000 + 8850);
  assert.equal(c.game.fishPerClick, 1);
  assert.equal(c.game.fishPerSecond, 0.5);
});

test('shrine uses the shared formula; elixirs use their live rate without speed amplification', () => {
  const c = setup();
  let shrineCalls = 0;
  c.getCatnipShrineRate = () => { shrineCalls++; return 0.123; };
  c.restoreWithOffline(snapshot({ prestigeCount: 10, cats: [],
    upgrades: [{ id: 'elixirmastery', purchased: true }],
    activeBoosts: [{ kind: 'speed', mult: 10, remainingMs: 30000 }],
  }));
  assert.ok(shrineCalls > 0);
  assert.ok(Math.abs(c.game.catnip - 0.123 * 3870) < 1e-10);
  assert.equal(c.game.elixirs, 90);
});

test('hard cap, retroactive extension and happy pet boundary retain correct rates', () => {
  const c = setup();
  const context = c.restoreWithOffline(snapshot({ savedAt: NOW - 8 * 3600000,
    catnip: 100, prestigeCount: 3, catlife: { hunger: 71, lastUpdate: NOW - 8 * 3600000, fedCount: 0 },
    activeBoosts: [{ kind: 'production', mult: 10, remainingMs: 30000 }],
  }));
  // Happy for 288s; production boost only during first 30s.
  const expected = seconds => 30 * 5.5 + 258 * 0.55 + (seconds - 288) * 0.5;
  assert.ok(Math.abs(c.game.fish - 1000 - expected(3600)) < 1e-9);
  c.creditOffline(context, 21600);
  assert.ok(Math.abs(c.game.fish - 1000 - expected(21600)) < 1e-9);
  const fish = c.game.fish;
  c.creditOffline(context, 999999);
  c.creditOffline(context, 21600);
  assert.equal(c.game.fish, fish);
});

test('legacy local saves earn no guessed absence; server fallback and future timestamps are safe', () => {
  const c = setup();
  c.restoreWithOffline(snapshot({ savedAt: undefined }));
  assert.equal(c.game.fish, 1000);
  c.restoreWithOffline(snapshot({ savedAt: undefined }), NOW - 3600000);
  assert.equal(c.game.fish, 2800);
  c.restoreWithOffline(snapshot({ savedAt: NOW + 3600000 }));
  assert.equal(c.game.fish, 1000);
});

test('migration preserves the full guest snapshot, checkpoints once, and announces the choice', async () => {
  const c = setup();
  const state = snapshot({ daily: { count: 2, lastClaimDate: '2026-10-20' },
    gacha: { totalPulls: 1, pity: 1, counts: { blue: 1 } },
    purchasedItems: ['test'], shopCounts: { test: 1 },
  });
  account(c, { fish: 0, cats: [], upgrades: [] });
  await c.loadGame(state);
  assert.equal(c.game.fish, 2800);
  assert.equal(c.writes.length, 1);
  assert.ok(c.writes[0].id);
  assert.equal(c.writes[0].deviceId, c.getDeviceId()); // only a verified device record may seed the album (decision 6B)
  assert.equal(c.writes[0].state.saveOwnerId, '7');
  assert.equal(c.writes[0].state.daily.count, 2);
  assert.equal(c.writes[0].state.gacha.totalPulls, 1);
  assert.match(c.notice, /transferred/);
  await c.loadGame(c.readLocalState());
  assert.equal(c.game.fish, 2800);
  assert.equal(c.writes[1].id, undefined);
  assert.match(c.notice, /Account progress loaded/);
});

test('nonempty account wins; omitted nested state cannot leak from the guest', async () => {
  const c = setup();
  const guest = snapshot({ catlife: { hunger: 10, fedCount: 5 }, daily: { count: 10 }, gacha: { totalPulls: 9 } });
  c.applyGameState(guest);
  account(c, { fish: 9, savedAt: NOW });
  await c.loadGame(guest);
  assert.equal(c.game.fish, 9);
  assert.ok(c.game.cats.every(cat => cat.count === 0));
  assert.equal(c.game.daily, null);
  assert.equal(c.game.gacha, null);
  assert.equal(c.game.catlife, null);
  assert.equal(c.writes[0].id, undefined);
  assert.equal(JSON.parse(c.localStorage.getItem('catnip-recovery-guest')).fish, 1000);
});

test('account copies cannot be migrated after logout; failed import retains its stable ID and local progress', async () => {
  const c = setup();
  account(c, {});
  await c.loadGame(snapshot({ saveOwnerId: 'other-account' }));
  assert.equal(c.game.fish, 0);
  assert.equal(c.writes[0].id, undefined);
  c.api.saveGameState = async () => { throw new Error('response lost'); };
  c.api.loadGameState = async () => ({ gameState: {} });
  await assert.rejects(c.loadGame(snapshot()), /response lost/);
  const stored = c.readLocalState();
  assert.equal(stored.fish, 1000);
  assert.ok(stored.guestMigrationId);
  assert.equal(stored.saveOwnerId, undefined);
  await assert.rejects(c.loadGame(stored), /response lost/);
  assert.equal(c.readLocalState().guestMigrationId, stored.guestMigrationId);
});

test('save queue serializes requests and blocks writes throughout account selection', async () => {
  const c = setup();
  c.api.token = 'token';
  let finish, calls = 0;
  c.api.saveGameState = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const first = c.saveGame();
  const second = c.saveGame();
  await Promise.resolve();
  assert.equal(calls, 1);
  finish({});
  await first;
  await Promise.resolve();
  assert.equal(calls, 2);
  finish({});
  await second;
  c.beginStateTransition();
  await c.saveGame();
  assert.equal(calls, 2);
});

test('identical elixir queue cap and independent shop hour survive offline restoration', () => {
  const c = setup();
  for (let n = 0; n < 20; n++) c.applyBoost('speed', 10, 30000);
  assert.equal(c.game.activeBoosts.length, 10);
  assert.equal(c.game.activeBoosts[9].expiresAt - NOW, 300000);
  c.applyBoost('speed', 2, 3600000);
  assert.equal(c.game.speedMultiplier, 10);
  assert.equal(c.game.activeBoosts[10].expiresAt - NOW, 3600000);
  const state = JSON.parse(JSON.stringify(c.buildSaveState()));
  state.savedAt = NOW - 1800000;
  state.cats = [{ id: 'dachowiec', count: 1 }];
  c.restoreWithOffline(state);
  // Five minutes at x10, then 25 minutes at x2; the hour keeps its expiry.
  assert.equal(c.game.fish, 3000);
  assert.equal(c.game.speedMultiplier, 2);
  assert.equal(c.game.activeBoosts[0].expiresAt - NOW, 1800000);
  assert.equal(c.game.activeBoosts[0].maxDurationMs, 3600000);
});

test('save status still reports pending, success and both storage/network errors', async () => {
  const c = setup();
  const el = { dataset: {}, textContent: '' };
  c.document.getElementById = () => el;
  c.api.token = 'token';
  let finish;
  c.api.saveGameState = () => new Promise(resolve => { finish = resolve; });
  const pending = c.saveGame();
  assert.equal(el.dataset.status, 'pending');
  await Promise.resolve();
  finish({});
  await pending;
  assert.equal(el.dataset.status, 'saved');
  c.console = { error() {} };
  c.api.saveGameState = async () => { throw new Error('network'); };
  assert.equal(await c.saveGame(), false);
  assert.equal(el.dataset.status, 'error');
  assert.equal(c.game.saveConflict, false);
  c.api.saveGameState = async () => ({});
  assert.equal(await c.saveGame(), true);
  assert.equal(el.dataset.status, 'saved');
  c.localStorage.setItem = () => { throw new Error('storage full'); };
  assert.equal(await c.saveGame(), false);
  assert.equal(el.dataset.status, 'error');
});

test('409 after a successful save latches conflict, drains queued saves and preserves local progress', { timeout: 2000 }, async () => {
  const c = setup();
  const el = { dataset: {}, textContent: '' };
  c.document.getElementById = () => el;
  c.console = { error() {} };
  c.AbortSignal = AbortSignal;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/api.js'), 'utf8'), c);
  c.api.token = 'token';
  c.api.revision = 7;
  const requests = [];
  let conflict;
  c.fetch = async (url, options) => {
    requests.push({ url, method: options.method, body: JSON.parse(options.body) });
    if (requests.length === 1) return { ok: true, json: async () => ({ revision: 8 }) };
    return new Promise(resolve => {
      conflict = () => resolve({ ok: false, status: 409,
        json: async () => ({ code: 'SAVE_CONFLICT', error: 'Conflict', revision: 9 }),
      });
    });
  };
  let noticeCount = 0;
  c.showProgressNotice = (message, retry) => {
    noticeCount++;
    assert.equal(message, 'game.saveStatus.conflictMessage');
    assert.equal(retry, true);
  };
  c.applyGameState(snapshot({ savedAt: NOW, saveOwnerId: '7',
    daily: { count: 2 }, gacha: { totalPulls: 1 }, purchasedItems: ['test'],
  }));
  const recovery = JSON.stringify(snapshot());
  for (const owner of ['guest', '7']) c.localStorage.setItem('catnip-recovery-' + owner, recovery);
  assert.equal(await c.saveGame(), true);
  assert.equal(el.dataset.status, 'saved');
  assert.equal(c.api.revision, 8);
  assert.equal(requests[0].body.expected_revision, 7);

  c.game.fish = 1234;
  const first = c.saveGame();
  await Promise.resolve();
  c.game.fish = 2345;
  const queued = c.saveGame();
  const localBefore = c.localStorage.getItem('catnip-save');
  const gameBefore = JSON.stringify(c.game);
  conflict();
  assert.deepEqual(await Promise.all([first, queued]), [false, false]);
  assert.equal(c.game.saveConflict, true);
  assert.equal(el.dataset.status, 'conflict');
  assert.equal(el.textContent, 'game.saveStatus.conflict');
  assert.equal(noticeCount, 1);
  assert.equal(c.api.revision, 8);
  assert.equal(requests[1].body.expected_revision, 8);

  for (let n = 0; n < 3; n++) assert.equal(await c.saveGame(), false);
  assert.equal(JSON.stringify({ ...c.game, saveConflict: false }), gameBefore);
  // Account transitions must also be able to wait for the settled queue.
  c.beginStateTransition();
  assert.equal(await vm.runInContext('_saveQueue', c), false);
  c.endStateTransition();
  assert.equal(await c.saveGame(), false);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(r => r.url === '/api/save' && r.method === 'POST'));
  assert.equal(el.dataset.status, 'conflict');
  assert.equal(noticeCount, 1);
  assert.equal(c.localStorage.getItem('catnip-save'), localBefore);
  for (const owner of ['guest', '7']) {
    assert.equal(c.localStorage.getItem('catnip-recovery-' + owner), recovery);
  }
  assert.equal(JSON.parse(localBefore).saveConflict, undefined);
});

test('all four locales have matching keys and distinct save conflict status and message', () => {
  let keys;
  for (const locale of ['pl', 'en', 'es', 'de']) {
    const strings = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/locales', locale + '.json'), 'utf8'));
    const currentKeys = Object.keys(strings).sort();
    if (keys) assert.deepEqual(currentKeys, keys, locale + ' key parity');
    keys = currentKeys;
    assert.ok(strings['game.saveStatus.conflict']);
    assert.ok(strings['game.saveStatus.conflictMessage']);
    assert.notEqual(strings['game.saveStatus.conflict'], strings['game.saveStatus.error']);
  }
});

test('auth freezes play and autosaves before getting a token; registration adds no bonus', async () => {
  const c = setup();
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', dataset: {}, classList: { remove() {} } });
    return elements.get(id);
  };
  element('authEmail').value = 'guest@example.test';
  element('authPassword').value = 'Password123';
  c.document.getElementById = element;
  c.document.addEventListener = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/main.js'), 'utf8'), c);
  c.updateUserStatus = () => {};
  c.updateAdminVisibility = () => {};
  c.applyGameState(snapshot({ savedAt: NOW }));
  c.api.register = async () => {
    assert.equal(c.game.isReady, false);
    c.api.token = 'token';
    await c.saveGame();
    assert.equal(c.writes.length, 0);
    return { user: { id: 7 } };
  };
  c.writes = [];
  c.api.loadGameState = async () => ({ gameState: {} });
  c.api.saveGameState = async (state, id) => { c.writes.push({ state, id }); return {}; };
  vm.runInContext("authMode = 'register'", c);
  await c.handleAuth({ preventDefault() {} });
  assert.equal(c.game.isReady, true);
  assert.equal(c.game.fish, 1000);
  assert.equal(c.writes.length, 1);
  assert.ok(c.writes[0].id);
  assert.match(c.notice, /transferred/);
});

test('already-used guest import loads the account explicitly and keeps the recovery snapshot', async () => {
  const c = setup();
  account(c, {});
  const save = c.api.saveGameState;
  c.api.saveGameState = async (state, id) => {
    if (id) throw Object.assign(new Error('used'), { code: 'IMPORT_USED' });
    return save(state);
  };
  await c.loadGame(snapshot({ guestMigrationId: 'used-guest' }));
  assert.equal(c.game.fish, 0);
  assert.match(c.notice, /already transferred/);
  assert.equal(JSON.parse(c.localStorage.getItem('catnip-recovery-guest')).fish, 1000);
});

test('network latency cannot give local and server checkpoints different timestamps or boosts', async () => {
  const c = setup();
  account(c, snapshot({ savedAt: NOW, activeBoosts: [{ kind: 'speed', mult: 10, remainingMs: 30000 }] }));
  const save = c.api.saveGameState;
  c.api.saveGameState = async state => {
    const result = await save(state);
    c.Date.now = () => NOW + 1500;
    return result;
  };
  await c.loadGame(null);
  assert.deepEqual(JSON.parse(c.localStorage.getItem('catnip-save')), JSON.parse(JSON.stringify(c.writes[0].state)));
});
