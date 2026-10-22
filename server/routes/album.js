// Album routes: the server is the sole owner of monthly stamp progress
// (decision 6B). Logged-in players are identified by their JWT and stored
// inside saves.game_state.album; guests have no account yet, so they are
// identified by a client-generated device id and stored in guest_albums.
// The client never computes a stamp locally — see public/js/album.js.
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const { pool } = require('../db');
const { JWT_SECRET } = require('../auth');
const { advanceAlbum, isIanaTimeZone, albumDayKey } = require('../album-logic');

function isDeviceId(v) {
  return typeof v === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(v);
}

// Resolves { userId } from a valid Bearer token, else { deviceId } from
// device_id. Unlike authMiddleware this never 401s on a missing token alone —
// a device id is an equally valid identity for a guest.
async function resolveIdentity(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET, { algorithms: ['HS256'] });
      const r = await pool.query('SELECT token_version FROM users WHERE id = $1', [decoded.id]);
      if (r.rows.length && decoded.tv === r.rows[0].token_version) return { userId: decoded.id };
    } catch { /* falls through to device_id */ }
  }
  const deviceId = req.method === 'GET' ? req.query.device_id : req.body.device_id;
  if (isDeviceId(deviceId)) return { deviceId };
  return null;
}

function toResponse(record) {
  return {
    month: record.month, stamps: record.stamps,
    lastStampDay: record.lastStampDay, history: record.history,
    timeZone: record.timeZone,
  };
}

async function loadForUser(userId) {
  const result = await pool.query('SELECT game_state FROM saves WHERE user_id = $1', [userId]);
  const album = result.rows[0] && result.rows[0].game_state.album;
  if (!album) return null;
  return { timeZone: album.timeZone, month: album.month, stamps: album.stamps,
    lastStampDay: album.lastDay, history: album.history };
}

async function loadForDevice(deviceId) {
  const result = await pool.query(
    'SELECT time_zone, month, stamps, last_stamp_day, history FROM guest_albums WHERE device_id = $1', [deviceId]);
  if (!result.rows.length) return null;
  const row = result.rows[0];
  return { timeZone: row.time_zone, month: row.month, stamps: row.stamps,
    lastStampDay: row.last_stamp_day, history: row.history };
}

async function stampForUser(userId, now, requestedZone) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const result = await client.query('SELECT game_state, revision FROM saves WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!result.rows.length) throw new Error('No save row for user ' + userId);
    const { game_state: gameState, revision } = result.rows[0];
    const current = gameState.album ? { timeZone: gameState.album.timeZone, month: gameState.album.month,
      stamps: gameState.album.stamps, lastStampDay: gameState.album.lastDay, history: gameState.album.history } : null;
    const next = advanceAlbum(current, now, requestedZone);
    // Same day as last time: nothing changed, so skip the write entirely —
    // a repeat call must not spend a revision the client hasn't seen yet.
    if (current && next.lastStampDay === current.lastStampDay) {
      await client.query('COMMIT');
      return { ...next, revision };
    }
    gameState.album = { timeZone: next.timeZone, month: next.month, stamps: next.stamps,
      lastDay: next.lastStampDay, lastStampAt: now, history: next.history };
    await client.query('UPDATE saves SET game_state = $1, revision = revision + 1 WHERE user_id = $2',
      [JSON.stringify(gameState), userId]);
    await client.query('COMMIT');
    return { ...next, revision: revision + 1 };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function stampForDevice(deviceId, now, requestedZone) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const seedZone = isIanaTimeZone(requestedZone) ? requestedZone : 'UTC';
    await client.query(
      `INSERT INTO guest_albums (device_id, time_zone, month, stamps, last_stamp_day, history)
       VALUES ($1, $2, '', 0, '', '{}') ON CONFLICT (device_id) DO NOTHING`,
      [deviceId, seedZone]);
    const result = await client.query(
      'SELECT time_zone, month, stamps, last_stamp_day, history FROM guest_albums WHERE device_id = $1 FOR UPDATE',
      [deviceId]);
    const row = result.rows[0];
    const current = row.month ? { timeZone: row.time_zone, month: row.month, stamps: row.stamps,
      lastStampDay: row.last_stamp_day, history: row.history } : null;
    const next = advanceAlbum(current, now, requestedZone);
    if (current && next.lastStampDay === current.lastStampDay) {
      await client.query('COMMIT');
      return next;
    }
    await client.query(
      'UPDATE guest_albums SET time_zone=$1, month=$2, stamps=$3, last_stamp_day=$4, history=$5, updated_at=NOW() WHERE device_id=$6',
      [next.timeZone, next.month, next.stamps, next.lastStampDay, JSON.stringify(next.history), deviceId]);
    await client.query('COMMIT');
    return next;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * GET /api/album
 * Read-only: never advances the calendar, just reports the stored state (or
 * an empty current-month album if there is no record yet).
 * Identity: Authorization Bearer token, or ?device_id=<id> for guests.
 */
router.get('/', async (req, res) => {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return res.status(401).json({ error: 'Missing token or device_id' });
    const record = identity.userId ? await loadForUser(identity.userId) : await loadForDevice(identity.deviceId);
    const now = Date.now();
    res.json(toResponse(record || { timeZone: null, month: albumDayKey(now, 'UTC').slice(0, 7),
      stamps: 0, lastStampDay: '', history: {} }));
  } catch (err) {
    console.error('[Album] Load error:', err.message);
    res.status(500).json({ error: 'Failed to load album' });
  }
});

/**
 * POST /api/album/stamp
 * The only way to gain a stamp. Idempotent per calendar day, using the
 * server's own clock exclusively. Body: { timeZone? } — only consulted the
 * first time an identity ever stamps; later requests keep the stored zone.
 * Identity: Authorization Bearer token, or device_id in the body for guests.
 */
router.post('/stamp', async (req, res) => {
  try {
    const identity = await resolveIdentity(req);
    if (!identity) return res.status(401).json({ error: 'Missing token or device_id' });
    const requestedZone = typeof req.body.timeZone === 'string' ? req.body.timeZone : null;
    const now = Date.now();
    const record = identity.userId
      ? await stampForUser(identity.userId, now, requestedZone)
      : await stampForDevice(identity.deviceId, now, requestedZone);
    res.json(toResponse(record));
  } catch (err) {
    console.error('[Album] Stamp error:', err.message);
    res.status(500).json({ error: 'Failed to record stamp' });
  }
});

module.exports = router;
