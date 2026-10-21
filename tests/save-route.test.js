const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');

// Exercise the actual route and validator. The transactional store is a test
// double; PostgreSQL locking and DDL still need an integration environment.
function route() {
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
    console, module: {}, require(name) {
      if (name === 'express') return { Router: () => ({ get() {}, post(p, auth, handler) { post = handler; } }) };
      if (name === '../db') return { pool: { connect: async () => client } };
      if (name === '../auth') return { authMiddleware() {} };
      if (name === '../../public/js/save-progress') return require('../public/js/save-progress');
      throw new Error('Unexpected dependency');
    },
  });
  return {
    saves, receipts,
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
  assert.equal((await r.request(1, { ...state, activeBoosts: Array(21).fill(state.activeBoosts[0]) }, 1)).code, 400);
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
