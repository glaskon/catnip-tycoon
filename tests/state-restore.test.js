const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const { createGame } = require('./game-harness');

test('partial saves replace cats, upgrades and achievements without granting rewards', () => {
  const c = createGame();
  c.game.cats.forEach(cat => { cat.count = 10; });
  c.game.upgrades.forEach(u => { u.purchased = true; u.level = 5; });
  c.ACHIEVEMENTS.forEach(a => { a.earned = true; });
  const achievement = c.ACHIEVEMENTS[0].id;
  c.applyGameState({
    fish: 17, cats: [{ id: 'dachowiec', count: 1 }, { id: 'unknown', count: 100 }],
    upgrades: [{ id: 'autoclicker', purchased: true }, { id: 'unknown', level: 10 }],
    achievements: [achievement, 'unknown'],
  });
  assert.equal(c.game.fish, 17);
  assert.equal(c.game.cats[0].count, 1);
  assert.ok(c.game.cats.slice(1).every(cat => cat.count === 0));
  assert.equal(c.game.cats[0].production, 0.5);
  assert.equal(c.game.cats[0].currentCost, 17);
  assert.ok(c.game.upgrades.every(u => u.purchased === (u.id === 'autoclicker') && u.level === 0));
  assert.equal(c.ACHIEVEMENTS.filter(a => a.earned).length, 1);
  assert.equal(c.game.totalFishEarned, 0);
});

test('empty and actual registration saves clear all collections and cached achievements', () => {
  const c = createGame();
  const source = fs.readFileSync(path.join(__dirname, '../server/routes/auth.js'), 'utf8');
  const registration = vm.runInNewContext('(' + source.match(/const defaultSave = (\{[\s\S]*?\n    \});/)[1] + ')');
  for (const state of [{}, registration, { _fresh: true }, { upgrades: {} }]) {
    c.game.fish = 1000;
    c.game.cats.forEach(cat => { cat.count = 10; });
    c.game.upgrades.forEach(u => { u.purchased = true; u.level = 5; });
    c.ACHIEVEMENTS.forEach(a => { a.earned = true; });
    c.applyGameState(state);
    assert.equal(c.game.fish, 0);
    assert.equal(c.game.fishPerSecond, 0);
    assert.ok(c.game.cats.every(cat => cat.count === 0));
    assert.ok(c.game.upgrades.every(u => !u.purchased && u.level === 0));
    assert.ok(c.ACHIEVEMENTS.every(a => !a.earned));
    assert.equal(c.localStorage.getItem('catnip-achievements'), '[]');
  }
});
