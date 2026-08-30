// Database initialization and connection pool for PostgreSQL
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { Pool } = require('pg');

// Use DATABASE_URL if available, otherwise construct from env vars
const connectionString = process.env.DATABASE_URL || 
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB}`;

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize database schema
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Game saves
      CREATE TABLE IF NOT EXISTS saves (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        game_state JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Store transactions (Stripe)
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        item_name VARCHAR(255) NOT NULL,
        amount_cents INTEGER NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        stripe_session_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Admin configuration (speed multipliers, etc.)
      CREATE TABLE IF NOT EXISTS admin_config (
        id SERIAL PRIMARY KEY,
        speed_multiplier FLOAT DEFAULT 1.0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Password reset tokens (valid 15 minutes, single use)
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Index on token for fast lookups
      CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
       -- Token invalidation versioning for JWTs (bumped on password reset)
       ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT DEFAULT 0;

      -- Insert default admin config if not exists
      INSERT INTO admin_config (speed_multiplier)
      SELECT 1.0
      WHERE NOT EXISTS (SELECT 1 FROM admin_config);

      -- Bootstrap: make lukasz@ww.pl admin on first run
      UPDATE users SET is_admin = true WHERE email = 'lukasz@ww.pl' AND is_admin = false;
          `);
    console.log('[DB] Schema initialized successfully');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };