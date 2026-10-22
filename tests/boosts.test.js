const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');

const NOW = 1800000000000;
function setup() {
  const c = createGame();
  c.now = NOW;
  c.Date = class extends Date { static now() { return c.now; } };
  c.document = { getElementById: () => null };
  c.i18n = { t: key => key };
  for (const file of ['shop', 'prestige', 'api']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file + '.js'), 'utf8'), c);
  }
  c.game.elixirs = 100;
  return c;
}
function advance(c, ms) {
  c.now += ms;
  c.recomputeBoostedValues();
}
const cases = [
  { kind: 'speed', paid: 2, strong: 10, duration: 30000, value: c => c.game.speedMultiplier },
  { kind: 'click', paid: 3, strong: 5, duration: 120000, value: c => c.game.fishPerClick },
];
for (const { kind, paid, strong, duration, value } of cases) {
  test(`${kind}: shop then elixir expires independently and returns to the paid multiplier`, () => {
    const c = setup();
    c.applyShopItem(`boost_${kind}_1h`);
    advance(c, 300000);
    assert.equal(c.useElixirBoost(kind), true);
    assert.equal(c.game.activeBoosts.length, 2);
    assert.equal(value(c), strong);
    advance(c, duration - 1);
    assert.equal(value(c), strong);
    advance(c, 1001);
    assert.equal(value(c), paid);
    assert.equal(c.game.activeBoosts[0].expiresAt, NOW + 3600000);
    assert.equal(c.game.activeBoosts[0].maxDurationMs, 3600000);
  });

  test(`${kind}: elixir then shop cannot extend the stronger multiplier`, () => {
    const c = setup();
    c.useElixirBoost(kind);
    advance(c, 1000);
    c.applyShopItem(`boost_${kind}_1h`);
    assert.equal(value(c), strong);
    assert.equal(c.game.activeBoosts[0].expiresAt, NOW + duration);
    advance(c, duration);
    assert.equal(value(c), paid);
    assert.equal(c.game.activeBoosts[0].expiresAt, NOW + 1000 + 3600000);
  });

  test(`${kind}: a shop purchase lasts a full hour`, () => {
    const c = setup();
    c.applyShopItem(`boost_${kind}_1h`);
    advance(c, 3599999);
    assert.equal(value(c), paid);
    advance(c, 1);
    assert.equal(value(c), 1);
  });
}

test('legacy hour boost without maxDurationMs preserves its remaining time after restore', () => {
  const c = setup();
  c.applyGameState({ activeBoosts: [{ kind: 'speed', mult: 2, remainingMs: 3300000 }] }, NOW);
  assert.equal(c.game.speedMultiplier, 2);
  assert.equal(c.game.activeBoosts[0].maxDurationMs, 3300000);
  advance(c, 3299999);
  assert.equal(c.game.speedMultiplier, 2);
  advance(c, 1);
  assert.equal(c.game.speedMultiplier, 1);
});

test('recomputation never moves an activation expiry or copies another duration', () => {
  const c = setup();
  c.applyBoost('production', 10, 30000);
  c.applyBoost('production', 2, 3600000);
  const before = JSON.parse(JSON.stringify(c.game.activeBoosts));
  for (let i = 0; i < 20; i++) advance(c, 1000);
  assert.deepEqual(JSON.parse(JSON.stringify(c.game.activeBoosts)), before);
  assert.equal(c.game.productionMultiplier, 10);
  advance(c, 11000);
  assert.equal(c.game.productionMultiplier, 2);
});

test('local save retains maxDurationMs while actual POST sends exactly three boost keys', async () => {
  const c = setup();
  c.applyShopItem('boost_speed_1h');
  c.useElixirBoost('speed');
  const state = c.buildSaveState();
  c.AbortSignal = AbortSignal;
  let sent;
  c.fetch = async (url, options) => {
    assert.equal(url, '/api/save');
    sent = JSON.parse(options.body).game_state;
    return { ok: true, json: async () => ({ revision: 1 }) };
  };
  await c.api.saveGameState(state);
  assert.equal(state.activeBoosts[0].maxDurationMs, 3600000);
  assert.equal(state.activeBoosts[1].maxDurationMs, 30000);
  for (const b of sent.activeBoosts) assert.deepEqual(Object.keys(b).sort(), ['kind', 'mult', 'remainingMs']);
  const clone = setup();
  clone.applyGameState(sent, NOW);
  advance(clone, 31000);
  assert.equal(clone.game.speedMultiplier, 2);
  assert.equal(clone.game.activeBoosts[0].expiresAt, NOW + 3600000);
});

test('two identical elixirs queue sixty seconds without changing the first expiry', () => {
  const c = setup();
  c.useElixirBoost('speed');
  const firstExpiry = c.game.activeBoosts[0].expiresAt;
  c.useElixirBoost('speed');
  assert.equal(c.game.activeBoosts.length, 2);
  assert.equal(c.game.activeBoosts[0].expiresAt, firstExpiry);
  assert.equal(c.game.activeBoosts[1].expiresAt - firstExpiry, 30000);
  assert.equal(c.game.activeBoosts[1].maxDurationMs, 30000);
  advance(c, 31000);
  assert.equal(c.game.speedMultiplier, 10);
  advance(c, 28999);
  assert.equal(c.game.speedMultiplier, 10);
  advance(c, 1);
  assert.equal(c.game.speedMultiplier, 1);
});

test('a shop hour cannot increase the identical elixir queue cap', () => {
  const c = setup();
  c.applyShopItem('boost_speed_1h');
  c.game.elixirs = 1000;
  for (let i = 0; i < 20; i++) c.useElixirBoost('speed');
  assert.equal(c.game.activeBoosts.length, 11);
  let previousExpiry = NOW;
  for (const boost of c.game.activeBoosts.slice(1)) {
    assert.ok(boost.expiresAt - previousExpiry <= boost.maxDurationMs);
    assert.ok(boost.expiresAt <= NOW + 300000);
    previousExpiry = boost.expiresAt;
  }
  advance(c, 300000);
  assert.equal(c.game.speedMultiplier, 2);
  assert.equal(c.game.activeBoosts[0].expiresAt, NOW + 3600000);
});

test('server-style restore preserves the elixir queue when another elixir is activated', () => {
  const c = setup();
  c.applyGameState({ elixirs: 5, activeBoosts: [
    { kind: 'speed', mult: 10, remainingMs: 20000 },
    { kind: 'speed', mult: 10, remainingMs: 50000 },
    { kind: 'speed', mult: 2, remainingMs: 3500000 },
  ] }, NOW);
  c.useElixirBoost('speed');
  assert.equal(c.game.activeBoosts[3].expiresAt, NOW + 80000);
  advance(c, 80000);
  assert.equal(c.game.speedMultiplier, 2);
});
