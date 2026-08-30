// Authentication middleware and helpers
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[Auth] JWT_SECRET env var is not set — refusing to start.');
  process.exit(1);
}

// Generate JWT token for a user
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, is_admin: user.is_admin },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Middleware: verify JWT token from Authorization header
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: ensure user is admin
function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { generateToken, authMiddleware, adminMiddleware, JWT_SECRET };