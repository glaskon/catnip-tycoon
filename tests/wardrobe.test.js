const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const saved = c => JSON.parse(JSON.stringify(c.buildSaveState()));

function setup() {
  const c = createGame();
  const panel = { writes: 0, html: '', get innerHTML() { return this.html; },
    set innerHTML(value) { this.html = value.replace(/ disabled(?=[ >])/g, ' disabled=""'); this.writes++; } };
  const elements = new Map([
    ['wardrobeContent', panel], ['wardrobeTitle', {}], ['wardrobeOpen', {}],
    ['wardrobeNav', { setAttribute(key, value) { this[key] = value; } }],
  ]);
  c.activePanel = { id: 'panel-wardrobe' };
  c.document = {
    getElementById: id => elements.get(id), querySelector: () => c.activePanel,
    addEventListener() {}, body: { children: [] },
  };
  c.i18n = { currentLang: 'pl', translations: JSON.parse(read('public/locales/pl.json')),
    t(key) { return this.translations[key] || key; } };
  for (const file of ['escape', 'shop', 'gacha', 'album', 'wardrobe', 'render']) {
    vm.runInContext(read('public/js/' + file + '.js'), c);
  }
  c.game.isReady = true;
  c.saves = 0;
  c.saveGame = () => { c.saves++; c.snapshot = saved(c); };
  c.colors = [];
  const ctx = new Proxy({}, {
    get: (o, key) => o[key] || (() => {}),
    set: (o, key, value) => { if (key === 'fillStyle') c.colors.push(value); o[key] = value; return true; },
  });
  elements.set('catCanvas', { width: 200, height: 200, getContext: () => ctx });
  c.panel = panel;
  return c;
}

const ownedState = {
  fish: 1200, catnip: 43, diamonds: 8, elixirs: 2,
  purchasedItems: ['skin_black', 'skin_siamese', 'outfit_hat', 'outfit_crown', 'effect_sparkle', 'effect_rainbow', 'skin_album_2026-09'],
  gacha: { totalPulls: 1, pity: 0, counts: { skin_galaxy: 1, effect_aurora: 1 } },
};

function card(c, id) {
  const match = c.panel.innerHTML.match(new RegExp('<div class="shop-item wardrobe-item[^>]*data-cosmetic="' + id + '"[\\s\\S]*?</button>'));
  assert.ok(match, 'visible card: ' + id);
  return match[0];
}

test('wardrobe equips one cosmetic per category, saves, redraws immediately and never changes rewards or ownership', () => {
  const c = setup();
  c.applyGameState(ownedState);
  const before = saved(c);
  const selections = [
    ['skin', 'skin_black', '#2d3436'], ['skin', 'skin_siamese', '#f5e6d3'],
    ['outfit', 'outfit_hat'], ['outfit', 'outfit_crown'],
    ['effect', 'effect_sparkle'], ['effect', 'effect_rainbow'],
    ['skin', 'skin_galaxy', '#5b4b8a'], ['effect', 'effect_aurora'],
    ['skin', 'skin_album_2026-09', c.albumSkinPalette('skin_album_2026-09').fur],
  ];
  for (const [category, id, color] of selections) {
    c.colors.length = 0;
    assert.equal(c.equipCosmetic(category, id), true);
    const field = { skin: 'equippedSkin', outfit: 'equippedOutfit', effect: 'equippedEffect' }[category];
    assert.equal(c.game[field], id);
    assert.equal(c.snapshot[field], id);
    if (color) assert.equal(c.colors[0], color);
    assert.match(card(c, id), /wardrobe-equipped/);
    assert.match(card(c, id), /aria-pressed="true" disabled/);
    const after = saved(c);
    for (const key of Object.keys(before).filter(k => !['savedAt', 'equippedSkin', 'equippedOutfit', 'equippedEffect'].includes(k))) {
      assert.deepEqual(after[key], before[key], key);
    }
  }
  assert.equal(c.game.equippedSkin, 'skin_album_2026-09');
  assert.equal(c.game.equippedOutfit, 'outfit_crown');
  assert.equal(c.game.equippedEffect, 'effect_aurora');
  assert.doesNotMatch(card(c, 'skin_black'), /wardrobe-equipped/);
  const clone = setup();
  clone.applyGameState(c.snapshot);
  clone.refreshAlbum = () => {};
  clone.endStateTransition();
  clone.render();
  assert.equal(clone.colors[0], c.albumSkinPalette('skin_album_2026-09').fur);
  assert.match(card(clone, 'skin_album_2026-09'), /wardrobe-equipped/);
  const retained = saved(c);
  c.game.totalFishEarned = c.getCatnipNeeded();
  c.checkAchievements = () => {};
  c.prestige();
  for (const key of ['equippedSkin', 'equippedOutfit', 'equippedEffect', 'purchasedItems', 'gacha']) {
    assert.deepEqual(saved(c)[key], retained[key], 'prestige retains ' + key);
  }
});

test('default actions clear only their category and restore the original canvas', () => {
  const c = setup();
  c.applyGameState(ownedState);
  c.equipCosmetic('skin', 'skin_black');
  c.equipCosmetic('outfit', 'outfit_hat');
  c.equipCosmetic('effect', 'effect_rainbow');
  c.colors.length = 0;
  assert.equal(c.equipCosmetic('skin', null), true);
  assert.equal(c.game.equippedSkin, null);
  assert.equal(c.colors[0], '#f4a261');
  assert.equal(c.game.equippedOutfit, 'outfit_hat');
  assert.equal(c.game.equippedEffect, 'effect_rainbow');
  c.equipCosmetic('outfit', null);
  c.equipCosmetic('effect', null);
  assert.equal(c.game.equippedOutfit, null);
  assert.equal(c.game.equippedEffect, null);
  assert.doesNotMatch(c.panel.innerHTML, /wardrobe-equipped/);
  assert.equal(c.equipCosmetic('effect', null), false);
});

test('locked, invalid and cross-category choices, transitions and save conflicts cannot equip or save', () => {
  const c = setup();
  c.applyGameState(ownedState);
  const before = saved(c);
  for (const [category, id] of [['skin', 'skin_orange'], ['skin', 'skin_unknown'], ['skin', 'outfit_hat'],
    ['effect', 'skin_galaxy'], ['fish', null], ['__proto__', null], ['skin', undefined]]) {
    assert.equal(c.equipCosmetic(category, id), false);
  }
  c.game.isReady = false;
  assert.equal(c.equipCosmetic('skin', 'skin_black'), false);
  c.game.isReady = true;
  c.game.saveConflict = true;
  assert.equal(c.equipCosmetic('skin', 'skin_black'), false);
  assert.equal(c.saves, 0);
  const after = saved(c);
  delete before.savedAt;
  delete after.savedAt;
  assert.deepEqual(after, before);
});

test('three translated sections show all known cosmetics with descriptive sources, ownership and no prices', () => {
  const c = setup();
  c.applyGameState({ ...ownedState, album: { timeZone: 'UTC', month: '2026-10', stamps: 1,
    lastDay: '2026-10-01', lastStampAt: Date.parse('2026-10-01T12:00:00Z'), history: { '2026-08': 3 } } });
  c.render();
  assert.equal((c.panel.innerHTML.match(/<section /g) || []).length, 3);
  for (const text of ['Skórki', 'Stroje', 'Efekty', 'Sklep · Losowanie', 'Album miesiąca 2026-10', 'Posiadane', 'Nieposiadane']) {
    assert.ok(c.panel.innerHTML.includes(text), text);
  }
  assert.match(card(c, 'skin_black'), /onclick="equipCosmetic\('skin', 'skin_black'\)" aria-pressed="false" >/);
  assert.match(card(c, 'skin_orange'), /wardrobe-locked/);
  assert.match(card(c, 'skin_orange'), /disabled/);
  assert.doesNotMatch(card(c, 'skin_galaxy'), /wardrobe-locked/); // gacha counts alone
  assert.match(card(c, 'skin_album_2026-08'), /wardrobe-locked/); // recorded missed month
  assert.doesNotMatch(card(c, 'skin_album_2026-09'), /wardrobe-locked/); // owned outside album history
  assert.doesNotMatch(c.panel.innerHTML, /shop-item-price|buyShopItem|pullGacha|💎|🌿|boost_speed|offline_catnip/);
  assert.equal(c.document.getElementById('wardrobeOpen').textContent, '👒 Garderoba');
  assert.equal(c.document.getElementById('wardrobeNav')['aria-label'], 'Garderoba');
});

test('common render refreshes changed ownership, equipment, account and language without replacing unchanged buttons', () => {
  const c = setup();
  c.activePanel = null;
  c.gameLoop();
  const writes = c.panel.writes;
  c.gameLoop();
  assert.equal(c.panel.writes, writes);
  c.applyGameState(ownedState);
  c.gameLoop();
  assert.equal(c.panel.writes, writes + 1);
  c.equipCosmetic('skin', 'skin_black');
  assert.match(card(c, 'skin_black'), /wardrobe-equipped/);
  c.i18n.currentLang = 'de';
  c.i18n.translations = JSON.parse(read('public/locales/de.json'));
  c.gameLoop();
  assert.match(c.panel.innerHTML, /Fellfarben/);
  assert.equal(c.document.getElementById('wardrobeNav').title, 'Garderobe');
  const updatedWrites = c.panel.writes;
  c.gameLoop();
  assert.equal(c.panel.writes, updatedWrites);
  c.applyGameState({});
  c.gameLoop();
  assert.match(card(c, 'skin_black'), /wardrobe-locked/);
  assert.doesNotMatch(c.panel.innerHTML, /wardrobe-equipped/);
  // A remounted empty panel must not be skipped because of a stale cache.
  c.panel.html = '';
  c.gameLoop();
  assert.match(c.panel.innerHTML, /wardrobe-section/);
});

test('the canvas draws selected outfits and click particles use only the selected effect', () => {
  const c = setup();
  c.applyGameState(ownedState);
  c.colors.length = 0;
  c.drawCat();
  const defaultColors = [...c.colors];
  c.equipCosmetic('outfit', 'outfit_hat');
  assert.ok(c.colors.includes('#22222a')); // existing top hat palette
  c.colors.length = 0;
  c.equipCosmetic('outfit', 'outfit_crown');
  assert.ok(c.colors.includes('#f1c40f')); // existing crown palette
  c.colors.length = 0;
  c.equipCosmetic('outfit', null);
  assert.deepEqual(c.colors, defaultColors);
  const particles = [];
  c.document.querySelectorAll = () => [];
  c.document.createElement = () => ({ style: { setProperty() {} }, addEventListener() {}, remove() {} });
  c.document.body.appendChild = particle => particles.push(particle.textContent);
  c.setTimeout = () => {};
  c.Math = Object.create(Math);
  c.Math.random = () => 0.99; // last emoji from the chosen palette
  for (const [id, expected] of [[null, '🐾'], ['effect_sparkle', '💫'], ['effect_rainbow', '🐟'], ['effect_aurora', '❄️'], [null, '🐾']]) {
    c.equipCosmetic('effect', id);
    c.spawnParticles(100, 100, 1);
    assert.equal(particles.at(-1), expected);
  }
});

test('wardrobe names and sources are escaped and unknown owned ids cannot become markup', () => {
  const c = setup();
  c.applyGameState({ purchasedItems: ['skin_<img src=x onerror=alert(1)>', 'skin_album_2026-13'] });
  c.i18n.translations['shop.item.skin_black'] = '<img src=x onerror=alert(1)>';
  c.i18n.translations['wardrobe.source.shop'] = '<b>shop</b>';
  c.render();
  assert.doesNotMatch(c.panel.innerHTML, /<img|<b>|2026-13/);
  assert.match(c.panel.innerHTML, /&lt;img/);
  assert.match(c.panel.innerHTML, /&lt;b&gt;shop/);
});

test('all four languages have identical keys and translate every wardrobe label and cosmetic name', () => {
  let keys;
  const c = setup();
  const wardrobeKeys = [...read('public/js/wardrobe.js').matchAll(/i18n.t\('(wardrobe\.[a-z]+)'\)/g)].map(m => m[1]);
  wardrobeKeys.push('wardrobe.skin', 'wardrobe.outfit', 'wardrobe.effect', 'wardrobe.equipped', 'wardrobe.owned', 'wardrobe.locked',
    'wardrobe.source.shop', 'wardrobe.source.gacha', 'wardrobe.source.album');
  const ids = [...new Set([...c.SHOP_ITEMS, ...c.GACHA_POOL].map(item => item.id).filter(id => /^(skin|outfit|effect)_/.test(id)))];
  for (const locale of ['pl', 'en', 'es', 'de']) {
    const strings = JSON.parse(read('public/locales/' + locale + '.json'));
    const currentKeys = Object.keys(strings).sort();
    if (keys) assert.deepEqual(currentKeys, keys, locale);
    keys = currentKeys;
    for (const key of [...wardrobeKeys, ...ids.map(id => 'shop.item.' + id), 'album.skin']) {
      assert.ok(typeof strings[key] === 'string' && strings[key].length > 0, locale + ': ' + key);
    }
  }
  const html = read('public/index.html');
  assert.match(html, /data-panel="wardrobe"/);
  assert.match(html, /onclick="switchPanel\('wardrobe'\)"/);
  assert.match(html, /id="panel-wardrobe"/);
  assert.ok(html.indexOf('/js/wardrobe.js') < html.indexOf('/js/main.js'));
});
