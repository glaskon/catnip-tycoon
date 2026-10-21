// Core game state and mechanics for Catnip Tycoon
const game = {
  // --- Resources ---
  fish: 0,  // No starter — everything earned by clicking
  fishPerClick: 1,
  baseFishPerClick: 1,
  fishPerSecond: 0,
  catnip: 0,
  diamonds: 0,
  totalFishEarned: 0,
  prestigeCount: 0,
  speedMultiplier: 1,
  productionMultiplier: 1,
  activeBoosts: [],
  elixirs: 0,

  // --- Prestige persistence ---
  anchoredCatId: null,     // Tier 6: cat to keep through prestige
  preservedUpgradeId: null, // Tier 8: upgrade to keep through prestige
  totalPrestigeFishSpent: 0, // Track for Tier 7 cashback

  // --- Click tracking ---
  clickCount: 0,
  totalCatsBought: 0,
  luckyCatnipCount: 0,  // lifetime lucky catnip drops (survives prestige)
  dailyClicks: 0,       // clicks on the current day (daily achievements)
  lastClickDate: '',    // day marker for dailyClicks reset

  savedAt: 0,
  saveOwnerId: null,
  guestMigrationId: null,

  // --- Offline time ---
  offlineTimeMinutes: 60, // Default 1 hour — can be extended via shop

  // --- Initialization guard ---
  isReady: false, // gameLoop runs only after loadGame / guest init

  // --- Cat Life (virtual pet, unlocked at prestige 3) ---
  catlife: null, // {hunger, lastUpdate, fedCount} — lazy-init in getCatLife()

  // --- Daily reward (login streak) ---
  daily: null,    // {count, lastClaimDate} — lazy-init in getDaily()

  // --- Gacha (cosmetic pulls) ---
  gacha: null,    // {totalPulls, pity, counts} — lazy-init in getGacha()

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
  { id: 'dachowiec', nameKey: 'cats.dachowiec', baseCost: 15, baseProduction: 0.5, costGrowth: 1.15 },
  { id: 'rudzielec', nameKey: 'cats.rudzielec', baseCost: 100, baseProduction: 2, costGrowth: 1.15 },
  { id: 'syjamski', nameKey: 'cats.syjamski', baseCost: 1100, baseProduction: 8, costGrowth: 1.15 },
  { id: 'perski', nameKey: 'cats.perski', baseCost: 12000, baseProduction: 40, costGrowth: 1.15 },
  { id: 'bengalski', nameKey: 'cats.bengalski', baseCost: 130000, baseProduction: 200, costGrowth: 1.15 },
  { id: 'sfinks', nameKey: 'cats.sfinks', baseCost: 1400000, baseProduction: 1000, costGrowth: 1.15 },
  { id: 'mainecoon', nameKey: 'cats.mainecoon', baseCost: 20000000, baseProduction: 5000, costGrowth: 1.15 },
  { id: 'kotmag', nameKey: 'cats.kotmag', baseCost: 330000000, baseProduction: 25000, costGrowth: 1.20, requiresPrestige: 1 },
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
  { id: 'catnipclick', nameKey: 'upgrades.catnipclick', descKey: 'upgrades.catnipclickDesc', effect: 'catnipClick', baseCost: 10, currency: 'catnip', type: 'stackable', costGrowth: 5 },
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
        purchased: false,
        level: 0,
        get currentCost() {
          return Math.floor(def.baseCost * Math.pow(def.costGrowth, this.level));
        },
      };
    }
    return { ...def, purchased: false, level: 0 };
  });

  game.baseFishPerClick = 1;
  game.activeBoosts = [];
  game.productionMultiplier = 1;
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
function recalcFPS(now = Date.now()) {
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

  // Elixir production boost — handled via activeBoosts (recomputeBoostedValues)

  // Quantum Karma active: ×10
  if (game._quantumActive) {
    base *= 10;
  }

  // Cat Life: happy pet (hunger >= 70) = +10% production
  if (typeof catLifeProductionMultiplier === 'function') {
    base *= catLifeProductionMultiplier(now);
  }

  base *= (game.productionMultiplier || 1);

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

// Base click value with all deterministic upgrades (no random crits).
// Shared by clickCat() and the autoclicker so both use the same value.
function calculateClickValue() {
  let clickValue = game.fishPerClick;

  // FishClick+ stackable: +1 fish/click per level
  clickValue += getUpgradeLevel('fishclick');

  // Upgrade: Golden Bowl (2x click multiplier)
  if (hasUpgrade('miska')) clickValue *= 2;

  // LuckyPaw: +0.1 fish/click per cat owned
  if (hasUpgrade('luckypaw')) {
    const totalCats = game.cats.reduce((sum, c) => sum + c.count, 0);
    clickValue += totalCats * 0.1;
  }

  // Round to 2 decimals to prevent float drift (e.g. 0.1 * 3 = 0.30000000000000004)
  return Math.round(clickValue * 100) / 100;
}

const BOOST_MAX_DURATION_MS = 5 * 60 * 1000;

function applyBoost(kind, mult, durationMs) {
  game.activeBoosts.push({ kind: kind, mult: mult, expiresAt: Date.now() + durationMs, maxDurationMs: durationMs });
  recomputeBoostedValues();
}

function recomputeBoostedValues(now = Date.now(), silent = false) {
  const before = game.activeBoosts.length;
  game.activeBoosts = game.activeBoosts.filter(b => b.expiresAt > now);
  if (!silent && game.activeBoosts.length < before && typeof showToast === 'function') showToast('⏰ Boost expired');
  // Merge repeated activations and legacy saves: strongest multiplier wins,
  // Remaining durations add up, capped at the longer of five minutes and
  // the longest single activation of that kind (also preserved in saves).
  const boosts = [];
  for (const b of game.activeBoosts) {
    if (!['speed', 'click', 'production'].includes(b.kind) ||
        !Number.isFinite(b.mult) || b.mult <= 0 || b.mult > 1000 ||
        !Number.isFinite(b.expiresAt)) continue;
    const existing = boosts.find(boost => boost.kind === b.kind);
    const remainingMs = b.expiresAt - now;
    // Legacy saves have no original duration; preserve their remaining time.
    const maxDurationMs = Number.isFinite(b.maxDurationMs) && b.maxDurationMs > 0 ? b.maxDurationMs : remainingMs;
    if (existing) {
      existing.mult = Math.max(existing.mult, b.mult);
      existing.maxDurationMs = Math.max(existing.maxDurationMs, maxDurationMs);
      existing.expiresAt = now + Math.min(Math.max(BOOST_MAX_DURATION_MS, existing.maxDurationMs), existing.expiresAt - now + remainingMs);
    } else {
      boosts.push({ kind: b.kind, mult: b.mult, expiresAt: now + Math.min(Math.max(BOOST_MAX_DURATION_MS, maxDurationMs), remainingMs), maxDurationMs });
    }
  }
  game.activeBoosts = boosts;
  const prevPP = game.productionMultiplier;
  let sp = 1, cp = 1, pp = 1;
  for (const b of game.activeBoosts) {
    if (b.kind === 'speed') sp = b.mult;
    else if (b.kind === 'click') cp = b.mult;
    else if (b.kind === 'production') pp = b.mult;
  }
  game.speedMultiplier = sp;
  game.fishPerClick = game.baseFishPerClick * cp;
  game.productionMultiplier = pp;
  // Production multiplier affects fishPerSecond — recalc only when it changes
  if (pp !== prevPP && typeof recalcFPS === 'function') recalcFPS(now);
}

// Check if player can afford a cost in given currency
function canAfford(cost, currency) {
  if (currency === 'catnip') return game.catnip >= cost;
  if (currency === 'diamonds') return game.diamonds >= cost;
  return game.fish >= cost;
}

// Click the cat: add fish, animate, check achievements
function clickCat(event) {
  let clickValue = calculateClickValue();

  sound.click();

  // ClickCrit: 10% chance for ×10 (random — manual clicks only)
  if (hasUpgrade('clickcrit') && Math.random() < 0.1) {
    clickValue *= 10;
    sound.crit();
    screenShake();
  }

  // Round to avoid floating point issues
  if (clickValue < 1) clickValue = Math.round(clickValue * 100) / 100;

  addFish(clickValue);
  game.clickCount++;

  // Daily click tracking (resets on a new day)
  const today = new Date().toDateString();
  if (game.lastClickDate !== today) {
    game.lastClickDate = today;
    game.dailyClicks = 0;
  }
  game.dailyClicks++;

  // Lucky Catnip Click: base 1/100,000 per click, each level raises the
  // chance gently (×1.05, ×1.06, ×1.10... — same ramp as Diamond Luck)
  const catnipClickLevel = getUpgradeLevel('catnipclick');
  if (catnipClickLevel > 0) {
    let catnipDropRate = 0.00001;
    const ccMultipliers = [1.05, 1.06, 1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40, 1.50];
    for (let i = 0; i < Math.min(catnipClickLevel - 1, ccMultipliers.length); i++) {
      catnipDropRate *= ccMultipliers[i];
    }
    if (Math.random() < catnipDropRate) {
      game.catnip += 25;
      game.luckyCatnipCount = (game.luckyCatnipCount || 0) + 1;
      sound.lucky();
      luckyFlash();
      if (typeof showToast === 'function') {
        showToast('🍀 ' + i18n.t('toasts.luckyCatnip', 'Lucky Catnip! +25🌿'));
      }
    }
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
    sound.lucky();
    luckyFlash();
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

  if (!canAfford(cost, currency)) {
    showDebug('buyCat: cannot afford ' + cost + ' ' + currency);
    return false;
  }

  cat.count++;
  game.totalCatsBought++;
  showDebug('buyCat: BOUGHT! ' + cat.id + ' #' + cat.count);
  sound.buy();

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
  if (!canAfford(cost, currency)) return false;

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

  sound.buy();
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
  // First prestige: 10M fish (Łukasz, 2026-08-28). Scales with prestige count:
  // 10M, 20M, 30M...
  return 10000000 * (game.prestigeCount + 1);
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

  // Tier 7 (50+): cashback — 1 catnip per full 1000 fish earned this run
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
  game.baseFishPerClick = 1;
  game.activeBoosts = [];
  game.productionMultiplier = 1;
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

// Cat Shrine catnip/s rate — single source of truth for live gameLoop AND
// offline earnings (loadGame). Scales with prestige (10+) + SuperKarmnik ×4.
function getCatnipShrineRate() {
  if (game.prestigeCount < 3) return 0;
  let catnipRate = 0.01;
  if (game.prestigeCount >= 10) {
    catnipRate += (game.prestigeCount - 9) * 0.005; // scales: +0.005/s per prestige past 10
  }
  // SuperKarmnik: 4x catnip generation
  if (hasUpgrade('superkarmnik')) {
    catnipRate *= 4;
  }
  return catnipRate;
}

// Main game loop: runs every 100ms
function gameLoop() {
  if (!game.isReady) return;
  recomputeBoostedValues();
  const now = Date.now();
  const delta = (now - game.lastTick) / 1000; // Convert to seconds
  game.lastTick = now;

  if (typeof refreshCatLifeProduction === 'function') refreshCatLifeProduction();

  // Auto income from cats (fish per second)
  if (game.fishPerSecond > 0) {
    const income = game.fishPerSecond * delta * game.speedMultiplier;
    addFish(income);
  }

  // Auto-clicker upgrade: 1 click per second (full click value incl. upgrades)
  if (hasUpgrade('autoclicker')) {
    const clicks = 1 * delta * game.speedMultiplier;
    addFish(calculateClickValue() * clicks);
  }

  // Tier 2 prestige: Cat Shrine generates catnip/s (scales with prestige)
  if (game.prestigeCount >= 3) {
    game.catnip += getCatnipShrineRate() * delta * game.speedMultiplier;
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

// Save game state to server (and always to localStorage)
const SAVE_KEY = 'catnip-save';
// UI-only status; it is not part of the persisted game state.
let _saveStatus = 'idle';
let _saveAttempt = 0;

function renderSaveStatus() {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  const text = i18n.t('game.saveStatus.' + _saveStatus);
  if (el.textContent !== text) el.textContent = text;
  el.dataset.status = _saveStatus;
}

function setSaveStatus(status) {
  _saveStatus = status;
  renderSaveStatus();
}

function buildSaveState() {
  const now = Date.now();
  return {
    savedAt: now,
    saveOwnerId: game.saveOwnerId,
    guestMigrationId: game.guestMigrationId,
    fish: game.fish,
    fishPerClick: game.baseFishPerClick,
    fishPerSecond: game.fishPerSecond,
    catnip: game.catnip,
    diamonds: game.diamonds,
    totalFishEarned: game.totalFishEarned,
    prestigeCount: game.prestigeCount,
    speedMultiplier: 1,
    elixirs: game.elixirs,
    anchoredCatId: game.anchoredCatId,
    preservedUpgradeId: game.preservedUpgradeId,
    clickCount: game.clickCount,
    luckyCatnipCount: game.luckyCatnipCount || 0,
    dailyClicks: game.dailyClicks || 0,
    lastClickDate: game.lastClickDate || '',
    totalCatsBought: game.totalCatsBought,
    offlineTimeMinutes: game.offlineTimeMinutes,
    activeBoosts: game.activeBoosts.map(b => ({ kind: b.kind, mult: b.mult, remainingMs: Math.max(0, b.expiresAt - now), maxDurationMs: b.maxDurationMs })),
    catlife: game.catlife || null,
    daily: game.daily || null,
    gacha: game.gacha || null,
    cats: game.cats.map(c => ({ id: c.id, count: c.count })),
    upgrades: game.upgrades.map(u => ({
      id: u.id,
      purchased: u.purchased,
      level: u.level,
    })),
    achievements: ACHIEVEMENTS.filter(a => a.earned).map(a => a.id),
    purchasedItems: window.purchasedItems || [],
    shopCounts: window.shopCounts || {},
  };
}

function safeNum(v, fallback, max) {
  max = max || 1e30;
  return (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max) ? v : fallback;
}

function applyGameState(state, at = Date.now()) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;

  // A save replaces the collections, including omitted entries. Keep getters
  // and definitions from initGame(), never from untrusted serialized objects.
  initGame();
  game.savedAt = safeNum(state.savedAt, 0);
  game.saveOwnerId = typeof state.saveOwnerId === 'string' ? state.saveOwnerId : null;
  game.guestMigrationId = typeof state.guestMigrationId === 'string' ? state.guestMigrationId : null;
  game.catlife = null;
  game.daily = null;
  game.gacha = null;
  game._quantumActive = false;
  game._quantumTimer = 0;

  game.fish = safeNum(state.fish, 0);
  game.fishPerClick = safeNum(state.fishPerClick, 1);
  game.baseFishPerClick = safeNum(state.fishPerClick, 1);
  game.fishPerSecond = safeNum(state.fishPerSecond, 0);
  game.catnip = safeNum(state.catnip, 0);
  game.diamonds = safeNum(state.diamonds, 0);
  game.totalFishEarned = safeNum(state.totalFishEarned, 0);
  game.prestigeCount = safeNum(state.prestigeCount, 0);
  game.speedMultiplier = safeNum(state.speedMultiplier, 1);
  game.elixirs = safeNum(state.elixirs, 0);
  game.anchoredCatId = typeof state.anchoredCatId === 'string' ? state.anchoredCatId : null;
  game.preservedUpgradeId = typeof state.preservedUpgradeId === 'string' ? state.preservedUpgradeId : null;
  game.clickCount = safeNum(state.clickCount, 0);
  game.luckyCatnipCount = safeNum(state.luckyCatnipCount, 0);
  game.dailyClicks = safeNum(state.dailyClicks, 0);
  game.lastClickDate = typeof state.lastClickDate === 'string' ? state.lastClickDate : '';
  game.totalCatsBought = safeNum(state.totalCatsBought, 0);
  game.offlineTimeMinutes = Math.min(safeNum(state.offlineTimeMinutes, 60, OFFLINE_MAX_MIN), OFFLINE_MAX_MIN);
  if (state.catlife && typeof state.catlife === 'object') {
    game.catlife = {
      hunger: Math.min(100, safeNum(state.catlife.hunger, 100, 100)),
      lastUpdate: safeNum(state.catlife.lastUpdate, at),
      fedCount: safeNum(state.catlife.fedCount, 0),
    };
  }
  if (state.daily && typeof state.daily === 'object') {
    game.daily = {
      count: safeNum(state.daily.count, 0, 1000000),
      lastClaimDate: typeof state.daily.lastClaimDate === 'string' && state.daily.lastClaimDate.length <= 20 ? state.daily.lastClaimDate : '',
    };
  }
  if (state.gacha && typeof state.gacha === 'object') {
    const gCounts = (state.gacha.counts && typeof state.gacha.counts === 'object' && !Array.isArray(state.gacha.counts)) ? state.gacha.counts : {};
    game.gacha = {
      totalPulls: safeNum(state.gacha.totalPulls, 0, 100000000),
      pity: Math.min(safeNum(state.gacha.pity, 0, 10), 10),
      counts: {},
    };
    for (const [k, v] of Object.entries(gCounts)) {
      if (typeof k === 'string' && k.length <= 100) game.gacha.counts[k] = safeNum(v, 0, 1000000);
    }
  }

  // Restore cats
  const savedCats = Array.isArray(state.cats) ? state.cats : [];
  for (const savedCat of savedCats) {
    if (!savedCat || typeof savedCat.id !== 'string') continue;
    const cat = game.cats.find(c => c.id === savedCat.id);
    if (cat) cat.count = safeNum(savedCat.count, 0);
  }

  // Restore upgrades and reapply effects
  const savedUpgrades = Array.isArray(state.upgrades) ? state.upgrades : [];
  for (const savedUpg of savedUpgrades) {
    if (!savedUpg || typeof savedUpg.id !== 'string') continue;
    const upg = game.upgrades.find(u => u.id === savedUpg.id);
    if (!upg) continue;

    if (savedUpg.purchased === true && upg.type === 'once') {
      upg.purchased = true;
      applyUpgradeEffect(upg.id);
    }

    if (upg.type === 'stackable') {
      upg.level = safeNum(savedUpg.level, 0, 10000);
      if (upg.level > 0) applyUpgradeEffect(upg.id);
    }
  }

  // Migration: catnipclick used to be once-type (+0.1 catnip/click).
  // It is now stackable (Lucky Catnip Click) — old purchases become level 1.
  const savedCatnipClick = savedUpgrades.find(u => u && u.id === 'catnipclick');
  if (savedCatnipClick && savedCatnipClick.purchased) {
    const catnipClickUpg = game.upgrades.find(u => u.id === 'catnipclick');
    if (catnipClickUpg && catnipClickUpg.type === 'stackable' && catnipClickUpg.level === 0) {
      catnipClickUpg.level = 1;
    }
  }

  // Restore achievements from save (without re-awarding rewards)
  const savedAchievements = Array.isArray(state.achievements) ? state.achievements : [];
  const earnedIds = new Set(savedAchievements);
  for (const ach of ACHIEVEMENTS) ach.earned = earnedIds.has(ach.id);
  const validAchievements = ACHIEVEMENTS.filter(a => a.earned).map(a => a.id);
  localStorage.setItem('catnip-achievements', JSON.stringify(validAchievements));

  // Restore shop purchased items
  const savedPurchasedItems = Array.isArray(state.purchasedItems) ? state.purchasedItems : [];
  window.purchasedItems = savedPurchasedItems;
  localStorage.setItem('catnip-purchased', JSON.stringify(savedPurchasedItems));
  const savedShopCounts = (state.shopCounts && typeof state.shopCounts === 'object' && !Array.isArray(state.shopCounts)) ? state.shopCounts : {};
  window.shopCounts = savedShopCounts;
  localStorage.setItem('catnip-shopcounts', JSON.stringify(savedShopCounts));
  if (typeof purchasedItems !== 'undefined') purchasedItems = window.purchasedItems;
  if (typeof shopCounts !== 'undefined') shopCounts = window.shopCounts;

  game.activeBoosts = (Array.isArray(state.activeBoosts) ? state.activeBoosts : []).filter(b => b && Number.isFinite(b.remainingMs) && b.remainingMs > 0).map(b => ({ kind: b.kind, mult: b.mult, expiresAt: at + b.remainingMs, maxDurationMs: b.maxDurationMs }));
  recomputeBoostedValues(at, true);

  recalcFPS(at);
  return true;
}

// Serialize saves: an earlier response must never advance a later snapshot's
// revision. A transition waits for this queue before changing the active user.
let _saveQueue = Promise.resolve();
let _stateTransition = false;
let _transitionElements = [];

function beginStateTransition() {
  _stateTransition = true;
  game.isReady = false;
  _transitionElements = Array.from(document.body.children).map(el => [el, el.inert]);
  for (const [el] of _transitionElements) el.inert = true;
}

function endStateTransition() {
  for (const [el, inert] of _transitionElements) el.inert = inert;
  _transitionElements = [];
  recomputeBoostedValues();
  recalcFPS();
  game.lastTick = Date.now();
  game.isReady = true;
  _stateTransition = false;
}

function showProgressNotice(message, retry = false) {
  const old = document.getElementById('progressNotice');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.id = 'progressNotice';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:grid;place-items:center;background:#000b;';
  const panel = document.createElement('div');
  panel.style.cssText = 'max-width:420px;padding:24px;background:var(--bg-secondary);border-radius:12px;';
  const text = document.createElement('p');
  text.textContent = message;
  const button = document.createElement('button');
  button.className = 'btn btn-primary';
  button.textContent = i18n.t(retry ? 'progress.retry' : 'progress.continue', retry ? 'Reload and retry' : 'Continue');
  button.onclick = () => retry ? window.location.reload() : overlay.remove();
  panel.append(text, button);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  button.focus();
}

function saveGame() {
  if (_stateTransition || !game.isReady) return _saveQueue;
  const attempt = ++_saveAttempt;
  setSaveStatus('pending');
  let state;
  try {
    state = buildSaveState();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (err) {
    setSaveStatus('error');
    return Promise.resolve(false);
  }
  const token = api.token;
  _saveQueue = _saveQueue.then(async () => {
    try {
      if (token && token === api.token) await api.saveGameState(state);
      if (attempt === _saveAttempt) setSaveStatus('saved');
      return true;
    } catch (err) {
      if (attempt === _saveAttempt) setSaveStatus('error');
      console.error('[Game] Save failed:', err.message);
      return false;
    }
  });
  return _saveQueue;
}

function readLocalState() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  const state = JSON.parse(raw);
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid local save');
  return state;
}

// Integrate at expiry boundaries. The same live formulas provide every rate.
// Keep all segments up to the hard cap so a purchased extension can use them.
function restoreWithOffline(state, fallbackTime, now = Date.now()) {
  const timestamp = safeNum(state.savedAt, 0) || safeNum(fallbackTime, 0) || now;
  const start = Math.min(timestamp, now);
  applyGameState(state, start);
  const end = Math.min(now, start + OFFLINE_MAX_MIN * 60000);
  const boundaries = [start, end];
  for (const boost of game.activeBoosts) {
    if (boost.expiresAt > start && boost.expiresAt < end) boundaries.push(boost.expiresAt);
  }
  // The pet's happy bonus is also time-limited by hunger decay.
  if (game.catlife && typeof CATLIFE_DECAY_PER_SEC !== 'undefined') {
    const moodEnd = game.catlife.lastUpdate + (game.catlife.hunger - 70) / CATLIFE_DECAY_PER_SEC * 1000;
    if (moodEnd > start && moodEnd < end) boundaries.push(moodEnd);
  }
  boundaries.sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const from = boundaries[i], to = boundaries[i + 1];
    if (to <= from) continue;
    recomputeBoostedValues(from, true);
    recalcFPS((from + to) / 2);
    segments.push({
      from: (from - start) / 1000, to: (to - start) / 1000,
      fish: (game.fishPerSecond + (hasUpgrade('autoclicker') ? calculateClickValue() : 0)) * game.speedMultiplier,
      catnip: getCatnipShrineRate() * game.speedMultiplier,
      elixirs: typeof getElixirRate === 'function' ? getElixirRate() : 0,
    });
  }
  recomputeBoostedValues(now, true);
  recalcFPS(now);
  game.lastTick = now;
  game.savedAt = now;
  const context = { awaySeconds: (now - start) / 1000, segments, creditedSeconds: 0 };
  creditOffline(context, game.offlineTimeMinutes * 60);
  return context;
}

function offlineTotals(context, seconds) {
  const totals = { fish: 0, catnip: 0, elixirs: 0 };
  if (!context) return totals;
  const limit = Math.min(Math.max(0, seconds), context.awaySeconds, OFFLINE_MAX_MIN * 60);
  for (const segment of context.segments) {
    const duration = Math.max(0, Math.min(segment.to, limit) - segment.from);
    for (const key of Object.keys(totals)) totals[key] += segment[key] * duration;
  }
  return totals;
}

function creditOffline(context, seconds) {
  const before = offlineTotals(context, context.creditedSeconds);
  const after = offlineTotals(context, seconds);
  const gain = {};
  for (const key of Object.keys(after)) gain[key] = Math.max(0, after[key] - before[key]);
  addFish(gain.fish);
  game.catnip += gain.catnip;
  game.elixirs += gain.elixirs;
  context.creditedSeconds = Math.max(context.creditedSeconds, Math.min(seconds, context.awaySeconds, OFFLINE_MAX_MIN * 60));
  return gain;
}

function loadLocalGame() {
  const state = readLocalState();
  if (!state) return false;
  const context = restoreWithOffline(state);
  // Persist the credited amount and its new timestamp together before showing it.
  localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveState()));
  showOfflineEarnings(context);
  return true;
}

// The server either receives one entire guest snapshot or supplies one entire
// account snapshot. The original local snapshot is retained as a recovery copy.
async function loadGame(localState = readLocalState()) {
  if (!api.token) return;
  const result = await api.loadGameState();
  const serverState = result.gameState || {};
  const owner = String(game.user.id);
  if (localState && hasRealProgress(localState)) {
    localStorage.setItem('catnip-recovery-' + (localState.saveOwnerId || 'guest'), JSON.stringify(localState));
  }
  let context;
  let checkpoint;
  let message = i18n.t('progress.account', 'Account progress loaded. It replaces local progress; a local recovery copy has been kept.');
  const eligible = localState && !localState.saveOwnerId && hasRealProgress(localState);
  if (eligible && !hasRealProgress(serverState) && !serverState.guestMigrationId) {
    // Store the stable ID BEFORE sending. A lost response is safe to retry.
    localState.guestMigrationId = localState.guestMigrationId || crypto.randomUUID();
    localStorage.setItem(SAVE_KEY, JSON.stringify(localState));
    localStorage.setItem('catnip-recovery-guest', JSON.stringify(localState));
    context = restoreWithOffline(localState);
    game.saveOwnerId = owner;
    let imported;
    checkpoint = buildSaveState();
    try {
      imported = await api.saveGameState(checkpoint, localState.guestMigrationId);
    } catch (err) {
      if (err.code !== 'IMPORT_USED') throw err;
      // This snapshot belongs to another account. Keep its recovery copy,
      // then explicitly choose this account's state instead of importing again.
      await loadGame(null);
      showProgressNotice(i18n.t('progress.used', 'This guest progress was already transferred to another account. The current account was loaded; the local recovery copy is kept.'));
      return;
    }
    if (imported.already_migrated) {
      context = restoreWithOffline(imported.game_state);
      checkpoint = buildSaveState();
      await api.saveGameState(checkpoint);
    }
    message = i18n.t('progress.migrated', 'Guest progress transferred and saved to your account. This transfer can only happen once.');
  } else {
    context = restoreWithOffline(serverState, Date.parse(result.updatedAt));
    game.saveOwnerId = owner;
    // Commit the offline credit before allowing play/reload to claim it again.
    checkpoint = buildSaveState();
    await api.saveGameState(checkpoint);
  }
  // Both sources must retain the identical timestamp and boost durations,
  // regardless of how long the server took to acknowledge the write.
  localStorage.setItem(SAVE_KEY, JSON.stringify(checkpoint));
  setSaveStatus('saved');
  showOfflineEarnings(context);
  showProgressNotice(message);
  render();
}

// Start game loops
function startGameLoops() {
  game.lastTick = Date.now();
  game.gameLoopInterval = setInterval(gameLoop, 100);
  game.autoSaveInterval = setInterval(saveGame, 30000); // Auto-save every 30 seconds
}

// --- Offline time purchase (zmiana: +30 min increments, 6h cap) ---
// Constants defined in /js/constants.js (loaded before this file)

// Offline earnings context — kept so buying more time can retroactively
// top up earnings for the extra window (if the player was away longer)
let _offlineContext = { awaySeconds: 0, segments: [], creditedSeconds: 0 };

// Show actual credited totals without compact-number rounding.
function updateOfflinePopup() {
  const fishEl = document.getElementById('offlineFishTotal');
  if (!fishEl || !_offlineContext) return;
  const totals = offlineTotals(_offlineContext, _offlineContext.creditedSeconds);
  fishEl.textContent = String(totals.fish);
  document.getElementById('offlineCatnipTotal').textContent = String(totals.catnip);
  document.getElementById('offlineElixirTotal').textContent = String(totals.elixirs);
  document.getElementById('offlineCatnipLine').style.display = totals.catnip > 0 ? '' : 'none';
  document.getElementById('offlineElixirLine').style.display = totals.elixirs > 0 ? '' : 'none';

  const h = Math.floor(game.offlineTimeMinutes / 60);
  const m = game.offlineTimeMinutes % 60;
  const cur = m > 0 ? `${h}h ${m}m` : `${h}h`;
  document.getElementById('offlineWindowInfo').textContent =
    `${i18n.t('offline.window')}: ${cur} / ${i18n.t('offline.max')} ${OFFLINE_MAX_MIN / 60}h`;

  const buyRow = document.getElementById('offlineBuyRow');
  if (game.offlineTimeMinutes >= OFFLINE_MAX_MIN) {
    buyRow.innerHTML = `<p style="font-size: 0.75rem; color: var(--success); margin-top: 8px;">✅ ${i18n.t('offline.maxReached')}</p>`;
  } else {
    document.getElementById('offlineBuyCatnip').disabled = game.catnip < OFFLINE_COST_CATNIP;
    document.getElementById('offlineBuyDiamond').disabled = game.diamonds < OFFLINE_COST_DIAMOND;
  }
}

// Buy +30 min of offline window. Retroactively grants earnings for the extra
// time if the player was away longer than the old window allowed.
function buyOfflineTime(currency) {
  if (_stateTransition || !_offlineContext || !['catnip', 'diamonds'].includes(currency)) return false;
  if (game.offlineTimeMinutes >= OFFLINE_MAX_MIN) {
    showDebug('buyOfflineTime: window at max ' + OFFLINE_MAX_MIN + ' min');
    return false;
  }
  const cost = currency === 'catnip' ? OFFLINE_COST_CATNIP : OFFLINE_COST_DIAMOND;
  if (currency === 'catnip') {
    if (game.catnip < cost) {
      showDebug('buyOfflineTime: cannot afford ' + cost + ' catnip (have ' + game.catnip.toFixed(1) + ')');
      return false;
    }
    game.catnip -= cost;
  } else {
    if (game.diamonds < cost) {
      showDebug('buyOfflineTime: cannot afford ' + cost + ' diamonds (have ' + Math.floor(game.diamonds) + ')');
      return false;
    }
    game.diamonds -= cost;
  }

  game.offlineTimeMinutes = Math.min(game.offlineTimeMinutes + OFFLINE_STEP_MIN, OFFLINE_MAX_MIN);
  const gain = creditOffline(_offlineContext, game.offlineTimeMinutes * 60);
  showDebug('buyOfflineTime: window now ' + game.offlineTimeMinutes + ' min, fish +' + gain.fish);

  updateOfflinePopup();
  saveGame();
  render();
  return true;
}

// Show offline earnings popup
function showOfflineEarnings(context) {
  _offlineContext = context;
  const existing = document.getElementById('offlinePopup');
  if (existing) existing.remove();
  const totals = offlineTotals(context, context.creditedSeconds);
  if (!Object.values(totals).some(value => value > 0)) return;
  const seconds = Math.floor(context.awaySeconds);
  const timeAway = `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`;

  const popup = document.createElement('div');
  popup.id = 'offlinePopup';
  popup.innerHTML = `
    <div style="background: var(--bg-secondary); border: 2px solid var(--cat-orange); border-radius: var(--border-radius); padding: 20px; text-align: center; max-width: 360px; margin: 0 auto; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">
      <h3 style="color: var(--cat-orange); margin-bottom: 8px;">🐱 ${i18n.t('offline.title', 'Welcome Back!')}</h3>
      <p style="font-size: 0.85rem; color: var(--text-secondary);">${i18n.t('offline.away', 'You were away for {time}').replace('{time}', `<b>${timeAway}</b>`)}</p>
      <div style="margin: 12px 0;">
        <p style="font-size: 1.2rem;">🐟 <b style="color: var(--gold);" id="offlineFishTotal">0</b> ${i18n.t('offline.fishEarned', 'fish earned')}</p>
        <p style="font-size: 1rem;" id="offlineCatnipLine">🌿 <b style="color: var(--cat-orange);" id="offlineCatnipTotal">0</b> ${i18n.t('offline.catnipEarned', 'catnip earned')}</p>
        <p style="font-size: 1rem;" id="offlineElixirLine">🧪 <b id="offlineElixirTotal">0</b> ${i18n.t('offline.elixirsEarned', 'elixirs earned')}</p>
      </div>
      <p style="font-size: 0.75rem; color: var(--text-muted);" id="offlineWindowInfo"></p>
      <div id="offlineBuyRow" style="margin-top: 10px; display: flex; gap: 8px; justify-content: center;">
        <button class="btn btn-sm" id="offlineBuyCatnip" onclick="buyOfflineTime('catnip')">⏱️ ${i18n.t('offline.buy30')} (${OFFLINE_COST_CATNIP}🌿)</button>
        <button class="btn btn-sm" id="offlineBuyDiamond" onclick="buyOfflineTime('diamonds')">⏱️ ${i18n.t('offline.buy30')} (${OFFLINE_COST_DIAMOND}💎)</button>
      </div>
      <button class="btn btn-primary" onclick="document.getElementById('offlinePopup').remove()" style="margin-top: 8px;">${i18n.t('offline.collect', 'Collect')}</button>
    </div>
  `;

  // Style and position as a modal overlay
  popup.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);z-index:9998;';
  popup.onclick = (e) => { if (e.target === popup) popup.remove(); };

  document.body.appendChild(popup);
  updateOfflinePopup();
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
window.loadLocalGame = loadLocalGame;
window.startGameLoops = startGameLoops;
window.addFish = addFish;
window.spendFish = spendFish;
window.recalcFPS = recalcFPS;
window.canAfford = canAfford;
window.hasUpgrade = hasUpgrade;
window.getUpgradeLevel = getUpgradeLevel;
window.getCatCost = getCatCost;
window.buyOfflineTime = buyOfflineTime;
