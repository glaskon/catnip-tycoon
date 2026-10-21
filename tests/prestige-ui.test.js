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
