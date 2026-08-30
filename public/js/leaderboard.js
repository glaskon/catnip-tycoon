// Leaderboard module — top players by total fish earned
// Public data: rank, masked email, fish, prestige, fps

let _lbSig = null;
let _lbLoaded = false;
let _lbFetching = false;
let _lbLastFetch = 0;
let _lbAbort = null; // AbortController for in-flight fetch
const LB_FETCH_INTERVAL = 30000; // refetch at most once per 30s

// Abort any in-flight leaderboard fetch (call when switching away from panel)
function abortLeaderboardFetch() {
  if (_lbAbort) {
    _lbAbort.abort();
    _lbAbort = null;
    _lbFetching = false;
  }
}

// Called from gameLoop every 100ms while the leaderboard tab is active.
// Must NOT fetch or rebuild the DOM every tick — that is what made the table
// "blink" (constant Loading... flash + 10 API calls/second).
function renderLeaderboard() {
  const container = document.getElementById('leaderboardContent');
  if (!container) return;

  const now = Date.now();
  if (_lbFetching || now - _lbLastFetch < LB_FETCH_INTERVAL) return;

  // Abort any previous in-flight request
  if (_lbAbort) { _lbAbort.abort(); _lbAbort = null; }
  _lbAbort = new AbortController();
  _lbFetching = true;
  _lbLastFetch = now;

  // Only show "Loading..." the very first time — never flash over real data
  if (!_lbLoaded) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Loading leaderboard...</p>';
  }

  api.getLeaderboard({ signal: _lbAbort.signal })
    .then(data => {
      _lbLoaded = true;
      const entries = data.leaderboard || [];
      if (entries.length === 0) {
        _lbSig = 'empty';
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No players yet — be the first!</p>';
        return;
      }

      // Rebuild only when the data actually changed (quantized — fish moves
      // every tick, nobody needs a rebuild per single-fish change)
      let sig = entries.length + '';
      for (const e of entries) {
        sig += '|' + e.rank + ':' + e.email + ':' + Math.floor(e.totalFishEarned / 100) + ':' + e.prestige + ':' + Math.floor(e.fps);
      }
      if (sig === _lbSig) return;
      _lbSig = sig;

      let html = '';
      for (const entry of entries) {
        const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `${entry.rank}.`;
        html += `<div class="card" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px;">`;
        html += `<span style="font-size: 1.1rem; min-width: 32px; text-align: center;">${medal}</span>`;
        html += `<div style="flex: 1;">`;
        html += `<div style="font-size: 0.85rem; color: var(--text);">${entry.email}</div>`;
        html += `<div style="font-size: 0.75rem; color: var(--text-secondary);">`;
        html += `🐟 ${formatNumber(entry.totalFishEarned)} | ✨ ${entry.prestige} prestige | ⚡ ${formatNumber(entry.fps)}/s`;
        html += `</div>`;
        html += `</div>`;
        html += `</div>`;
      }

      container.innerHTML = html;
      // Stable hover on entries (same treatment as cats/upgrades cards)
      initCardHoverTracking(container);
      restoreCardHover(container);
    })
    .catch(err => {
      if (err.name === 'AbortError') return; // silently ignore cancelled fetches
      console.error('[Leaderboard] Error:', err.message);
      if (!_lbLoaded) {
        container.innerHTML = `<p style="text-align: center; color: var(--danger);">❌ Failed to load leaderboard</p>`;
      }
    })
    .finally(() => {
      _lbFetching = false;
      _lbAbort = null;
    });
}

// Expose to global scope
window.renderLeaderboard = renderLeaderboard;
