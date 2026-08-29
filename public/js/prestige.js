// Prestige system - reset progress for permanent catnip bonuses and tier unlocks

// Prestige tier definitions — expanded from 3 to 9 tiers
const PRESTIGE_TIERS = [
  {
    tier: 1,
    required: 1,
    nameKey: 'prestige.tier1',
    rewardKeys: ['prestige.tier1r1', 'prestige.tier1r2'],
    unlocked: false,
  },
  {
    tier: 2,
    required: 3,
    nameKey: 'prestige.tier2',
    rewardKeys: ['prestige.tier2r1', 'prestige.tier2r2'],
    unlocked: false,
  },
  {
    tier: 3,
    required: 5,
    nameKey: 'prestige.tier3',
    rewardKeys: ['prestige.tier3r1', 'prestige.tier3r2'],
    unlocked: false,
  },
  {
    tier: 4,
    required: 10,
    nameKey: 'prestige.tier4',
    rewardKeys: ['prestige.tier4r1', 'prestige.tier4r2'],
    unlocked: false,
  },
  {
    tier: 5,
    required: 20,
    nameKey: 'prestige.tier5',
    rewardKeys: ['prestige.tier5r1'],
    unlocked: false,
  },
  {
    tier: 6,
    required: 35,
    nameKey: 'prestige.tier6',
    rewardKeys: ['prestige.tier6r1'],
    unlocked: false,
  },
  {
    tier: 7,
    required: 50,
    nameKey: 'prestige.tier7',
    rewardKeys: ['prestige.tier7r1'],
    unlocked: false,
  },
  {
    tier: 8,
    required: 75,
    nameKey: 'prestige.tier8',
    rewardKeys: ['prestige.tier8r1'],
    unlocked: false,
  },
  {
    tier: 9,
    required: 100,
    nameKey: 'prestige.tier9',
    rewardKeys: ['prestige.tier9r1'],
    unlocked: false,
  },
];

// --- Elixir System (unlocked at Tier 4, prestige >= 10) ---

let elixirTimer = 0;
const ELIXIR_RATE_PER_PRESTIGE = 1 / 60; // 1 elixir per minute per prestige over 10

// Called from gameLoop every 100ms
function tickElixirs(delta) {
  if (game.prestigeCount < 10) return;
  
  let rate = (game.prestigeCount - 9) * ELIXIR_RATE_PER_PRESTIGE;
  // ElixirMastery: +50% elixir rate
  if (typeof hasUpgrade === 'function' && hasUpgrade('elixirmastery')) {
    rate *= 1.5;
  }
  game.elixirs += rate * delta;
}

// Spend elixirs on a temporary boost
function useElixirBoost(type) {
  const costs = { speed: 5, click: 3, production: 10 };
  const cost = costs[type];
  if (!cost || game.elixirs < cost) return false;
  
  game.elixirs -= cost;
  
  switch (type) {
    case 'speed':
      game.speedMultiplier *= 10;
      setTimeout(() => {
        game.speedMultiplier /= 10;
        showToast(i18n.t('toast.speedExpired'));
        render();
      }, 30000);
      showToast(i18n.t('toast.speedBoost'));
      break;
    case 'click':
      game.fishPerClick *= 5;
      setTimeout(() => {
        game.fishPerClick /= 5;
        showToast(i18n.t('toast.clickExpired'));
        render();
      }, 120000);
      showToast(i18n.t('toast.clickBoost'));
      break;
    case 'production':
      // 10x production for 30 seconds
      const oldProd = game.cats.map(c => c.count * c.baseProduction);
      // We'll handle this via a temporary multiplier in recalcFPS
      game._prodBoost = true;
      setTimeout(() => {
        game._prodBoost = false;
        showToast(i18n.t('toast.prodExpired'));
        recalcFPS();
        render();
      }, 30000);
      recalcFPS();
      showToast(i18n.t('toast.prodBoost'));
      break;
  }
  render();
  return true;
}

// --- Cat Anchor (Tier 6, prestige >= 35) ---

function setAnchoredCat(catId) {
  if (game.prestigeCount < 35) return;
  game.anchoredCatId = game.anchoredCatId === catId ? null : catId;
  renderPrestigePanel();
}

// --- Preserved Upgrade (Tier 8, prestige >= 75) ---

function setPreservedUpgrade(upgradeId) {
  if (game.prestigeCount < 75) return;
  game.preservedUpgradeId = game.preservedUpgradeId === upgradeId ? null : upgradeId;
  renderPrestigePanel();
}

// --- Render the prestige panel with progress and tier info ---

// Coarse render signature: only rebuild the panel when something STRUCTURAL
// changed. Hot numbers (fish counter, progress bar, balances, cashback) are
// updated in place by updateStats() every tick — rebuilding the whole DOM
// every 100ms replaced the prestige button under the cursor (swallowed
// clicks, "have to click many times").
let _prestigeRenderSig = null;
function renderPrestigePanel() {
  const container = document.getElementById('prestigeContent');
  if (!container) return;

  const needed = getCatnipNeeded();
  const progress = Math.min(100, (game.totalFishEarned / needed) * 100);
  const reward = calculatePrestigeReward();
  const canPrestige = game.totalFishEarned >= needed && reward > 0;

  const elixirFloor = Math.floor(game.elixirs);
  const sig = [
    i18n.currentLang,
    canPrestige ? 1 : 0,
    Math.floor(reward),
    game.prestigeCount,
    game.totalFishEarned > 0 ? 1 : 0,
    Math.floor(game.totalFishEarned * 0.1 / 100) > 0 ? 1 : 0,
    game.anchoredCatId || '',
    game.preservedUpgradeId || '',
    (elixirFloor >= 3 ? 1 : 0) + (elixirFloor >= 5 ? 1 : 0) + (elixirFloor >= 10 ? 1 : 0),
    game.cats.map(c => c.count > 0 ? 1 : 0).join(''),
    game.upgrades.map(u => (u.purchased || u.id === game.preservedUpgradeId) ? 1 : 0).join(''),
  ].join('|');
  if (sig === _prestigeRenderSig) return;
  _prestigeRenderSig = sig;

  let html = '';

  // --- Progress bar section ---
  html += `<p style="color: var(--text-secondary); margin-bottom: 8px;">${i18n.t('prestige.description')}</p>`;
  html += `<div class="prestige-progress">`;
  html += `<div class="prestige-bar" id="prestigeBar" style="width: ${Math.min(100, progress)}%">`;
  if (progress > 15) {
    html += `${progress.toFixed(1)}%`;
  }
  html += `</div></div>`;

  html += `<p id="prestigeFishLine" style="font-size: 0.85rem; color: var(--text-secondary);">`;
  html += `🐟 ${formatNumber(game.totalFishEarned)} / ${formatNumber(needed)} ${i18n.t('prestige.needed')}`;
  html += `</p>`;

  // Reward info
  html += `<div style="margin: 16px 0; padding: 12px; background: var(--bg-tertiary); border-radius: var(--border-radius);">`;
  html += `<p style="font-size: 0.9rem;">${i18n.t('prestige.gain')}: <b style="color: var(--gold);">${i18n.t('prestige.rewardCatnip', '🌿 {n} catnip').replace('{n}', formatNumber(reward))}</b></p>`;

  // Tier 7: Catnip cashback
  if (game.prestigeCount >= 50) {
    const cashback = Math.floor(game.totalFishEarned * 0.1 / 100);
    if (cashback > 0) {
      html += `<p id="prestigeCashbackLine" style="font-size: 0.8rem; color: var(--cat-orange);">${i18n.t('prestige.cashback', '🐟 Cat Grace: +🌿 {n} cashback!').replace('{n}', formatNumber(cashback))}</p>`;
    }
  }

  html += `<p style="font-size: 0.75rem; color: var(--text-muted);">${i18n.t('prestige.resetsNote', 'resets: fish, cats, upgrades')}</p>`;
  html += `<p style="font-size: 0.75rem; color: var(--text-muted);">${i18n.t('prestige.keptNote', '✅ Kept: catnip, diamonds, prestige tiers')}</p>`;
  html += `</div>`;

  // Prestige button
  html += `<button class="btn btn-warning" onclick="performPrestige()" ${!canPrestige ? 'disabled' : ''}>`;
  html += `✨ ${i18n.t('prestige.perform')}</button>`;

  if (!canPrestige && game.totalFishEarned > 0) {
    html += `<p id="prestigeNeedMore" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">`;
    html += i18n.t('prestige.needMore', 'Need {n} more fish').replace('{n}', formatNumber(needed - game.totalFishEarned));
    html += `</p>`;
  }

  // Current prestige info
  html += `<div style="margin-top: 16px;">`;
  html += `<p style="font-size: 0.9rem;"><b>${i18n.t('prestige.count', 'Prestige Count')}:</b> ${game.prestigeCount}</p>`;
  html += `<p style="font-size: 0.9rem;"><b>${i18n.t('prestige.catnipLabel', 'Catnip')}:</b> 🌿 <span id="prestigeCatnipVal">${formatNumber(Math.floor(game.catnip))}</span></p>`;
  html += `<p style="font-size: 0.9rem;"><b>${i18n.t('prestige.elixirsLabel', 'Elixirs')}:</b> 🧪 ${formatNumber(Math.floor(game.elixirs))}</p>`;

  // Show active bonuses
  if (game.prestigeCount >= 3) {
    html += `<p style="font-size: 0.8rem; color: var(--success);">${i18n.t('prestige.shrineActive', '⚡ Cat Shrine active! +{rate} catnip/s').replace('{rate}', String(getCatnipShrineRate()))}</p>`;
  }
  if (game.prestigeCount >= 5) {
    html += `<p style="font-size: 0.8rem; color: var(--gold);">${i18n.t('prestige.artifactsActive', '🌟 Divine Artifacts active! 2x global production')}</p>`;
  }
  if (game.prestigeCount >= 10) {
    const pctBonus = Math.floor(game.prestigeCount / 10) * 5;
    html += `<p style="font-size: 0.8rem; color: var(--cat-orange);">${i18n.t('prestige.ascensionBonus', '📈 +{pct}% fish/s from Ascension Tiers').replace('{pct}', String(pctBonus))}</p>`;
  }
  html += `</div>`;

  // --- Elixir panel (Tier 4+) ---
  if (game.prestigeCount >= 10) {
    html += `<div style="margin-top: 20px; padding: 12px; background: var(--bg-secondary); border: 1px solid #a855f7; border-radius: var(--border-radius);">`;
    html += `<h3 style="color: #a855f7; margin-bottom: 8px;">${i18n.t('prestige.alchemy', '🧪 Alchemy — Elixirs')}</h3>`;
    html += `<p style="font-size: 0.8rem; color: var(--text-secondary);">${i18n.t('prestige.elixirsHave', 'You have {n} elixirs ({rate}/min)')
      .replace('{n}', `<b style="color: #a855f7;"><span id="prestigeElixirVal">${formatNumber(elixirFloor)}</span></b>`)
      .replace('{rate}', formatNumber(ELIXIR_RATE_PER_PRESTIGE * (game.prestigeCount - 9)))}</p>`;
    html += `<div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">`;
    
    const hasSpeed = game.elixirs >= 5;
    const hasClick = game.elixirs >= 3;
    const hasProd = game.elixirs >= 10;
    
    html += `<button class="btn btn-sm" onclick="useElixirBoost('speed')" ${!hasSpeed ? 'disabled' : ''} style="background: #a855f7; color: #fff;">${i18n.t('prestige.boostSpeed', '⚡ 10× Speed 30s (5🧪)')}</button>`;
    html += `<button class="btn btn-sm" onclick="useElixirBoost('click')" ${!hasClick ? 'disabled' : ''} style="background: #a855f7; color: #fff;">${i18n.t('prestige.boostClick', '👆 5× Click 2min (3🧪)')}</button>`;
    html += `<button class="btn btn-sm" onclick="useElixirBoost('production')" ${!hasProd ? 'disabled' : ''} style="background: #a855f7; color: #fff;">${i18n.t('prestige.boostProd', '🧪 10× Prod 30s (10🧪)')}</button>`;
    
    html += `</div></div>`;
  }

  // --- Cat Anchor (Tier 6+) ---
  if (game.prestigeCount >= 35) {
    html += `<div style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--cat-orange); border-radius: var(--border-radius);">`;
    html += `<h3 style="color: var(--cat-orange); margin-bottom: 8px;">${i18n.t('prestige.catAnchor', '⚓ Cat Anchor')}</h3>`;
    html += `<p style="font-size: 0.8rem; color: var(--text-secondary);">${i18n.t('prestige.chooseCat', 'Choose one cat to keep through prestige:')}</p>`;
    html += `<div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">`;
    for (const cat of game.cats) {
      if (cat.count > 0) {
        const isAnchored = game.anchoredCatId === cat.id;
        html += `<button class="btn btn-sm ${isAnchored ? 'btn-primary' : 'btn-secondary'}" onclick="setAnchoredCat('${cat.id}')">
          ${cat.id === 'kotfeniks' ? '🐲' : '🐱'} ${i18n.t(cat.nameKey, cat.id)} ${isAnchored ? '✅' : ''}</button>`;
      }
    }
    if (game.anchoredCatId) {
      html += `<p style="font-size: 0.75rem; color: var(--success); margin-top: 4px;">${i18n.t('prestige.anchored', '✅ Anchored: {name}').replace('{name}', i18n.t(game.cats.find(c => c.id === game.anchoredCatId)?.nameKey || '', ''))}</p>`;
    }
    html += `</div></div>`;
  }

  // --- Preserved Upgrade (Tier 8+) ---
  if (game.prestigeCount >= 75) {
    html += `<div style="margin-top: 16px; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--gold); border-radius: var(--border-radius);">`;
    html += `<h3 style="color: var(--gold); margin-bottom: 8px;">${i18n.t('prestige.preservedTitle', '👑 Chosen One')}</h3>`;
    html += `<p style="font-size: 0.8rem; color: var(--text-secondary);">${i18n.t('prestige.chooseUpgrade', 'Choose one upgrade to keep through prestige:')}</p>`;
    html += `<div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">`;
    for (const upg of game.upgrades) {
      if (upg.purchased || (game.preservedUpgradeId === upg.id)) {
        const isPreserved = game.preservedUpgradeId === upg.id;
        html += `<button class="btn btn-sm ${isPreserved ? 'btn-warning' : 'btn-secondary'}" onclick="setPreservedUpgrade('${upg.id}')">
          ⬆️ ${i18n.t(upg.nameKey, upg.id)} ${isPreserved ? '✅' : ''}</button>`;
      }
    }
    if (game.preservedUpgradeId) {
      const name = game.upgrades.find(u => u.id === game.preservedUpgradeId);
      html += `<p style="font-size: 0.75rem; color: var(--gold); margin-top: 4px;">${i18n.t('prestige.preserved', '👑 Preserved: {name}').replace('{name}', i18n.t(name?.nameKey || '', ''))}</p>`;
    }
    html += `</div></div>`;
  }

  // --- Prestige Tiers progress ---
  html += `<div style="margin-top: 20px;">`;
  html += `<h3 style="color: var(--cat-orange); margin-bottom: 10px;">${i18n.t('prestige.tierProgress', 'Tier Progress')}</h3>`;

  for (const tier of PRESTIGE_TIERS) {
    const earned = game.prestigeCount >= tier.required;
    const isNext = !earned && (tier.required > game.prestigeCount) && 
      (tier.required <= game.prestigeCount + 1 || !game.prestigeCount);
    let tierClass = '';
    if (earned) tierClass = 'earned';
    else if (isNext) tierClass = 'active';

    html += `<div class="prestige-tier ${tierClass}">`;
    html += `<p style="font-weight: bold;">${i18n.t(tier.nameKey, `Tier ${tier.tier}`)}</p>`;
    html += `<p style="font-size: 0.75rem; color: var(--text-secondary);">${i18n.t('prestige.tierRequires', 'Requires: {n} prestige(s)').replace('{n}', String(tier.required))} — ${earned ? i18n.t('prestige.tierUnlocked', '✅ Unlocked') : `🔒 ${game.prestigeCount}/${tier.required}`}</p>`;
    html += `<ul style="font-size: 0.75rem; color: var(--text-muted); padding-left: 16px; margin-top: 4px;">`;
    for (const rewardKey of tier.rewardKeys) {
      html += `<li>${i18n.t(rewardKey, '')}</li>`;
    }
    html += `</ul>`;
    html += `</div>`;
  }
  html += `</div>`;

  container.innerHTML = html;
}

// Wrapper function to call prestige and show feedback
function performPrestige() {
  if (prestige()) {
    showToast(i18n.t('prestige.completeToast', '✨ Prestige complete!'));
    renderPrestigePanel();
    saveGame();
  }
}

// Show prestige rewards that will be unlocked next
function showPrestigeRewards() {
  const nextTier = PRESTIGE_TIERS.find(t => t.required > game.prestigeCount);
  if (!nextTier) {
    return i18n.t('prestige.allTiersUnlocked', 'All tiers unlocked! 🎉');
  }
  return nextTier.rewardKeys.map(k => i18n.t(k, '')).join(', ');
}

// Expose to global scope
window.renderPrestigePanel = renderPrestigePanel;
window.performPrestige = performPrestige;
window.showPrestigeRewards = showPrestigeRewards;
window.PRESTIGE_TIERS = PRESTIGE_TIERS;
window.useElixirBoost = useElixirBoost;
window.tickElixirs = tickElixirs;
window.setAnchoredCat = setAnchoredCat;
window.setPreservedUpgrade = setPreservedUpgrade;