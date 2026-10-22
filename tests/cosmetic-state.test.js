const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createGame } = require('./game-harness');
const { isCosmeticId } = require('../public/js/cosmetic-state');
const fields = ['equippedSkin', 'equippedOutfit', 'equippedEffect'];
const saved = c => JSON.parse(JSON.stringify(c.buildSaveState()));

test('new player defaults and full save/restore preserve all three independent choices', () => {
  const c = createGame();
  for (const field of fields) assert.equal(c.game[field], null);
  c.purchasedItems = ['skin_black', 'skin_album_2026-10', 'outfit_crown'];
  c.game.gacha = { totalPulls: 1, pity: 0, counts: { effect_aurora: 1 } };
  c.game.equippedSkin = 'skin_album_2026-10';
  c.game.equippedOutfit = 'outfit_crown';
  c.game.equippedEffect = 'effect_aurora';
  const before = saved(c);
  const clone = createGame();
  clone.applyGameState(before);
  const after = saved(clone);
  for (const field of [...fields, 'purchasedItems', 'gacha']) assert.deepEqual(after[field], before[field]);
});

test('legacy and invalid selections reset equipment without losing any ownership', () => {
  const c = createGame();
  const legacy = { purchasedItems: ['skin_black', 'skin_album_2026-10', 'outfit_crown', 'legacy_item'],
    gacha: { totalPulls: 2, pity: 0, counts: { effect_aurora: 2 } } };
  c.game.equippedSkin = 'skin_black';
  assert.doesNotThrow(() => c.applyGameState(legacy));
  for (const field of fields) assert.equal(c.game[field], null);
  assert.deepEqual(saved(c).purchasedItems, legacy.purchasedItems);
  assert.deepEqual(saved(c).gacha, legacy.gacha);
  c.applyGameState({ ...legacy, equippedSkin: 'skin_unknown', equippedOutfit: 'skin_black', equippedEffect: 'effect_rainbow' });
  for (const field of fields) assert.equal(c.game[field], null);
  assert.deepEqual(saved(c).purchasedItems, legacy.purchasedItems);
  assert.deepEqual(saved(c).gacha, legacy.gacha);
});

test('shared cosmetic ids exactly match the existing shop and gacha catalogs', () => {
  const c = createGame();
  for (const file of ['shop', 'gacha']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file + '.js'), 'utf8'), c);
  }
  const catalog = [...new Set([...c.SHOP_ITEMS, ...c.GACHA_POOL]
    .map(item => item.id).filter(id => /^(skin|outfit|effect)_/.test(id)))].sort();
  const allowed = Array.from(vm.runInContext('COSMETIC_IDS', c)).sort();
  assert.deepEqual(allowed, catalog);
  for (const id of catalog) assert.equal(isCosmeticId(id, id.split('_')[0]), true);
});
