// Catnip Tycoon - Main Express server entry point
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import database and routes
const { initDB } = require('./db');
const authRoutes = require('./routes/auth');
const saveRoutes = require('./routes/save');
const adminRoutes = require('./routes/admin');
const leaderboardRoutes = require('./routes/leaderboard');

const app = express();
const PORT = process.env.PORT || 8000;

// --- Middleware ---
app.set('trust proxy', 1);               // Behind Coolify proxy — real client IP from X-Forwarded-For
app.use(cors());                      // Allow cross-origin requests from game client
app.use(express.json());              // Parse JSON request bodies

// --- Rate limiting ---
// General API: 600 req / 15 min / IP (save polls, leaderboard, static API)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});
// Auth endpoints: 20 req / 15 min / IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, try again later' },
});
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);

// --- Static file serving ---
// Serve all frontend assets (index.html, CSS, JS, locales, images, etc.)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve reset-password.html without .html extension
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'reset-password.html'));
});

// --- API Routes ---
app.use('/api/auth', authRoutes);     // Registration, login, user info
app.use('/api/save', saveRoutes);     // Save and load game state
app.use('/api/admin', adminRoutes);   // Admin panel: speed, currency, user management
app.use('/api/leaderboard', leaderboardRoutes); // Public leaderboard

// --- Health check endpoint ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Start server after DB initialization ---
async function start() {
  try {
    // Initialize database schema (creates tables if they don't exist)
    await initDB();
    console.log('[Server] Database initialized');

    app.listen(PORT, () => {
      console.log(`[Server] Catnip Tycoon running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app; // Export for testing