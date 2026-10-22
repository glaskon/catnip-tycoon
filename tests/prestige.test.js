const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('./game-harness');

function setup() {
  const c = createGame();
  c.checkAchievements = () => {};
  return c;
}
function reset(c) {
  c.game.totalFishEarned = c.getCatnipNeeded();
  assert.equal(c.prestige(), true);
}
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
}

test('20 resets earn exactly +200% permanent production, capped on later resets', () => {
  const c = setup();
  for (let n = 1; n <= 25; n++) {
    reset(c);
    assert.equal(c.game.prestigeMultiplier, 1 + Math.min(n, 20) / 10);
    c.game.cats[0].count = 2;
    c.recalcFPS();
    const tier = (n >= 5 ? 2 : 1) * (1 + Math.floor(n / 10) * 0.05);
    close(c.game.fishPerSecond, tier * c.game.prestigeMultiplier);
  }
});

test('catnip upgrades and diamond levels persist; all unselected fish upgrades reset', () => {
  const c = setup();
  c.game.upgrades.forEach(u => { u.purchased = u.type === 'once'; u.level = u.type === 'stackable' ? 3 : 0; });
  c.game.catnip = 123;
  const reward = () => c.getPrestigeSettlement().catnip;
  c.game.totalFishEarned = c.getCatnipNeeded();
  const gain = reward();
  reset(c);
  assert.equal(c.game.catnip, 123 + gain);
  for (const u of c.game.upgrades) {
    const keep = u.currency !== 'fish';
    assert.equal(u.purchased, keep && u.type === 'once', u.id);
    assert.equal(u.level, keep && u.type === 'stackable' ? 3 : 0, u.id);
  }
  const restored = setup();
  restored.applyGameState(c.buildSaveState());
  assert.equal(restored.hasUpgrade('catnipmastery'), true);
  assert.equal(restored.getUpgradeLevel('catnipclick'), 3);
});

test('anchor retains exactly one owned cat, never invents a cat, and chosen upgrade stays single', () => {
  for (const count of [0, 1, 20]) {
    const c = setup();
    c.game.prestigeCount = 75;
    c.game.anchoredCatId = 'dachowiec';
    c.game.cats.forEach(cat => { cat.count = 30; });
    c.game.cats[0].count = count;
    c.game.preservedUpgradeId = 'catspeed';
    c.game.upgrades.forEach(u => { u.purchased = true; u.level = 4; });
    reset(c);
    assert.equal(c.game.cats[0].count, Math.min(1, count));
    assert.ok(c.game.cats.slice(1).every(cat => cat.count === 0));
    assert.equal(c.getUpgradeLevel('catspeed'), 4);
    assert.equal(c.getUpgradeLevel('fishclick'), 0);
    assert.equal(c.hasUpgrade('karma'), false);
  }
});

test('unearned anchor and preserved upgrade cannot retain round purchases', () => {
  const c = setup();
  c.game.anchoredCatId = 'dachowiec';
  c.game.cats[0].count = 20;
  c.game.preservedUpgradeId = 'karma';
  c.game.upgrades[0].purchased = true;
  reset(c);
  assert.equal(c.game.cats[0].count, 0);
  assert.equal(c.hasUpgrade('karma'), false);
});

test('permanent bonus survives boost recomputation, save/load and offline expiry boundaries', () => {
  const c = setup();
  const now = 1800000000000;
  const state = { savedAt: now - 60000, prestigeCount: 20, prestigeMultiplier: 3,
    cats: [{ id: 'dachowiec', count: 2 }],
    upgrades: [{ id: 'superkarmnik', purchased: true }],
    activeBoosts: [{ kind: 'production', mult: 10, remainingMs: 30000 }] };
  c.applyGameState(state, now - 60000);
  close(c.game.fishPerSecond, 66);
  close(c.getCatnipShrineRate(), 0.78);
  const restored = setup();
  restored.applyGameState(c.buildSaveState());
  assert.equal(restored.game.prestigeMultiplier, 3);
  c.restoreWithOffline(state, undefined, now);
  close(c.game.fish, 30 * 66 + 30 * 6.6);
  close(c.game.catnip, 60 * 0.78);
  close(c.game.fishPerSecond, 6.6);
  c.applyBoost('speed', 10, 30000);
  reset(c);
  assert.equal(c.game.speedMultiplier, 1);
  assert.equal(c.game.productionMultiplier, 1);
  assert.equal(c.game.prestigeMultiplier, 3);
});

test('old saves load without production or balance jumps and keep migration across reloads', () => {
  const c = setup();
  const state = { prestigeCount: 20, fish: 123, catnip: 456, cats: [{ id: 'dachowiec', count: 2 }] };
  c.applyGameState(state);
  assert.equal(c.game.prestigeMultiplier, 1);
  close(c.game.fishPerSecond, 2.2);
  close(c.getCatnipShrineRate(), 0.065);
  assert.equal(c.game.fish, 123);
  assert.equal(c.game.catnip, 456);
  c.applyGameState(c.buildSaveState());
  close(c.game.fishPerSecond, 2.2);
  reset(c);
  assert.equal(c.game.prestigeMultiplier, 1.1);
  for (const invalid of [-1, 0, 4, Infinity, NaN, '3']) {
    c.applyGameState({ ...state, prestigeMultiplier: invalid });
    assert.equal(c.game.prestigeMultiplier, 1);
  }
});

test('requirements are monotone, meet at 21 and grow faster than linear after 20 completed resets', () => {
  const c = setup();
  const requirements = [];
  for (let completed = 0; completed < 100; completed++) {
    c.game.prestigeCount = completed;
    requirements.push(c.getCatnipNeeded());
  }
  for (let i = 0; i < 21; i++) assert.equal(requirements[i], 1e7 * (i + 1));
  assert.equal(requirements[20] - requirements[19], 1e7);
  close(requirements[21], 1e7 * 22 * (22 / 21));
  for (let i = 1; i < requirements.length; i++) {
    assert.ok(requirements[i] > requirements[i - 1]);
    if (i > 20) assert.ok(requirements[i] - requirements[i - 1] > 1e7);
    if (i > 21) assert.ok(requirements[i] - requirements[i - 1] > requirements[i - 1] - requirements[i - 2]);
  }
  assert.ok(requirements[24] > 250000000 * 1.19);
});

test('prestige checks the quadratic threshold, and refuses without changing state below it', () => {
  const c = setup();
  c.game.prestigeCount = 24;
  c.game.totalFishEarned = c.getCatnipNeeded() - 1;
  const before = JSON.stringify(c.game);
  assert.equal(c.prestige(), false);
  assert.equal(JSON.stringify(c.game), before);
  reset(c);
  assert.equal(c.game.prestigeCount, 25);
});

test('one receipt pays fish and proportional catnip exactly once, even at the former cashback tier', () => {
  for (const completed of [0, 4, 9, 19, 24, 50, 100]) {
    const c = setup();
    c.game.prestigeCount = completed;
    c.game.catnip = 123;
    c.game.totalFishEarned = c.getCatnipNeeded();
    const before = JSON.stringify(c.game);
    const receipt = c.getPrestigeSettlement();
    assert.equal(JSON.stringify(c.game), before);
    assert.equal(receipt.fish, Math.floor(Math.sqrt(c.getCatnipNeeded()) / 100));
    assert.equal(receipt.catnip, Math.floor(receipt.fish * (completed >= 50 ? 1.25 : 1)));
    assert.equal(c.prestige(), true);
    assert.equal(c.game.fish, receipt.fish);
    assert.equal(c.game.catnip, 123 + receipt.catnip);
    assert.equal(c.game.totalFishEarned, 0); // Reset reward does not feed the next requirement.
    assert.equal(c.prestige(), false);
    assert.equal(c.game.catnip, 123 + receipt.catnip);
  }
});

test('catnip reward modifiers survive resets and never scale with total round fish directly', () => {
  const c = setup();
  for (const id of ['karmnik', 'prestigeBoost']) c.game.upgrades.find(u => u.id === id).purchased = true;
  c.game.totalFishEarned = 1e7;
  assert.equal(c.getPrestigeSettlement().fish, 31);
  assert.equal(c.getPrestigeSettlement().catnip, 77);
  reset(c);
  c.game.prestigeCount = 50;
  c.game.totalFishEarned = 1e12;
  const receipt = c.getPrestigeSettlement();
  assert.equal(receipt.fish, 10000);
  assert.equal(receipt.catnip, 31250); // Not 1 billion from F/1000.
});

test('fifth and twentieth resets exceed the effective production gain criteria with identical cats', () => {
  const c = setup();
  for (let n = 1; n <= 20; n++) {
    c.game.cats[0].count = 20000;
    c.recalcFPS();
    const before = c.game.fishPerSecond;
    const receipt = c.getPrestigeSettlement();
    reset(c);
    c.game.cats[0].count = 20000;
    c.recalcFPS();
    close(c.game.fishPerSecond / before, receipt.fishMultiplierAfter / receipt.fishMultiplierBefore);
    if (n === 5) assert.ok(c.game.fishPerSecond / before >= 1.15);
    if (n === 20) assert.ok(c.game.fishPerSecond / before >= 1.05);
  }
});

test('receipt preservation list matches the actual cats and upgrades after reset', () => {
  const c = setup();
  c.game.prestigeCount = 75;
  c.game.anchoredCatId = 'dachowiec';
  c.game.cats[0].count = 50;
  c.game.preservedUpgradeId = 'karma';
  c.game.upgrades.forEach(u => { u.purchased = u.type === 'once'; u.level = u.type === 'stackable' ? 2 : 0; });
  const receipt = c.getPrestigeSettlement();
  reset(c);
  assert.equal(receipt.catId, c.game.cats.find(cat => cat.count === 1).id);
  assert.equal(receipt.preservedUpgradeId, 'karma');
  assert.deepEqual(Array.from(receipt.upgrades, u => u.id), Array.from(c.game.upgrades.filter(u => c.hasUpgrade(u.id)), u => u.id));
});

test('all requirements through count 100 stay numerically identical to the old formula', () => {
  const c = setup();
  for (let count = 0; count <= 100; count++) {
    c.game.prestigeCount = count;
    const next = count + 1;
    assert.equal(c.getCatnipNeeded(), 10000000 * next * (next > 21 ? next / 21 : 1), `count=${count}`);
  }
  assert.equal(c.getCatnipNeeded(), 4857619047.619047);
});

test('one phoenix takes at least five minutes and strictly longer at every depth after count 100', () => {
  const c = setup();
  c.game.cats.find(cat => cat.id === 'kotfeniks').count = 1;
  for (const multiplier of [1, 3]) {
    c.game.prestigeMultiplier = multiplier;
    c.game.prestigeCount = 99;
    c.recalcFPS();
    let previous = c.getCatnipNeeded() / c.game.fishPerSecond;
    // Include every ascension step, not only the seven report samples.
    for (let count = 101; count <= 500; count++) {
      c.game.prestigeCount = count;
      c.recalcFPS();
      const seconds = c.getCatnipNeeded() / c.game.fishPerSecond;
      assert.ok(seconds >= 300, `count=${count}, multiplier=${multiplier}: ${seconds}s`);
      assert.ok(seconds > previous, `count=${count}: ${seconds} <= ${previous}`);
      close(c.getPrestigeFishMultiplier(), multiplier * 2 * (1 + Math.floor(count / 10) * 0.05) * 100);
      previous = seconds;
    }
  }
});

test('protected count 100 still has the documented seconds-long reset with the retained goddess bonus', () => {
  const c = setup();
  c.game.cats.find(cat => cat.id === 'kotfeniks').count = 1;
  c.game.prestigeCount = 100;
  for (const multiplier of [1, 3]) {
    c.game.prestigeMultiplier = multiplier;
    c.recalcFPS();
    close(c.game.fishPerSecond, 375000000 * multiplier);
    close(c.getCatnipNeeded() / c.game.fishPerSecond, 12.953650793650793 / multiplier);
  }
});
