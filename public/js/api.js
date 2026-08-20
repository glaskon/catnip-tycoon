// API module - wraps fetch calls to the Catnip Tycoon backend
const api = {
  baseURL: '/api',
  token: null,

  // Load token from localStorage on init
  init() {
    this.token = localStorage.getItem('catnip-token');
  },

  // Generic API call wrapper
  async apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
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
    localStorage.removeItem('catnip-token');
  },

  // --- Save / Load ---
  async loadGameState() {
    const data = await this.apiCall('/save', 'GET');
    return { gameState: data.game_state, updatedAt: data.updated_at };
  },

  async saveGameState(gameState) {
    return this.apiCall('/save', 'POST', { game_state: gameState });
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
  async getLeaderboard() {
    return this.apiCall('/leaderboard', 'GET');
  },
};

window.api = api;