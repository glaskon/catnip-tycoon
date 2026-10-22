const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the real handler with an isolated environment and database test double.
function route(flag, rows = [], failure = false) {
  let get;
  const queries = [];
  const router = { get(url, handler) { assert.equal(url, '/'); get = handler; } };
  const env = flag === undefined ? {} : { LEADERBOARD_ENABLED: flag };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../server/routes/leaderboard.js'), 'utf8'), {
    process: { env }, module: {}, console: { error() {} },
    require(name) {
      if (name === 'express') return { Router: () => router };
      if (name === '../db') return { pool: { async query(sql) {
        queries.push(sql);
        if (failure) throw new Error('database unavailable');
        return { rows };
      } } };
      throw new Error('Unexpected require: ' + name);
    },
  });
  return {
    queries,
    async request() {
      const result = { status: 200 };
      const res = {
        status(code) { result.status = code; return this; },
        json(body) { result.body = JSON.parse(JSON.stringify(body)); return this; },
      };
      await get({ method: 'GET', url: '/api/leaderboard' }, res);
      return result;
    },
  };
}

const rows = [
  { user_id: 7, email: 'lukasz@example.com', fish_earned: '123456.5', prestige: '200', fps: '42.5' },
  { user_id: 8, email: 'tester@example.org', fish_earned: '100', prestige: null, fps: null },
];

test('leaderboard defaults to 404 without querying or exposing any player data', async () => {
  const r = route(undefined, rows, true);
  assert.deepEqual(await r.request(), { status: 404, body: { error: 'Not found' } });
  assert.equal(r.queries.length, 0);
});

test('only the explicit true flag enables the leaderboard', async () => {
  for (const flag of ['', 'false', '0', '1', 'TRUE', ' true ']) {
    const r = route(flag, rows);
    assert.deepEqual(await r.request(), { status: 404, body: { error: 'Not found' } });
    assert.equal(r.queries.length, 0);
  }
});

test('enabled leaderboard retains the top-50 query and original response mapping', async () => {
  const r = route('true', rows);
  assert.deepEqual(await r.request(), { status: 200, body: { leaderboard: [
    { rank: 1, userId: 7, email: 'lu***@example.com', totalFishEarned: 123456.5, prestige: 200, fps: 42.5 },
    { rank: 2, userId: 8, email: 'te***@example.org', totalFishEarned: 100, prestige: 0, fps: 0 },
  ] } });
  assert.equal(r.queries.length, 1);
  assert.match(r.queries[0], /JOIN users u ON u.id = s.user_id/);
  assert.match(r.queries[0], /ORDER BY \(s.game_state->>'totalFishEarned'\)::numeric DESC\s+LIMIT 50/);
  assert.deepEqual(await route('true').request(), { status: 200, body: { leaderboard: [] } });
});

test('enabled leaderboard retains its database error response', async () => {
  assert.deepEqual(await route('true', [], true).request(), {
    status: 500, body: { error: 'Failed to fetch leaderboard' },
  });
});

test('client has no active leaderboard navigation or panel and retains restoration code', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const activeHTML = source.replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(activeHTML, /data-panel=["']leaderboard["']/);
  assert.doesNotMatch(activeHTML, /id=["'](?:panel-leaderboard|leaderboardContent)["']/);
  assert.doesNotMatch(activeHTML, /(?:href|onclick)=["'][^"']*leaderboard/i);
  assert.match(activeHTML, /data-panel="cats"/);
  assert.match(activeHTML, /id="panel-prestige"/);
  assert.match(source, /data-panel="leaderboard"/); // Preserved in a comment.
  assert.match(source, /id="panel-leaderboard"/);
  assert.match(activeHTML, /src="\/js\/leaderboard.js"/);
  const main = fs.readFileSync(path.join(__dirname, '../public/js/main.js'), 'utf8');
  assert.match(main, /querySelectorAll\('\.nav-btn\[data-panel\]'\)/);
  assert.doesNotMatch(main, /switchPanel\(['"]leaderboard['"]\)/);
  const server = fs.readFileSync(path.join(__dirname, '../server/index.js'), 'utf8');
  assert.match(server, /app.use\('\/api\/leaderboard', leaderboardRoutes\)/);
});
