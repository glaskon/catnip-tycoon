const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');

function setup() {
  const c = createGame();
  c.document = { getElementById: () => null };
  c.api = { token: null };
  c.setSaveStatus = () => {};
  c.sound = { buy() {} };
  c.i18n = { t: key => key };
  c.checkAchievements = () => {};
  for (const name of ['shop', 'gacha']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', name + '.js'), 'utf8'), c);
  }
  c.game.isReady = true;
  return c;
}

test('zero start and failed purchase give no reward; first guest cat unlocks exactly one pull', async () => {
  const c = setup();
  assert.equal(c.game.fish, 0);
  assert.equal(c.claimFirstCatReward(), null);
  assert.equal(c.buyCat(0), false);
  assert.equal(c.claimFirstCatReward(), null);
  c.game.fish = 15;
  assert.equal(c.buyCat(0), true);
  assert.match(c.firstCatRewardHTML(), /claimFirstCatReward/);
  const result = c.claimFirstCatReward();
  assert.ok(c.GACHA_POOL.some(p => p.id === result));
  assert.equal(c.game.fish, 0);
  assert.equal(c.game.catnip, 0);
  assert.equal(c.game.diamonds, 0);
  assert.equal(c.hasItem(result), true);
  assert.equal(c.claimFirstCatReward(), null);
  assert.equal(c.firstCatRewardHTML(), '');
  await c.saveGame();
  const saved = c.readLocalState();
  assert.equal(saved.firstCatReward, result);
  const loaded = setup();
  loaded.applyGameState(JSON.parse(JSON.stringify(saved)));
  assert.equal(loaded.claimFirstCatReward(), null);
  assert.equal(loaded.hasItem(result), true);
});

test('legacy players qualify via owned cats, lifetime count or achievement without a value jump', () => {
  for (const progress of [{ cats: [{ id: 'dachowiec', count: 1 }] }, { totalCatsBought: 1 }, { achievements: ['first_cat'] }]) {
    const c = setup();
    c.applyGameState({ ...progress, fish: 42, catnip: 7, diamonds: 3 });
    assert.equal(c.game.firstCatReward, null);
    assert.ok(c.claimFirstCatReward());
    assert.deepEqual([c.game.fish, c.game.catnip, c.game.diamonds], [42, 7, 3]);
    assert.equal(c.claimFirstCatReward(), null);
  }
});

test('free duplicate preserves paid pity and total pulls, with no duplicate currency', () => {
  const c = setup();
  c.applyGameState({ totalCatsBought: 1, gacha: { pity: 9, totalPulls: 19, counts: {} },
    purchasedItems: c.GACHA_POOL.map(p => p.id) });
  const id = c.claimFirstCatReward();
  assert.equal(c.game.gacha.pity, 9);
  assert.equal(c.game.gacha.totalPulls, 19);
  assert.equal(c.game.gacha.counts[id], 1);
  assert.equal(c.game.catnip, 0);
  assert.equal(c._gachaResults[0].isNew, false);
  assert.equal(c._gachaResults[0].refunded, 0);
  // A prestige reset cannot make the reward claimable again.
  c.game.cats.forEach(cat => { cat.count = 0; });
  assert.equal(c.claimFirstCatReward(), null);
  c.applyGameState({});
  assert.equal(c.game.firstCatReward, null);
  assert.equal(c.claimFirstCatReward(), null);
});

test('first goal disappears after a cat; empty suggestions have an explicit message', () => {
  const c = setup();
  const goal = { innerHTML: '' }, suggestions = { innerHTML: '', children: [] };
  c.document.getElementById = id => id === 'firstCatGoal' ? goal : id === 'purchaseSuggestions' ? suggestions : null;
  c.renderFirstCatGoal();
  assert.match(goal.innerHTML, /onboarding.goal/);
  for (const name of ['escape', 'render']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', name + '.js'), 'utf8'), c);
  c.renderPurchaseSuggestions();
  assert.match(suggestions.innerHTML, /economy.noneAffordable/);
  c.game.totalCatsBought = 1;
  c.renderFirstCatGoal();
  assert.doesNotMatch(goal.innerHTML, /onboarding.goal/);
  assert.match(goal.innerHTML, /onboarding.reward/);
  c.game.firstCatReward = 'skin_black';
  c.renderFirstCatGoal();
  assert.equal(goal.innerHTML, '');
  const gacha = { innerHTML: '' };
  c.document.getElementById = () => gacha;
  c.renderGacha();
  assert.match(gacha.innerHTML, /onboarding.received.*skin_black/);
});
