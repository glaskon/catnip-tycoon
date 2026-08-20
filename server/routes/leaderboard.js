// Leaderboard route: top players sorted by total fish earned
const express = require('express');
const router = express.Router();
const { pool } = require('../db');

/**
 * GET /api/leaderboard
 * Returns top 50 players by totalFishEarned.
 * No auth required — public endpoint.
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.user_id,
        u.email,
        s.game_state->>'totalFishEarned' AS fish_earned,
        s.game_state->>'prestigeCount' AS prestige,
        s.game_state->>'fishPerSecond' AS fps
      FROM saves s
      JOIN users u ON u.id = s.user_id
      WHERE s.game_state != '{}'
        AND s.game_state->>'totalFishEarned' IS NOT NULL
        AND (s.game_state->>'totalFishEarned')::numeric > 0
      ORDER BY (s.game_state->>'totalFishEarned')::numeric DESC
      LIMIT 50
    `);

    const entries = result.rows.map((row, idx) => ({
      rank: idx + 1,
      userId: row.user_id,
      email: row.email.replace(/(.{2}).+(@.+)/, '$1***$2'), // mask email
      totalFishEarned: parseFloat(row.fish_earned) || 0,
      prestige: parseInt(row.prestige) || 0,
      fps: parseFloat(row.fps) || 0,
    }));

    res.json({ leaderboard: entries });
  } catch (err) {
    console.error('[Leaderboard] Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

module.exports = router;
