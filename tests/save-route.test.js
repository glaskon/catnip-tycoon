const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');

// Exercise the actual route and validator. The transactional store is a test
// double; PostgreSQL locking and DDL still need an integration environment.
function route(now = Date.parse('2026-11-01T12:00:00Z')) {
  const saves = new Map([[1, { game_state: {}, revision: 0 }], [2, { game_state: {}, revision: 0 }]]);
  const receipts = new Map();
  let post, before, releases = 0;
  const client = {
    release() { releases++; },
    async query(sql, args = []) {
      if (sql === 'BEGIN') { before = structuredClone({ saves, receipts }); return { rows: [] }; }
      if (sql === 'COMMIT') return { rows: [] };
      if (sql === 'ROLLBACK') {
        saves.clear(); receipts.clear();
        before.saves.forEach((v, k) => saves.set(k, v));
        before.receipts.forEach((v, k) => receipts.set(k, v));
        return { rows: [] };
      }
      if (sql.startsWith('SELECT id FROM users')) return { rows: [{ id: args[0] }] };
      if (sql.startsWith('SELECT game_state')) return { rows: saves.has(args[0]) ? [structuredClone(saves.get(args[0]))] : [] };
      if (sql.startsWith('SELECT user_id FROM guest_imports')) return { rows: receipts.has(args[0]) ? [{ user_id: receipts.get(args[0]) }] : [] };
      if (sql.startsWith('INSERT INTO guest_imports')) {
        if (receipts.has(args[0])) return { rows: [] };
        receipts.set(args[0], args[1]);
        return { rows: [{ migration_id: args[0] }] };
      }
      if (sql.startsWith('UPDATE saves')) {
        saves.set(args[1], { game_state: JSON.parse(args[0]), revision: saves.get(args[1]).revision + 1 });
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO saves')) {
        saves.set(args[0], { game_state: JSON.parse(args[1]), revision: 1 });
        return { rows: [] };
      }
      throw new Error('Unexpected SQL: ' + sql);
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/routes/save.js'), 'utf8'), {
    console, Date: class extends Date { static now() { return now; } }, module: {}, require(name) {
      if (name === 'express') return { Router: () => ({ get() {}, post(p, auth, handler) { post = handler; } }) };
      if (name === '../db') return { pool: { connect: async () => client } };
      if (name === '../auth') return { authMiddleware() {} };
      if (name === '../../public/js/save-progress') return require('../public/js/save-progress');
      if (name === '../../public/js/album-state') return require('../public/js/album-state');
      throw new Error('Unexpected dependency');
    },
  });
  return {
    saves, receipts,
    setNow(value) { now = value; },
    async request(user, state, revision = 0, id) {
      const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
      await post({ user: { id: user }, body: { game_state: structuredClone(state), expected_revision: revision, migration_id: id } }, res);
      return res;
    },
    get releases() { return releases; },
  };
}

test('migration receipt makes a lost response safe to retry and prevents reuse on another account', async () => {
  const r = route();
  const state = { fish: 1000, guestMigrationId: 'guest-1', savedAt: 1800000000000 };
  assert.equal((await r.request(1, state, 0, 'guest-1')).code, 200);
  const again = await r.request(1, { ...state, fish: 9999 }, 0, 'guest-1');
  assert.equal(again.code, 200);
  assert.equal(again.body.already_migrated, true);
  assert.equal(again.body.game_state.fish, 1000);
  assert.equal(r.saves.get(1).revision, 1);
  const other = await r.request(2, state, 0, 'guest-1');
  assert.equal(other.code, 409);
  assert.equal(other.body.code, 'IMPORT_USED');
  assert.deepEqual(r.saves.get(2).game_state, {});
  assert.equal(r.releases, 3);
});

test('account progress wins and stale revisions cannot overwrite saves or claim offline income twice', async () => {
  const r = route();
  assert.equal((await r.request(1, { fish: 10 })).code, 200);
  assert.equal((await r.request(1, { fish: 1000, guestMigrationId: 'guest-2' }, 1, 'guest-2')).code, 409);
  assert.equal(r.receipts.size, 0);
  assert.equal((await r.request(1, { fish: 20 }, 1)).code, 200);
  assert.equal((await r.request(1, { fish: 30 }, 1)).code, 409);
  assert.equal(r.saves.get(1).game_state.fish, 20);
  assert.equal(r.saves.get(1).game_state.saveOwnerId, '1');
});

test('new metadata and existing boost payloads validate; malformed boosts and metadata are rejected', async () => {
  const c = createGame();
  c.applyBoost('speed', 10, 30000);
  const state = JSON.parse(JSON.stringify(c.buildSaveState()));
  const r = route();
  assert.equal((await r.request(1, state)).code, 200);
  const boosts = [
    { kind: 'x', mult: 10, remainingMs: 10 },
    { kind: 'speed', mult: 0, remainingMs: 10 },
    { kind: 'speed', mult: 10, remainingMs: 10, extra: 1 },
    { kind: 'speed', mult: Infinity, remainingMs: 10 },
    { kind: 'speed', mult: 10, remainingMs: 10000001 },
  ];
  for (const boost of boosts) assert.equal((await r.request(1, { ...state, activeBoosts: [boost] }, 1)).code, 400);
  for (const invalid of [{ savedAt: -1 }, { savedAt: 1.5 }, { saveOwnerId: 1 }, { guestMigrationId: {} },
    { fishPerClick: -1 }, { fishPerClick: Infinity }, { fishPerClick: '1' },
    { clickScalingBaseline: -1 }, { clickScalingBaseline: NaN }, { clickScalingBaseline: '0' }]) {
    assert.equal((await r.request(1, { ...state, ...invalid }, 1)).code, 400);
  }
  assert.equal((await r.request(1, { ...state, activeBoosts: Array(1001).fill(state.activeBoosts[0]) }, 1)).code, 400);
  assert.equal((await r.request(1, { ...state, activeBoosts: [{ kind: 'production', mult: 1000, remainingMs: 10000000 }] }, 1)).code, 200);
});

test('a save without a row can be imported; normal saves retain its migration receipt', async () => {
  const r = route();
  r.saves.delete(1);
  assert.equal((await r.request(1, { fish: 10, guestMigrationId: 'guest-3' }, 0, 'guest-3')).code, 200);
  assert.equal((await r.request(1, { fish: 0, guestMigrationId: null }, 1)).code, 200);
  assert.equal(r.saves.get(1).game_state.guestMigrationId, 'guest-3');
  assert.equal((await r.request(1, { fish: 10, guestMigrationId: 'guest-4' }, 2, 'guest-4')).code, 409);
});

test('permanent prestige multiplier round-trips through the save route with bounded validation', async () => {
  const r = route();
  for (const invalid of [0, -1, 3.1, Infinity, NaN, '2']) {
    assert.equal((await r.request(1, { prestigeMultiplier: invalid })).code, 400);
  }
  assert.equal((await r.request(1, { prestigeMultiplier: 3 })).code, 200);
  assert.equal(r.saves.get(1).game_state.prestigeMultiplier, 3);
});

test('first-cat reward marker survives the save route; malformed markers are rejected', async () => {
  const r = route();
  assert.equal((await r.request(1, { firstCatReward: null })).code, 200);
  assert.equal((await r.request(1, { firstCatReward: 'skin_black' }, 1)).code, 200);
  assert.equal(r.saves.get(1).game_state.firstCatReward, 'skin_black');
  for (const value of [true, 1, {}, '', 'x'.repeat(101)]) {
    assert.equal((await r.request(1, { firstCatReward: value }, 2)).code, 400);
  }
});

test('stored album history and monthly skin persist; a first guest stamp can be imported', async () => {
  const c = createGame();
  const album = { timeZone: 'Europe/Warsaw', month: '2026-11', stamps: 1,
    lastDay: '2026-11-01', lastStampAt: Date.parse('2026-11-01T12:00:00Z'), history: { '2026-10': 10 } };
  c.applyGameState({ album, purchasedItems: ['skin_album_2026-10'], guestMigrationId: 'album-guest' });
  const state = JSON.parse(JSON.stringify(c.buildSaveState()));
  const r = route();
  r.saves.set(1, { game_state: { album }, revision: 0 });
  assert.equal((await r.request(1, state)).code, 200);
  const stored = r.saves.get(1).game_state;
  assert.deepEqual(stored.album, album);
  assert.deepEqual(stored.purchasedItems, ['skin_album_2026-10']);
  const clone = createGame();
  clone.applyGameState(stored);
  assert.deepEqual(JSON.parse(JSON.stringify(clone.buildSaveState().album)), album);
  // A guest with only a first stamp still has real progress to import.
  const onlyStamp = { album: { ...album, history: {} }, guestMigrationId: 'stamp-guest' };
  assert.equal((await r.request(2, onlyStamp, 0, 'stamp-guest')).code, 200);
});

test('album validator rejects malformed calendars, stamps, timestamps and history; local restore is safe', async () => {
  const album = { timeZone: 'Europe/Warsaw', month: '2026-11', stamps: 1,
    lastDay: '2026-11-01', lastStampAt: Date.parse('2026-11-01T12:00:00Z'), history: { '2026-10': 10 } };
  const invalid = [[], {}, { ...album, extra: 1 },
    ...[0, -1, 11, 1.5, '1'].map(stamps => ({ ...album, stamps })),
    ...[null, {}, 'Moon/Base', '<script>'].map(timeZone => ({ ...album, timeZone })),
    ...['2026-13', '2026-00', '<script>'].map(month => ({ ...album, month })),
    ...['2026-11-31', '2026-10-01', '2026-11-02'].map(lastDay => ({ ...album, lastDay })),
    ...[NaN, Infinity, -1, 1.5, '1', 253402300800000].map(lastStampAt => ({ ...album, lastStampAt })),
    ...[[], null, { '2026-11': 10 }, { '2026-12': 10 }, { '2026-09': 11 }, { '<script>': 1 }].map(history => ({ ...album, history })),
  ];
  const r = route();
  assert.equal((await r.request(1, { album: null })).code, 200);
  const c = createGame();
  for (const value of invalid) {
    assert.equal((await r.request(1, { album: value }, 1)).code, 400);
    c.applyGameState({ album: value, fish: 42 });
    assert.equal(c.game.album, null);
    assert.equal(c.game.fish, 42);
  }
});

test('separate activations of all elixirs and shop boosts fit in the save payload', async () => {
  const c = createGame();
  for (let i = 0; i < 10; i++) {
    c.applyBoost('speed', 10, 30000);
    c.applyBoost('production', 10, 30000);
  }
  for (let i = 0; i < 3; i++) c.applyBoost('click', 5, 120000);
  c.applyBoost('speed', 2, 3600000);
  c.applyBoost('click', 3, 3600000);
  const state = JSON.parse(JSON.stringify(c.buildSaveState()));
  assert.equal(state.activeBoosts.length, 25);
  const r = route();
  assert.equal((await r.request(1, state)).code, 200);
  assert.equal(r.saves.get(1).game_state.activeBoosts.length, 25);
});

function albumAt(day, stamps = 1, history = {}) {
  return { timeZone: 'UTC', month: day.slice(0, 7), stamps, lastDay: day,
    lastStampAt: Date.parse(day + 'T12:00:00Z'), history };
}

for (const stamps of [4, 10]) {
  test(`guest import persists ${stamps} stamps, history and the rest of the guest progress`, async () => {
    const r = route();
    for (const user of [1, 2, 3]) { // empty save, explicit null album and no save row
      if (user === 2) r.saves.get(user).game_state.album = null;
      const id = `album-guest-${user}`;
      const state = { fish: 4242, cats: [{ id: 'tabby', count: 3 }], totalCatsBought: 3,
        guestMigrationId: id, album: albumAt('2026-10-22', stamps, { '2026-09': 10 }) };
      const result = await r.request(user, state, 0, id);
      assert.equal(result.code, 200);
      assert.equal(result.body.revision, 1);
      const stored = structuredClone(r.saves.get(user));
      assert.deepEqual(stored, { game_state: { ...state, saveOwnerId: String(user) }, revision: 1 });
      assert.equal(r.receipts.get(id), user);
      const retry = await r.request(user, { ...state, fish: 9999 }, 0, id);
      assert.equal(retry.code, 200);
      assert.equal(retry.body.already_migrated, true);
      assert.deepEqual(r.saves.get(user), stored);
    }
  });
}

test('new account POST with a full state and ten stamps returns 400 without persisting', async () => {
  const r = route(Date.parse('2026-10-22T12:00:00Z'));
  const state = JSON.parse(JSON.stringify(createGame().buildSaveState()));
  for (const user of [1, 3]) { // an empty save and no save row
    const before = structuredClone(r.saves.get(user));
    const result = await r.request(user, { ...state, album: albumAt('2026-10-22', 10) });
    assert.equal(result.code, 400);
    assert.equal(result.body.error, 'Invalid album progress');
    assert.deepEqual(r.saves.get(user), before);
    assert.equal((await r.request(user, { ...state, album: albumAt('2026-10-22') })).code, 200);
  }
  assert.equal(r.releases, 4);
});

test('same-day stamp increment and multi-stamp jumps return 400; unchanged album is accepted', async () => {
  const r = route();
  const album = albumAt('2026-10-21');
  assert.equal((await r.request(1, { album })).code, 200);
  for (const invalid of [{ ...album, stamps: 2 }, albumAt('2026-10-22', 3)]) {
    assert.equal((await r.request(1, { album: invalid }, 1)).code, 400);
    assert.deepEqual(r.saves.get(1).game_state.album, album);
    assert.equal(r.saves.get(1).revision, 1);
  }
  assert.equal((await r.request(1, { album }, 1)).code, 200);
});

test('one stamp on each later day succeeds through the tenth reward and subsequent visits', async () => {
  const r = route();
  for (let day = 1; day <= 11; day++) {
    const state = { album: albumAt(`2026-10-${String(day).padStart(2, '0')}`, Math.min(day, 10)),
      purchasedItems: day >= 10 ? ['skin_album_2026-10'] : [] };
    r.setNow(state.album.lastStampAt);
    assert.equal((await r.request(1, state, day - 1)).code, 200);
    assert.deepEqual(r.saves.get(1).game_state.album, state.album);
  }
  assert.deepEqual(r.saves.get(1).game_state.purchasedItems, ['skin_album_2026-10']);
});

test('month rollover accepts one stamp and archives only the saved month; five stamps fail', async () => {
  const r = route();
  const previous = albumAt('2026-10-31', 10, { '2026-09': 2 });
  r.saves.set(1, { game_state: { album: previous }, revision: 7 });
  const history = { '2026-09': 2, '2026-10': 10 };
  assert.equal((await r.request(1, { album: albumAt('2026-11-01', 5, history) }, 7)).code, 400);
  const album = albumAt('2026-11-01', 1, history);
  assert.equal((await r.request(1, { album }, 7)).code, 200);
  assert.deepEqual(r.saves.get(1).game_state.album, album);
  assert.equal((await r.request(1, { album: previous }, 8)).code, 400);
});

test('stored history cannot be invented, modified or removed, including during rollover', async () => {
  const r = route();
  const album = albumAt('2026-10-31', 2, { '2026-09': 3 });
  r.saves.set(1, { game_state: { album }, revision: 0 });
  const invalid = [
    { ...album, history: { ...album.history, '2026-08': 10 } },
    { ...album, history: { '2026-09': 10 } },
    { ...album, history: {} },
    albumAt('2026-11-01', 1, { '2026-09': 3, '2026-10': 10 }),
    albumAt('2026-11-01', 1, { '2026-09': 3, '2026-10': 2, '2026-08': 10 }),
  ];
  for (const value of invalid) {
    assert.equal((await r.request(1, { album: value })).code, 400);
    assert.deepEqual(r.saves.get(1).game_state.album, album);
  }
  assert.equal((await r.request(2, { album: albumAt('2026-10-22', 1, { '2026-09': 10 }) })).code, 400);
  assert.equal(r.receipts.size, 0);
});

test('future stamp timestamps have an exact five-minute server-clock tolerance', async () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  const r = route(now);
  const album = albumAt('2026-10-22');
  assert.equal((await r.request(1, { album: { ...album, lastStampAt: now + 300001 } })).code, 400);
  assert.equal((await r.request(1, { album: { ...album, lastStampAt: now + 300000 } })).code, 200);
  assert.equal((await r.request(2, { album: albumAt('2026-10-23') })).code, 400);
});

test('album progress cannot rewind stamps, days, timestamps or change the calendar zone', async () => {
  const r = route();
  const album = albumAt('2026-10-22', 2);
  r.saves.set(1, { game_state: { album }, revision: 0 });
  for (const invalid of [
    { ...album, stamps: 1 }, albumAt('2026-10-21', 2),
    { ...album, lastStampAt: album.lastStampAt - 1 },
    { ...album, timeZone: 'Europe/Warsaw' },
  ]) assert.equal((await r.request(1, { album: invalid })).code, 400);
  assert.deepEqual(r.saves.get(1).game_state.album, album);
});

test('normal saves and guest imports without albums still work and cannot erase stored progress', async () => {
  const r = route();
  assert.equal((await r.request(1, { fish: 42 })).code, 200);
  assert.equal((await r.request(2, { fish: 42, guestMigrationId: 'no-album' }, 0, 'no-album')).code, 200);
  const album = albumAt('2026-10-22');
  assert.equal((await r.request(1, { fish: 42, album }, 1)).code, 200);
  assert.equal((await r.request(1, { fish: 43 }, 2)).code, 200);
  assert.deepEqual(r.saves.get(1).game_state.album, album);
  assert.equal((await r.request(1, { fish: 44, album: null }, 3)).code, 200);
  assert.deepEqual(r.saves.get(1).game_state.album, album);
  assert.equal((await r.request(1, { album: { ...album, stamps: 2 } }, 4)).code, 400);
});

test('malformed guest albums cannot persist progress or consume a receipt; corrected import succeeds', async () => {
  const r = route();
  const album = albumAt('2026-10-22', 4, { '2026-09': 10 });
  const state = { fish: 42, guestMigrationId: 'bad-album', album };
  const before = structuredClone(r.saves.get(1));
  for (const invalid of [
    { ...album, month: '2026-09' }, { ...album, timeZone: null },
    ...[0, 11, 1.5].map(stamps => ({ ...album, stamps })),
    { ...album, history: { '2026-10': 10 } }, { ...album, history: { '2026-11': 10 } },
  ]) {
    assert.equal((await r.request(1, { ...state, album: invalid }, 0, 'bad-album')).code, 400);
    assert.equal(r.receipts.size, 0);
    assert.deepEqual(r.saves.get(1), before);
  }
  assert.equal((await r.request(1, state, 0, 'bad-album')).code, 200);
  assert.deepEqual(r.saves.get(1).game_state.album, album);
});

test('guest migration metadata alone cannot bypass the new-account stamp limit', async () => {
  const r = route();
  const state = { fish: 42, guestMigrationId: 'not-an-import', album: albumAt('2026-10-22', 10) };
  assert.equal((await r.request(1, state)).code, 400);
  assert.equal(r.saves.get(1).revision, 0);
  assert.equal(r.receipts.size, 0);
});

test('imported albums keep daily progress and immutable history checks on subsequent saves', async () => {
  const r = route(Date.parse('2026-10-22T12:00:00Z'));
  const album = albumAt('2026-10-22', 4, { '2026-09': 10 });
  assert.equal((await r.request(1, { album, guestMigrationId: 'daily-album' }, 0, 'daily-album')).code, 200);
  assert.equal((await r.request(1, { album: { ...album, stamps: 5 } }, 1)).code, 400);
  const next = albumAt('2026-10-23', 5, album.history);
  assert.equal((await r.request(1, { album: next }, 1)).code, 400);
  r.setNow(next.lastStampAt);
  assert.equal((await r.request(1, { album: next }, 1)).code, 200);
  const stored = structuredClone(r.saves.get(1));
  assert.equal((await r.request(1, { album: { ...next, history: { ...next.history, '2026-08': 10 } } }, 2)).code, 400);
  assert.equal((await r.request(1, { album: { ...next, stamps: 10 }, guestMigrationId: 'another-import' }, 2, 'another-import')).code, 409);
  assert.deepEqual(r.saves.get(1), stored);
  assert.equal(r.receipts.size, 1);
});

test('backdated requests cannot simulate elapsed days against an unchanged server clock', async () => {
  const r = route(Date.parse('2026-10-22T12:00:00Z'));
  assert.equal((await r.request(1, { album: albumAt('2026-10-01') })).code, 200);
  assert.equal((await r.request(1, { album: albumAt('2026-10-02', 2) }, 1)).code, 400);
  assert.equal((await r.request(1, { album: albumAt('2026-10-22', 2) }, 1)).code, 200);
  assert.equal((await r.request(1, { album: albumAt('2026-10-22', 3) }, 2)).code, 400);
});
