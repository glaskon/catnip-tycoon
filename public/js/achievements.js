// Achievements module - tracks and awards achievements based on player actions

// Achievement definitions with conditions and rewards
const ACHIEVEMENTS = [
  {
    id: 'first_click',
    nameKey: 'achievements.firstClick',
    descKey: 'achievements.firstClickDesc',
    icon: '🐟',
    condition: () => game.clickCount >= 100,
    progress: () => ({ current: game.clickCount, target: 100 }),
    reward: { fish: 50 },
    earned: false,
  },
  {
    id: 'cat_lover',
    nameKey: 'achievements.catLover',
    descKey: 'achievements.catLoverDesc',
    icon: '🐱',
    condition: () => game.totalCatsBought >= 10,
    progress: () => ({ current: game.totalCatsBought, target: 10 }),
    reward: { fish: 200 },
    earned: false,
  },
  {
    id: 'millionaire',
    nameKey: 'achievements.millionaire',
    descKey: 'achievements.millionaireDesc',
    icon: '💰',
    condition: () => game.totalFishEarned >= 1_000_000,
    progress: () => ({ current: game.totalFishEarned, target: 1_000_000 }),
    reward: { diamonds: 5 },
    earned: false,
  },
  {
    id: 'prestigious',
    nameKey: 'achievements.prestigious',
    descKey: 'achievements.prestigiousDesc',
    icon: '✨',
    condition: () => game.prestigeCount >= 1,
    progress: () => ({ current: game.prestigeCount, target: 1 }),
    reward: { diamonds: 10 },
    earned: false,
  },
  {
    id: 'catnip_lord',
    nameKey: 'achievements.catnipLord',
    descKey: 'achievements.catnipLordDesc',
    icon: '🌿',
    condition: () => game.catnip >= 100,
    progress: () => ({ current: Math.floor(game.catnip), target: 100 }),
    reward: { diamonds: 15 },
    earned: false,
  },
  {
    id: 'click_master',
    nameKey: 'achievements.clickMaster',
    descKey: 'achievements.clickMasterDesc',
    icon: '👆',
    condition: () => game.clickCount >= 10_000,
    progress: () => ({ current: game.clickCount, target: 10_000 }),
    reward: { fish: 5000 },
    earned: false,
  },
  {
    id: 'cat_army',
    nameKey: 'achievements.catArmy',
    descKey: 'achievements.catArmyDesc',
    icon: '🐾',
    condition: () => game.totalCatsBought >= 100,
    progress: () => ({ current: game.totalCatsBought, target: 100 }),
    reward: { fish: 50000 },
    earned: false,
  },
  {
    id: 'billionaire',
    nameKey: 'achievements.billionaire',
    descKey: 'achievements.billionaireDesc',
    icon: '💎',
    condition: () => game.totalFishEarned >= 1_000_000_000,
    progress: () => ({ current: game.totalFishEarned, target: 1_000_000_000 }),
    reward: { diamonds: 50 },
    earned: false,
  },
  {
    id: 'prestige_master',
    nameKey: 'achievements.prestigeMaster',
    descKey: 'achievements.prestigeMasterDesc',
    icon: '🌟',
    condition: () => game.prestigeCount >= 5,
    progress: () => ({ current: game.prestigeCount, target: 5 }),
    reward: { diamonds: 100 },
    earned: false,
  },
  {
    id: 'catnip_king',
    nameKey: 'achievements.catnipKing',
    descKey: 'achievements.catnipKingDesc',
    icon: '👑',
    condition: () => game.catnip >= 1000,
    progress: () => ({ current: Math.floor(game.catnip), target: 1000 }),
    reward: { diamonds: 200 },
    earned: false,
  },
  {
    id: 'speed_demon',
    nameKey: 'achievements.speedDemon',
    descKey: 'achievements.speedDemonDesc',
    icon: '⚡',
    condition: () => game.fishPerSecond >= 1000,
    progress: () => ({ current: game.fishPerSecond, target: 1000 }),
    reward: { fish: 10000 },
    earned: false,
  },
  {
    id: 'fish_collector',
    nameKey: 'achievements.fishCollector',
    descKey: 'achievements.fishCollectorDesc',
    icon: '🎣',
    condition: () => game.totalFishEarned >= 100_000,
    progress: () => ({ current: game.totalFishEarned, target: 100_000 }),
    reward: { fish: 5000 },
    earned: false,
  },
  {
    id: 'ten_million',
    nameKey: 'achievements.tenMillion',
    descKey: 'achievements.tenMillionDesc',
    icon: '🏦',
    condition: () => game.totalFishEarned >= 10_000_000,
    progress: () => ({ current: game.totalFishEarned, target: 10_000_000 }),
    reward: { diamonds: 20 },
    earned: false,
  },
  {
    id: 'cat_empire',
    nameKey: 'achievements.catEmpire',
    descKey: 'achievements.catEmpireDesc',
    icon: '🏰',
    condition: () => game.totalCatsBought >= 500,
    progress: () => ({ current: game.totalCatsBought, target: 500 }),
    reward: { fish: 500000 },
    earned: false,
  },
  {
    id: 'idle_master',
    nameKey: 'achievements.idleMaster',
    descKey: 'achievements.idleMasterDesc',
    icon: '⏰',
    condition: () => game.fishPerSecond >= 100000,
    progress: () => ({ current: game.fishPerSecond, target: 100000 }),
    reward: { diamonds: 30 },
    earned: false,
  },
  {
    id: 'first_cat',
    nameKey: 'achievements.firstCat',
    descKey: 'achievements.firstCatDesc',
    icon: '😺',
    condition: () => game.totalCatsBought >= 1,
    progress: () => ({ current: game.totalCatsBought, target: 1 }),
    reward: { fish: 20 },
    earned: false,
  },
  {
    id: 'upgrade_novice',
    nameKey: 'achievements.upgradeNovice',
    descKey: 'achievements.upgradeNoviceDesc',
    icon: '🔧',
    condition: () => game.upgrades.filter(u => u.purchased).length >= 3,
    progress: () => ({
      current: game.upgrades.filter(u => u.purchased).length,
      target: 3,
    }),
    reward: { fish: 1000 },
    earned: false,
  },
  {
    id: 'upgrade_master',
    nameKey: 'achievements.upgradeMaster',
    descKey: 'achievements.upgradeMasterDesc',
    icon: '⚙️',
    condition: () => game.upgrades.every(u => u.purchased),
    progress: () => ({
      current: game.upgrades.filter(u => u.purchased).length,
      target: game.upgrades.length,
    }),
    reward: { diamonds: 25 },
    earned: false,
  },
  {
    id: 'triple_prestige',
    nameKey: 'achievements.triplePrestige',
    descKey: 'achievements.triplePrestigeDesc',
    icon: '🔮',
    condition: () => game.prestigeCount >= 3,
    progress: () => ({ current: game.prestigeCount, target: 3 }),
    reward: { diamonds: 50 },
    earned: false,
  },
  {
    id: 'hundred_clicks',
    nameKey: 'achievements.hundredClicks',
    descKey: 'achievements.hundredClicksDesc',
    icon: '🖱️',
    condition: () => game.clickCount >= 100_000,
    progress: () => ({ current: game.clickCount, target: 100_000 }),
    reward: { fish: 100000 },
    earned: false,
  },
];

// Load earned achievements from localStorage
function loadAchievements() {
  try {
    const stored = localStorage.getItem('catnip-achievements');
    const earned = stored ? JSON.parse(stored) : [];
    for (const id of earned) {
      const ach = ACHIEVEMENTS.find(a => a.id === id);
      if (ach) ach.earned = true;
    }
  } catch {
    // Fresh start
  }
}

// Save earned achievements to localStorage
function saveAchievements() {
  const earned = ACHIEVEMENTS.filter(a => a.earned).map(a => a.id);
  localStorage.setItem('catnip-achievements', JSON.stringify(earned));
}

// Check all achievements and award any newly completed ones
function checkAchievements() {
  let newlyEarned = false;
  for (const ach of ACHIEVEMENTS) {
    if (ach.earned) continue;

    if (ach.condition()) {
      ach.earned = true;
      saveAchievements();
      newlyEarned = true;

      // Award the reward
      if (ach.reward.fish) {
        game.fish += ach.reward.fish;
      }
      if (ach.reward.diamonds) {
        game.diamonds += ach.reward.diamonds;
      }

      // Show toast notification
      const name = i18n.t(ach.nameKey, ach.id);
      showToast(`🏆 ${name}`);
    }
  }

  // Trigger server save immediately if any achievements earned
  if (newlyEarned) {
    saveGame();
  }
}

// Render the achievements list
// Dirty-check: rebuild only when visible state changes (raw progress floats
// change every tick — signature uses quantized display values instead).
let _achRenderSig = null;
function renderAchievements() {
  const container = document.getElementById('achievementList');
  if (!container) return;

  const total = ACHIEVEMENTS.length;
  let earned = 0;
  let sig = i18n.currentLang;
  for (const ach of ACHIEVEMENTS) {
    if (ach.earned) {
      earned++;
      sig += '|1';
    } else {
      const p = ach.progress();
      sig += '|0:' + formatNumber(p.current) + ':' + Math.floor(Math.min(100, (p.current / p.target) * 100));
    }
  }
  sig += '|E' + earned;
  if (sig === _achRenderSig) return;
  _achRenderSig = sig;

  let html = '';

  // Summary
  html += `<p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px;">`;
  html += `🏆 ${i18n.t('achievements.summary', '{earned} / {total} achievements earned')
    .replace('{earned}', String(earned)).replace('{total}', String(total))}`;
  html += `</p>`;

  for (const ach of ACHIEVEMENTS) {
    const name = i18n.t(ach.nameKey, ach.id);
    const desc = i18n.t(ach.descKey, '');
    const progress = ach.progress();
    const percentage = Math.min(100, (progress.current / progress.target) * 100);

    html += `<div class="achievement${ach.earned ? ' earned' : ''}">`;
    html += `<div class="achievement-icon">${ach.icon}</div>`;
    html += `<div class="achievement-info">`;
    html += `<div class="achievement-name">${name}</div>`;
    html += `<div class="achievement-desc">${desc}</div>`;
    if (!ach.earned) {
      html += `<div class="achievement-progress">${formatNumber(progress.current)} / ${formatNumber(progress.target)} (${percentage.toFixed(1)}%)</div>`;
    } else {
      html += `<div class="achievement-progress" style="color: var(--success);">${i18n.t('achievements.earnedBadge', '✅ Earned!')}</div>`;
    }
    html += `</div>`;
    html += `</div>`;
  }

  container.innerHTML = html;
}

// Expose to global scope
window.ACHIEVEMENTS = ACHIEVEMENTS;
window.checkAchievements = checkAchievements;
window.renderAchievements = renderAchievements;
window.loadAchievements = loadAchievements;