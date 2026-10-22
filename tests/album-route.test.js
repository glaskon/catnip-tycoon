const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JWT_SECRET = 'album-route-test-secret';

// No real npm dependencies are installed for this test run (consistent with
// save-route.test.js, which never loads the real pg/express either) — a
// minimal stand-in for the two jsonwebtoken calls album.js actually makes.
const jwt = {
  sign(payload, secret) { return Buffer.from(JSON.stringify({ payload, secret })).toString('base64'); },
  verify(token, secret) {
    let decoded;
    try { decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8')); } catch { throw new Error('invalid token'); }
    if (decoded.secret !== secret) throw new Error('invalid signature');
    return decoded.payload;
  },
};

// Exercises the actual server/routes/album.js source against a scripted
// Postgres double, the same technique tests/save-route.test.js already uses
// for server/routes/save.js.
function route(now = Date.parse('2026-10-22T12:00:00Z')) {
  const users = new Map([[1, { token_version: 0 }], [2, { token_version: 0 }]]);
  const saves = new Map([[1, { game_state: {}, revision: 0 }]]);
  const guestAlbums = new Map(); // device_id -> {time_zone, month, stamps, last_stamp_day, history}
  let get, post, before;

  const pool = {
    async query(sql, args = []) {
      if (sql.startsWith('SELECT token_version FROM users')) {
        return { rows: users.has(args[0]) ? [{ token_version: users.get(args[0]).token_version }] : [] };
      }
      if (sql.startsWith('SELECT game_state FROM saves')) {
        return { rows: saves.has(args[0]) ? [{ game_state: structuredClone(saves.get(args[0]).game_state) }] : [] };
      }
      if (sql.startsWith('SELECT time_zone, month, stamps, last_stamp_day, history FROM guest_albums WHERE device_id = $1') && !sql.includes('FOR UPDATE')) {
        return { rows: guestAlbums.has(args[0]) ? [structuredClone(guestAlbums.get(args[0]))] : [] };
      }
      throw new Error('Unexpected pool SQL: ' + sql);
    },
    async connect() {
      return {
        release() {},
        async query(sql, args = []) {
          if (sql === 'BEGIN') { before = structuredClone({ saves, guestAlbums }); return { rows: [] }; }
          if (sql === 'COMMIT') return { rows: [] };
          if (sql === 'ROLLBACK') {
            saves.clear(); guestAlbums.clear();
            before.saves.forEach((v, k) => saves.set(k, v));
            before.guestAlbums.forEach((v, k) => guestAlbums.set(k, v));
            return { rows: [] };
          }
          if (sql.startsWith('SELECT id FROM users')) return { rows: [{ id: args[0] }] };
          if (sql.startsWith('SELECT game_state, revision FROM saves')) {
            return { rows: saves.has(args[0]) ? [structuredClone(saves.get(args[0]))] : [] };
          }
          if (sql.startsWith('UPDATE saves SET game_state')) {
            const prev = saves.get(args[1]);
            saves.set(args[1], { game_state: JSON.parse(args[0]), revision: prev.revision + 1 });
            return { rows: [] };
          }
          if (sql.startsWith('INSERT INTO guest_albums')) {
            if (!guestAlbums.has(args[0])) {
              guestAlbums.set(args[0], { time_zone: args[1], month: '', stamps: 0, last_stamp_day: '', history: {} });
            }
            return { rows: [] };
          }
          if (sql.startsWith('SELECT time_zone, month, stamps, last_stamp_day, history FROM guest_albums') && sql.includes('FOR UPDATE')) {
            return { rows: [structuredClone(guestAlbums.get(args[0]))] };
          }
          if (sql.startsWith('UPDATE guest_albums SET')) {
            guestAlbums.set(args[5], { time_zone: args[0], month: args[1], stamps: args[2], last_stamp_day: args[3], history: JSON.parse(args[4]) });
            return { rows: [] };
          }
          throw new Error('Unexpected client SQL: ' + sql);
        },
      };
    },
  };

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/routes/album.js'), 'utf8'), {
    console, Date: class extends Date { static now() { return now; } }, module: {}, require(name) {
      if (name === 'express') return { Router: () => ({ get(p, h) { get = h; }, post(p, h) { post = h; } }) };
      if (name === 'jsonwebtoken') return jwt;
      if (name === '../db') return { pool };
      if (name === '../auth') return { JWT_SECRET };
      if (name === '../album-logic') return require('../server/album-logic');
      throw new Error('Unexpected dependency: ' + name);
    },
  });

  function token(userId, tv = 0) {
    return jwt.sign({ id: userId, tv }, JWT_SECRET, { algorithm: 'HS256' });
  }

  // Route handlers run inside a separate vm context/realm, so a plain object
  // built in there (toResponse's return value) has a different Object
  // prototype than literals in this file — assert.deepEqual would otherwise
  // report "same structure but not reference-equal". Round-tripping through
  // JSON moves the response back into this realm, same as a real HTTP call.
  function makeRes() {
    return { code: 200, status(c) { this.code = c; return this; }, json(b) { this.body = JSON.parse(JSON.stringify(b)); } };
  }

  return {
    saves, guestAlbums, users,
    setNow(value) { now = value; },
    seedGuestAlbum(deviceId, album) {
      guestAlbums.set(deviceId, { time_zone: album.timeZone, month: album.month, stamps: album.stamps,
        last_stamp_day: album.lastStampDay, history: album.history });
    },
    token,
    async getAsUser(userId, tv) {
      const res = makeRes();
      await get({ method: 'GET', headers: { authorization: 'Bearer ' + token(userId, tv) }, query: {} }, res);
      return res;
    },
    async getAsDevice(deviceId) {
      const res = makeRes();
      await get({ method: 'GET', headers: {}, query: { device_id: deviceId } }, res);
      return res;
    },
    async stampAsUser(userId, timeZone) {
      const res = makeRes();
      await post({ method: 'POST', headers: { authorization: 'Bearer ' + token(userId) }, body: { timeZone } }, res);
      return res;
    },
    async stampAsDevice(deviceId, timeZone) {
      const res = makeRes();
      await post({ method: 'POST', headers: {}, body: { device_id: deviceId, timeZone } }, res);
      return res;
    },
    async getRaw(headers, query) {
      const res = makeRes();
      await get({ method: 'GET', headers, query }, res);
      return res;
    },
  };
}

test('GET without a token or device_id is rejected; neither is required if the other is present', async () => {
  const r = route();
  assert.equal((await r.getRaw({}, {})).code, 401);
  assert.equal((await r.getRaw({}, { device_id: 'only-device' })).code, 200);
  assert.equal((await r.getAsUser(1)).code, 200);
});

test('a brand new identity has an empty current-month album and GET never writes', async () => {
  const r = route(Date.parse('2026-10-22T12:00:00Z'));
  const res = await r.getAsDevice('device-1');
  assert.deepEqual(res.body, { month: '2026-10', stamps: 0, lastStampDay: '', history: {}, timeZone: null });
  assert.equal(r.guestAlbums.size, 0);
  const userRes = await r.getAsUser(1);
  assert.deepEqual(userRes.body, { month: '2026-10', stamps: 0, lastStampDay: '', history: {}, timeZone: null });
});

test('one stamp per day for a guest device; a second request the same day is a no-op', async () => {
  const r = route(Date.parse('2026-10-22T12:00:00Z'));
  const first = await r.stampAsDevice('device-2', 'Europe/Warsaw');
  assert.equal(first.code, 200);
  assert.deepEqual(first.body, { month: '2026-10', stamps: 1, lastStampDay: '2026-10-22', history: {}, timeZone: 'Europe/Warsaw' });
  const again = await r.stampAsDevice('device-2', 'Europe/Warsaw');
  assert.deepEqual(again.body, first.body);
  // A later-claimed zone change is ignored; the first zone is sticky.
  const differentZone = await r.stampAsDevice('device-2', 'Pacific/Honolulu');
  assert.equal(differentZone.body.timeZone, 'Europe/Warsaw');
});

test('a guest device accrues stamps day by day, rolls month over, and caps at ten', async () => {
  const r = route(Date.parse('2026-10-01T12:00:00Z'));
  for (let day = 1; day <= 10; day++) {
    r.setNow(Date.parse(`2026-10-${String(day).padStart(2, '0')}T12:00:00Z`));
    const res = await r.stampAsDevice('device-3', 'UTC');
    assert.equal(res.body.stamps, Math.min(day, 10));
  }
  assert.equal((await r.getAsDevice('device-3')).body.stamps, 10);
  r.setNow(Date.parse('2026-11-01T12:00:00Z'));
  const rollover = await r.stampAsDevice('device-3', 'UTC');
  assert.equal(rollover.body.stamps, 1);
  assert.equal(rollover.body.month, '2026-11');
  assert.deepEqual(rollover.body.history, { '2026-10': 10 });
});

test('logged-in users stamp their own saved album and bump its revision', async () => {
  const r = route(Date.parse('2026-10-22T12:00:00Z'));
  const res = await r.stampAsUser(1, 'UTC');
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { month: '2026-10', stamps: 1, lastStampDay: '2026-10-22', history: {}, timeZone: 'UTC' });
  assert.equal(r.saves.get(1).revision, 1);
  assert.deepEqual(r.saves.get(1).game_state.album,
    { timeZone: 'UTC', month: '2026-10', stamps: 1, lastDay: '2026-10-22', lastStampAt: Date.parse('2026-10-22T12:00:00Z'), history: {} });
  const sameDay = await r.stampAsUser(1, 'UTC');
  assert.equal(sameDay.body.stamps, 1);
  assert.equal(r.saves.get(1).revision, 1); // no-op does not spend a revision either
});

test('an invalid or stale token falls back to the device_id instead of 401ing outright', async () => {
  const r = route();
  const garbage = await r.getRaw({ authorization: 'Bearer not-a-real-token' }, { device_id: 'fallback-device' });
  assert.equal(garbage.code, 200);
  const staleVersion = await r.getRaw({ authorization: 'Bearer ' + r.token(1, 99) }, { device_id: 'fallback-device-2' });
  assert.equal(staleVersion.code, 200);
  // But with neither a usable token nor a device_id, it is unauthenticated.
  assert.equal((await r.getRaw({ authorization: 'Bearer not-a-real-token' }, {})).code, 401);
});
