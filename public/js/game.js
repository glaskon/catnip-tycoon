// Core game state and mechanics for Catnip Tycoon
const game = {
  // --- Resources ---
  fish: 0,  // No starter — everything earned by clicking
  fishPerClick: 1,
  fishPerSecond: 0,
  catnip: 0,
  diamonds: 0,
  totalFishEarned: 0,
  prestigeCount: 0,
  speedMultiplier: 1,
  elixirs: 0,

  // --- Prestige persistence ---
  anchoredCatId: null,     // Tier 6: cat to keep through prestige
  preservedUpgradeId: null, // Tier 8: upgrade to keep through prestige
  totalPrestigeFishSpent: 0, // Track for Tier 7 cashback

  // --- Click tracking ---
  clickCount: 0,
  totalCatsBought: 0,

  // --- Offline time ---
  offlineTimeMinutes: 120, // Default 2 hours — can be extended via shop

  // --- Collections ---
  cats: [],
  // Upgrades: [{id, nameKey, effect, cost, purchased | level, type}]
  upgrades: [],
  // Achievements: tracked in achievements.js

  // --- Quantum Karma timer ---
  _quantumTimer: 0,

  // --- User ---
  user: null,
  isAdmin: false,

  // --- Timers ---
  lastTick: Date.now(),
  autoSaveInterval: null,
  gameLoopInterval: null,
};

// ============================================================
// Cat definitions
// ============================================================
const CAT_DEFINITIONS = [
  { id: 'dachowiec', nameKey: 'cats.dachowiec', baseCost: 5, baseProduction: 0.5, costGrowth: 1.15 },
  { id: 'rudzielec', nameKey: 'cats.rudzielec', baseCost: 50, baseProduction: 2, costGrowth: 1.15 },
  { id: 'syjamski', nameKey: 'cats.syjamski', baseCost: 200, baseProduction: 8, costGrowth: 1.15 },
  { id: 'perski', nameKey: 'cats.perski', baseCost: 1000, baseProduction: 40, costGrowth: 1.15 },
  { id: 'bengalski', nameKey: 'cats.bengalski', baseCost: 5000, baseProduction: 200, costGrowth: 1.15 },
  { id: 'sfinks', nameKey: 'cats.sfinks', baseCost: 25000, baseProduction: 1000, costGrowth: 1.15 },
  { id: 'mainecoon', nameKey: 'cats.mainecoon', baseCost: 100000, baseProduction: 5000, costGrowth: 1.15 },
  { id: 'kotmag', nameKey: 'cats.kotmag', baseCost: 500000, baseProduction: 25000, costGrowth: 1.20, requiresPrestige: 1 },
  { id: 'kotfeniks', nameKey: 'cats.kotfeniks', baseCost: 100, baseProduction: 1000000, costGrowth: 1.50, requiresPrestige: 20, currency: 'catnip' },
];

// ============================================================
// Upgrade definitions
// ============================================================
const UPGRADE_DEFINITIONS = [
  // Existing — once purchases
  { id: 'karma', nameKey: 'upgrades.karma', descKey: 'upgrades.karmaDesc', effect: 'fish2x', cost: 100, currency: 'fish', type: 'once' },
  { id: 'autoclicker', nameKey: 'upgrades.autoclicker', descKey: 'upgrades.autoclickerDesc', effect: 'autoClick', cost: 500, currency: 'fish', type: 'once' },
  { id: 'miska', nameKey: 'upgrades.miska', descKey: 'upgrades.miskaDesc', effect: 'click2x', cost: 2000, currency: 'fish', type: 'once' },
  { id: 'buda', nameKey: 'upgrades.buda', descKey: 'upgrades.budaDesc', effect: 'cats1.5x', cost: 10000, currency: 'fish', type: 'once' },
  { id: 'karmnik', nameKey: 'upgrades.karmnik', descKey: 'upgrades.karmnikDesc', effect: 'catnip2x', cost: 10, currency: 'catnip', type: 'once' },

  // New — fish upgrades
  { id: 'fishclick', nameKey: 'upgrades.fishclick', descKey: 'upgrades.fishclickDesc', effect: 'fishClick', baseCost: 10000, currency: 'fish', type: 'stackable', costGrowth: 5 },
  { id: 'catspeed', nameKey: 'upgrades.catspeed', descKey: 'upgrades.catspeedDesc', effect: 'catSpeed', baseCost: 100000, currency: 'fish', type: 'stackable', costGrowth: 2.5 },
  { id: 'megakarma', nameKey: 'upgrades.megakarma', descKey: 'upgrades.megakarmaDesc', effect: 'megaKarma', cost: 100000, currency: 'fish', type: 'once' },
  { id: 'clickcrit', nameKey: 'upgrades.clickcrit', descKey: 'upgrades.clickcritDesc', effect: 'clickCrit', cost: 1000000, currency: 'fish', type: 'once' },
  { id: 'luckypaw', nameKey: 'upgrades.luckypaw', descKey: 'upgrades.luckypawDesc', effect: 'luckyPaw', cost: 5000000, currency: 'fish', type: 'once' },
  { id: 'quantumkarma', nameKey: 'upgrades.quantumkarma', descKey: 'upgrades.quantumkarmaDesc', effect: 'quantumKarma', cost: 100000000, currency: 'fish', type: 'once' },

  // New — catnip upgrades
  { id: 'superkarmnik', nameKey: 'upgrades.superkarmnik', descKey: 'upgrades.superkarmnikDesc', effect: 'superKarmnik', cost: 50, currency: 'catnip', type: 'once' },
  { id: 'catnipclick', nameKey: 'upgrades.catnipclick', descKey: 'upgrades.catnipclickDesc', effect: 'catnipClick', cost: 10, currency: 'catnip', type: 'once' },
  { id: 'catnipmastery', nameKey: 'upgrades.catnipmastery', descKey: 'upgrades.catnipmasteryDesc', effect: 'catnipMastery', cost: 100, currency: 'catnip', type: 'once' },
  { id: 'elixirmastery', nameKey: 'upgrades.elixirmastery', descKey: 'upgrades.elixirmasteryDesc', effect: 'elixirMastery', cost: 25, currency: 'catnip', type: 'once' },
  { id: 'prestigeBoost', nameKey: 'upgrades.prestigeBoost', descKey: 'upgrades.prestigeBoostDesc', effect: 'prestigeBoost', cost: 200, currency: 'catnip', type: 'once' },
  { id: 'diamondluck', nameKey: 'upgrades.diamondluck', descKey: 'upgrades.diamondluckDesc', effect: 'diamondLuck', baseCost: 10, currency: 'diamonds', type: 'stackable', costGrowth: 5 },
];

// ============================================================
// Initialize game state
// ============================================================
function initGame() {
  // Build cats array from definitions
  game.cats = CAT_DEFINITIONS.map(def => ({
    ...def,
    count: 0,
    currency: def.currency || 'fish',
    get currentCost() {
      return Math.floor(def.baseCost * Math.pow(def.costGrowth, this.count));
    },
    get production() {
      return this.count * def.baseProduction;
    },
    // Check if cat type is unlocked
    get unlocked() {
      if (def.requiresPrestige && game.prestigeCount < def.requiresPrestige) return false;
      return true;
    },
  }));

  // Build upgrades array from definitions
  game.upgrades = UPGRADE_DEFINITIONS.map(def => {
    if (def.type === 'stackable') {
      return {
        ...def,
        level: 0,
        get currentCost() {
          return Math.floor(def.baseCost * Math.pow(def.costGrowth, this.level));
        },
      };
    }
    return { ...def, purchased: false };
  });
}

// ============================================================
// Core mechanics
// ============================================================

// Add fish to the player's total
function addFish(amount) {
  if (amount <= 0) return;
  game.fish += amount;
  game.totalFishEarned += amount;
}

// Spend fish (returns true if affordable)
function spendFish(amount) {
  if (game.fish < amount) return false;
  game.fish -= amount;
  return true;
}

// Recalculate fish per second from all owned cats
function recalcFPS() {
  let base = 0;
  let hasWizardCat = false;
  let hasFeniks = false;

  for (const cat of game.cats) {
    base += cat.production;
    if (cat.id === 'kotmag' && cat.count > 0) {
      hasWizardCat = true;
    }
    if (cat.id === 'kotfeniks' && cat.count > 0) {
      hasFeniks = true;
    }
  }

  // Wizard Cat: +10% to all cat production per wizard cat
  if (hasWizardCat) {
    const wizardCats = game.cats.find(c => c.id === 'kotmag');
    if (wizardCats) {
      base *= (1 + 0.1 * wizardCats.count);
    }
  }

  // Feniks Cat: +25% to all cat production per feniks cat
  if (hasFeniks) {
    const feniksCats = game.cats.find(c => c.id === 'kotfeniks');
    if (feniksCats) {
      base *= (1 + 0.25 * feniksCats.count);
    }
  }

  // CatSpeed: stackable, +10% per level
  const csLevel = getUpgradeLevel('catspeed');
  if (csLevel > 0) {
    base *= (1 + csLevel * 0.1);
  }

  // Upgrades that affect FPS
  if (hasUpgrade('karma')) base *= 2;
  if (hasUpgrade('buda')) base *= 1.5;
  if (hasUpgrade('megakarma')) base *= 5;
  if (hasUpgrade('catnipmastery')) base *= 2;

  // Prestige tier bonuses
  if (game.prestigeCount >= 5) base *= 2; // Tier 3: Divine artifacts

  // Every 10 prestige levels: cumulative +5% fish/s (Tier 4+)
  if (game.prestigeCount >= 10) {
    const tierBonus = 1 + (Math.floor(game.prestigeCount / 10) * 0.05);
    base *= tierBonus;
  }

  // Kot Bogini (Tier 9): ×100 at 100 prestige
  if (game.prestigeCount >= 100) {
    base *= 100;
  }

  // Elixir production boost
  if (game._prodBoost) {
    base *= 10;
  }

  // Quantum Karma active: ×10
  if (game._quantumActive) {
    base *= 10;
  }

  game.fishPerSecond = base;
}

// Check if an upgrade has been purchased (once-type) or has levels (stackable)
function hasUpgrade(upgradeId) {
  const upg = game.upgrades.find(u => u.id === upgradeId);
  if (!upg) return false;
  if (upg.type === 'stackable') return upg.level > 0;
  return upg.purchased;
}

// Get current level of a stackable upgrade (0 if not owned or once-type)
function getUpgradeLevel(upgradeId) {
  const upg = game.upgrades.find(u => u.id === upgradeId);
  if (!upg || upg.type !== 'stackable') return 0;
  return upg.level;
}

// Get current cat cost (considering how many already owned)
function getCatCost(catIndex) {
  const cat = game.cats[catIndex];
  return cat.currentCost;
}

// ============================================================
// Player actions
// ============================================================

// Click the cat: add fish, animate, check achievements
function clickCat(event) {
  let clickValue = game.fishPerClick;

  // FishClick+ stackable: +1 fish/click per level
  clickValue += getUpgradeLevel('fishclick');

  // Upgrade: Golden Bowl (2x click multiplier)
  if (hasUpgrade('miska')) clickValue *= 2;

  // ClickCrit: 10% chance for ×10
  if (hasUpgrade('clickcrit') && Math.random() < 0.1) {
    clickValue *= 10;
  }

  // LuckyPaw: +0.1 fish/click per cat owned
  if (hasUpgrade('luckypaw')) {
    const totalCats = game.cats.reduce((sum, c) => sum + c.count, 0);
    clickValue += totalCats * 0.1;
  }

  // Round to avoid floating point issues
  if (clickValue < 1) clickValue = Math.round(clickValue * 100) / 100;

  addFish(clickValue);
  game.clickCount++;

  // CatnipClick: +0.1 catnip per click
  if (hasUpgrade('catnipclick')) {
    game.catnip += 0.1;
  }

  // Diamond drops: base 0.0001% (1/1,000,000) per click
  // DiamondLuck: multiplicative per level — ×1.05, ×1.06, ×1.10, ×1.15...
  let diamondDropRate = 0.000001;
  const diamondLuckLevel = getUpgradeLevel('diamondluck');
  if (diamondLuckLevel > 0) {
    const dlMultipliers = [1.05, 1.06, 1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40, 1.50];
    for (let i = 0; i < Math.min(diamondLuckLevel, dlMultipliers.length); i++) {
      diamondDropRate *= dlMultipliers[i];
    }
  }
  if (Math.random() < diamondDropRate) {
    game.diamonds += 1;
  }

  // Bounce animation on cat canvas
  const catCanvas = document.getElementById('catCanvas');
  if (catCanvas) {
    catCanvas.classList.remove('bounce');
    void catCanvas.offsetWidth; // Trigger reflow
    catCanvas.classList.add('bounce');
  }

  // Spawn particle effects at click position
  if (event && typeof spawnParticles === 'function') {
    spawnParticles(event.clientX, event.clientY, clickValue);
  }

  // Check achievements after click
  if (typeof checkAchievements === 'function') checkAchievements();

  render();
}

// Buy a cat by index in the cats array
function buyCat(index) {
  const cat = game.cats[index];
  if (!cat || !cat.unlocked) {
    showDebug('buyCat: cat null or locked (idx=' + index + ')');
    return false;
  }

  const cost = cat.currentCost;
  const currency = cat.currency || 'fish'; // Kot Feniks uses catnip

  showDebug('buyCat: ' + cat.id + ' cost=' + cost + ' currency=' + currency + ' fish=' + game.fish.toFixed(0) + ' catnip=' + game.catnip.toFixed(0));

  let canAfford = false;
  if (currency === 'catnip') {
    canAfford = game.catnip >= cost;
  } else {
    canAfford = game.fish >= cost;
  }

  if (!canAfford) {
    showDebug('buyCat: cannot afford ' + cost + ' ' + currency);
    return false;
  }

  cat.count++;
  game.totalCatsBought++;
  showDebug('buyCat: BOUGHT! ' + cat.id + ' #' + cat.count);

  if (currency === 'catnip') {
    game.catnip -= cost;
  } else {
    game.fish -= cost;
  }

  recalcFPS();

  if (typeof checkAchievements === 'function') checkAchievements();
  render();
  return true;
}

// Buy an upgrade by index
function buyUpgrade(index) {
  const upg = game.upgrades[index];
  if (!upg) return false;

  // Once-type: can't buy if already purchased
  if (upg.type === 'once' && upg.purchased) return false;

  // Determine cost
  const cost = upg.type === 'stackable' ? upg.currentCost : upg.cost;
  const currency = upg.currency;

  // Check if player can afford
  if (currency === 'fish' && game.fish < cost) return false;
  if (currency === 'catnip' && game.catnip < cost) return false;
  if (currency === 'diamonds' && game.diamonds < cost) return false;

  // Deduct cost
  if (currency === 'fish') game.fish -= cost;
  else if (currency === 'catnip') game.catnip -= cost;
  else if (currency === 'diamonds') game.diamonds -= cost;

  // Apply purchase
  if (upg.type === 'stackable') {
    upg.level++;
  } else {
    upg.purchased = true;
  }

  // Apply upgrade effect
  applyUpgradeEffect(upg.id);

  recalcFPS();
  if (typeof checkAchievements === 'function') checkAchievements();
  render();
  return true;
}

// Apply the effect of a purchased upgrade
function applyUpgradeEffect(upgradeId) {
  // Most effects are handled inline in their respective functions.
  // This function exists for effects that need one-time application
  // or for save/load re-application.
  switch (upgradeId) {
    case 'karma':      break; // handled in recalcFPS()
    case 'autoclicker': break; // handled in gameLoop
    case 'miska':      break; // handled in clickCat()
    case 'buda':       break; // handled in recalcFPS()
    case 'karmnik':    break; // handled in prestige()
    case 'fishclick':  break; // handled in clickCat()
    case 'catspeed':   break; // handled in recalcFPS()
    case 'megakarma':  break; // handled in recalcFPS()
    case 'clickcrit':  break; // handled in clickCat()
    case 'luckypaw':   break; // handled in clickCat()
    case 'quantumkarma': break; // handled in gameLoop
    case 'superkarmnik': break; // handled in gameLoop
    case 'catnipclick': break; // handled in clickCat()
    case 'catnipmastery': break; // handled in recalcFPS()
    case 'elixirmastery': break; // handled in tickElixirs
    case 'prestigeBoost': break; // handled in prestige()
    case 'diamondluck': break; // handled in clickCat()
  }
}

// ============================================================
// Prestige system
// ============================================================

// Calculate how many fish are needed for next prestige
function getCatnipNeeded() {
  return 10000 * (game.prestigeCount + 1);
}

// Calculate how much catnip the player would earn from prestige
function calculatePrestigeReward() {
  let catnipGain = Math.floor(Math.sqrt(game.totalFishEarned) / 100);
  // Upgrade: Feeder gives 2x catnip
  if (hasUpgrade('karmnik')) catnipGain *= 2;
  // Upgrade: PrestigeBoost gives +25%
  if (hasUpgrade('prestigeBoost')) catnipGain = Math.floor(catnipGain * 1.25);
  return catnipGain;
}

// Perform prestige: reset progress, earn catnip
function prestige() {
  const needed = getCatnipNeeded();
  if (game.totalFishEarned < needed) return false;

  const catnipGain = calculatePrestigeReward();
  if (catnipGain <= 0) return false;

  // Save what persists through prestige
  const oldCatnip = game.catnip;
  const oldDiamonds = game.diamonds;
  const oldPrestigeCount = game.prestigeCount + 1;
  const oldElixirs = game.elixirs;
  const oldAnchoredCatId = game.anchoredCatId;
  const oldPreservedUpgradeId = game.preservedUpgradeId;

  // Tier 7 (50+): cashback — 10% of total fish earned returns as catnip bonus
  let cashbackCatnip = 0;
  if (game.prestigeCount >= 50) {
    cashbackCatnip = Math.floor(game.totalFishEarned * 0.1 / 100);
  }

  // Save stackable upgrade levels before reset
  const oldStackableLevels = {};
  for (const upg of game.upgrades) {
    if (upg.type === 'stackable' && upg.level > 0) {
      oldStackableLevels[upg.id] = upg.level;
    }
  }

  // Reset everything except catnip, diamonds, prestigeCount
  game.fish = 0;
  game.fishPerClick = 1;
  game.fishPerSecond = 0;
  game.totalFishEarned = 0;
  game.clickCount = 0;
  game.totalCatsBought = 0;
  game.catnip = oldCatnip + catnipGain + cashbackCatnip;
  game.diamonds = oldDiamonds;
  game.prestigeCount = oldPrestigeCount;
  game.elixirs = oldElixirs;

  // Reset cats — keep anchored cat if Tier 6 (35+)
  game.cats.forEach(c => {
    if (oldAnchoredCatId && c.id === oldAnchoredCatId && game.prestigeCount >= 35) {
      // Keep this cat's count through prestige
    } else {
      c.count = 0;
    }
  });

  // Reset upgrades — keep preserved upgrade if Tier 8 (75+), keep stackable levels
  game.upgrades.forEach(u => {
    if (oldPreservedUpgradeId && u.id === oldPreservedUpgradeId && game.prestigeCount >= 75) {
      u.purchased = true;
      applyUpgradeEffect(u.id);
    } else if (u.type === 'stackable' && oldStackableLevels[u.id]) {
      // Stackable upgrades keep their levels through prestige
      u.level = oldStackableLevels[u.id];
    } else if (u.type === 'once') {
      u.purchased = false;
    }
    // Stackable upgrades with no level stay at 0 (no-op)
  });

  // Reset quantum karma state
  game._quantumTimer = 0;
  game._quantumActive = false;

  recalcFPS();

  if (typeof checkAchievements === 'function') checkAchievements();
  render();
  return true;
}

// ============================================================
// Game loop and persistence
// ============================================================

// Main game loop: runs every 100ms
function gameLoop() {
  const now = Date.now();
  const delta = (now - game.lastTick) / 1000; // Convert to seconds
  game.lastTick = now;

  // Auto income from cats (fish per second)
  if (game.fishPerSecond > 0) {
    const income = game.fishPerSecond * delta * game.speedMultiplier;
    addFish(income);
  }

  // Auto-clicker upgrade: 1 click per second
  if (hasUpgrade('autoclicker')) {
    const clicks = 1 * delta * game.speedMultiplier;
    addFish(game.fishPerClick * (hasUpgrade('miska') ? 2 : 1) * clicks);
  }

  // Tier 2 prestige: Cat Shrine generates catnip/s (scales with prestige)
  if (game.prestigeCount >= 3) {
    let catnipRate = 0.01;
    if (game.prestigeCount >= 10) {
      catnipRate += (game.prestigeCount - 9) * 0.005; // scales: +0.005/s per prestige past 10
    }
    // SuperKarmnik: 4x catnip generation
    if (hasUpgrade('superkarmnik')) {
      catnipRate *= 4;
    }
    game.catnip += catnipRate * delta * game.speedMultiplier;
  }

  // Tier 4+: tick elixirs
  if (typeof tickElixirs === 'function') {
    tickElixirs(delta);
  }

  // Quantum Karma: ×10 fish/s for 5s every 60s
  if (hasUpgrade('quantumkarma')) {
    game._quantumTimer += delta;
    if (game._quantumTimer >= 60 && !game._quantumActive) {
      game._quantumActive = true;
      game._quantumTimer = 0;
      recalcFPS();
      showToast('🌀 Quantum Karma active! ×10 fish/s for 5s');
      setTimeout(() => {
        game._quantumActive = false;
        recalcFPS();
        showToast('🌀 Quantum Karma expired');
        render();
      }, 5000);
    }
  }

  // Update UI
  render();
}

// Save game state to server
async function saveGame() {
  if (!api.token) return; // Don't save if not logged in

  try {
    const state = {
      fish: game.fish,
      fishPerClick: game.fishPerClick,
      fishPerSecond: game.fishPerSecond,
      catnip: game.catnip,
      diamonds: game.diamonds,
      totalFishEarned: game.totalFishEarned,
      prestigeCount: game.prestigeCount,
      speedMultiplier: game.speedMultiplier,
      elixirs: game.elixirs,
      anchoredCatId: game.anchoredCatId,
      preservedUpgradeId: game.preservedUpgradeId,
      clickCount: game.clickCount,
      totalCatsBought: game.totalCatsBought,
      offlineTimeMinutes: game.offlineTimeMinutes,
      cats: game.cats.map(c => ({ id: c.id, count: c.count })),
      upgrades: game.upgrades.map(u => ({
        id: u.id,
        purchased: u.purchased,
        level: u.level,
      })),
    };
    await api.saveGameState(state);
  } catch (err) {
    console.error('[Game] Save failed:', err.message);
  }
}

// Load game state from server
async function loadGame() {
  if (!api.token) return;

  try {
    const result = await api.loadGameState();
    const state = result.gameState;
    const updatedAt = result.updatedAt;

    if (!state || state._fresh) {
      // No save on server yet — start with defaults (already set in game object)
      console.log('[Game] Fresh account — starting from zero');
      recalcFPS();
      render();
      return;
    }

    // Always restore whatever the server has — even if it's all zeros
    game.fish = state.fish || 0;
    game.fishPerClick = state.fishPerClick || 1;
    game.fishPerSecond = state.fishPerSecond || 0;
    game.catnip = state.catnip || 0;
    game.diamonds = state.diamonds || 0;
    game.totalFishEarned = state.totalFishEarned || 0;
    game.prestigeCount = state.prestigeCount || 0;
    game.speedMultiplier = state.speedMultiplier || 1;
    game.elixirs = state.elixirs || 0;
    game.anchoredCatId = state.anchoredCatId || null;
    game.preservedUpgradeId = state.preservedUpgradeId || null;
    game.clickCount = state.clickCount || 0;
    game.totalCatsBought = state.totalCatsBought || 0;
    game.offlineTimeMinutes = state.offlineTimeMinutes || 120;

    // Calculate offline earnings if we have a last save timestamp
    if (updatedAt) {
      const lastSave = new Date(updatedAt).getTime();
      const now = Date.now();
      const offlineSeconds = Math.min(
        (now - lastSave) / 1000,
        game.offlineTimeMinutes * 60
      );

      if (offlineSeconds > 30) { // Only show if more than 30s offline
        // Calculate what would have been earned during offline time
        // Use FPS at time of save (loaded from state)
        const fps = state.fishPerSecond || 0;
        const catnipRate = state.prestigeCount >= 3 ? 0.01 : 0;
        const offlineFish = fps * offlineSeconds;
        const offlineCatnip = catnipRate * offlineSeconds;

        // Show offline earnings popup — delay slightly to let UI load
        setTimeout(() => {
          const hours = Math.floor(offlineSeconds / 3600);
          const mins = Math.floor((offlineSeconds % 3600) / 60);
          const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          
          showOfflineEarnings(timeStr, offlineFish, offlineCatnip);
        }, 1000);

        // Award offline earnings
        if (offlineFish > 0) addFish(offlineFish);
        if (offlineCatnip > 0) game.catnip += offlineCatnip;
      }
    }

    // Restore cats
    if (state.cats) {
      for (const savedCat of state.cats) {
        const cat = game.cats.find(c => c.id === savedCat.id);
        if (cat) cat.count = savedCat.count || 0;
      }
    }

    // Restore upgrades and reapply effects
    if (state.upgrades) {
      for (const savedUpg of state.upgrades) {
        const upg = game.upgrades.find(u => u.id === savedUpg.id);
        if (!upg) continue;

        // Restore once-type
        if (savedUpg.purchased && upg.type === 'once') {
          upg.purchased = true;
          applyUpgradeEffect(upg.id);
        }

        // Restore stackable level
        if (savedUpg.level && upg.type === 'stackable') {
          upg.level = savedUpg.level;
          applyUpgradeEffect(upg.id);
        }
      }
    }

    recalcFPS();
    render();
  } catch (err) {
    console.error('[Game] Load failed:', err.message);
  }
}

// Start game loops
function startGameLoops() {
  game.lastTick = Date.now();
  game.gameLoopInterval = setInterval(gameLoop, 100);
  game.autoSaveInterval = setInterval(saveGame, 30000); // Auto-save every 30 seconds
}

// Show offline earnings popup
function showOfflineEarnings(timeAway, fish, catnip) {
  // Remove existing popup if any
  const existing = document.getElementById('offlinePopup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'offlinePopup';
  popup.innerHTML = `
    <div style="background: var(--bg-secondary); border: 2px solid var(--cat-orange); border-radius: var(--border-radius); padding: 20px; text-align: center; max-width: 360px; margin: 0 auto; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
      <h3 style="color: var(--cat-orange); margin-bottom: 8px;">🐱 Welcome Back!</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary);">You were away for <b>${timeAway}</b></p>
      <div style="margin: 12px 0;">
        <p style="font-size: 1.2rem;">🐟 <b style="color: var(--gold);">${formatNumber(Math.floor(fish))}</b> fish earned</p>
        ${catnip > 0 ? `<p style="font-size: 1rem;">🌿 <b style="color: var(--cat-orange);">${formatNumber(Math.floor(catnip))}</b> catnip earned</p>` : ''}
      </div>
      <p style="font-size: 0.75rem; color: var(--text-muted);">Offline time: ${formatNumber(game.offlineTimeMinutes / 60)}h / ${game.offlineTimeMinutes} min max</p>
      <button class="btn btn-primary" onclick="document.getElementById('offlinePopup').remove()" style="margin-top: 8px;">Collect</button>
    </div>
  `;

  // Style and position as a modal overlay
  popup.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:9998;';
  popup.onclick = (e) => { if (e.target === popup) popup.remove(); };

  document.body.appendChild(popup);
}

// Expose game to global scope
window.game = game;
window.initGame = initGame;
window.clickCat = clickCat;
window.buyCat = buyCat;
window.buyUpgrade = buyUpgrade;
window.prestige = prestige;
window.getCatnipNeeded = getCatnipNeeded;
window.calculatePrestigeReward = calculatePrestigeReward;
window.saveGame = saveGame;
window.loadGame = loadGame;
window.startGameLoops = startGameLoops;
window.addFish = addFish;
window.spendFish = spendFish;
window.recalcFPS = recalcFPS;
window.hasUpgrade = hasUpgrade;
window.getUpgradeLevel = getUpgradeLevel;
window.getCatCost = getCatCost;