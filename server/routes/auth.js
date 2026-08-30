// Auth routes: registration, login, forgot/reset password, user profile
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const router = express.Router();

const { pool } = require('../db');
const { generateToken, authMiddleware } = require('../auth');
const { sendEmail } = require('../email');

// --- Timing-safe dummy hash for login failures (computed once at startup) ---
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer', 10);

// --- Password validation ---
function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one digit';
  }
  return null;
}

/**
 * POST /api/auth/register
 * Creates a new user account with hashed password and an empty save slot.
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post('/register', async (req, res) => {
  try {
    const { password } = req.body;
    let { email } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    email = String(email).trim().toLowerCase();

    const pwError = validatePassword(password);
    if (pwError) {
      return res.status(400).json({ error: pwError });
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

    // Create an empty save for the new user — zero everything, no starter
    const defaultSave = {
      fish: 0,
      fishPerClick: 1,
      fishPerSecond: 0,
      catnip: 0,
      diamonds: 0,
      offlineCatnip: 0,
      offlineDiamonds: 0,
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

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, is_admin: user.is_admin },
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Generates a reset token and sends email with reset link.
 * Body: { email }
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user
    const userResult = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      // Don't reveal whether email exists — always return same message
      return res.json({
        success: true,
        message: 'If this email is registered, you will receive a reset link shortly.',
      });
    }

    const user = userResult.rows[0];

    // Generate secure random token + expiry (15 minutes)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Store token in DB
    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    // Invalidate old tokens for this user
    await pool.query(
      'UPDATE password_resets SET used = true WHERE user_id = $1 AND token != $2',
      [user.id, token]
    );

    // Send email via SMTP (Brajanek)
    const resetLink = `https://ct-d.1.booster.rentals/reset-password?token=${token}`;
    const emailResult = await sendEmail({
      to: user.email,
      subject: 'Catnip Tycoon — Reset hasła',
      html: `
        <div style="max-width: 480px; margin: 0 auto; font-family: Arial, sans-serif; background: #1a1a2e; color: #eee; padding: 24px; border-radius: 12px;">
          <div style="text-align: center; font-size: 48px; margin-bottom: 16px;">🐱</div>
          <h2 style="text-align: center; color: #f4a261;">Reset hasła — Catnip Tycoon</h2>
          <p>Otrzymaliśmy prośbę o reset hasła dla Twojego konta.</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 12px 32px; background: #e94560; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Resetuj hasło
            </a>
          </p>
          <p style="font-size: 12px; color: #777;">Link ważny 15 minut. Jeśli to nie Ty prosiłeś o reset — zignoruj tę wiadomość.</p>
        </div>
      `,
      text: `Catnip Tycoon — Reset hasła\n\nOtrzymaliśmy prośbę o reset hasła. Kliknij link poniżej:\n${resetLink}\n\nLink ważny 15 minut.`,
    });

    if (!emailResult.success) {
      console.error('[Auth] Failed to send reset email:', emailResult.error);
      // Don't reveal to user — they'll get generic success message
    }

    res.json({
      success: true,
      message: 'If this email is registered, you will receive a reset link shortly.',
    });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/reset-password
 * Validates reset token and updates password.
 * Body: { token, password }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return res.status(400).json({ error: pwError });
    }

    // Find valid token
    const result = await pool.query(
      'SELECT id, user_id, expires_at FROM password_resets WHERE token = $1 AND used = false',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const reset = result.rows[0];

    // Check expiry
    if (new Date() > new Date(reset.expires_at)) {
      return res.status(400).json({ error: 'Reset token has expired. Please request a new one.' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      reset.user_id,
    ]);

    // Mark token as used
    await pool.query('UPDATE password_resets SET used = true WHERE id = $1', [reset.id]);

    // Invalidate all other tokens for this user
    await pool.query(
      'UPDATE password_resets SET used = true WHERE user_id = $1 AND id != $2',
      [reset.user_id, reset.id]
    );

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err.message);
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
    const { password } = req.body;
    let { email } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    email = String(email).trim().toLowerCase();

    // Find user by email
    const result = await pool.query(
      'SELECT id, email, password_hash, is_admin FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) {
      // Constant-time path: run a dummy bcrypt compare to match existing-account timing
      await bcrypt.compare(password, DUMMY_HASH);
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

/**
 * POST /api/auth/make-admin
 * Bootstrap endpoint — sets a user as admin. Protected by secret key.
 * Body: { email, secret }
 */
router.post('/make-admin', async (req, res) => {
  try {
    const { email, secret } = req.body;
    if (secret !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      return res.status(403).json({ error: 'Invalid secret' });
    }
    const result = await pool.query(
      'UPDATE users SET is_admin = true WHERE email = $1 RETURNING id, email, is_admin',
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('[Auth] Make-admin error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
