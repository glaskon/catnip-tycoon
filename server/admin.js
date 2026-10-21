// Admin panel logic - speed boosts, currency manipulation, user management
const { pool } = require('./db');

// Get current speed multiplier
async function getSpeedMultiplier() {
  const result = await pool.query(
    'SELECT speed_multiplier FROM admin_config ORDER BY id LIMIT 1'
  );
  return result.rows[0]?.speed_multiplier || 1.0;
}

// Set speed multiplier
async function setSpeedMultiplier(multiplier) {
  const result = await pool.query(
    'UPDATE admin_config SET speed_multiplier = $1, updated_at = NOW() RETURNING speed_multiplier',
    [multiplier]
  );
  return result.rows[0].speed_multiplier;
}

// Add currency to a user's save
async function addCurrency(userId, currency, amount) {
  // Validate currency type
  const validCurrencies = ['fish', 'catnip', 'diamonds'];
  if (!validCurrencies.includes(currency)) {
    throw new Error(`Invalid currency: ${currency}. Must be one of: ${validCurrencies.join(', ')}`);
  }

  // Atomic update participates in save revision checks, so an older client
  // snapshot cannot erase the granted currency (or overwrite a concurrent save).
  const result = await pool.query(
    `UPDATE saves SET game_state = jsonb_set(game_state, ARRAY[$2::text],
       to_jsonb(COALESCE((game_state->>$2)::numeric, 0) + $3::numeric)),
       updated_at = NOW(), revision = revision + 1
     WHERE user_id = $1 RETURNING game_state`,
    [userId, currency, amount]
  );
  if (!result.rows.length) throw new Error('User has no save data');
  return { userId, currency, added: amount, newTotal: result.rows[0].game_state[currency] };
}

// List all users
async function listUsers() {
  const result = await pool.query(
    `SELECT u.id, u.email, u.is_admin, u.created_at, 
            s.game_state, s.updated_at as save_updated_at
     FROM users u
     LEFT JOIN saves s ON u.id = s.user_id
     ORDER BY u.created_at DESC`
  );
  return result.rows;
}

module.exports = { getSpeedMultiplier, setSpeedMultiplier, addCurrency, listUsers };