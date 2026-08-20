// Leaderboard module — top players by total fish earned
// Public data: rank, masked email, fish, prestige, fps

function renderLeaderboard() {
  const container = document.getElementById('leaderboardContent');
  if (!container) return;

  container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Loading leaderboard...</p>';

  api.getLeaderboard()
    .then(data => {
      const entries = data.leaderboard || [];
      if (entries.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No players yet — be the first!</p>';
        return;
      }

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
    })
    .catch(err => {
      container.innerHTML = `<p style="text-align: center; color: var(--danger);">❌ Failed to load leaderboard</p>`;
      console.error('[Leaderboard] Error:', err.message);
    });
}

// Expose to global scope
window.renderLeaderboard = renderLeaderboard;