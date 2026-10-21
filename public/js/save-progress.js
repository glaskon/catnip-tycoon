// Shared by plain browser scripts and the save route. Defaults and timestamps
// are not progress; spent currency still counts through lifetime counters.
function hasRealProgress(state) {
  if (!state || typeof state !== 'object') return false;
  const counters = ['fish', 'catnip', 'diamonds', 'elixirs', 'totalFishEarned',
    'prestigeCount', 'clickCount', 'totalCatsBought', 'luckyCatnipCount', 'dailyClicks'];
  if (counters.some(key => Number.isFinite(state[key]) && state[key] > 0)) return true;
  if (state.fishPerClick > 1 || state.offlineTimeMinutes > 60) return true;
  if (['cats', 'upgrades'].some(key => Array.isArray(state[key]) && state[key].some(item =>
    item && (item.count > 0 || item.purchased === true || item.level > 0)))) return true;
  if (['achievements', 'purchasedItems', 'activeBoosts'].some(key => Array.isArray(state[key]) && state[key].length)) return true;
  if (state.shopCounts && Object.values(state.shopCounts).some(n => n > 0)) return true;
  return !!(state.anchoredCatId || state.preservedUpgradeId ||
    state.daily && (state.daily.count > 0 || state.daily.lastClaimDate) ||
    state.catlife && state.catlife.fedCount > 0 ||
    state.gacha && (state.gacha.totalPulls > 0 || state.gacha.pity > 0 ||
      state.gacha.counts && Object.values(state.gacha.counts).some(n => n > 0)));
}

if (typeof window !== 'undefined') window.hasRealProgress = hasRealProgress;
if (typeof module !== 'undefined') module.exports = { hasRealProgress };
