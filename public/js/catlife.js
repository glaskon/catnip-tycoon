// Cat Life module - virtual pet with hunger and mood (unlocked at prestige 3)
// Hunger decays in real time from a timestamp (works offline too).
// Happy pet (hunger >= 70) grants +10% fish/s in recalcFPS.

const CATLIFE_UNLOCK_PRESTIGE = 3;
const CATLIFE_FOOD_COST = 10000; // fish per meal
const CATLIFE_MEAL_SIZE = 40;    // hunger restored per meal
const CATLIFE_DECAY_PER_SEC = 100 / (8 * 3600); // 100 -> 0 in 8 hours

function getCatLife() {
  if (!game.catlife) {
    game.catlife = { hunger: 100, lastUpdate: Date.now(), fedCount: 0 };
  }
  return game.catlife;
}

// Effective hunger now (decayed in real time since lastUpdate)
function getCatLifeHunger() {
  const cl = getCatLife();
  const now = Date.now();
  const elapsed = Math.max(0, (now - cl.lastUpdate) / 1000);
  const hunger = cl.hunger - elapsed * CATLIFE_DECAY_PER_SEC;
  return Math.max(0, Math.min(100, hunger));
}

// 'happy' | 'neutral' | 'sad'
function getCatLifeMood() {
  if (game.prestigeCount < CATLIFE_UNLOCK_PRESTIGE) return 'locked';
  const h = getCatLifeHunger();
  if (h >= 70) return 'happy';
  if (h >= 30) return 'neutral';
  return 'sad';
}

// Called from recalcFPS — happy pet = +10% production
function catLifeProductionMultiplier() {
  return getCatLifeMood() === 'happy' ? 1.1 : 1;
}

function feedCatLife() {
  const mood = getCatLifeMood();
  if (mood === 'locked') return false;
  if (game.fish < CATLIFE_FOOD_COST) {
    showDebug('feedCatLife: need ' + CATLIFE_FOOD_COST + ' fish (have ' + game.fish.toFixed(0) + ')');
    return false;
  }
  game.fish -= CATLIFE_FOOD_COST;
  const cl = getCatLife();
  // Apply decay up to now first, then restore
  cl.hunger = getCatLifeHunger();
  cl.hunger = Math.min(100, cl.hunger + CATLIFE_MEAL_SIZE);
  cl.lastUpdate = Date.now();
  cl.fedCount = (cl.fedCount || 0) + 1;
  showToast(i18n.t('catlife.fedToast', '🍖 Nom nom! +{n} hunger').replace('{n}', String(CATLIFE_MEAL_SIZE)));
  recalcFPS();
  saveGame();
  render();
  return true;
}

let _catLifeSig = null;
function renderCatLife() {
  const container = document.getElementById('catLifeContent');
  if (!container) return;

  const mood = getCatLifeMood();
  const hunger = Math.floor(getCatLifeHunger());
  const cl = getCatLife();
  const sig = [i18n.currentLang, mood, Math.floor(hunger / 10), cl.fedCount || 0, game.prestigeCount >= CATLIFE_UNLOCK_PRESTIGE ? 1 : 0].join('|');
  if (sig === _catLifeSig) return;
  _catLifeSig = sig;

  let html = '';

  if (mood === 'locked') {
    html += `<div style="text-align: center; padding: 30px;">`;
    html += `<div style="font-size: 3rem;">🔒</div>`;
    html += `<p style="color: var(--text-secondary); font-size: 0.9rem;">${i18n.t('catlife.locked', 'Cat Life unlocks at prestige {n}').replace('{n}', String(CATLIFE_UNLOCK_PRESTIGE))}</p>`;
    html += `</div>`;
    container.innerHTML = html;
    return;
  }

  const face = mood === 'happy' ? '😻' : mood === 'neutral' ? '😺' : '😿';
  const moodLabel = i18n.t('catlife.mood_' + mood, mood);

  html += `<div style="text-align: center; padding: 16px;">`;
  html += `<div style="font-size: 4rem; line-height: 1.2;" id="catLifePet">${face}</div>`;
  html += `<p style="font-size: 1rem; font-weight: bold; color: var(--text-primary);">${moodLabel}</p>`;

  // Hunger bar
  html += `<div style="max-width: 260px; margin: 14px auto;">`;
  html += `<p style="font-size: 0.75rem; color: var(--text-secondary); text-align: left;">${i18n.t('catlife.hunger', 'Hunger')}: <span id="catLifeHungerVal">${hunger}</span>/100</p>`;
  html += `<div class="prestige-progress"><div class="prestige-bar" id="catLifeHungerBar" style="width: ${hunger}%; background: ${hunger >= 70 ? 'var(--success)' : hunger >= 30 ? 'var(--gold)' : 'var(--danger, #e74c3c)'};"></div></div>`;
  html += `</div>`;

  // Feed button
  html += `<button class="btn btn-primary" onclick="feedCatLife()" ${game.fish < CATLIFE_FOOD_COST ? 'disabled' : ''}>`;
  html += `🍖 ${i18n.t('catlife.feed', 'Feed')} (${formatNumber(CATLIFE_FOOD_COST)}🐟)</button>`;

  html += `<p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 12px;">${i18n.t('catlife.bonus', 'Happy pet: +10% fish/s')}</p>`;
  html += `<p style="font-size: 0.7rem; color: var(--text-muted);">${i18n.t('catlife.fedCount', 'Meals served')}: {n}`.replace('{n}', String(cl.fedCount || 0)) + `</p>`;
  html += `</div>`;

  container.innerHTML = html;
}

window.getCatLifeMood = getCatLifeMood;
window.catLifeProductionMultiplier = catLifeProductionMultiplier;
window.feedCatLife = feedCatLife;
window.renderCatLife = renderCatLife;
