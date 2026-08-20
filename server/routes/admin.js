// Admin routes: speed multiplier, currency manipulation, user management
// All routes require both auth and admin middleware
const express = require('express');
const router = express.Router();

const { authMiddleware, adminMiddleware } = require('../auth');
const {
  setSpeedMultiplier,
  getSpeedMultiplier,
  addCurrency,
  listUsers,
} = require('../admin');

// Apply auth + admin guard to all routes in this router
router.use(authMiddleware);
router.use(adminMiddleware);

/**
 * POST /api/admin/speed
 * Set the global speed multiplier for the game.
 * Body: { multiplier: 10 }
 */
router.post('/speed', async (req, res) => {
  try {
    const { multiplier } = req.body;

    if (multiplier === undefined || multiplier === null) {
      return res.status(400).json({ error: 'multiplier is required' });
    }
    if (typeof multiplier !== 'number' || multiplier <= 0) {
      return res.status(400).json({ error: 'multiplier must be a positive number' });
    }

    const newMultiplier = await setSpeedMultiplier(multiplier);
    res.json({ success: true, speed_multiplier: newMultiplier });
  } catch (err) {
    console.error('[Admin] Speed error:', err.message);
    res.status(500).json({ error: 'Failed to set speed multiplier' });
  }
});

/**
 * POST /api/admin/currency
 * Add currency to a specific user's save.
 * Body: { user_id: number, currency: 'fish'|'catnip'|'diamond', amount: number }
 */
router.post('/currency', async (req, res) => {
  try {
    const { user_id, currency, amount } = req.body;

    if (!user_id || !currency || amount === undefined) {
      return res.status(400).json({ error: 'user_id, currency, and amount are required' });
    }

    const result = await addCurrency(user_id, currency, amount);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Admin] Currency error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/admin/users
 * List all registered users with their save data.
 */
router.get('/users', async (req, res) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (err) {
    console.error('[Admin] Users error:', err.message);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

module.exports = router;