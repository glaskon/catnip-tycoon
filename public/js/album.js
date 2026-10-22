// Monthly cosmetic album. The server is the sole owner of stamp progress
// (decision 6B) — this file only displays what the server reports and, once
// per visit, asks it to record today's stamp via POST /api/album/stamp. A
// failed or offline request may still show the last known state as a
// preview, but it must never grant a stamp locally: only a confirmed server
// response can change game.album.
let _albumRequest = null;
let _albumGeneration = 0;
let _albumTimeConfirmed = false;

function resetAlbumSession() {
  _albumGeneration++;
  _albumRequest = null;
  _albumTimeConfirmed = false;
}

function albumSkinId(month) { return 'skin_album_' + month; }
function albumSkinName(month) { return i18n.t('album.skin').replace('{month}', month); }

// A stable palette for each dated edition, read by the existing cat renderer.
function albumSkinPalette(id) {
  const match = /^skin_album_(\d{4})-(0[1-9]|1[0-2])$/.exec(id || '');
  if (!match) return null;
  const edition = Number(match[1]) * 12 + Number(match[2]);
  const hue = (edition * 137.508) % 360;
  return {
    fur: `hsl(${hue}, 65%, 70%)`, ear: `hsl(${(hue + 35) % 360}, 60%, 45%)`,
    whisker: `hsl(${hue}, 35%, 25%)`, mouth: `hsl(${hue}, 40%, 20%)`,
  };
}

// Folds a trusted /api/album(/stamp) response into the shape already
// persisted at game.album (and validated by validateAlbumState), and awards
// the 10th-stamp cosmetic if it is not owned yet. The stamp count itself is
// always the server's; this never increments anything on its own.
function applyAlbumResponse(response) {
  const previous = game.album;
  const month = response.month;
  const changed = !previous || previous.stamps !== response.stamps || previous.month !== month;
  game.album = response.stamps >= 1 ? {
    timeZone: response.timeZone, month: response.month, stamps: response.stamps,
    lastDay: response.lastStampDay, lastStampAt: response.lastStampAt, history: response.history,
  } : null;
  const id = albumSkinId(month);
  if (response.stamps === 10 && !hasItem(id)) {
    purchasedItems.push(id);
    savePurchasedItems();
    if (typeof drawCat === 'function') drawCat();
    showToast('🐾 ' + i18n.t('album.unlocked') + ' ' + albumSkinName(month));
  }
  // State and cosmetic are in one snapshot, including for guests. Polling
  // and the startup preview below call this often; only save when something
  // actually moved, not on every idempotent same-day confirmation.
  if (changed) saveGame();
}

// "Przy starcie: GET /api/album ... i ten stan pokazuję" (decision 6B) — a
// fast, read-only preview of the server's last known state shown immediately
// at startup, before refreshAlbum()'s slower stamp attempt below resolves.
async function primeAlbumFromServer() {
  if (!game.isReady || game.saveConflict) return;
  try {
    const response = await api.getAlbum(getDeviceId());
    if (!game.isReady || game.saveConflict) return;
    applyAlbumResponse(response);
  } catch {
    // Keep whatever local preview is already on screen; refreshAlbum retries.
  } finally {
    renderAlbum();
  }
}

async function refreshAlbum() {
  if (!game.isReady || game.saveConflict || _albumRequest) return;
  const request = { generation: _albumGeneration };
  _albumRequest = request;
  try {
    const zone = game.album ? game.album.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await api.stampAlbum(getDeviceId(), zone);
    if (request.generation !== _albumGeneration || !game.isReady || game.saveConflict) return;
    _albumTimeConfirmed = true;
    applyAlbumResponse(response);
  } catch {
    // Offline or erroring: keep showing the last known state (if any) as an
    // unconfirmed preview. No stamp is granted outside a confirmed response.
    if (request.generation === _albumGeneration) _albumTimeConfirmed = false;
  } finally {
    if (_albumRequest === request) _albumRequest = null;
    renderAlbum();
  }
}

function equipAlbumSkin(month) {
  if (!game.isReady || game.saveConflict || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;
  equipCosmetic('skin', albumSkinId(month));
}

function albumRewardHTML(month, owned) {
  const palette = albumSkinPalette(albumSkinId(month));
  if (!palette) return '';
  return `<span class="album-swatch" style="background:${palette.fur}" aria-hidden="true">🐈</span>
    ${albumSkinName(month)}${owned ? ` <button class="btn btn-secondary btn-sm" onclick="equipAlbumSkin('${month}')">${i18n.t(game.equippedSkin === albumSkinId(month) ? 'wardrobe.equipped' : 'album.equip')}</button>` : ''}`;
}

// visited: a confirmed response arrived this session. offline: the server
// could not be reached, but a previously confirmed state is on screen as a
// preview. waiting: no confirmed state has ever arrived yet.
function albumStatusKey() {
  if (_albumTimeConfirmed) return 'album.visited';
  return game.album ? 'album.offline' : 'album.waiting';
}

function renderAlbum() {
  const container = document.getElementById('albumContent');
  const summary = document.getElementById('albumSummary');
  const album = game.album;
  const count = album ? album.stamps : 0;
  if (summary) {
    const html = `<button class="btn btn-secondary" onclick="switchPanel('daily')">🐾 ${i18n.t('album.title')} · ${count}/10</button>`;
    if (summary.innerHTML !== html) summary.innerHTML = html;
  }
  if (!container) return;
  let html = `<h3>🐾 ${i18n.t('album.title')}${album ? ' · ' + album.month : ''}</h3>`;
  html += `<p>${i18n.t('album.description')}</p><p role="status">${count}/10 — ${i18n.t(albumStatusKey())}</p>`;
  html += '<div class="album-stamps" aria-hidden="true">' + Array.from({ length: 10 }, (_, i) =>
    `<span class="album-stamp ${i < count ? 'album-stamped' : ''}">${i < count ? '🐾' : i + 1}</span>`).join('') + '</div>';
  if (album) {
    html += `<p>${albumRewardHTML(album.month, hasItem(albumSkinId(album.month)))}</p>`;
    html += `<p class="album-calendar">${i18n.t('album.calendar').replace('{zone}', escapeHtml(album.timeZone))}</p>`;
    const history = Object.entries(album.history).sort(([a], [b]) => b.localeCompare(a));
    if (history.length) {
      html += `<h3>${i18n.t('album.history')}</h3><ul class="album-history">`;
      for (const [month, stamps] of history) {
        const owned = hasItem(albumSkinId(month));
        html += `<li>${month} · ${stamps}/10 · ${i18n.t(owned ? 'album.earned' : 'album.missed')}<br>${albumRewardHTML(month, owned)}</li>`;
      }
      html += '</ul>';
    }
  }
  if (container.innerHTML !== html) container.innerHTML = html;
}

// Also run at each completed guest/account restore (game.js). Polling allows
// a tab left open over midnight to count its first visit in the new day.
document.addEventListener('DOMContentLoaded', () => {
  setInterval(() => { if (!document.hidden) refreshAlbum(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAlbum(); });
});
