// Gacha module — cosmetic pulls with OPEN drop rates and a visible pity counter.
// Fair-play: cosmetics only, transparent rates, duplicates refunded in catnip.

const GACHA_SINGLE_COST = 50;   // catnip per single pull
const GACHA_MULTI_PULLS = 5;
const GACHA_MULTI_COST = 225;   // 10% off (250 -> 225)
const GACHA_PITY = 10;          // guaranteed Rare+ every 10 pulls

// Open rates (percent) — displayed in the UI
const GACHA_RATES = { common: 70, rare: 25, epic: 4.5, legendary: 0.5 };
// Duplicate refund by rarity (catnip)
const GACHA_DUP_REFUND = { common: 10, rare: 25, epic: 25, legendary: 50 };

// Pool: reuses shop cosmetic ids + 2 gacha-exclusives.
// Rarities: common 70% / rare 25% / epic 4.5% / legendary 0.5%
const GACHA_POOL = [
  { id: 'skin_orange',    rarity: 'common' },
  { id: 'skin_black',     rarity: 'common' },
  { id: 'effect_sparkle', rarity: 'common' },
  { id: 'skin_siamese',   rarity: 'rare' },
  { id: 'outfit_hat',     rarity: 'rare' },
  { id: 'effect_rainbow', rarity: 'rare' },
  { id: 'outfit_crown',   rarity: 'epic' },
  { id: 'effect_aurora',  rarity: 'epic' },      // gacha-exclusive
  { id: 'skin_galaxy',    rarity: 'legendary' }, // gacha-exclusive
];

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

function getGacha() {
  if (!game.gacha) {
    game.gacha = { totalPulls: 0, pity: 0, counts: {} };
  }
  return game.gacha;
}

// Roll a rarity. forceRareOrBetter = pity roll (normalized within rare+ mass).
function rollRarity(forceRareOrBetter) {
  const roll = Math.random() * 100;
  if (!forceRareOrBetter) {
    if (roll < GACHA_RATES.legendary) return 'legendary';
    if (roll < GACHA_RATES.legendary + GACHA_RATES.epic) return 'epic';
    if (roll < GACHA_RATES.legendary + GACHA_RATES.epic + GACHA_RATES.rare) return 'rare';
    return 'common';
  }
  // Pity: same relative ratios within the rare+ pool (25 : 4.5 : 0.5 = 30 mass)
  const x = Math.random() * 30;
  if (x < 0.5) return 'legendary';
  if (x < 5.0) return 'epic';
  return 'rare';
}

function pickPoolItem(rarity) {
  const candidates = GACHA_POOL.filter(p => p.rarity === rarity);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Perform n pulls (1 or 5). Returns array of results or null if unaffordable.
function pullGacha(n) {
  const g = getGacha();
  const cost = (n === GACHA_MULTI_PULLS) ? GACHA_MULTI_COST : GACHA_SINGLE_COST;
  if (!canAfford(cost, 'catnip')) {
    showDebug('pullGacha: need ' + cost + ' catnip (have ' + game.catnip.toFixed(0) + ')');
    return null;
  }
  game.catnip -= cost;

  const results = [];
  for (let i = 0; i < n; i++) {
    const forced = (g.pity + 1) >= GACHA_PITY;
    const rarity = rollRarity(forced);
    const item = pickPoolItem(rarity);

    g.totalPulls++;
    g.pity = (rarity === 'common') ? g.pity + 1 : 0;
    g.counts[item.id] = (g.counts[item.id] || 0) + 1;

    let isNew = false;
    let refunded = 0;
    if (!hasItem(item.id)) {
      purchasedItems.push(item.id);
      savePurchasedItems();
      applyShopItem(item.id);
      isNew = true;
    } else {
      refunded = GACHA_DUP_REFUND[rarity];
      game.catnip += refunded;
    }
    results.push({ id: item.id, rarity: rarity, isNew: isNew, refunded: refunded });
  }

  // Reveal: best rarity first (visual drama), original order kept in data
  window._gachaResults = results.slice().sort((a, b) =>
    RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));

  // Juiciness: sound + flash scaled to the best pull
  const best = RARITY_ORDER.indexOf(window._gachaResults[0].rarity);
  if (best >= 3) { sound.prestige(); luckyFlash(); screenShake(); }
  else if (best === 2) { sound.achievement(); luckyFlash(); }
  else if (best === 1) { sound.lucky(); }
  else { sound.buy(); }

  showToast('🎰 ' + i18n.t('gacha.pulledToast', 'Pull complete!'));
  showDebug('pullGacha: n=' + n + ' cost=' + cost + ' best=' + window._gachaResults[0].rarity + ' pity=' + g.pity);
  saveGame();
  renderGacha();
  return window._gachaResults;
}

// ---------- UI ----------

const RARITY_CSS = {
  common: 'gacha-card-common',
  rare: 'gacha-card-rare',
  epic: 'gacha-card-epic',
  legendary: 'gacha-card-legendary',
};

function gachaItemIcon(itemId) {
  const item = SHOP_ITEMS.find(s => s.id === itemId);
  if (item) return item.icon;
  if (itemId.startsWith('skin_')) return '🐈';
  if (itemId.startsWith('effect_')) return '✨';
  return '🎁';
}

function gachaItemName(itemId) {
  return i18n.t('shop.item.' + itemId, itemId);
}

let _gachaSig = null;
function renderGacha() {
  const container = document.getElementById('gachaContent');
  if (!container) return;

  const g = getGacha();
  const results = window._gachaResults || null;
  let countsSig = '';
  for (const p of GACHA_POOL) countsSig += (g.counts[p.id] || 0) + ':';
  const sig = [i18n.currentLang, Math.floor(game.catnip), g.pity, g.totalPulls, countsSig, results ? results.length : 0].join('|');
  if (sig === _gachaSig) return;
  _gachaSig = sig;

  let html = '';

  // Pull buttons
  html += `<div style="text-align: center; padding: 8px 0 4px;">`;
  html += `<button class="btn btn-primary" onclick="pullGacha(1)" ${game.catnip < GACHA_SINGLE_COST ? 'disabled' : ''}>🎰 ${i18n.t('gacha.pull1', '1 pull')} — {n}🌿</button>`.replace('{n}', String(GACHA_SINGLE_COST));
  html += ` `;
  html += `<button class="btn btn-primary" onclick="pullGacha(${GACHA_MULTI_PULLS})" ${game.catnip < GACHA_MULTI_COST ? 'disabled' : ''}>🎰 ${i18n.t('gacha.pull5', '5 pulls')} — {n}🌿</button>`.replace('{n}', String(GACHA_MULTI_COST));
  html += `<div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 6px;">${i18n.t('gacha.multiDiscount', '5-pull: 10% off')}</div>`;
  html += `</div>`;

  // Open rates + pity (transparency, required)
  html += `<div class="gacha-rates">`;
  html += `<span class="gacha-rate gacha-rate-common">${i18n.t('gacha.rarity.common', 'Common')} ${GACHA_RATES.common}%</span>`;
  html += `<span class="gacha-rate gacha-rate-rare">${i18n.t('gacha.rarity.rare', 'Rare')} ${GACHA_RATES.rare}%</span>`;
  html += `<span class="gacha-rate gacha-rate-epic">${i18n.t('gacha.rarity.epic', 'Epic')} ${GACHA_RATES.epic}%</span>`;
  html += `<span class="gacha-rate gacha-rate-legendary">${i18n.t('gacha.rarity.legendary', 'Legendary')} ${GACHA_RATES.legendary}%</span>`;
  html += `</div>`;
  html += `<p style="text-align: center; font-size: 0.75rem; color: var(--text-secondary);">`;
  html += `${i18n.t('gacha.pityLabel', 'Pity')}: <b>${g.pity}/${GACHA_PITY}</b> — ${i18n.t('gacha.pityDesc', 'guaranteed Rare+ every 10 pulls')}`;
  html += `</p>`;

  // Reveal area
  if (results) {
    html += `<div class="gacha-reveal">`;
    for (const r of results) {
      html += `<div class="gacha-card ${RARITY_CSS[r.rarity]}">`;
      html += `<div class="gacha-card-icon">${gachaItemIcon(r.id)}</div>`;
      html += `<div class="gacha-card-name">${gachaItemName(r.id)}</div>`;
      html += `<div class="gacha-card-rarity">${i18n.t('gacha.rarity.' + r.rarity, r.rarity)}</div>`;
      if (r.isNew) {
        html += `<div class="gacha-card-new">✨ ${i18n.t('gacha.new', 'NEW!')}</div>`;
      } else if (r.refunded > 0) {
        html += `<div class="gacha-card-dup">${i18n.t('gacha.dup', 'Duplicate')} +{n}🌿</div>`.replace('{n}', String(r.refunded));
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  // Collection
  html += `<h3 style="margin-top: 18px;">${i18n.t('gacha.collection', 'Collection')}</h3>`;
  html += `<div class="gacha-grid">`;
  for (const p of GACHA_POOL) {
    const owned = hasItem(p.id);
    const count = g.counts[p.id] || 0;
    html += `<div class="gacha-slot ${RARITY_CSS[p.rarity].replace('gacha-card', 'gacha-slot')} ${owned ? '' : 'gacha-slot-locked'}">`;
    html += `<div class="gacha-slot-icon">${owned ? gachaItemIcon(p.id) : '❓'}</div>`;
    html += `<div class="gacha-slot-name">${owned ? gachaItemName(p.id) : i18n.t('gacha.undiscovered', '???')}</div>`;
    if (count > 0) html += `<div class="gacha-slot-count">×${count}</div>`;
    html += `</div>`;
  }
  html += `</div>`;

  html += `<p style="text-align: center; font-size: 0.7rem; color: var(--text-muted); margin-top: 12px;">${i18n.t('gacha.totalPulls', 'Total pulls')}: {n}</p>`.replace('{n}', String(g.totalPulls));
  container.innerHTML = html;
}

window.pullGacha = pullGacha;
window.renderGacha = renderGacha;
window.getGacha = getGacha;
window.GACHA_POOL = GACHA_POOL;