// Save/Load routes: persist and retrieve game state from PostgreSQL
const express = require('express');
const router = express.Router();

const { pool } = require('../db');
const { authMiddleware } = require('../auth');
const { hasRealProgress } = require('../../public/js/save-progress');
const { validateAlbumState } = require('../../public/js/album-state');
const { validateEquippedCosmetic } = require('../../public/js/cosmetic-state');

/**
 * GET /api/save
 * Load the current user's game state from the database.
 * Requires valid JWT.
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT game_state, updated_at, revision FROM saves WHERE user_id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      // No save exists yet — frontend explicitly selects guest import or zero state.
      return res.json({
        game_state: { _fresh: true },
        updated_at: null,
        revision: 0,
      });
    }

    res.json({
      game_state: result.rows[0].game_state,
      updated_at: result.rows[0].updated_at,
      revision: result.rows[0].revision,
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
  savedAt: 'int', saveOwnerId: 'strOrNull', guestMigrationId: 'strOrNull',
  fish: 'num', fishPerClick: 'num', clickScalingBaseline: 'num', fishPerSecond: 'num', catnip: 'num',
  diamonds: 'num', totalFishEarned: 'num', prestigeCount: 'int', prestigeMultiplier: 'prestigeMultiplier',
  speedMultiplier: 'num', elixirs: 'num', clickCount: 'int',
  luckyCatnipCount: 'int', dailyClicks: 'int', totalCatsBought: 'int',
  offlineTimeMinutes: 'num',
  activeBoosts: 'arrBoosts',
  anchoredCatId: 'strOrNull', preservedUpgradeId: 'strOrNull',
  lastClickDate: 'str',
  catlife: 'catlife',
  daily: 'daily',
  album: 'album',
  gacha: 'gacha',
  firstCatReward: 'strOrNull',
  equippedSkin: 'skin', equippedOutfit: 'outfit', equippedEffect: 'effect',
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

function validateGacha(v) {
  if (v === null) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  if (keys.length !== 3) return false;
  if (!isInt(v.totalPulls)) return false;
  if (!isInt(v.pity) || v.pity > 10) return false;
  const counts = v.counts;
  if (counts === null || typeof counts !== 'object' || Array.isArray(counts)) return false;
  const cks = Object.keys(counts);
  if (cks.length > MAX_KEYS) return false;
  if (!cks.every(key => key.length >= 1 && key.length <= 100 && isInt(counts[key]))) return false;
  return true;
}

function validateState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  for (const k of Object.keys(s)) {
    if (!(k in STATE_SCHEMA)) return false; // unknown key
    const v = s[k];
    switch (STATE_SCHEMA[k]) {
      case 'skin':
      case 'outfit':
      case 'effect':
        if (!validateEquippedCosmetic(v, STATE_SCHEMA[k], s)) return false;
        break;
      case 'prestigeMultiplier':
        if (!isFiniteNum(v) || v < 1 || v > 3) return false;
        break;
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
      case 'album':
        if (!validateAlbumState(v)) return false;
        break;
      case 'daily':
        if (!validateDaily(v)) return false;
        break;
      case 'gacha':
        if (!validateGacha(v)) return false;
        break;
      case 'arrBoosts':
        if (!Array.isArray(v) || v.length > MAX_ARRAY_LEN) return false;
        for (const e of v) {
          if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
          const keys = Object.keys(e);
          if (keys.length < 3 || keys.length > 4 || !keys.every(key => key === 'kind' || key === 'mult' || key === 'remainingMs' || key === 'maxDurationMs')) return false;
          if (!['speed', 'click', 'production'].includes(e.kind)) return false;
          if (typeof e.mult !== 'number' || !Number.isFinite(e.mult) || e.mult <= 0 || e.mult > 1000) return false;
          if (typeof e.remainingMs !== 'number' || !Number.isFinite(e.remainingMs) || e.remainingMs < 0 || e.remainingMs > 10000000) return false;
          if ('maxDurationMs' in e && (typeof e.maxDurationMs !== 'number' || !Number.isFinite(e.maxDurationMs) || e.maxDurationMs <= 0 || e.maxDurationMs > 10000000)) return false;
        }
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

// Structural validation runs first. Progress is checked against the locked
// account snapshot so concurrent requests cannot award the same day twice.
function validateAlbumProgress(album, previous, isGuestImport = false, now = Date.now()) {
  // Older clients may omit the album. The route retains the stored high-water mark.
  if (!album) return true;
  // A one-time guest import may already span multiple days and months.
  // Its structure was validated before the transaction; stored albums still use all progress checks.
  if (!previous && isGuestImport) return true;
  if (album.lastStampAt > now + 5 * 60 * 1000) return false;
  if (!previous) return album.stamps <= 1 && Object.keys(album.history).length === 0;
  if (album.month < previous.month || album.timeZone !== previous.timeZone ||
      album.lastDay < previous.lastDay || album.lastStampAt < previous.lastStampAt) return false;

  // Completed months are immutable. On rollover only the already saved current
  // month may be archived, with exactly its saved number of stamps.
  for (const [month, stamps] of Object.entries(previous.history)) {
    if (album.history[month] !== stamps) return false;
  }
  for (const [month, stamps] of Object.entries(album.history)) {
    if (Object.hasOwn(previous.history, month)) continue;
    if (album.month === previous.month || month !== previous.month || stamps !== previous.stamps) return false;
  }
  if (album.month === previous.month && album.stamps === previous.stamps) return true;
  // Advancing client dates alone is insufficient: otherwise ten backdated
  // requests could still finish an album today. Use the shared calendar
  // validator to match a server day, with the same five-minute clock tolerance.
  const serverDay = [now - 5 * 60 * 1000, now, now + 5 * 60 * 1000]
    .some(lastStampAt => validateAlbumState({ ...album, lastStampAt }));
  if (!serverDay) return false;
  if (album.month > previous.month) return album.stamps <= 1;
  return album.stamps === previous.stamps + 1 && album.lastDay > previous.lastDay &&
    album.lastStampAt > previous.lastStampAt;
}

/**
 * POST /api/save
 * Save/update the current user's game state in the database.
 * Body: { game_state, expected_revision, migration_id? } — validated.
 * Requires valid JWT.
 */
router.post('/', authMiddleware, async (req, res) => {
  const { game_state, expected_revision, migration_id } = req.body;
  if (!validateState(game_state) || !Number.isInteger(expected_revision) || expected_revision < 0 ||
      (migration_id !== undefined && !isId(migration_id))) {
    return res.status(400).json({ error: 'Invalid game_state or revision' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // Also locks saves that do not exist yet; serializes imports and autosaves.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    const result = await client.query('SELECT game_state, revision FROM saves WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    const current = result.rows[0];
    const revision = current ? current.revision : 0;
    if (migration_id) {
      const receipt = await client.query('SELECT user_id FROM guest_imports WHERE migration_id = $1', [migration_id]);
      if (receipt.rows.length) {
        await client.query('ROLLBACK');
        if (receipt.rows[0].user_id !== req.user.id) {
          return res.status(409).json({ error: 'Guest progress already imported', code: 'IMPORT_USED' });
        }
        return res.json({ success: true, already_migrated: true, game_state: current.game_state, revision });
      }
      if (current && (hasRealProgress(current.game_state) || current.game_state.guestMigrationId)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Account already has progress', code: 'SAVE_CONFLICT' });
      }
      if (!hasRealProgress(game_state) || game_state.guestMigrationId !== migration_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid guest import' });
      }
    }
    if (revision !== expected_revision) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Save changed; reload before saving', code: 'SAVE_CONFLICT' });
    }
    const previousAlbum = current && current.game_state.album;
    if (!validateAlbumProgress(game_state.album, previousAlbum, !!migration_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid album progress' });
    }
    if (!game_state.album && previousAlbum) game_state.album = previousAlbum;
    if (migration_id) {
      const inserted = await client.query(
        'INSERT INTO guest_imports (migration_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING migration_id',
        [migration_id, req.user.id]);
      if (!inserted.rows.length) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Guest progress already imported', code: 'IMPORT_USED' });
      }
    }
    game_state.saveOwnerId = String(req.user.id);
    game_state.guestMigrationId = migration_id || (current && current.game_state.guestMigrationId) || null;
    if (current) {
      await client.query('UPDATE saves SET game_state = $1, updated_at = NOW(), revision = revision + 1 WHERE user_id = $2',
        [JSON.stringify(game_state), req.user.id]);
    } else {
      await client.query('INSERT INTO saves (user_id, game_state, revision) VALUES ($1, $2, 1)',
        [req.user.id, JSON.stringify(game_state)]);
    }
    await client.query('COMMIT');
    res.json({ success: true, revision: revision + 1 });
  } catch (err) {
    if (client) await client.query('ROLLBACK');
    console.error('[Save] Save error:', err.message);
    res.status(500).json({ error: 'Failed to save game state' });
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
