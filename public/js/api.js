// API module - wraps fetch calls to the Catnip Tycoon backend
const api = {
  baseURL: '/api',
  token: null,
  revision: null,

  // Load token from localStorage on init
  init() {
    this.token = localStorage.getItem('catnip-token');
  },

  // Generic API call wrapper (30s timeout via AbortController)
  async apiCall(endpoint, method = 'GET', body = null, timeoutMs = 30000, extraOptions = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = { method, headers, ...extraOptions };
    if (!options.signal) {
      options.signal = AbortSignal.timeout(timeoutMs);
    }
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error || `HTTP ${response.status}`);
      error.code = data.code;
      error.status = response.status;
      throw error;
    }

    return data;
  },

  // --- Auth ---
  async login(email, password) {
    const data = await this.apiCall('/auth/login', 'POST', { email, password });
    this.token = data.token;
    localStorage.setItem('catnip-token', data.token);
    return data;
  },

  async register(email, password) {
    const data = await this.apiCall('/auth/register', 'POST', { email, password });
    this.token = data.token;
    localStorage.setItem('catnip-token', data.token);
    return data;
  },

  async getMe() {
    return this.apiCall('/auth/me');
  },

  logout() {
    this.token = null;
    this.revision = null;
    localStorage.removeItem('catnip-token');
  },

  // --- Save / Load ---
  async loadGameState() {
    const data = await this.apiCall('/save', 'GET');
    this.revision = data.revision;
    return { gameState: data.game_state, updatedAt: data.updated_at };
  },

  async saveGameState(gameState, migrationId) {
    // Local duration metadata is not part of the server boost contract.
    const state = { ...gameState };
    if (Array.isArray(state.activeBoosts)) {
      state.activeBoosts = state.activeBoosts.map(b => ({ kind: b.kind, mult: b.mult, remainingMs: b.remainingMs }));
    }
    const data = await this.apiCall('/save', 'POST', {
      game_state: state, expected_revision: this.revision, migration_id: migrationId,
    });
    this.revision = data.revision;
    return data;
  },

  // --- Album (decision 6B: the server owns the stamp calendar) ---
  // device_id is sent either way; the server prefers the Bearer token and
  // only falls back to it for guests, so there is no need to branch here.
  async getAlbum(deviceId) {
    return this.apiCall(`/album?device_id=${encodeURIComponent(deviceId)}`, 'GET');
  },

  async stampAlbum(deviceId, timeZone) {
    return this.apiCall('/album/stamp', 'POST', { device_id: deviceId, timeZone });
  },

  // --- Admin ---
  async adminSetSpeed(multiplier) {
    return this.apiCall('/admin/speed', 'POST', { multiplier });
  },

  async adminAddCurrency(userId, currency, amount) {
    return this.apiCall('/admin/currency', 'POST', {
      user_id: userId,
      currency,
      amount,
    });
  },

  async adminListUsers() {
    return this.apiCall('/admin/users', 'GET');
  },

  // --- Leaderboard ---
  async getLeaderboard(options = {}) {
    return this.apiCall('/leaderboard', 'GET', null, 30000, options);
  },
};

window.api = api;