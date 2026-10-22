const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createGame } = require('./game-harness');
const { isCosmeticId, ownsCosmetic, validateEquippedCosmetic } = require('../public/js/cosmetic-state');
const fields = ['equippedSkin', 'equippedOutfit', 'equippedEffect'];
const saved = c => JSON.parse(JSON.stringify(c.buildSaveState()));

test('new player defaults and full save/restore preserve all three independent choices', () => {
  const c = createGame();
  for (const field of fields) assert.equal(c.game[field], null);
  c.purchasedItems = ['skin_album_2026-10', 'skin_black', 'outfit_hat', 'outfit_crown', 'effect_sparkle'];
  c.game.gacha = { totalPulls: 1, pity: 0, counts: { effect_aurora: 1 } };
  c.game.equippedSkin = 'skin_album_2026-10';
  c.game.equippedOutfit = 'outfit_hat';
  c.game.equippedEffect = 'effect_aurora';
  const before = saved(c);
  const clone = createGame();
  clone.applyGameState(before);
  const after = saved(clone);
  for (const field of [...fields, 'purchasedItems', 'gacha']) assert.deepEqual(after[field], before[field]);
});

test('legacy saves inherit the last valid purchase in each category without changing ownership', () => {
  const c = createGame();
  const legacy = { purchasedItems: ['skin_black', 'outfit_hat', 'effect_rainbow', 'skin_album_2026-10',
    'outfit_crown', 'effect_sparkle', 'skin_unknown', 'skin_album_2026-13', 'outfit_unknown', 'effect_unknown', 'legacy_item'],
    gacha: { totalPulls: 2, pity: 0, counts: { effect_aurora: 2 } } };
  const before = structuredClone(legacy);
  c.game.equippedSkin = 'skin_black';
  assert.doesNotThrow(() => c.applyGameState(legacy));
  assert.equal(c.game.equippedSkin, 'skin_album_2026-10');
  assert.equal(c.game.equippedOutfit, 'outfit_crown');
  assert.equal(c.game.equippedEffect, 'effect_sparkle');
  for (const [field, category] of fields.map((field, i) => [field, ['skin', 'outfit', 'effect'][i]])) {
    assert.equal(ownsCosmetic(saved(c), c.game[field]), true);
    assert.equal(validateEquippedCosmetic(c.game[field], category, saved(c)), true);
  }
  assert.deepEqual(legacy, before);
  assert.deepEqual(saved(c).purchasedItems, legacy.purchasedItems);
  assert.deepEqual(saved(c).gacha, legacy.gacha);
  const clone = createGame();
  clone.applyGameState(saved(c));
  for (const field of fields) assert.equal(clone.game[field], c.game[field]);
});

test('legacy saves without cosmetics reset all equipment to null', () => {
  const c = createGame();
  for (const state of [{}, { purchasedItems: [] }, { purchasedItems: ['legacy_item', 'skin_unknown'] }]) {
    c.game.equippedSkin = 'skin_black';
    c.game.equippedOutfit = 'outfit_hat';
    c.game.equippedEffect = 'effect_sparkle';
    c.applyGameState(state);
    for (const field of fields) assert.equal(c.game[field], null);
  }
});

test('explicit null stays default and missing categories migrate independently', () => {
  const c = createGame();
  const purchasedItems = ['skin_black', 'outfit_hat', 'effect_sparkle'];
  c.applyGameState({ purchasedItems, equippedSkin: null });
  assert.equal(c.game.equippedSkin, null);
  assert.equal(c.game.equippedOutfit, 'outfit_hat');
  assert.equal(c.game.equippedEffect, 'effect_sparkle');
  c.applyGameState({ purchasedItems, equippedSkin: null, equippedOutfit: null, equippedEffect: null });
  for (const field of fields) assert.equal(c.game[field], null);
  const clone = createGame();
  clone.applyGameState(saved(c));
  for (const field of fields) assert.equal(clone.game[field], null);
});

test('owning only an outfit never equips a skin or effect', () => {
  const c = createGame();
  c.applyGameState({ purchasedItems: ['outfit_hat'] });
  assert.equal(c.game.equippedSkin, null);
  assert.equal(c.game.equippedOutfit, 'outfit_hat');
  assert.equal(c.game.equippedEffect, null);
});

test('invalid explicit selections reset equipment without falling back to owned cosmetics', () => {
  const c = createGame();
  const legacy = { purchasedItems: ['skin_black', 'outfit_crown', 'effect_sparkle'],
    gacha: { totalPulls: 2, pity: 0, counts: { effect_aurora: 2 } } };
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
