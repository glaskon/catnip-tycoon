// Core game state and mechanics for Catnip Tycoon
const game = {
  // --- Resources ---
  fish: 25,  // Starter fish
  fishPerClick: 1,
  fishPerSecond: 0,
  catnip: 0,
  diamonds: 0,
  totalFishEarned: 0,
  prestigeCount: 0,
  speedMultiplier: 1,

  // --- Click tracking ---
  clickCount: 0,
  totalCatsBought: 0,

  // --- Collections ---
  // Cats: [{id, nameKey, count, baseProduction, cost, unlocked}]
  cats: [],
  // Upgrades: [{id, nameKey, effect, cost, purchased}]
  upgrades: [],
  // Achievements: tracked in achievements.js

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
];

// ============================================================
// Upgrade definitions
// ============================================================
const UPGRADE_DEFINITIONS = [
  { id: 'karma', nameKey: 'upgrades.karma', descKey: 'upgrades.karmaDesc', effect: 'fish2x', cost: 100, currency: 'fish' },
  { id: 'autoclicker', nameKey: 'upgrades.autoclicker', descKey: 'upgrades.autoclickerDesc', effect: 'autoClick', cost: 500, currency: 'fish' },
  { id: 'miska', nameKey: 'upgrades.miska', descKey: 'upgrades.miskaDesc', effect: 'click2x', cost: 2000, currency: 'fish' },
  { id: 'buda', nameKey: 'upgrades.buda', descKey: 'upgrades.budaDesc', effect: 'cats1.5x', cost: 10000, currency: 'fish' },
  { id: 'karmnik', nameKey: 'upgrades.karmnik', descKey: 'upgrades.karmnikDesc', effect: 'catnip2x', cost: 10, currency: 'catnip' },
];

// ============================================================
// Initialize game state
// ============================================================
function initGame() {
  // Build cats array from definitions
  game.cats = CAT_DEFINITIONS.map(def => ({
    ...def,
    count: 0,
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
  game.upgrades = UPGRADE_DEFINITIONS.map(def => ({
    ...def,
    purchased: false,
  }));
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

  for (const cat of game.cats) {
    base += cat.production;
    if (cat.id === 'kotmag' && cat.count > 0) {
      hasWizardCat = true;
    }
  }

  // Wizard Cat: +10% to all cat production per wizard cat
  if (hasWizardCat) {
    const wizardCats = game.cats.find(c => c.id === 'kotmag');
    if (wizardCats) {
      base *= (1 + 0.1 * wizardCats.count);
    }
  }

  // Upgrades that affect FPS
  if (hasUpgrade('karma')) base *= 2;
  if (hasUpgrade('buda')) base *= 1.5;

  // Prestige tier bonuses
  if (game.prestigeCount >= 5) base *= 2; // Tier 3: Divine artifacts

  game.fishPerSecond = base;
}

// Check if an upgrade has been purchased
function hasUpgrade(upgradeId) {
  const upg = game.upgrades.find(u => u.id === upgradeId);
  return upg && upg.purchased;
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

  // Upgrade: Golden Bowl (2x click multiplier)
  if (hasUpgrade('miska')) clickValue *= 2;

  addFish(clickValue);
  game.clickCount++;

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
  if (!cat || !cat.unlocked) return false;

  const cost = cat.currentCost;
  if (!spendFish(cost)) return false;

  cat.count++;
  game.totalCatsBought++;
  recalcFPS();

  if (typeof checkAchievements === 'function') checkAchievements();
  render();
  return true;
}

// Buy an upgrade by index
function buyUpgrade(index) {
  const upg = game.upgrades[index];
  if (!upg || upg.purchased) return false;

  const cost = upg.cost;
  const currency = upg.currency;

  // Check if player can afford
  if (currency === 'fish' && game.fish < cost) return false;
  if (currency === 'catnip' && game.catnip < cost) return false;

  // Deduct cost
  if (currency === 'fish') game.fish -= cost;
  else game.catnip -= cost;

  upg.purchased = true;

  // Apply upgrade effect
  applyUpgradeEffect(upg.id);

  recalcFPS();
  if (typeof checkAchievements === 'function') checkAchievements();
  render();
  return true;
}

// Apply the effect of a purchased upgrade
function applyUpgradeEffect(upgradeId) {
  switch (upgradeId) {
    case 'karma':
      // 2x fish/s — handled in recalcFPS()
      break;
    case 'autoclicker':
      // Auto 1 click/s — handled in gameLoop
      break;
    case 'miska':
      // 2x click multiplier — handled in clickCat()
      break;
    case 'buda':
      // 1.5x all cat production — handled in recalcFPS()
      break;
    case 'karmnik':
      // 2x catnip from prestige — handled in prestige()
      break;
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
  const catnipGain = Math.floor(Math.sqrt(game.totalFishEarned) / 100);
  // Upgrade: Feeder gives 2x catnip
  if (hasUpgrade('karmnik')) return catnipGain * 2;
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

  // Reset everything except catnip, diamonds, prestigeCount
  game.fish = 0;
  game.fishPerClick = 1;
  game.fishPerSecond = 0;
  game.totalFishEarned = 0;
  game.clickCount = 0;
  game.totalCatsBought = 0;
  game.catnip = oldCatnip + catnipGain;
  game.diamonds = oldDiamonds;
  game.prestigeCount = oldPrestigeCount;

  // Reset cats and upgrades
  game.cats.forEach(c => (c.count = 0));
  game.upgrades.forEach(u => (u.purchased = false));

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

  // Tier 2 prestige: Cat Shrine generates catnip/s
  if (game.prestigeCount >= 3) {
    game.catnip += 0.01 * delta * game.speedMultiplier;
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
      clickCount: game.clickCount,
      totalCatsBought: game.totalCatsBought,
      cats: game.cats.map(c => ({ id: c.id, count: c.count })),
      upgrades: game.upgrades.map(u => ({ id: u.id, purchased: u.purchased })),
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
    const state = await api.loadGameState();
    if (!state || state.fish === undefined) return; // Fresh save — keep starter fish

    // Detect empty/default save (no actual progress yet)
    if (!state.totalFishEarned && !state.totalCatsBought && !state.prestigeCount) {
      return; // Keep starter fish — no real progress on server
    }

    // Restore game state
    game.fish = state.fish || 0;
    game.fishPerClick = state.fishPerClick || 1;
    game.fishPerSecond = state.fishPerSecond || 0;
    game.catnip = state.catnip || 0;
    game.diamonds = state.diamonds || 0;
    game.totalFishEarned = state.totalFishEarned || 0;
    game.prestigeCount = state.prestigeCount || 0;
    game.speedMultiplier = state.speedMultiplier || 1;
    game.clickCount = state.clickCount || 0;
    game.totalCatsBought = state.totalCatsBought || 0;

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
        if (upg && savedUpg.purchased) {
          upg.purchased = true;
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
window.getCatCost = getCatCost;