const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'workshop-secret-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const accessTokenBlacklist = new Set();
const refreshTokenStore = new Set();

function buildUserPayload(user, extra = {}) {
  return {
    sub: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...extra,
  };
}

function issueAccessToken(user, extra = {}) {
  return jwt.sign(
    buildUserPayload(user, { tokenType: 'access', ...extra }),
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function issueRefreshToken(user, extra = {}) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    buildUserPayload(user, { tokenType: 'refresh', jti, ...extra }),
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  refreshTokenStore.add(token);

  return token;
}

function generateAuthTokens(user, extra = {}) {
  const accessToken = issueAccessToken(user, extra);
  const refreshToken = issueRefreshToken(user, extra);
  return { accessToken, refreshToken };
}

function revokeAccessToken(token) {
  accessTokenBlacklist.add(token);
}

function isAccessTokenRevoked(token) {
  return accessTokenBlacklist.has(token);
}

function revokeRefreshToken(token) {
  refreshTokenStore.delete(token);
}

function verifyAccessToken(token) {
  if (isAccessTokenRevoked(token)) {
    throw new Error('Token has been revoked');
  }

  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.tokenType !== 'access') {
    throw new Error('Invalid token type');
  }

  return decoded;
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.tokenType !== 'refresh' || !decoded.jti) {
    throw new Error('Invalid token type');
  }

  if (!refreshTokenStore.has(token)) {
    throw new Error('Refresh token has been revoked');
  }

  return decoded;
}

function rotateRefreshToken(token) {
  const decoded = verifyRefreshToken(token);
  refreshTokenStore.delete(token);
  return decoded;
}

module.exports = {
  generateAuthTokens,
  issueAccessToken,
  issueRefreshToken,
  revokeAccessToken,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
