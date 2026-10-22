// Rendering module - draws everything on screen
// Handles canvas drawing, UI updates, and particle effects

// ============================================================
// Background Canvas - floating fish and cat paws
// ============================================================

let bgParticles = [];
let bgAnimationId = null;
let _bgResizeHandler = null; // stored for cleanup

// Cleanup background animation (call before re-init to avoid listener accumulation)
function destroyBackground() {
  if (_bgResizeHandler) {
    window.removeEventListener('resize', _bgResizeHandler);
    _bgResizeHandler = null;
  }
  if (bgAnimationId) {
    cancelAnimationFrame(bgAnimationId);
    bgAnimationId = null;
  }
  bgParticles = [];
}

// Initialize background animation
function initBackground() {
  // Guard against double-init (resize listener accumulation)
  destroyBackground();

  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  _bgResizeHandler = function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', _bgResizeHandler);
  _bgResizeHandler();

  // Create initial background particles
  for (let i = 0; i < 20; i++) {
    bgParticles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: 12 + Math.random() * 18,
      speed: 0.3 + Math.random() * 0.7,
      type: Math.random() > 0.5 ? 'fish' : 'paw',
      opacity: 0.05 + Math.random() * 0.1,
      drift: (Math.random() - 0.5) * 0.5,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of bgParticles) {
      // Move particles upward (floating effect)
      p.y -= p.speed;
      p.x += p.drift;

      // Wrap around edges
      if (p.y < -30) {
        p.y = canvas.height + 30;
        p.x = Math.random() * canvas.width;
      }
      if (p.x < -30) p.x = canvas.width + 30;
      if (p.x > canvas.width + 30) p.x = -30;

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.font = `${p.size}px serif`;

      if (p.type === 'fish') {
        ctx.fillText('🐟', p.x, p.y);
      } else {
        ctx.fillText('🐾', p.x, p.y);
      }

      ctx.restore();
    }

    bgAnimationId = requestAnimationFrame(animate);
  }

  animate();
}

// ============================================================
// Cat Canvas - draw the clickable cat
// ============================================================

// Cat skins from the shop — fur/whisker/mouth palettes (selected in the wardrobe)
const CAT_SKINS = {
  skin_orange:  { fur: '#f4a261', whisker: '#8b5e3c', mouth: '#6b4c3b', ear: '#f4a261' },
  skin_black:   { fur: '#2d3436', whisker: '#9aa5a8', mouth: '#8a9498', ear: '#2d3436' },
  skin_siamese: { fur: '#f5e6d3', whisker: '#a9825e', mouth: '#8b5e3c', ear: '#8b5e3c' },
  skin_galaxy:  { fur: '#5b4b8a', whisker: '#c5b3e8', mouth: '#8f7fc0', ear: '#4a3d75' }, // gacha-exclusive (legendary)
};

function drawCat() {
  const canvas = document.getElementById('catCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Explicit equipment leaves the default palette and geometry unchanged.
  const skinId = game.equippedSkin;
  let skin = CAT_SKINS[skinId] || CAT_SKINS.skin_orange;
  if (skinId && !CAT_SKINS[skinId] && typeof albumSkinPalette === 'function') {
    skin = albumSkinPalette(skinId) || skin;
  }
  const activeOutfit = game.equippedOutfit;

  // Draw a stylized cat face with emoji-like style using canvas primitives
  const cx = w / 2;
  const cy = h / 2 - 5;
  const headRadius = 55;

  // Body
  ctx.fillStyle = skin.fur;
  ctx.beginPath();
  ctx.ellipse(cx, cy + headRadius - 10, 50, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = skin.fur;
  ctx.beginPath();
  ctx.arc(cx, cy - 10, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Ears (left)
  ctx.fillStyle = skin.ear;
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy - 50);
  ctx.lineTo(cx - 55, cy - 85);
  ctx.lineTo(cx - 20, cy - 55);
  ctx.fill();

  // Ears (right)
  ctx.beginPath();
  ctx.moveTo(cx + 40, cy - 50);
  ctx.lineTo(cx + 55, cy - 85);
  ctx.lineTo(cx + 20, cy - 55);
  ctx.fill();

  // Inner ears
  ctx.fillStyle = '#e8a0b4';
  ctx.beginPath();
  ctx.moveTo(cx - 38, cy - 50);
  ctx.lineTo(cx - 50, cy - 78);
  ctx.lineTo(cx - 24, cy - 54);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 38, cy - 50);
  ctx.lineTo(cx + 50, cy - 78);
  ctx.lineTo(cx + 24, cy - 54);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(cx - 18, cy - 20, 14, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 18, cy - 20, 14, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = '#2d3436';
  ctx.beginPath();
  ctx.ellipse(cx - 16, cy - 18, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 20, cy - 18, 7, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - 12, cy - 23, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 24, cy - 23, 3, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.fillStyle = '#e8a0b4';
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 5);
  ctx.lineTo(cx + 6, cy - 5);
  ctx.lineTo(cx, cy + 2);
  ctx.fill();

  // Mouth
  ctx.strokeStyle = skin.mouth;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2);
  ctx.lineTo(cx - 10, cy + 12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + 2);
  ctx.lineTo(cx + 10, cy + 12);
  ctx.stroke();

  // Whiskers
  ctx.strokeStyle = skin.whisker;
  ctx.lineWidth = 1;
  // Left whiskers
  ctx.beginPath(); ctx.moveTo(cx - 15, cy); ctx.lineTo(cx - 45, cy - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - 15, cy + 4); ctx.lineTo(cx - 45, cy + 6); ctx.stroke();
  // Right whiskers
  ctx.beginPath(); ctx.moveTo(cx + 15, cy); ctx.lineTo(cx + 45, cy - 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + 15, cy + 4); ctx.lineTo(cx + 45, cy + 6); ctx.stroke();

  // Fish emoji in front of the cat
  ctx.font = '36px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🐟', cx + 30, cy + 25);

  // --- Outfits (drawn last, on top of head) ---
  if (activeOutfit === 'outfit_hat') {
    // Top hat: cylinder + brim + band, sitting between the ears
    ctx.fillStyle = '#22222a';
    ctx.fillRect(cx - 24, cy - 105, 48, 42);            // cylinder
    ctx.beginPath();
    ctx.ellipse(cx, cy - 63, 34, 8, 0, 0, Math.PI * 2);  // brim
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(cx - 24, cy - 74, 48, 7);               // band
  } else if (activeOutfit === 'outfit_crown') {
    // Royal crown: gold zigzag with a base band
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy - 62);
    ctx.lineTo(cx - 28, cy - 92);
    ctx.lineTo(cx - 14, cy - 74);
    ctx.lineTo(cx, cy - 96);
    ctx.lineTo(cx + 14, cy - 74);
    ctx.lineTo(cx + 28, cy - 92);
    ctx.lineTo(cx + 28, cy - 62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(cx - 28, cy - 66, 56, 6);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(cx, cy - 76, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ============================================================
// Particle effects on click
// ============================================================

function spawnParticles(x, y, amount) {
  let emojis = ['🐟', '🐠', '✨', '🐾'];
  // Only the selected effect extends the unchanged default click palette.
  if (game.equippedEffect === 'effect_sparkle') emojis = emojis.concat(['✨', '🌟', '💫']);
  if (game.equippedEffect === 'effect_rainbow') emojis = emojis.concat(['🌈', '💜', '💛', '💚', '🐟']);
  if (game.equippedEffect === 'effect_aurora') emojis = emojis.concat(['🌌', '🔮', '💠', '❄️']);
  const count = Math.min(5, Math.ceil(amount / 5));

  // Global cap on concurrent particles to avoid DOM bloat during rapid clicking
  const existing = document.querySelectorAll('.particle').length;
  const toSpawn = Math.min(count, MAX_PARTICLES - existing);
  if (toSpawn <= 0) return;

  for (let i = 0; i < toSpawn; i++) {
    const particle = document.createElement('span');
    particle.className = 'particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
    particle.style.setProperty('--dy', `${-40 - Math.random() * 60}px`);

    document.body.appendChild(particle);

    // Remove particle after animation ends
    setTimeout(() => {
      if (particle.parentNode) {
        particle.parentNode.removeChild(particle);
      }
    }, PARTICLE_LIFE_MS);
  }
}

// ============================================================
// UI Rendering
// ============================================================

// Format large numbers with suffixes (K, M, B, T)
function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  if (num >= 1e15) return (num / 1e15).toFixed(2) + 'Q';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  if (Number.isInteger(num)) return num.toLocaleString();
  return num.toFixed(1);
}

// Cached DOM writer for stat elements: skip textContent updates when unchanged.
const _statsCache = {};
function setStat(id, value) {
  const s = String(value);
  if (_statsCache[id] === s) return;
  _statsCache[id] = s;
  const el = document.getElementById(id);
  if (el) el.textContent = s;
}

// Update the stats display
function updateStats() {
  setStat('fishCount', formatNumber(game.fish));
  setStat('clickValue', `${formatRate(calculateClickValue())} ${i18n.t('economy.clickRate')}`);
  setStat('fishPerSec', formatRate(getFishIncomeRate()));
  setStat('catnipCount', formatNumber(Math.floor(game.catnip)));
  setStat('diamondCount', formatNumber(Math.floor(game.diamonds)));
  renderTopBar();

  // Prestige panel hot numbers — updated in place (no DOM rebuild) so the
  // prestige button is never replaced mid-click. The ids only exist while
  // the prestige panel is built and visible.
  const prestigeBar = document.getElementById('prestigeBar');
  if (prestigeBar && typeof getCatnipNeeded === 'function') {
    const needed = getCatnipNeeded();
    const pct = Math.min(100, (game.totalFishEarned / needed) * 100);
    const widthStr = pct + '%';
    if (_statsCache['prestigeBar.width'] !== widthStr) {
      _statsCache['prestigeBar.width'] = widthStr;
      prestigeBar.style.width = widthStr;
    }
    setStat('prestigeBar', pct > 15 ? pct.toFixed(1) + '%' : '');
  }
  const prestigeFishLine = document.getElementById('prestigeFishLine');
  if (prestigeFishLine) {
    setStat('prestigeFishLine', `🐟 ${formatNumber(game.totalFishEarned)} / ${formatNumber(getCatnipNeeded())} ${i18n.t('prestige.needed')}`);
  }
  const prestigeNeedMore = document.getElementById('prestigeNeedMore');
  if (prestigeNeedMore) {
    setStat('prestigeNeedMore', `Need ${formatNumber(Math.max(0, getCatnipNeeded() - game.totalFishEarned))} more fish`);
  }
  const prestigeCatnipVal = document.getElementById('prestigeCatnipVal');
  if (prestigeCatnipVal) {
    setStat('prestigeCatnipVal', formatNumber(Math.floor(game.catnip)));
  }
  const prestigeElixirVal = document.getElementById('prestigeElixirVal');
  if (prestigeElixirVal) {
    setStat('prestigeElixirVal', formatNumber(Math.floor(game.elixirs)));
  }
}

// Update the top bar resource display
function renderTopBar() {
  setStat('resFish', formatNumber(game.fish));
  setStat('resFps', formatRate(getFishIncomeRate()));
  setStat('resCatnip', formatNumber(Math.floor(game.catnip)));
  setStat('resDiamonds', formatNumber(Math.floor(game.diamonds)));
}

// Stable hover highlight: after an innerHTML rebuild the browser drops :hover on
// the fresh nodes under a stationary cursor (border "blink"). We track the
// hovered card index on the container (survives rebuilds) and re-apply a
// .card-hovered class after every rebuild.
// selector/cls are parameterized so shop items (non-.card) get the same treatment.
function initCardHoverTracking(container, selector, cls) {
  selector = selector || '.card';
  cls = cls || 'card-hovered';
  if (container._hoverTracked) return;
  container._hoverTracked = true;
  container._hoveredCardIdx = -1;
  container.addEventListener('mousemove', (e) => {
    const card = e.target.closest(selector);
    container.querySelectorAll('.' + cls).forEach(c => c.classList.remove(cls));
    if (card) {
      container._hoveredCardIdx = Array.prototype.indexOf.call(container.children, card);
      card.classList.add(cls);
    } else {
      container._hoveredCardIdx = -1;
    }
  });
  container.addEventListener('mouseleave', () => {
    container._hoveredCardIdx = -1;
    container.querySelectorAll('.' + cls).forEach(c => c.classList.remove(cls));
  });
}

function restoreCardHover(container, selector, cls) {
  selector = selector || '.card';
  cls = cls || 'card-hovered';
  if (container._hoveredCardIdx >= 0 && container.children[container._hoveredCardIdx]) {
    container.children[container._hoveredCardIdx].classList.add(cls);
  }
}

// Two decimals keep small click/rate gains visible; large values stay compact.
function formatRate(value) {
  return Math.abs(value) < 1000 ? String(Number(value.toFixed(2))) : formatNumber(value);
}

function purchaseGainText(preview) {
  const labels = { fish: 'economy.fishRate', click: 'economy.clickRate', catnip: 'economy.catnipRate' };
  const parts = [];
  for (const key of Object.keys(labels)) {
    const delta = preview.after[key] - preview.before[key];
    if (delta > 0) parts.push(`+${formatRate(delta)} ${i18n.t(labels[key])} (${formatRate(preview.before[key])} → ${formatRate(preview.after[key])})`);
  }
  return parts.join(' · ') || i18n.t('economy.specialEffect');
}

function purchaseButtons(kind, index) {
  const item = getPurchaseItem(kind, index);
  const quantities = kind === 'cat' || item.type === 'stackable' ? [1, 10, 'max'] : [1];
  return '<div class="purchase-buttons">' + quantities.map(quantity => {
    const quote = getPurchaseQuote(kind, index, quantity);
    const label = quantity === 'max' ? `max (${quote.count})` : `×${quantity}`;
    const argument = quantity === 'max' ? "'max'" : quantity;
    const action = kind === 'cat' ? 'buyCat' : 'buyUpgrade';
    const gain = quote.count ? purchaseGainText(previewPurchase(kind, index, quote.count)) : '';
    return `<button class="btn btn-primary btn-sm" onclick="${action}(${index}, ${argument})"
      title="${escapeHtml(gain)}" ${quote.affordable ? '' : 'disabled'}>${label}<small>${purchaseCurrencyIcon(quote.currency)} ${formatNumber(quote.cost)}</small></button>`;
  }).join('') + '</div>';
}

// Only replace changed content: stable buttons must survive ordinary income ticks.
function writePurchaseCards(container, html) {
  if (container._purchaseHTML === html) return;
  container._purchaseHTML = html;
  container.innerHTML = html;
  restoreCardHover(container);
}

function renderCats() {
  const container = document.getElementById('catList');
  if (!container) return;
  initCardHoverTracking(container);
  let html = '';
  game.cats.forEach((cat, index) => {
    if (index > 0 && game.cats[index - 1].count === 0) return;
    const unlocked = isPurchaseUnlocked('cat', index);
    const gain = unlocked ? purchaseGainText(previewPurchase('cat', index)) : i18n.t('economy.locked');
    html += `<div id="purchase-cat-${index}" tabindex="-1" class="card purchase-card${unlocked ? '' : ' locked'}">
      <div class="card-info"><div class="card-name">🐱 ${i18n.t(cat.nameKey, cat.id)}</div>
      <div class="card-desc">${i18n.t('economy.nextUnit')}: ${gain}</div>
      <div class="card-count">${i18n.t('cats.owned')}: ${cat.count}</div></div>
      ${unlocked ? purchaseButtons('cat', index) : `<div class="card-cost">🔒 ${cat.requiresPrestige ? 'Prestige ' + cat.requiresPrestige : i18n.t('economy.locked')}</div>`}</div>`;
  });
  writePurchaseCards(container, html);
}

function renderUpgrades() {
  const container = document.getElementById('upgradeList');
  if (!container) return;
  initCardHoverTracking(container);
  let html = '';
  game.upgrades.forEach((upg, index) => {
    const owned = upg.type === 'once' && upg.purchased;
    const unlocked = isPurchaseUnlocked('upgrade', index);
    html += `<div id="purchase-upgrade-${index}" tabindex="-1" class="card purchase-card${owned ? ' unlocked' : ''}">
      <div class="card-info"><div class="card-name">⬆️ ${i18n.t(upg.nameKey, upg.id)}${upg.type === 'stackable' ? ' · ' + upg.level : ''}</div>
      <div class="card-desc">${i18n.t(upg.descKey, '')}</div>
      ${unlocked ? `<div class="card-count">${i18n.t('economy.nextUnit')}: ${purchaseGainText(previewPurchase('upgrade', index))}</div>` : ''}</div>
      ${owned ? `<div class="card-cost">✅ ${i18n.t('upgrades.purchased')}</div>` : unlocked ? purchaseButtons('upgrade', index) : `<div class="card-cost">🔒 ${i18n.t('economy.locked')}</div>`}</div>`;
  });
  writePurchaseCards(container, html);
}

// One affordable option per category, cheapest first within that currency.
function getAffordableSuggestions() {
  const candidates = [];
  for (const kind of ['cat', 'upgrade']) {
    const items = kind === 'cat' ? game.cats : game.upgrades;
    items.forEach((item, index) => {
      if (item.currency === 'diamonds') return;
      const quote = getPurchaseQuote(kind, index);
      if (!quote.affordable) return;
      const preview = previewPurchase(kind, index);
      const improvesRate = Object.keys(preview.before).some(key => preview.after[key] > preview.before[key]);
      // Conditional benefits stay in the card description, with no invented rates.
      const usefulSpecial = ['karmnik', 'clickcrit', 'quantumkarma', 'catnipclick', 'prestigeBoost'].includes(item.id) ||
        (item.id === 'elixirmastery' && game.prestigeCount >= 10);
      if (!improvesRate && !usefulSpecial) return;
      candidates.push({ kind, index, item, quote, preview, category: kind === 'cat' ? 'cat' : item.currency });
    });
  }
  return ['cat', 'fish', 'catnip'].map(category => candidates.filter(c => c.category === category)
    .sort((a, b) => a.quote.cost - b.quote.cost)[0]).filter(Boolean);
}

function renderPurchaseSuggestions() {
  const container = document.getElementById('purchaseSuggestions');
  if (!container) return;
  const suggestions = getAffordableSuggestions();
  const html = `<h3>${i18n.t('economy.affordable')}</h3>` + (suggestions.length ? suggestions.map(s =>
    `<button class="btn btn-secondary purchase-suggestion" onclick="focusPurchase('${s.kind}', ${s.index})">
      ${i18n.t(s.item.nameKey, s.item.id)} · ${purchaseCurrencyIcon(s.quote.currency)} ${formatNumber(s.quote.cost)}
      <small>${purchaseGainText(s.preview)}</small></button>`).join('') : `<p>${i18n.t('economy.noneAffordable')}</p>`);
  writePurchaseCards(container, html);
}

function focusPurchase(kind, index) {
  switchPanel(kind === 'cat' ? 'cats' : 'upgrades');
  const card = document.getElementById(`purchase-${kind}-${index}`);
  if (card) {
    card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    card.focus({ preventScroll: true });
  }
}

// Main render function - updates all visible UI
function render() {
  updateStats();
  renderSaveStatus();
  if (typeof renderFirstCatGoal === 'function') renderFirstCatGoal();
  if (typeof renderAlbum === 'function') renderAlbum();
  if (typeof renderWardrobe === 'function') renderWardrobe();
  if (typeof renderPrestigePanel === 'function') renderPrestigePanel();

  // Only render the currently active panel for performance
  const activePanel = document.querySelector('.panel.active');
  if (!activePanel) return;

  switch (activePanel.id) {
    case 'panel-main':
      renderPurchaseSuggestions();
      break;
    case 'panel-cats':
      renderCats();
      break;
    case 'panel-upgrades':
      renderUpgrades();
      break;
    case 'panel-shop':
      if (typeof renderShop === 'function') renderShop();
      break;
    case 'panel-gacha':
      if (typeof renderGacha === 'function') renderGacha();
      break;
    case 'panel-catlife':
      if (typeof renderCatLife === 'function') renderCatLife();
      break;
    case 'panel-daily':
      if (typeof renderDaily === 'function') renderDaily();
      break;
    case 'panel-achievements':
      if (typeof renderAchievements === 'function') renderAchievements();
      break;
    case 'panel-leaderboard':
      if (typeof renderLeaderboard === 'function') renderLeaderboard();
      break;
  }
}

// Expose to global scope
window.initBackground = initBackground;
window.drawCat = drawCat;
window.spawnParticles = spawnParticles;
window.formatNumber = formatNumber;
window.updateStats = updateStats;
window.renderCats = renderCats;
window.renderUpgrades = renderUpgrades;
window.renderTopBar = renderTopBar;
window.render = render;
