// Daily Login + Streak module
// 7-day reward cycle. Streak = consecutive days claimed; miss a day and it resets to 1.
// Rewards escalate: fish (days 1-3) -> catnip (days 4-6) -> diamond (day 7), then cycle.

const DAILY_CYCLE_LEN = 7;

// Reward per day of the cycle (index 0 = day 1)
const DAILY_REWARDS = [
  { currency: 'fish',     amount: 500   },
  { currency: 'fish',     amount: 1500  },
  { currency: 'fish',     amount: 5000  },
  { currency: 'catnip',   amount: 5     },
  { currency: 'catnip',   amount: 15    },
  { currency: 'catnip',   amount: 50    },
  { currency: 'diamonds', amount: 5     },
];

// Local calendar day key (YYYY-MM-DD) — calendar arithmetic is DST-safe
function localDateKey(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function getDaily() {
  if (!game.daily) {
    game.daily = { count: 0, lastClaimDate: '' };
  }
  return game.daily;
}

function isDailyClaimedToday() {
  return getDaily().lastClaimDate === localDateKey();
}

// Streak that would be set if claimed right now (yesterday's claim -> +1, else fresh 1)
function getPendingStreak() {
  const d = getDaily();
  const now = new Date();
  const yesterday = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  return d.lastClaimDate === yesterday ? (d.count || 0) + 1 : 1;
}

// 1-based reward tier of the cycle for the pending claim
function getPendingTier() {
  return ((getPendingStreak() - 1) % DAILY_CYCLE_LEN) + 1;
}

function dailyRewardSymbol(currency) {
  if (currency === 'catnip') return '🌿';
  if (currency === 'diamonds') return '💎';
  return '🐟';
}

function claimDaily() {
  if (isDailyClaimedToday()) return;
  const tier = getPendingTier();
  const reward = DAILY_REWARDS[tier - 1];
  const d = getDaily();
  d.count = getPendingStreak();
  d.lastClaimDate = localDateKey();
  if (reward.currency === 'fish') addFish(reward.amount);
  else if (reward.currency === 'catnip') game.catnip += reward.amount;
  else game.diamonds += reward.amount;
  if (typeof showToast === 'function') {
    showToast('🎁 ' + i18n.t('daily.claimedToast', 'Daily reward: ') + formatNumber(reward.amount) + dailyRewardSymbol(reward.currency));
  }
  showDebug('claimDaily: tier=' + tier + ' +' + reward.amount + ' ' + reward.currency + ' streak=' + d.count);
  saveGame();
  render();
}

let _dailySig = null;
function renderDaily() {
  const container = document.getElementById('dailyContent');
  if (!container) return;

  const claimed = isDailyClaimedToday();
  const tier = getPendingTier();
  const d = getDaily();
  const sig = [i18n.currentLang, claimed ? 1 : 0, tier, d.count].join('|');
  if (sig === _dailySig) return;
  _dailySig = sig;

  let html = '';

  // Streak counter
  html += `<div style="text-align: center; padding: 6px 0 14px;">`;
  html += `<div style="font-size: 0.9rem; color: var(--text-secondary);">${i18n.t('daily.streak', 'Streak')}</div>`;
  html += `<div style="font-size: 2.2rem; font-weight: bold; color: var(--gold);">${d.count} 🔥</div>`;
  html += `</div>`;

  // 7-day cycle
  html += `<div class="daily-cycle">`;
  const doneSlot = ((d.count - 1) % DAILY_CYCLE_LEN) + 1; // slot just claimed today
  for (let i = 0; i < DAILY_CYCLE_LEN; i++) {
    const r = DAILY_REWARDS[i];
    let cls = 'daily-slot';
    if (!claimed && i + 1 === tier) cls += ' daily-slot-active';
    else if (claimed && i + 1 === doneSlot) cls += ' daily-slot-done';
    html += `<div class="${cls}">`;
    html += `<div class="daily-slot-day">${i18n.t('daily.day', 'Day')} ${i + 1}</div>`;
    html += `<div class="daily-slot-reward">${dailyRewardSymbol(r.currency)} ${formatNumber(r.amount)}</div>`;
    html += `</div>`;
  }
  html += `</div>`;

  // Claim button or claimed state
  if (claimed) {
    html += `<p style="text-align: center; margin-top: 14px; color: var(--success); font-weight: bold;">✅ ${i18n.t('daily.claimed', 'Claimed! See you tomorrow')}</p>`;
  } else {
    const r = DAILY_REWARDS[tier - 1];
    html += `<div style="text-align: center; margin-top: 16px;">`;
    html += `<button class="btn btn-primary" onclick="claimDaily()">🎁 ${i18n.t('daily.claim', 'Claim')} +${formatNumber(r.amount)}${dailyRewardSymbol(r.currency)}</button>`;
    html += `</div>`;
  }

  html += `<p style="font-size: 0.7rem; color: var(--text-muted); text-align: center; margin-top: 14px;">${i18n.t('daily.desc', 'Come back every day. Miss a day and the streak resets. The cycle repeats after day 7.')}</p>`;
  container.innerHTML = html;
}

// Badge on the nav button while a reward is claimable
function updateDailyBadge() {
  const btn = document.querySelector('.nav-btn[data-panel="daily"]');
  if (!btn) return;
  if (isDailyClaimedToday()) btn.classList.remove('daily-ready');
  else btn.classList.add('daily-ready');
}

// Availability check + re-render (cheap — only rebuilds on state change)
function refreshDaily() {
  updateDailyBadge();
  renderDaily();
}

window.claimDaily = claimDaily;
window.renderDaily = renderDaily;
window.refreshDaily = refreshDaily;
window.getPendingTier = getPendingTier;

document.addEventListener('DOMContentLoaded', () => {
  // Day can only change once per day — 5s polling is plenty
  setInterval(() => { if (game.isReady) refreshDaily(); }, 5000);
});