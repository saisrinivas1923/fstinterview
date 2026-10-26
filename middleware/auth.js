const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'institute-secret-token-key-2026-secure';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({
      error: 'NO_TOKEN',
      message: 'Access denied. No authentication token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch latest user details and session token from database
    const user = db.prepare(`
      SELECT id, name, email, phone, domain, role, placement_status, current_session_token, last_login_at
      FROM users WHERE id = ?
    `).get(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'Account not found. Please log in again.'
      });
    }

    // Enforce single-device login:
    // If the token's sessionToken does not match the active session in DB, this device is superseded!
    if (user.current_session_token !== decoded.sessionToken) {
      return res.status(401).json({
        error: 'SESSION_REVOKED',
        message: 'Your account was logged in on another device or browser. For security, this session has been logged out.'
      });
    }

    req.user = user;
    req.sessionToken = decoded.sessionToken;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Session expired. Please log in again.'
      });
    }
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Invalid session token. Please log in again.'
    });
  }
}

function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Admin access required for this action.'
    });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  authenticateToken,
  verifyAdmin
};
