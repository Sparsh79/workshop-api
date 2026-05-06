const { getStore } = require('../../data/seed');
const {
  revokeAccessToken,
  verifyAccessToken,
} = require('../utils/token.utils');

function verifyJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next({ status: 401, message: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    next({ status: 401, message: err.message === 'Token has been revoked' ? err.message : 'Invalid or expired token' });
  }
}

function verifyApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return next({ status: 401, message: 'Missing x-api-key header' });
  }
  const store = getStore();
  const user = store.users.find((u) => u.apiKey === apiKey);
  if (!user) {
    return next({ status: 401, message: 'Invalid API key' });
  }
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  next();
}

// Try Bearer first, then API key
function verifyBearerOrApiKey(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyJWT(req, res, next);
  }
  return verifyApiKey(req, res, next);
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return next({ status: 401, message: 'Not authenticated' });
    }
    if (req.user.role !== role) {
      return next({ status: 403, message: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { verifyJWT, verifyApiKey, verifyBearerOrApiKey, requireRole, addToBlacklist: revokeAccessToken };