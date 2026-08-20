// Save/Load routes: persist and retrieve game state from PostgreSQL
const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { authMiddleware } = require('../auth');

/**
 * GET /api/save
 * Load the current user's game state from the database.
 * Requires valid JWT.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT game_state, updated_at FROM saves WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // No save exists yet — return a default empty state
      return res.json({
        game_state: {
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
        },
        updated_at: new Date().toISOString(),
      });
    }

    res.json({
      game_state: result.rows[0].game_state,
      updated_at: result.rows[0].updated_at,
    });
  } catch (err) {
    console.error('[Save] Load error:', err.message);
    res.status(500).json({ error: 'Failed to load game state' });
  }
});

/**
 * POST /api/save
 * Save/update the current user's game state in the database.
 * Body: { game_state: { ... } }
 * Requires valid JWT.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { game_state } = req.body;

    if (!game_state || typeof game_state !== 'object') {
      return res.status(400).json({ error: 'game_state object is required' });
    }

    // Upsert: check if save row exists, then insert or update
    const existing = await pool.query('SELECT id FROM saves WHERE user_id = $1', [req.user.id]);
    if (existing.rows.length > 0) {
      await pool.query(
        'UPDATE saves SET game_state = $1, updated_at = NOW() WHERE user_id = $2',
        [JSON.stringify(game_state), req.user.id]
      );
    } else {
      await pool.query(
        'INSERT INTO saves (user_id, game_state, updated_at) VALUES ($1, $2, NOW())',
        [req.user.id, JSON.stringify(game_state)]
      );
    }

    res.json({ success: true, saved_at: new Date().toISOString() });
  } catch (err) {
    console.error('[Save] Save error:', err.message);
    res.status(500).json({ error: 'Failed to save game state' });
  }
});

module.exports = router;