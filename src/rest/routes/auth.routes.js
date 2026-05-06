const express = require('express');
const bcrypt = require('bcryptjs');
const { getStore } = require('../../data/seed');
const { verifyJWT, addToBlacklist } = require('../middleware/auth.middleware');
const {
  generateAuthTokens,
  issueAccessToken,
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
} = require('../utils/token.utils');

const router = express.Router();

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

    const { accessToken, refreshToken } = generateAuthTokens(user);
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
  if (req.body.refreshToken) {
    revokeRefreshToken(req.body.refreshToken);
  }
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
    const decoded = rotateRefreshToken(refreshToken);
    const user = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };
    const tokenExtras = decoded.scope ? { scope: decoded.scope } : {};
    const accessToken = issueAccessToken(user, tokenExtras);
    const nextRefreshToken = issueRefreshToken(user, tokenExtras);
    res.json({ accessToken, refreshToken: nextRefreshToken });
  } catch (err) {
    next({ status: 401, message: 'Invalid or expired refresh token' });
  }
});

module.exports = router;