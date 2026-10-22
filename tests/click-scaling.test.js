const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('./game-harness');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const NOW = 1800000000000;
function setup() {
  const c = createGame();
  c.Date = class extends Date { static now() { return NOW; } };
  c.document = { getElementById: () => null };
  c.sound = { click() {}, buy() {} };
  c.checkAchievements = () => {};
  return c;
}
function own(c, id, level = 1) {
  const upg = c.game.upgrades.find(u => u.id === id);
  if (upg.type === 'stackable') upg.level = level;
  else upg.purchased = true;
}
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`); }

test('manual click gains about 0.03 at R₀=5 and scales with production and click levels', () => {
  const c = setup();
  assert.equal(c.calculateClickValue(), 1);
  c.game.cats[0].count = 10;
  assert.equal(c.getBaseFishRate(), 5);
  assert.equal(c.calculateClickValue(), 1.03);
  c.clickCat();
  assert.equal(c.game.fish, 1.03);
  c.game.cats[0].count = 2000;
  assert.equal(c.calculateClickValue(), 6);
  own(c, 'fishclick', 10);
  assert.equal(c.calculateClickValue(), 16.25);
  c.game.cats[0].count = 4000;
  assert.equal(c.calculateClickValue(), 21.5);
});

test('bowl multiplies manual click once even with an autoclicker in R₀', () => {
  const c = setup();
  c.game.cats[0].count = 2000;
  own(c, 'fishclick', 3);
  own(c, 'autoclicker');
  const baseRate = c.getBaseFishRate();
  assert.equal(baseRate, 1004);
  const expected = (1 + 3 + 0.005 * baseRate * (1 + 0.005 * 3)) * 2;
  own(c, 'miska');
  assert.equal(c.getBaseFishRate(), baseRate);
  assert.equal(c.calculateClickValue(), Math.round(expected * 100) / 100);
  assert.equal(c.calculateClickValue('autoclicker'), 8);
  assert.equal(c.game.fishPerClick, 1);
});

test('R₀ shares permanent cat calculations and excludes prestige, pet and boosters', () => {
  const c = setup();
  c.game.cats[0].count = 20;
  own(c, 'karma');
  own(c, 'catspeed', 5);
  own(c, 'autoclicker');
  own(c, 'fishclick', 2);
  assert.equal(c.getBaseCatProduction(), 30);
  assert.equal(c.getBaseFishRate(), 33);
  c.game.prestigeCount = 100;
  c.catLifeProductionMultiplier = () => 1.1;
  c.game._quantumActive = true;
  c.applyBoost('production', 10, 30000);
  c.applyBoost('speed', 10, 30000);
  c.applyBoost('click', 5, 30000);
  c.recalcFPS();
  assert.equal(c.getBaseFishRate(), 33);
  assert.ok(c.game.fishPerSecond > 30);
  // The existing click booster still affects the base 1, not R₀.
  assert.equal(c.calculateClickValue(), 2150); // Round (7 + 0.16665) × 300 once.
});

test('live and offline income share prestige-scaled autoclicks and unchanged cat production', () => {
  const c = setup();
  c.game.cats[0].count = 10;
  for (const id of ['karma', 'buda', 'megakarma', 'catnipmastery', 'autoclicker', 'miska', 'luckypaw']) own(c, id);
  own(c, 'catspeed', 2);
  own(c, 'fishclick', 4);
  c.game.prestigeCount = 10;
  c.catLifeProductionMultiplier = () => 1.1;
  c.applyBoost('production', 10, 30000);
  c.applyBoost('speed', 2, 30000);
  c.applyBoost('click', 3, 30000);
  c.recalcFPS();
  close(c.game.fishPerSecond, 4158);
  assert.equal(c.calculateClickValue('autoclicker'), 31.5);
  assert.equal(c.calculateClickValue(), 35.48); // Round the full raw value ×2.1 at the end.
  close(c.getFishIncomeRate(), 8379);
  c.game.isReady = true;
  c.game.lastTick = NOW - 1000;
  c.gameLoop();
  close(c.game.fish, 8379);
  const state = c.buildSaveState();
  state.savedAt = NOW - 1000;
  const offline = setup();
  offline.catLifeProductionMultiplier = () => 1.1;
  offline.restoreWithOffline(state);
  close(offline.game.fish - state.fish, 8379);
});

test('legacy saves keep exact click behavior, base fishPerClick and boosts through migration and reload', () => {
  const c = setup();
  const legacy = {
    fishPerClick: 1.25, cats: [{ id: 'dachowiec', count: 10 }],
    upgrades: [{ id: 'fishclick', level: 3 }, { id: 'miska', purchased: true },
      { id: 'autoclicker', purchased: true }, { id: 'luckypaw', purchased: true }],
    activeBoosts: [{ kind: 'click', mult: 5, remainingMs: 30000 }],
  };
  c.applyGameState(legacy);
  assert.equal(c.calculateClickValue(), 19.5);
  assert.equal(c.calculateClickValue('autoclicker'), 19.5);
  assert.equal(c.game.clickScalingBaseline, c.getBaseFishRate());
  const state = c.buildSaveState();
  assert.equal(state.fishPerClick, 1.25);
  assert.ok(state.clickScalingBaseline > 0);
  const restored = setup();
  restored.applyGameState(state);
  assert.equal(restored.calculateClickValue(), 19.5);
  restored.recomputeBoostedValues(NOW + 30001, true);
  assert.equal(restored.calculateClickValue(), 9.5);
});

test('legacy baseline permits future growth and persists without swallowing gains on reload', () => {
  const c = setup();
  c.applyGameState({ fishPerClick: 1, cats: [{ id: 'dachowiec', count: 2000 }] });
  assert.equal(c.calculateClickValue(), 1);
  assert.equal(c.game.clickScalingBaseline, 1000);
  c.game.cats[0].count = 4000;
  assert.equal(c.calculateClickValue(), 6);
  const restored = setup();
  restored.applyGameState(c.buildSaveState());
  assert.equal(restored.calculateClickValue(), 6);
  assert.equal(restored.game.clickScalingBaseline, 1000);
  restored.game.totalFishEarned = 1e7;
  assert.equal(restored.prestige(), true);
  assert.equal(restored.game.clickScalingBaseline, 0);
});

test('new snapshots retain full scaling and malformed numeric fields use safe defaults', () => {
  const c = setup();
  c.game.cats[0].count = 2000;
  const state = c.buildSaveState();
  assert.equal(state.fishPerClick, 1);
  assert.equal(state.clickScalingBaseline, 0);
  c.applyGameState(state);
  assert.equal(c.calculateClickValue(), 6);
  for (const invalid of [-1, Infinity, NaN, '5']) {
    c.applyGameState({ ...state, fishPerClick: invalid, clickScalingBaseline: invalid });
    assert.equal(c.game.fishPerClick, 1);
    assert.equal(c.game.clickScalingBaseline, 1000);
    assert.equal(c.calculateClickValue(), 1);
  }
  c.applyGameState({});
  assert.equal(c.game.clickScalingBaseline, 0);
  assert.equal(c.calculateClickValue(), 1);
});

test('purchase previews include scaling gains without feeding them into passive production', () => {
  const c = setup();
  c.game.cats[0].count = 2000;
  c.game.fish = 1e9;
  own(c, 'autoclicker');
  const index = c.game.upgrades.findIndex(u => u.id === 'fishclick');
  const preview = c.previewPurchase('upgrade', index);
  assert.equal(preview.before.fish, 1001);
  assert.equal(preview.after.fish, 1002);
  assert.ok(preview.after.click > preview.before.click + 1);
  assert.equal(c.buyUpgrade(index), true);
  assert.equal(c.calculateClickValue(), preview.after.click);
  assert.equal(c.getFishIncomeRate(), preview.after.fish);
});

test('five manual clicks per second keep the same income share at prestige 0, 20, 100 and 200', () => {
  const c = setup();
  c.game.cats.find(cat => cat.id === 'kotfeniks').count = 1;
  own(c, 'miska');
  const shares = [];
  for (const [count, expectedClick] of [[0, 12502], [20, 27504.4], [100, 3750600], [200, 5000800]]) {
    c.game.prestigeCount = count;
    c.recalcFPS();
    assert.equal(c.calculateClickValue(), expectedClick);
    const active = 5 * c.calculateClickValue();
    const share = 100 * active / (c.getFishIncomeRate() + active);
    assert.ok(share >= 2 && share <= 8, `count=${count}: ${share}%`);
    shares.push(share);
  }
  for (const share of shares) close(share, shares[0]);
  c.game.prestigeMultiplier = 3;
  c.recalcFPS();
  assert.equal(c.calculateClickValue(), 15002400);
  const active = 5 * c.calculateClickValue();
  close(100 * active / (c.getFishIncomeRate() + active), shares[0]);
});

test('prestige scales bowl, Lucky Paw and click boosts once without feeding back into R₀', () => {
  const c = setup();
  c.game.cats[0].count = 2000;
  for (const id of ['miska', 'luckypaw', 'autoclicker']) own(c, id);
  own(c, 'fishclick', 3);
  c.applyBoost('click', 5, 30000);
  assert.equal(c.getBaseFishRate(), 1204); // 1000 cats/s + 4 base click + 200 Lucky Paw
  const manual = Math.round(((5 + 3 + 0.005 * 1204 * 1.015) * 2 + 200) * 100) / 100;
  assert.equal(c.calculateClickValue(), manual); // Exact legacy result at prestige 0.
  assert.equal(c.calculateClickValue('autoclicker'), 216);
  c.game.prestigeCount = 200;
  c.game.prestigeMultiplier = 3;
  assert.equal(c.getBaseFishRate(), 1204);
  assert.equal(c.calculateClickValue(), 273864.72);
  assert.equal(c.calculateClickValue('autoclicker'), 259200);
  c.recomputeBoostedValues(NOW + 30001, true);
  assert.equal(c.calculateClickValue(), 264264.72);
  assert.equal(c.calculateClickValue('autoclicker'), 249600);
});

test('happy pet keeps its production bonus without duplicating prestige on clicks', () => {
  const c = setup();
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/catlife.js'), 'utf8'), c);
  c.game.prestigeCount = 200;
  c.game.cats.find(cat => cat.id === 'kotfeniks').count = 1;
  own(c, 'miska');
  c.game.catlife = { hunger: 100, lastUpdate: NOW, fedCount: 0 };
  c.recalcFPS();
  assert.equal(c.game.fishPerSecond, 550000000);
  assert.equal(c.calculateClickValue(), 5000800);
  const active = 5 * c.calculateClickValue();
  assert.ok(100 * active / (c.getFishIncomeRate() + active) >= 2);
  c.game.catlife.hunger = 0;
  c.recalcFPS();
  assert.equal(c.game.fishPerSecond, 500000000);
  assert.equal(c.calculateClickValue(), 5000800);
});

test('manual click pays the prestige-scaled value and critical multiplier exactly once', () => {
  const c = setup();
  c.game.prestigeCount = 200;
  c.game.prestigeMultiplier = 3;
  c.game.cats[0].count = 2000;
  own(c, 'miska');
  assert.equal(c.calculateClickValue(), 14400);
  c.clickCat();
  assert.equal(c.game.fish, 14400);
  own(c, 'clickcrit');
  vm.runInContext('Math.random = () => 0.05', c);
  c.sound.crit = () => {};
  c.screenShake = () => {};
  c.clickCat();
  assert.equal(c.game.fish, 158400);
});
