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

function drawCat() {
  const canvas = document.getElementById('catCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Draw a stylized cat face with emoji-like style using canvas primitives
  const cx = w / 2;
  const cy = h / 2 - 5;
  const headRadius = 55;

  // Body
  ctx.fillStyle = '#f4a261';
  ctx.beginPath();
  ctx.ellipse(cx, cy + headRadius - 10, 50, 45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#f4a261';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Ears (left)
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
  ctx.strokeStyle = '#6b4c3b';
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
  ctx.strokeStyle = '#8b5e3c';
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
}

// ============================================================
// Particle effects on click
// ============================================================

function spawnParticles(x, y, amount) {
  const emojis = ['🐟', '🐠', '✨', '🐾'];
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

// Update the stats display
function updateStats() {
  document.getElementById('fishCount').textContent = formatNumber(game.fish);
  document.getElementById('fishPerSec').textContent = formatNumber(game.fishPerSecond);
  document.getElementById('catnipCount').textContent = formatNumber(Math.floor(game.catnip));
  document.getElementById('diamondCount').textContent = formatNumber(Math.floor(game.diamonds));
  renderTopBar();
}

// Update the top bar resource display
function renderTopBar() {
  const resFish = document.getElementById('resFish');
  const resFps = document.getElementById('resFps');
  const resCatnip = document.getElementById('resCatnip');
  const resDiamonds = document.getElementById('resDiamonds');
  if (resFish) resFish.textContent = formatNumber(game.fish);
  if (resFps) resFps.textContent = formatNumber(game.fishPerSecond);
  if (resCatnip) resCatnip.textContent = formatNumber(Math.floor(game.catnip));
  if (resDiamonds) resDiamonds.textContent = formatNumber(Math.floor(game.diamonds));
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
    const c = game.cats[i];
    const cost = c.currentCost;
    const afford = c.currency === 'catnip' ? game.catnip >= cost : game.fish >= cost;
    sig += '|' + c.count + ':' + (afford ? 1 : 0) + ':' + (c.unlocked ? 1 : 0);
  }
  if (sig === _catsRenderSig) return;
  _catsRenderSig = sig;

  let html = '';
  for (let i = 0; i < game.cats.length; i++) {
    const cat = game.cats[i];
    const name = i18n.t(cat.nameKey, cat.id);
    const cost = cat.currentCost;
    const canAfford = cat.currency === 'catnip' ? game.catnip >= cost : game.fish >= cost;
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
    const afford = u.currency === 'fish' ? game.fish >= cost
      : u.currency === 'catnip' ? game.catnip >= cost
      : game.diamonds >= cost;
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
    const canAfford = upg.currency === 'fish'
      ? game.fish >= cost
      : upg.currency === 'catnip'
        ? game.catnip >= cost
        : game.diamonds >= cost;

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