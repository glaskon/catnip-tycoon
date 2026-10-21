const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');

function setup() {
  const c = createGame();
  c.sound = { buy() {} };
  c.i18n = { t: (key, fallback) => fallback || key };
  c.checkAchievements = () => {};
  c.showToast = text => { c.receipt = text; };
  return c;
}
function upgrade(c, id) { return c.game.upgrades.findIndex(u => u.id === id); }
function loadRender(c) {
  for (const file of ['escape', 'render']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file + '.js'), 'utf8'), c);
  }
}

test('x10 charges the exact sum of successive rounded costs, including existing cats', () => {
  for (const owned of [0, 7, 30]) {
    const c = setup();
    c.game.cats[0].count = owned;
    const cost = Array.from({ length: 10 }, (_, n) => Math.floor(15 * 1.15 ** (owned + n))).reduce((a, b) => a + b);
    c.game.fish = cost - 1;
    assert.equal(c.buyCat(0, 10), false);
    assert.equal(c.game.cats[0].count, owned);
    c.game.fish = cost;
    assert.equal(c.buyCat(0, 10), true);
    assert.equal(c.game.fish, 0);
    assert.equal(c.game.cats[0].count, owned + 10);
    assert.equal(c.game.totalCatsBought, 10);
    assert.match(c.receipt, new RegExp('spent ' + cost));
  }
});

test('max matches sequential purchases and leaves too little for another cat', () => {
  for (const funds of [0, 14, 15, 100, 10000, 1e15]) {
    const c = setup(), single = setup();
    c.game.fish = single.game.fish = funds;
    while (single.buyCat(0)) {}
    assert.equal(c.buyCat(0, 'max'), funds >= 15);
    assert.equal(c.game.cats[0].count, single.game.cats[0].count);
    assert.equal(c.game.fish, single.game.fish);
    assert.ok(c.game.fish < c.game.cats[0].currentCost);
  }
});

test('stackable upgrades use rising costs, once upgrades cannot be bought ten times', () => {
  const c = setup();
  const index = upgrade(c, 'catspeed');
  c.game.fish = 1e12;
  const start = c.game.fish;
  const cost = Array.from({ length: 10 }, (_, n) => Math.floor(100000 * 2.5 ** n)).reduce((a, b) => a + b);
  assert.equal(c.buyUpgrade(index, 10), true);
  assert.equal(c.game.fish, start - cost);
  assert.equal(c.game.upgrades[index].level, 10);
  assert.equal(c.buyUpgrade(upgrade(c, 'karma'), 10), false);
  assert.equal(c.buyUpgrade(upgrade(c, 'karma'), 'max'), true);
  assert.equal(c.buyUpgrade(upgrade(c, 'karma')), false);
});

test('all quantities enforce sequential cats, prestige, requireCat and maxOwned', () => {
  const c = setup();
  c.game.fish = c.game.catnip = 1e15;
  for (const quantity of [1, 10, 'max']) {
    assert.equal(c.buyCat(1, quantity), false);
    assert.equal(c.buyCat(7, quantity), false);
  }
  const index = upgrade(c, 'catspeed');
  c.game.upgrades[index].requireCat = 'rudzielec';
  assert.equal(c.buyUpgrade(index, 'max'), false);
  c.game.cats[0].count = 1;
  c.game.cats[1].maxOwned = 3;
  assert.equal(c.buyCat(1, 10), false);
  assert.equal(c.buyCat(1, 'max'), true);
  assert.equal(c.game.cats[1].count, 3);
  assert.equal(c.buyCat(1), false);
  c.game.upgrades[index].maxOwned = 2;
  assert.equal(c.buyUpgrade(index, 'max'), true);
  assert.equal(c.game.upgrades[index].level, 2);
  assert.equal(c.buyUpgrade(index), false);
});

test('catnip and diamonds bulk purchases deduct only their own currency', () => {
  const c = setup();
  c.game.fish = 123;
  c.game.catnip = 100;
  c.game.diamonds = 100;
  assert.equal(c.buyUpgrade(upgrade(c, 'catnipclick'), 'max'), true);
  assert.equal(c.game.catnip, 40);
  assert.equal(c.game.fish, 123);
  assert.equal(c.buyUpgrade(upgrade(c, 'diamondluck'), 'max'), true);
  assert.equal(c.game.diamonds, 40);
  c.game.prestigeCount = 20;
  c.game.cats[7].count = 1;
  c.game.catnip = 250;
  assert.equal(c.buyCat(8, 'max'), true);
  assert.equal(c.game.cats[8].count, 2);
  assert.equal(c.game.catnip, 0);
});

test('preview uses live multipliers, matches actual purchases and does not award or spend resources', () => {
  const c = setup();
  c.game.fish = 1e15;
  c.game.prestigeCount = 10;
  c.game.cats.forEach(cat => { cat.count = 1; });
  c.catLifeProductionMultiplier = () => 1.1;
  const plain = c.previewPurchase('cat', 0);
  c.applyBoost('production', 10, 30000);
  c.applyBoost('speed', 2, 30000);
  const boosted = c.previewPurchase('cat', 0);
  assert.ok(Math.abs((boosted.after.fish - boosted.before.fish) / (plain.after.fish - plain.before.fish) - 20) < 1e-6);
  for (const [kind, index, count] of [['cat', 7, 10], ['upgrade', upgrade(c, 'karma'), 1], ['upgrade', upgrade(c, 'autoclicker'), 1]]) {
    const before = JSON.stringify(c.buildSaveState());
    const preview = c.previewPurchase(kind, index, count);
    // Timestamps can move; all economic state must remain the same.
    const saved = JSON.parse(before), after = JSON.parse(JSON.stringify(c.buildSaveState()));
    delete saved.savedAt; delete after.savedAt;
    delete saved.activeBoosts; delete after.activeBoosts;
    assert.deepEqual(after, saved);
    assert.equal(c.buyPurchase(kind, index, count), true);
    assert.equal(c.getFishIncomeRate(), preview.after.fish);
    assert.equal(c.calculateClickValue(), preview.after.click);
  }
});

test('suggestions give at most one affordable unlocked item per category and exclude capped items', () => {
  const c = setup();
  loadRender(c);
  c.game.fish = 1e6;
  c.game.catnip = 100;
  const choices = c.getAffordableSuggestions();
  assert.equal(choices.length, 3);
  assert.deepEqual(Array.from(choices, x => x.category), ['cat', 'fish', 'catnip']);
  assert.ok(choices.every(x => x.quote.affordable));
  assert.equal(choices[0].index, 0);
  c.game.cats[0].maxOwned = 0;
  c.game.fish = c.game.catnip = 0;
  assert.equal(c.getAffordableSuggestions().length, 0);
});

test('cards refresh their displayed gains after boosts; ordinary income does not rebuild stable buttons', () => {
  const c = setup();
  loadRender(c);
  let writes = 0, html = '';
  const container = { _hoverTracked: true, children: [],
    get innerHTML() { return html; }, set innerHTML(value) { writes++; html = value; } };
  c.document = { getElementById: () => container };
  c.game.fish = 20;
  c.renderCats();
  assert.match(html, /\+0.5 /);
  c.game.fish = 21;
  c.renderCats();
  assert.equal(writes, 1);
  c.applyBoost('production', 10, 30000);
  c.renderCats();
  assert.match(html, /\+5 /);
  assert.equal(writes, 2);
  assert.match(html, /buyCat\(0, 10\)/);
  assert.match(html, /max \(1\)/);
});
