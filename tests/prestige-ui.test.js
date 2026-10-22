const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createGame } = require('./game-harness');

function setup() {
  const c = createGame();
  const elements = new Map();
  for (const id of ['prestigeDialog', 'prestigeReceipt', 'prestigeConfirm', 'prestigeCancel', 'prestigeOpen', 'prestigeContent']) {
    elements.set(id, { innerHTML: '', textContent: '', open: false, isConnected: true,
      showModal() { this.open = true; }, close() { this.open = false; },
      focus() { c.document.activeElement = this; } });
  }
  c.document = { getElementById: id => elements.get(id), activeElement: elements.get('prestigeOpen') };
  c.translations = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/locales/pl.json')));
  c.i18n = { currentLang: 'pl', t: (key, fallback) => c.translations[key] || fallback || key };
  c.formatNumber = String;
  c.checkAchievements = () => {};
  c.sound = { prestige() {} };
  c.luckyFlash = () => {};
  c.saveGame = () => { c.saves++; };
  c.saves = 0;
  c.timers = new Map();
  let timer = 0;
  c.setTimeout = (fn, delay) => { assert.equal(delay, 5000); c.timers.set(++timer, fn); return timer; };
  c.clearTimeout = id => c.timers.delete(id);
  for (const file of ['escape', 'prestige']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js', file + '.js'), 'utf8'), c);
  }
  c.game.totalFishEarned = c.getCatnipNeeded();
  return c;
}

test('first click displays the full receipt without resetting; second pays once and closes', () => {
  const c = setup();
  const before = JSON.stringify(c.game);
  c.armPrestige();
  assert.equal(JSON.stringify(c.game), before);
  assert.equal(c.document.getElementById('prestigeDialog').open, true);
  assert.equal(c.document.activeElement, c.document.getElementById('prestigeCancel'));
  const html = c.document.getElementById('prestigeReceipt').innerHTML;
  for (const label of ['Ryby na start', 'Kocimiętka', 'Trwały mnożnik', 'Zachowany kot', 'Wskazane ulepszenie', 'Wszystkie zachowane']) {
    assert.ok(html.includes(label), label);
  }
  assert.equal((html.match(/<ul /g) || []).length, 1);
  assert.match(html, /\+31/);
  c.confirmPrestige();
  assert.equal(c.game.prestigeCount, 1);
  assert.equal(c.game.fish, 31);
  assert.equal(c.game.catnip, 31);
  assert.equal(c.saves, 1);
  assert.equal(c.document.getElementById('prestigeDialog').open, false);
  assert.equal(c.document.activeElement, c.document.getElementById('prestigeOpen'));
  c.confirmPrestige();
  assert.equal(c.saves, 1);
});

test('cancel, Escape wiring, closed dialogs and the five-second timeout cannot reset progress', () => {
  const c = setup();
  const before = JSON.stringify(c.game);
  c.confirmPrestige();
  c.armPrestige();
  c.cancelPrestige();
  c.confirmPrestige();
  assert.equal(c.timers.size, 0);
  c.armPrestige();
  c.document.getElementById('prestigeDialog').close();
  c.confirmPrestige();
  c.cancelPrestige();
  c.armPrestige();
  const expire = [...c.timers.values()][0];
  expire();
  c.confirmPrestige();
  assert.equal(JSON.stringify(c.game), before);
  assert.equal(c.saves, 0);
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  assert.match(html, /id="prestigeDialog"[^>]*oncancel="cancelPrestige\(\)"/);
});

test('changed rewards are displayed before a fresh confirmation; lost eligibility cancels', () => {
  const c = setup();
  c.armPrestige();
  c.game.totalFishEarned = 4e7;
  c.confirmPrestige();
  assert.equal(c.game.prestigeCount, 0);
  assert.match(c.document.getElementById('prestigeReceipt').innerHTML, /\+63/);
  c.confirmPrestige();
  assert.equal(c.game.fish, 63);
  assert.equal(c.game.catnip, 63);
  c.game.totalFishEarned = c.getCatnipNeeded();
  c.armPrestige();
  c.game.totalFishEarned = 0;
  c.confirmPrestige();
  assert.equal(c.game.prestigeCount, 1);
  assert.equal(c.document.getElementById('prestigeDialog').open, false);
});

test('receipt escapes names, shows one anchored cat and updates when retained levels change', () => {
  const c = setup();
  c.game.prestigeCount = 75;
  c.game.anchoredCatId = 'dachowiec';
  c.game.cats[0].count = 99;
  c.translations['cats.dachowiec'] = '<img src=x onerror=alert(1)>';
  const upg = c.game.upgrades.find(u => u.id === 'catnipclick');
  upg.level = 2;
  c.renderPrestigePanel();
  let html = c.document.getElementById('prestigeContent').innerHTML;
  assert.match(c.prestigeSettlementHTML(c.getPrestigeSettlement()), /1 × &lt;img/);
  assert.match(html, /×2/);
  upg.level = 3;
  c.renderPrestigePanel();
  html = c.document.getElementById('prestigeContent').innerHTML;
  assert.match(html, /×3/);
  const receipt = c.prestigeSettlementHTML(c.getPrestigeSettlement());
  assert.ok(!receipt.includes('<img'));
});

function setupLivePanel(activePanel = { id: 'panel-prestige' }) {
  const c = setup();
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/render.js'), 'utf8'), c);
  c.document.querySelector = () => activePanel;
  c.game.isReady = true;
  c.now = Date.now();
  c.Date = class extends Date { static now() { return c.now; } };
  c.game.lastTick = c.now;
  c.tick = () => { c.now += 1000; c.gameLoop(); };
  const panel = c.document.getElementById('prestigeContent');
  let html = '';
  c.panelWrites = 0;
  Object.defineProperty(panel, 'innerHTML', {
    get: () => html,
    set: value => { html = value; c.panelWrites++; },
  });
  return c;
}

test('live ticks enable prestige at the threshold, refresh the receipt and still require two clicks', () => {
  const c = setupLivePanel();
  const panel = c.document.getElementById('prestigeContent');
  const button = () => panel.innerHTML.match(/<button id="prestigeOpen"[^>]*>/)[0];
  c.game.totalFishEarned = c.getCatnipNeeded() - 2;
  c.game.fishPerSecond = 1;
  c.render();
  assert.match(button(), /disabled/);
  c.tick();
  assert.match(button(), /disabled/);
  assert.equal(c.panelWrites, 1); // Same receipt: preserve the button DOM.
  c.tick();
  assert.doesNotMatch(button(), /disabled/);
  assert.equal(c.panelWrites, 2);
  c.game.totalFishEarned = 4e7;
  c.tick();
  assert.match(panel.innerHTML, /\+63/);
  assert.equal(c.panelWrites, 3);
  c.tick();
  assert.equal(c.panelWrites, 3);
  c.confirmPrestige();
  assert.equal(c.game.prestigeCount, 0);
  assert.match(button(), /onclick="armPrestige\(\)"/);
  c.armPrestige();
  assert.equal(c.game.prestigeCount, 0);
  assert.equal(c.document.getElementById('prestigeDialog').open, true);
  c.tick();
  assert.equal(c.document.getElementById('prestigeDialog').open, true);
  c.confirmPrestige();
  assert.equal(c.game.prestigeCount, 1);
  assert.equal(c.game.fish, 63);
  assert.equal(c.saves, 1);
  c.tick();
  assert.match(button(), /disabled/);
});

test('common render refreshes prestige even without an active panel and skips unchanged DOM', () => {
  const c = setupLivePanel(null);
  const panel = c.document.getElementById('prestigeContent');
  c.game.totalFishEarned = 0;
  c.tick();
  assert.match(panel.innerHTML, /id="prestigeOpen"[^>]*disabled/);
  c.tick();
  assert.equal(c.panelWrites, 1);
  c.game.totalFishEarned = c.getCatnipNeeded();
  c.tick();
  assert.match(panel.innerHTML, /\+31/);
  assert.doesNotMatch(panel.innerHTML, /id="prestigeOpen"[^>]*disabled/);
  assert.equal(c.panelWrites, 2);
  c.game.totalFishEarned = 0;
  c.tick();
  assert.match(panel.innerHTML, /id="prestigeOpen"[^>]*disabled/);
});

test('panel, arming and confirmation enforce the live production floor after colony growth', () => {
  const c = setupLivePanel();
  c.game.prestigeCount = 200;
  c.game.prestigeMultiplier = 3;
  const phoenix = c.game.cats.find(cat => cat.id === 'kotfeniks');
  phoenix.count = 5;
  c.recalcFPS();
  c.game.totalFishEarned = 1080000000000; // Previous count-only requirement.
  c.render();
  const panel = c.document.getElementById('prestigeContent');
  assert.match(panel.innerHTML, /id="prestigeOpen"[^>]*disabled/);
  c.armPrestige();
  assert.equal(c.document.getElementById('prestigeDialog').open, false);
  c.game.totalFishEarned = c.getCatnipNeeded();
  c.render();
  assert.doesNotMatch(panel.innerHTML, /id="prestigeOpen"[^>]*disabled/);
  c.armPrestige();
  assert.equal(c.document.getElementById('prestigeDialog').open, true);
  phoenix.count++;
  c.confirmPrestige();
  assert.equal(c.game.prestigeCount, 200);
  assert.equal(c.document.getElementById('prestigeDialog').open, false);
  assert.equal(c.saves, 0);
});
