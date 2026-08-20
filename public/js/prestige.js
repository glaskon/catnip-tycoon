// Prestige system - reset progress for permanent catnip bonuses and tier unlocks

// Prestige tier definitions
const PRESTIGE_TIERS = [
  {
    tier: 1,
    required: 1,
    nameKey: 'prestige.tier1',
    rewards: ['Kot Mag (Wizard Cat) unlocked', 'New upgrades available'],
    unlocked: false,
  },
  {
    tier: 2,
    required: 3,
    nameKey: 'prestige.tier2',
    rewards: ['Cat Shrine: generates catnip per second', 'Bonus fish multiplier'],
    unlocked: false,
  },
  {
    tier: 3,
    required: 5,
    nameKey: 'prestige.tier3',
    rewards: ['Divine Artifacts: 2x global production', 'Premium cosmetic unlocks'],
    unlocked: false,
  },
];

// Render the prestige panel with progress bar and tier info
function renderPrestigePanel() {
  const container = document.getElementById('prestigeContent');
  if (!container) return;

  const needed = getCatnipNeeded();
  const progress = Math.min(100, (game.totalFishEarned / needed) * 100);
  const reward = calculatePrestigeReward();
  const canPrestige = game.totalFishEarned >= needed && reward > 0;

  let html = '';

  // Progress bar section
  html += `<p style="color: var(--text-secondary); margin-bottom: 8px;">${i18n.t('prestige.description')}</p>`;
  html += `<div class="prestige-progress">`;
  html += `<div class="prestige-bar" style="width: ${Math.min(100, progress)}%">`;
  if (progress > 15) {
    html += `${progress.toFixed(1)}%`;
  }
  html += `</div></div>`;

  html += `<p style="font-size: 0.85rem; color: var(--text-secondary);">`;
  html += `🐟 ${formatNumber(game.totalFishEarned)} / ${formatNumber(needed)} ${i18n.t('prestige.needed')}`;
  html += `</p>`;

  // Reward info
  html += `<div style="margin: 16px 0; padding: 12px; background: var(--bg-tertiary); border-radius: var(--border-radius);">`;
  html += `<p style="font-size: 0.9rem;">${i18n.t('prestige.gain')}: <b style="color: var(--gold);">🌿 ${formatNumber(reward)} catnip</b></p>`;
  html += `<p style="font-size: 0.75rem; color: var(--text-muted);">${i18n.t('prestige.progress')} resets: fish, cats, upgrades</p>`;
  html += `<p style="font-size: 0.75rem; color: var(--text-muted);">✅ Kept: catnip, diamonds, prestige tiers</p>`;
  html += `</div>`;

  // Prestige button
  html += `<button class="btn btn-warning" onclick="performPrestige()" ${!canPrestige ? 'disabled' : ''}>`;
  html += `✨ ${i18n.t('prestige.perform')}`;
  html += `</button>`;

  if (!canPrestige && game.totalFishEarned > 0) {
    html += `<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">`;
    html += `Need ${formatNumber(needed - game.totalFishEarned)} more fish`;
    html += `</p>`;
  }

  // Current prestige info
  html += `<div style="margin-top: 16px;">`;
  html += `<p style="font-size: 0.9rem;"><b>Prestige Count:</b> ${game.prestigeCount}</p>`;
  html += `<p style="font-size: 0.9rem;"><b>Catnip:</b> 🌿 ${formatNumber(Math.floor(game.catnip))}</p>`;
  if (game.prestigeCount >= 3) {
    html += `<p style="font-size: 0.8rem; color: var(--success);">⚡ Cat Shrine active! +0.01 catnip/s</p>`;
  }
  if (game.prestigeCount >= 5) {
    html += `<p style="font-size: 0.8rem; color: var(--gold);">🌟 Divine Artifacts active! 2x global production</p>`;
  }
  html += `</div>`;

  // Prestige tiers
  html += `<div style="margin-top: 20px;">`;
  html += `<h3 style="color: var(--cat-orange); margin-bottom: 10px;">${i18n.t('prestige.tier')} Progress</h3>`;

  for (const tier of PRESTIGE_TIERS) {
    const earned = game.prestigeCount >= tier.required;
    const active = tier.required > game.prestigeCount && tier.required <= game.prestigeCount + 1;
    let tierClass = '';
    if (earned) tierClass = 'earned';
    else if (active) tierClass = 'active';

    html += `<div class="prestige-tier ${tierClass}">`;
    html += `<p style="font-weight: bold;">${i18n.t(tier.nameKey, `Tier ${tier.tier}`)}</p>`;
    html += `<p style="font-size: 0.75rem; color: var(--text-secondary);">Requires: ${tier.required} prestige(s) — ${earned ? '✅ Unlocked' : `🔒 ${game.prestigeCount}/${tier.required}`}</p>`;
    html += `<ul style="font-size: 0.75rem; color: var(--text-muted); padding-left: 16px; margin-top: 4px;">`;
    for (const reward of tier.rewards) {
      html += `<li>${reward}</li>`;
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
    // Show success toast
    showToast('✨ Prestige complete!');
    // Re-render prestige panel
    renderPrestigePanel();
    // Save game
    saveGame();
  }
}

// Show prestige rewards that will be unlocked
function showPrestigeRewards() {
  const nextTier = PRESTIGE_TIERS.find(t => t.required > game.prestigeCount);
  if (!nextTier) {
    return 'All tiers unlocked! 🎉';
  }
  return nextTier.rewards.join(', ');
}

// Expose to global scope
window.renderPrestigePanel = renderPrestigePanel;
window.performPrestige = performPrestige;
window.showPrestigeRewards = showPrestigeRewards;
window.PRESTIGE_TIERS = PRESTIGE_TIERS;