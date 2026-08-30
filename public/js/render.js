// Rendering module - draws everything on screen
// Handles canvas drawing, UI updates, and particle effects

// ============================================================
// Background Canvas - floating fish and cat paws
// ============================================================

let bgParticles = [];
let bgAnimationId = null;

// Initialize background animation
function initBackground() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

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

// Cat skins from the shop — fur/whisker/mouth palettes (last purchased wins)
const CAT_SKINS = {
  skin_orange:  { fur: '#f4a261', whisker: '#8b5e3c', mouth: '#6b4c3b', ear: '#f4a261' },
  skin_black:   { fur: '#2d3436', whisker: '#9aa5a8', mouth: '#8a9498', ear: '#2d3436' },
  skin_siamese: { fur: '#f5e6d3', whisker: '#a9825e', mouth: '#8b5e3c', ear: '#8b5e3c' },
};

function drawCat() {
  const canvas = document.getElementById('catCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Active cosmetics (last purchased wins)
  let skin = CAT_SKINS.skin_orange;
  if (typeof lastOwned === 'function') {
    const skinId = lastOwned('skin_');
    if (skinId && CAT_SKINS[skinId]) skin = CAT_SKINS[skinId];
  }
  const activeOutfit = (typeof lastOwned === 'function') ? lastOwned('outfit_') : null;

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
  // Shop effects extend the click particle palette
  if (typeof hasItem === 'function') {
    if (hasItem('effect_sparkle')) emojis = emojis.concat(['✨', '🌟', '💫']);
    if (hasItem('effect_rainbow')) emojis = emojis.concat(['🌈', '💜', '💛', '💚', '🐟']);
  }
  const count = Math.min(5, Math.ceil(amount / 5));

  for (let i = 0; i < count; i++) {
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
    }, 800);
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
  setStat('fishPerSec', formatNumber(game.fishPerSecond));
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
  const prestigeCashbackLine = document.getElementById('prestigeCashbackLine');
  if (prestigeCashbackLine) {
    setStat('prestigeCashbackLine', `🐟 Kocia Łaska: +🌿 ${formatNumber(Math.floor(game.totalFishEarned * 0.1 / 100))} catnip cashback!`);
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
  setStat('resFps', formatNumber(game.fishPerSecond));
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

// Render cats panel
let _catsRenderSig = null;
function renderCats() {
  const container = document.getElementById('catList');
  if (!container) return;
  initCardHoverTracking(container);

  // Skip full DOM rebuild when nothing changed. Rebuilding innerHTML every 100ms
  // tick replaced buy buttons mid-click (mousedown on old node, mouseup on new
  // node = no click event), so purchases needed several clicks.
  let sig = i18n.currentLang;
  for (let i = 0; i < game.cats.length; i++) {
    // Progressive reveal: a cat is only visible after the previous cat has
    // been bought at least once (first cat always visible). Resets with
    // prestige — part of the new run.
    const visible = i === 0 || game.cats[i - 1].count > 0;
    if (!visible) { sig += '|x'; continue; }
    const c = game.cats[i];
    const cost = c.currentCost;
    const afford = canAfford(cost, c.currency);
    sig += '|' + c.count + ':' + (afford ? 1 : 0) + ':' + (c.unlocked ? 1 : 0);
  }
  if (sig === _catsRenderSig) return;
  _catsRenderSig = sig;

  let html = '';
  for (let i = 0; i < game.cats.length; i++) {
    const visible = i === 0 || game.cats[i - 1].count > 0;
    if (!visible) continue;
    const cat = game.cats[i];
    const name = i18n.t(cat.nameKey, cat.id);
    const cost = cat.currentCost;
    const canAfford = window.canAfford(cost, cat.currency);
    const isUnlocked = cat.unlocked;
    const prestigeReq = CAT_DEFINITIONS[i].requiresPrestige;

    html += `<div class="card${isUnlocked ? '' : ' locked'}">`;
    html += `<div class="card-info">`;
    html += `<div class="card-name">🐱 ${name}</div>`;
    html += `<div class="card-desc">${i18n.t('cats.production')}: ${cat.baseProduction}/s</div>`;
    html += `<div class="card-count">${i18n.t('cats.owned')}: ${cat.count} (${formatNumber(cat.production)}/s)</div>`;
    html += `</div>`;

    if (!isUnlocked) {
      html += `<div class="card-cost">🔒 ${prestigeReq ? `Prestige ${prestigeReq}` : ''}</div>`;
    } else {
      const costIcon = cat.currency === 'catnip' ? '🌿' : '🐟';
      html += `<div class="card-cost">${costIcon} ${formatNumber(cost)}</div>`;
      html += `<button class="btn btn-primary card-btn" 
                onclick="buyCat(${i})" 
                ${!canAfford ? 'disabled' : ''}>${i18n.t('cats.buy')}</button>`;
    }

    html += `</div>`;
  }
  container.innerHTML = html;
  restoreCardHover(container);
}

// Render upgrades panel
let _upgradesRenderSig = null;
function renderUpgrades() {
  const container = document.getElementById('upgradeList');
  if (!container) return;
  initCardHoverTracking(container);

  // Same click-swallowing fix as renderCats: only rebuild when state changes
  let sig = i18n.currentLang;
  for (let i = 0; i < game.upgrades.length; i++) {
    const u = game.upgrades[i];
    const isStackable = u.type === 'stackable';
    const cost = isStackable ? u.currentCost : u.cost;
    const afford = canAfford(cost, u.currency);
    sig += '|' + (isStackable ? u.level : (u.purchased ? 1 : 0)) + ':' + (afford ? 1 : 0);
  }
  if (sig === _upgradesRenderSig) return;
  _upgradesRenderSig = sig;

  let html = '';
  for (let i = 0; i < game.upgrades.length; i++) {
    const upg = game.upgrades[i];
    const name = i18n.t(upg.nameKey, upg.id);
    const desc = i18n.t(upg.descKey, '');
    const currencyIcon = upg.currency === 'fish' ? '🐟' : upg.currency === 'catnip' ? '🌿' : '💎';

    const isStackable = upg.type === 'stackable';
    const isPurchased = isStackable ? upg.level > 0 : upg.purchased;
    const cost = isStackable ? upg.currentCost : upg.cost;
    const canAfford = window.canAfford(cost, upg.currency);

    let cardClass = '';
    if (isStackable && upg.level > 0) cardClass = 'unlocked';
    else if (isPurchased) cardClass = 'unlocked';
    
    html += `<div class="card${cardClass}">`;
    html += `<div class="card-info">`;
    html += `<div class="card-name">⬆️ ${name}</div>`;
    html += `<div class="card-desc">${desc}</div>`;
    html += `</div>`;

    if (isStackable) {
      if (upg.level > 0) {
        html += `<div class="card-cost" style="color: var(--cat-orange);">Level ${upg.level}</div>`;
      }
      html += `<div class="card-cost">${currencyIcon} ${formatNumber(cost)}</div>`;
      html += `<button class="btn btn-primary card-btn" 
                onclick="buyUpgrade(${i})" 
                ${!canAfford ? 'disabled' : ''}>Level ${upg.level + 1}</button>`;
    } else if (isPurchased) {
      html += `<div class="card-cost" style="color: var(--success)">✅ ${i18n.t('upgrades.purchased')}</div>`;
    } else {
      html += `<div class="card-cost">${currencyIcon} ${formatNumber(cost)}</div>`;
      html += `<button class="btn btn-primary card-btn" 
                onclick="buyUpgrade(${i})" 
                ${!canAfford ? 'disabled' : ''}>${i18n.t('cats.buy')}</button>`;
    }

    html += `</div>`;
  }
  container.innerHTML = html;
  restoreCardHover(container);
}

// Main render function - updates all visible UI
function render() {
  updateStats();

  // Only render the currently active panel for performance
  const activePanel = document.querySelector('.panel.active');
  if (!activePanel) return;

  switch (activePanel.id) {
    case 'panel-cats':
      renderCats();
      break;
    case 'panel-upgrades':
      renderUpgrades();
      break;
    case 'panel-prestige':
      if (typeof renderPrestigePanel === 'function') renderPrestigePanel();
      break;
    case 'panel-shop':
      if (typeof renderShop === 'function') renderShop();
      break;
    case 'panel-catlife':
      if (typeof renderCatLife === 'function') renderCatLife();
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