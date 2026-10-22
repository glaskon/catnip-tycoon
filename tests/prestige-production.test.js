const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');

// Frozen pre-floor formula, including the original evaluation order.
function oldRequirement(count) {
  const next = count + 1;
  if (count < 100) return 10000000 * next * (next > 21 ? next / 21 : 1);
  const ascension = 1 + Math.floor(count / 10) * 0.05;
  return 540000000000 * (ascension / 1.5) * (1 + (count - 100) / 200);
}

function colony(count = 200, multiplier = 3, phoenixes = 1, upgraded = true) {
  const c = createGame();
  c.Date = class extends Date { static now() { return 1800000000000; } };
  c.checkAchievements = () => {};
  c.sound = { buy() {} };
  c.game.prestigeCount = count;
  c.game.prestigeMultiplier = multiplier;
  c.game.cats.find(cat => cat.id === 'kotfeniks').count = phoenixes;
  if (upgraded) {
    for (const id of ['karma', 'megakarma', 'catnipmastery', 'buda']) {
      c.game.upgrades.find(u => u.id === id).purchased = true;
    }
  }
  c.recalcFPS();
  return c;
}

function loadPet(c) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/catlife.js'), 'utf8'), c);
  c.game.catlife = { hunger: 0, lastUpdate: c.Date.now(), fedCount: 0 };
}

test('strong colonies at 200/500 take 12/24 minutes at x1 and x3, also within 5–30 with a happy pet', () => {
  for (const count of [200, 500]) {
    for (const multiplier of [1, 3]) {
      for (const phoenixes of [1, 5, 20, 100]) {
        const c = colony(count, multiplier, phoenixes);
        const requirement = c.getCatnipNeeded();
        assert.ok(requirement > oldRequirement(count));
        const seconds = requirement / c.game.fishPerSecond;
        assert.ok(Math.abs(seconds - (count === 200 ? 720 : 1440)) < 1e-8);
        assert.ok(seconds >= 300 && seconds <= 1800);
        loadPet(c);
        c.game.catlife.hunger = 100;
        c.recalcFPS();
        assert.equal(c.getCatnipNeeded(), requirement);
        const happySeconds = requirement / c.game.fishPerSecond;
        assert.ok(happySeconds >= 300 && happySeconds <= 1800);
      }
    }
  }
});

test('unupgraded reference keeps the exact old requirement at every depth through 10000', () => {
  const c = colony(100, 1, 1, false);
  for (const multiplier of [1, 3]) {
    c.game.prestigeMultiplier = multiplier;
    for (let count = 100; count <= 10000; count++) {
      c.game.prestigeCount = count;
      assert.equal(c.getCatnipNeeded(), oldRequirement(count), `count=${count}, x${multiplier}`);
    }
    for (const [count, secondsAtOne] of [[100, 1440], [200, 2160], [500, 4320]]) {
      c.game.prestigeCount = count;
      c.recalcFPS();
      assert.equal(c.getCatnipNeeded() / c.game.fishPerSecond, secondsAtOne / multiplier);
    }
  }
});

test('all counts below 100 ignore even a strong colony; zero cats always use only the old requirement', () => {
  const c = colony(0, 3, 100);
  for (let count = 0; count < 100; count++) {
    c.game.prestigeCount = count;
    assert.equal(c.getCatnipNeeded(), oldRequirement(count));
  }
  c.game.prestigeCount = 24;
  assert.equal(Math.round(c.getCatnipNeeded()), 297619048);
  c.game.prestigeCount = 99;
  assert.equal(Math.round(c.getCatnipNeeded()), 4761904762);
  c.game.cats.forEach(cat => { cat.count = 0; });
  for (const count of [0, 99, 100, 200, 500]) {
    c.game.prestigeCount = count;
    assert.equal(c.getBaseCatProduction(), 0);
    assert.equal(c.getCatnipNeeded(), oldRequirement(count));
  }
});

test('elixir, shop boost, quantum karma, happy pet, clicks and expiry cannot change the floor', () => {
  for (const multiplier of [1, 3]) {
    for (const mode of ['elixir', 'shop', 'quantum', 'pet', 'click', 'all']) {
      const c = colony(200, multiplier);
      loadPet(c);
      const before = c.getCatnipNeeded();
      const fps = c.game.fishPerSecond;
      assert.equal(before, 10800000000000 * multiplier);
      if (mode === 'elixir' || mode === 'all') c.applyBoost('production', 10, 30000);
      if (mode === 'shop' || mode === 'all') c.applyBoost('production', 2, 3600000);
      if (mode === 'quantum' || mode === 'all') c.game._quantumActive = true;
      if (mode === 'pet' || mode === 'all') c.game.catlife.hunger = 100;
      if (mode === 'click' || mode === 'all') {
        c.applyBoost('click', 10, 30000);
        c.applyBoost('speed', 2, 3600000);
        for (const id of ['autoclicker', 'miska', 'clickcrit']) c.game.upgrades.find(u => u.id === id).purchased = true;
        c.game.upgrades.find(u => u.id === 'fishclick').level = 100;
      }
      c.recalcFPS();
      if (mode !== 'click') assert.ok(c.game.fishPerSecond > fps, mode);
      assert.equal(c.getCatnipNeeded(), before, mode);
      c.recomputeBoostedValues(c.Date.now() + 3600001);
      c.game._quantumActive = false;
      c.game.catlife.hunger = 0;
      c.recalcFPS();
      assert.equal(c.getCatnipNeeded(), before, mode + ' expired');
    }
  }
});

test('floor reads current permanent sources without requiring recalcFPS or mutating state', () => {
  const c = colony();
  let previous = c.getCatnipNeeded();
  const staleFPS = c.game.fishPerSecond;
  c.game.cats.find(cat => cat.id === 'kotmag').count = 5;
  assert.ok(c.getCatnipNeeded() > previous);
  previous = c.getCatnipNeeded();
  c.game.upgrades.find(u => u.id === 'catspeed').level = 10;
  assert.equal(c.getCatnipNeeded(), previous * 2);
  assert.equal(c.game.fishPerSecond, staleFPS);
  const snapshot = JSON.stringify(c.buildSaveState());
  c.getCatnipNeeded();
  assert.equal(JSON.stringify(c.buildSaveState()), snapshot);
  const clone = createGame();
  clone.applyGameState(JSON.parse(snapshot));
  assert.equal(clone.getCatnipNeeded(), c.getCatnipNeeded());
});

test('real purchases raise the floor, purchase previews leave it unchanged, and prestige checks the new threshold', () => {
  const c = colony();
  const index = c.game.cats.findIndex(cat => cat.id === 'kotfeniks');
  c.game.cats[index - 1].count = 1; // Sequential purchase unlock.
  const before = c.getCatnipNeeded();
  c.previewPurchase('cat', index, 10);
  assert.equal(c.getCatnipNeeded(), before);
  c.game.catnip = 1000000;
  assert.equal(c.buyCat(index), true);
  assert.ok(c.getCatnipNeeded() > before);
  c.game.totalFishEarned = oldRequirement(200);
  assert.equal(c.prestige(), false);
  const needed = c.getCatnipNeeded();
  c.game.totalFishEarned = needed - 1;
  assert.equal(c.prestige(), false);
  c.game.totalFishEarned = needed;
  assert.equal(c.prestige(), true);
  assert.equal(c.game.prestigeCount, 201);
  assert.equal(c.game.totalFishEarned, 0);
  assert.equal(c.getCatnipNeeded(), oldRequirement(201));
});

test('floor duration increases at every depth including ascension tiers', () => {
  const c = colony(100);
  let previous = 0;
  for (let count = 100; count <= 10000; count++) {
    c.game.prestigeCount = count;
    c.recalcFPS();
    const seconds = c.getCatnipNeeded() / c.game.fishPerSecond;
    assert.ok(seconds > previous, `count=${count}`);
    previous = seconds;
  }
});
