const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getStore } = require('../../data/seed');
const { verifyJWT, addToBlacklist } = require('../middleware/auth.middleware');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'workshop-secret-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function generateTokens(user) {
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  return { accessToken, refreshToken };
}

function safeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// POST /auth/login
router.post('/login', async (req, res, next) => {
  try {
    let email, password;

    // Try Basic Auth first
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Basic ')) {
      const base64 = authHeader.slice(6);
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      const colonIdx = decoded.indexOf(':');
      email = decoded.slice(0, colonIdx);
      password = decoded.slice(colonIdx + 1);
    } else {
      email = req.body.email;
      password = req.body.password;
    }

    if (!email || !password) {
      return next({ status: 400, message: 'Email and password are required' });
    }

    const store = getStore();
    const user = store.users.find((u) => u.email === email);
    if (!user) {
      return next({ status: 401, message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return next({ status: 401, message: 'Invalid credentials' });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout
router.post('/logout', verifyJWT, (req, res) => {
  addToBlacklist(req.token);
  res.json({ message: 'Logged out successfully' });
});

// POST /auth/refresh
router.post('/refresh', (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return next({ status: 400, message: 'refreshToken is required' });
  }
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const payload = { id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ accessToken });
  } catch (err) {
    next({ status: 401, message: 'Invalid or expired refresh token' });
  }
});

module.exports = router;
