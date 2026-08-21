// Main entry point - initializes all modules and handles UI interactions

// ============================================================
// Initialization
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Catnip Tycoon] Initializing...');

  // Initialize i18n first (load translations)
  await i18n.init();

  // Initialize API (load token)
  api.init();

  // Initialize game state
  initGame();

  // Load player data from storage
  loadAchievements();
  loadPurchasedItems();

  // Restore game state from localStorage (works for guests + instant restore)
  loadLocalGame();

  // Set up UI
  initBackground();
  drawCat();
  initUI();
  initAuthUI();
  initAdminUI();

  // Try to load game from server if logged in (overwrites local if newer)
  if (api.token) {
    try {
      const me = await api.getMe();
      game.user = me.user;
      game.isAdmin = me.user.is_admin;
      updateUserStatus();
      await loadGame();
    } catch (err) {
      console.log('[Main] Not logged in or session expired');
      api.logout();
    }
  }

  // Start game loops
  startGameLoops();

  // First render
  render();
  renderCats();
  renderUpgrades();
  renderPrestigePanel();
  renderShop();
  renderAchievements();

  console.log('[Catnip Tycoon] Ready!');
});

// ============================================================
// UI Panel Navigation
// ============================================================

function initUI() {
  // Cat canvas click handler
  const catCanvas = document.getElementById('catCanvas');
  if (catCanvas) {
    catCanvas.addEventListener('click', clickCat);
    // Touch support for mobile
    catCanvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      clickCat(e.touches[0]);
    });
  }

  // Navigation buttons
  const navButtons = document.querySelectorAll('.nav-btn[data-panel]');
  for (const btn of navButtons) {
    btn.addEventListener('click', () => {
      switchPanel(btn.dataset.panel);
    });
  }

  // Auth modal triggers
  document.getElementById('btnAuth').addEventListener('click', openAuthModal);

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  // Close modal buttons
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId) closeModal(modalId);
    });
  });
}

// Switch between panels
function switchPanel(panelName) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.nav-btn[data-panel="${panelName}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Update panels
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`panel-${panelName}`);
  if (panel) {
    panel.classList.add('active');
    // Trigger render for the new panel
    render();
  }
}

// ============================================================
// Auth UI
// ============================================================

let authMode = 'login'; // 'login' or 'register'

function initAuthUI() {
  const authForm = document.getElementById('authForm');
  const authToggle = document.getElementById('authToggle');
  const authForgot = document.getElementById('authForgot');

  authForm.addEventListener('submit', handleAuth);
  authToggle.addEventListener('click', toggleAuthMode);

  // Forgot password — open reset page
  if (authForgot) {
    authForgot.addEventListener('click', () => {
      window.location.href = '/reset-password.html';
    });
  }
}

function openAuthModal() {
  if (api.token) {
    // Logout
    api.logout();
    game.user = null;
    game.isAdmin = false;
    updateUserStatus();
    showToast('👋 Logged out');
    return;
  }
  document.getElementById('modalAuth').classList.add('open');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('open');
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  document.getElementById('authTitle').textContent =
    authMode === 'login' ? i18n.t('auth.login') : i18n.t('auth.register');
  document.getElementById('authSubmit').textContent =
    authMode === 'login' ? i18n.t('auth.loginBtn') : i18n.t('auth.registerBtn');
  document.getElementById('authToggle').textContent =
    authMode === 'login' ? i18n.t('auth.noAccount') : i18n.t('auth.hasAccount');
  document.getElementById('authError').textContent = '';
}

async function handleAuth(e) {
  e.preventDefault();

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errorEl = document.getElementById('authError');

  if (!email || !password) {
    errorEl.textContent = i18n.t('auth.errorRequired');
    return;
  }
  if (password.length < 8) {
    errorEl.textContent = i18n.t('auth.errorPassword');
    return;
  }
  if (!/[A-Z]/.test(password)) {
    errorEl.textContent = i18n.t('auth.errorUppercase');
    return;
  }
  if (!/[0-9]/.test(password)) {
    errorEl.textContent = i18n.t('auth.errorDigit');
    return;
  }

  errorEl.textContent = '';

  try {
    let result;
    if (authMode === 'login') {
      result = await api.login(email, password);
    } else {
      result = await api.register(email, password);
    }

    game.user = result.user;
    game.isAdmin = result.user.is_admin;
    updateUserStatus();
    closeModal('modalAuth');
    showToast('✅ Logged in!');

    // Load game state from server
    await loadGame();

    // Show admin button if admin
    updateAdminVisibility();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

function updateUserStatus() {
  const statusEl = document.getElementById('userStatus');
  const btnAuth = document.getElementById('btnAuth');

  if (game.user) {
    statusEl.textContent = `🐱 ${i18n.t('app.loggedIn')}: ${game.user.email}`;
    btnAuth.textContent = i18n.t('app.logout');
  } else {
    statusEl.textContent = `🐱 ${i18n.t('app.notLoggedIn')}`;
    btnAuth.textContent = i18n.t('app.login');
  }
}

// ============================================================
// Admin UI
// ============================================================

function initAdminUI() {
  updateAdminVisibility();
  renderAdminPanel();
}

function updateAdminVisibility() {
  const adminBtns = document.querySelectorAll('.nav-btn.admin-only');
  for (const btn of adminBtns) {
    if (game.isAdmin) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }
}

function renderAdminPanel() {
  const container = document.getElementById('adminContent');
  if (!container) return;

  container.innerHTML = `
    <div class="admin-section">
      <h3>${i18n.t('admin.speed')}</h3>
      <label>Multiplier:</label>
      <input type="number" id="adminSpeedInput" value="${game.speedMultiplier}" step="0.5" min="0.1">
      <button class="btn btn-primary btn-sm" onclick="handleAdminSetSpeed()">${i18n.t('admin.speedSet')}</button>
      <p id="adminSpeedResult" style="font-size: 0.8rem; color: var(--success); margin-top: 4px;"></p>
    </div>

    <div class="admin-section">
      <h3>${i18n.t('admin.currency')}</h3>
      <label>${i18n.t('admin.currencyUser')}:</label>
      <input type="number" id="adminCurrencyUser" placeholder="User ID">
      <label>${i18n.t('admin.currencyType')}:</label>
      <select id="adminCurrencyType">
        <option value="fish">🐟 Fish</option>
        <option value="catnip">🌿 Catnip</option>
        <option value="diamond">💎 Diamonds</option>
      </select>
      <label>${i18n.t('admin.currencyAmount')}:</label>
      <input type="number" id="adminCurrencyAmount" value="1000">
      <button class="btn btn-primary btn-sm" onclick="handleAdminAddCurrency()">${i18n.t('admin.currencyAdd')}</button>
      <p id="adminCurrencyResult" style="font-size: 0.8rem; color: var(--success); margin-top: 4px;"></p>
    </div>

    <div class="admin-section">
      <h3>${i18n.t('admin.users')}</h3>
      <button class="btn btn-secondary btn-sm" onclick="handleAdminListUsers()">Refresh List</button>
      <div id="adminUsersList" style="margin-top: 8px; font-size: 0.8rem;"></div>
    </div>
  `;
}

async function handleAdminSetSpeed() {
  const input = document.getElementById('adminSpeedInput');
  const result = document.getElementById('adminSpeedResult');
  const multiplier = parseFloat(input.value);

  if (isNaN(multiplier) || multiplier <= 0) {
    result.textContent = 'Invalid multiplier';
    return;
  }

  try {
    const data = await api.adminSetSpeed(multiplier);
    game.speedMultiplier = data.speed_multiplier;
    result.textContent = `✅ Speed set to ${data.speed_multiplier}x`;
  } catch (err) {
    result.textContent = `❌ ${err.message}`;
  }
}

async function handleAdminAddCurrency() {
  const userId = parseInt(document.getElementById('adminCurrencyUser').value);
  const currency = document.getElementById('adminCurrencyType').value;
  const amount = parseInt(document.getElementById('adminCurrencyAmount').value);
  const result = document.getElementById('adminCurrencyResult');

  if (isNaN(userId) || isNaN(amount)) {
    result.textContent = 'Invalid user ID or amount';
    return;
  }

  try {
    const data = await api.adminAddCurrency(userId, currency, amount);
    result.textContent = `✅ Added ${data.added} ${currency} to user ${userId}`;
  } catch (err) {
    result.textContent = `❌ ${err.message}`;
  }
}

async function handleAdminListUsers() {
  const container = document.getElementById('adminUsersList');
  try {
    const data = await api.adminListUsers();
    let html = '';
    for (const user of data.users) {
      const fish = user.game_state?.fish || 0;
      html += `<div style="padding: 4px 0; border-bottom: 1px solid var(--bg-tertiary);">`;
      html += `ID:${user.id} | ${user.email} | 🐟${formatNumber(fish)} | ${user.is_admin ? '⚙️ Admin' : '👤 User'}`;
      html += `</div>`;
    }
    container.innerHTML = html || '<p>No users found</p>';
  } catch (err) {
    container.innerHTML = `<p style="color: var(--danger);">❌ ${err.message}</p>`;
  }
}

// ============================================================
// Toast notification
// ============================================================

let toastTimeout = null;

function showToast(message) {
  const toast = document.getElementById('achievementToast');
  if (!toast) return;

  // Clear any existing timeout
  if (toastTimeout) clearTimeout(toastTimeout);

  toast.textContent = message;
  toast.classList.add('show');

  // Auto-hide after 3 seconds
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    toastTimeout = null;
  }, 3000);
}

// ============================================================
// Expose to global scope
// ============================================================

window.switchPanel = switchPanel;
window.openAuthModal = openAuthModal;
window.closeModal = closeModal;
window.updateUserStatus = updateUserStatus;
window.updateAdminVisibility = updateAdminVisibility;
window.renderAdminPanel = renderAdminPanel;
window.handleAdminSetSpeed = handleAdminSetSpeed;
window.handleAdminAddCurrency = handleAdminAddCurrency;
window.handleAdminListUsers = handleAdminListUsers;
window.showToast = showToast;