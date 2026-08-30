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
      // No save exists yet — return minimal indicator so frontend keeps starter
      return res.json({
        game_state: { _fresh: true },
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

// --- Validation: reject arbitrary/malicious game state from the client ---
const MAX_ARRAY_LEN = 1000;
const MAX_STR_LEN = 200;
const MAX_KEYS = 200;
const MAX_NUM = 1e30;

function isFiniteNum(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_NUM;
}
function isInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_NUM;
}
function isId(v) {
  return typeof v === 'string' && v.length >= 1 && v.length <= 100;
}

// Top-level schema: key -> type (allowlist; unknown keys are rejected)
const STATE_SCHEMA = {
  fish: 'num', fishPerClick: 'num', fishPerSecond: 'num', catnip: 'num',
  diamonds: 'num', totalFishEarned: 'num', prestigeCount: 'int',
  speedMultiplier: 'num', elixirs: 'num', clickCount: 'int',
  luckyCatnipCount: 'int', dailyClicks: 'int', totalCatsBought: 'int',
  offlineTimeMinutes: 'num',
  anchoredCatId: 'strOrNull', preservedUpgradeId: 'strOrNull',
  lastClickDate: 'str',
  catlife: 'catlife',
  daily: 'daily',
  cats: 'arrCats',
  upgrades: 'arrUpgrades',
  achievements: 'arrStrings',
  purchasedItems: 'arrStrings',
  shopCounts: 'objInts',
};

function validateCatLife(v) {
  if (v === null) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (keys.length === 0 || keys.length > 3) return false;
  return keys.every(k => {
    if (k === 'hunger') return typeof v[k] === 'number' && Number.isFinite(v[k]) && v[k] >= 0 && v[k] <= 100;
    if (k === 'lastUpdate') return isInt(v[k]);
    if (k === 'fedCount') return isInt(v[k]);
    return false;
  });
}

function validateDaily(v) {
  if (v === null) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (keys.length !== 2) return false;
  if (!isInt(v.count)) return false;
  if (typeof v.lastClaimDate !== 'string' || v.lastClaimDate.length > 20) return false;
  return true;
}

function validateState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  for (const k of Object.keys(s)) {
    if (!(k in STATE_SCHEMA)) return false; // unknown key
    const v = s[k];
    switch (STATE_SCHEMA[k]) {
      case 'num':
        if (!isFiniteNum(v)) return false;
        break;
      case 'int':
        if (!isInt(v)) return false;
        break;
      case 'str':
        if (typeof v !== 'string' || v.length > MAX_STR_LEN) return false;
        break;
      case 'strOrNull':
        if (v !== null && !isId(v)) return false;
        break;
      case 'catlife':
        if (!validateCatLife(v)) return false;
        break;
      case 'daily':
        if (!validateDaily(v)) return false;
        break;
      case 'arrStrings':
        if (!Array.isArray(v) || v.length > MAX_ARRAY_LEN || !v.every(isId)) return false;
        break;
      case 'objInts':
        if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
        {
          const ks = Object.keys(v);
          if (ks.length > MAX_KEYS ||
              !ks.every(key => key.length >= 1 && key.length <= 100 && isInt(v[key]))) return false;
        }
        break;
      case 'arrCats':
        if (!Array.isArray(v) || v.length > 200) return false;
        for (const e of v) {
          if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
          if (Object.keys(e).length !== 2) return false;
          if (!isId(e.id) || !isInt(e.count)) return false;
        }
        break;
      case 'arrUpgrades':
        if (!Array.isArray(v) || v.length > 100) return false;
        for (const e of v) {
          if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
          if (!isId(e.id)) return false;
          const ks = Object.keys(e);
          if (!ks.every(key => key === 'id' || key === 'purchased' || key === 'level')) return false;
          if ('purchased' in e && typeof e.purchased !== 'boolean') return false;
          if ('level' in e && !isInt(e.level)) return false;
        }
        break;
      default:
        return false;
    }
  }
  return true;
}

/**
 * POST /api/save
 * Save/update the current user's game state in the database.
 * Body: { game_state: { ... } } — validated (types, ranges, size).
 * Requires valid JWT.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { game_state } = req.body;

    if (!game_state || typeof game_state !== 'object') {
      return res.status(400).json({ error: 'game_state object is required' });
    }
    if (!validateState(game_state)) {
      return res.status(400).json({ error: 'Invalid game_state' });
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