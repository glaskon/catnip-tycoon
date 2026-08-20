// Auth routes: registration, login, and user profile
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const { pool } = require('../db');
const { generateToken, authMiddleware } = require('../auth');

/**
 * POST /api/auth/register
 * Creates a new user account with hashed password and an empty save slot.
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, is_admin, created_at',
      [email, passwordHash]
    );
    const user = result.rows[0];

    // Create an empty save for the new user
    const defaultSave = {
      fish: 0,
      fishPerClick: 1,
      fishPerSecond: 0,
      catnip: 0,
      diamonds: 0,
      totalFishEarned: 0,
      prestigeCount: 0,
      cats: [],
      upgrades: [],
      clickCount: 0,
      totalCatsBought: 0,
    };
    await pool.query(
      'INSERT INTO saves (user_id, game_state) VALUES ($1, $2)',
      [user.id, JSON.stringify(defaultSave)]
    );

    // Generate JWT
    const token = generateToken(user);

    res.status(201).json({ token, user: { id: user.id, email: user.email, is_admin: user.is_admin } });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user with email and password.
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const result = await pool.query(
      'SELECT id, email, password_hash, is_admin FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = generateToken(user);

    res.json({ token, user: { id: user.id, email: user.email, is_admin: user.is_admin } });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/auth/me
 * Returns the current user's profile info. Requires valid JWT.
 * Header: Authorization: Bearer <token>
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, is_admin, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('[Auth] Me error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;