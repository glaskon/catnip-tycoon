// Monthly cosmetic album. Only fresh server time can award a stamp; the
// device wall clock is never consulted. The first local IANA zone is retained
// (including its DST rules) so travelling cannot manufacture calendar days.
let _albumRequest = null;
let _albumGeneration = 0;
let _albumTimeConfirmed = false;

function resetAlbumSession() {
  _albumGeneration++;
  _albumRequest = null;
  _albumTimeConfirmed = false;
}

function albumDateKey(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
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

function recordAlbumVisit(timestamp) {
  if (!game.isReady || game.saveConflict || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > 253402300799999) return false;
  const previous = game.album;
  const timeZone = previous ? previous.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = albumDateKey(timestamp, timeZone);
  // High-water marks also reject a delayed response or backwards server time.
  if (previous && (timestamp <= previous.lastStampAt || day <= previous.lastDay)) return false;
  const month = day.slice(0, 7);
  const album = previous || { timeZone, month, stamps: 0, lastDay: '', lastStampAt: 0, history: {} };
  if (month !== album.month) {
    album.history[album.month] = album.stamps;
    album.month = month;
    album.stamps = 0;
  }
  album.lastDay = day;
  album.lastStampAt = timestamp;
  // No backfilling missed days and no stamps beyond this month's ten slots.
  album.stamps = Math.min(10, album.stamps + 1);
  game.album = album;
  const id = albumSkinId(month);
  if (album.stamps === 10 && !hasItem(id)) {
    purchasedItems.push(id);
    savePurchasedItems();
    if (typeof drawCat === 'function') drawCat();
    showToast('🐾 ' + i18n.t('album.unlocked') + ' ' + albumSkinName(month));
  }
  // State and cosmetic are in one snapshot, including for guests.
  saveGame();
  return true;
}

async function refreshAlbum() {
  if (!game.isReady || game.saveConflict || _albumRequest) return;
  const request = { generation: _albumGeneration };
  _albumRequest = request;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Album time unavailable');
    const data = await response.json();
    const timestamp = Date.parse(data.timestamp);
    if (data.status !== 'ok' || !Number.isSafeInteger(timestamp) || timestamp <= 0 || timestamp > 253402300799999) throw new Error('Invalid album time');
    if (request.generation !== _albumGeneration || !game.isReady || game.saveConflict) return;
    _albumTimeConfirmed = true;
    recordAlbumVisit(timestamp);
  } catch {
    if (request.generation === _albumGeneration) _albumTimeConfirmed = false;
  } finally {
    clearTimeout(timeout);
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
  html += `<p>${i18n.t('album.description')}</p><p role="status">${count}/10 — ${i18n.t(_albumTimeConfirmed ? 'album.visited' : 'album.waiting')}</p>`;
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
