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
  const validCurrencies = ['fish', 'catnip', 'diamond'];
  if (!validCurrencies.includes(currency)) {
    throw new Error(`Invalid currency: ${currency}. Must be one of: ${validCurrencies.join(', ')}`);
  }

  // Get current save
  const saveResult = await pool.query(
    'SELECT game_state FROM saves WHERE user_id = $1',
    [userId]
  );

  if (saveResult.rows.length === 0) {
    throw new Error('User has no save data');
  }

  const gameState = saveResult.rows[0].game_state;
  gameState[currency] = (gameState[currency] || 0) + amount;

  // Update save
  await pool.query(
    'UPDATE saves SET game_state = $1, updated_at = NOW() WHERE user_id = $2',
    [gameState, userId]
  );

  return { userId, currency, added: amount, newTotal: gameState[currency] };
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