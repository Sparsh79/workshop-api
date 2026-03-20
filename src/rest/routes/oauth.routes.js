const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'workshop-secret-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// In-memory auth code store: { code -> { clientId, redirectUri, expiresAt } }
const authCodes = new Map();

// GET /oauth/authorize
router.get('/authorize', (req, res, next) => {
  const { client_id, response_type, redirect_uri } = req.query;
  if (!client_id || !redirect_uri) {
    return next({ status: 400, message: 'client_id and redirect_uri are required' });
  }
  if (response_type !== 'code') {
    return next({ status: 400, message: 'response_type must be "code"' });
  }
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  authCodes.set(code, {
    clientId: client_id,
    redirectUri: redirect_uri,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  res.json({ code, message: 'Use this code in POST /oauth/token' });
});

// POST /oauth/token
router.post('/token', (req, res, next) => {
  const { grant_type, code, client_id, redirect_uri } = req.body;
  if (grant_type !== 'authorization_code') {
    return next({ status: 400, message: 'grant_type must be "authorization_code"' });
  }
  const entry = authCodes.get(code);
  if (!entry || entry.expiresAt < Date.now() || entry.clientId !== client_id) {
    return next({ status: 400, message: 'Invalid or expired code' });
  }
  authCodes.delete(code);
  const accessToken = jwt.sign({ client_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  res.json({ accessToken, token_type: 'Bearer', expires_in: 3600 });
});

module.exports = router;
