const crypto = require('crypto');
const express = require('express');
const { URL } = require('url');
const { getStore } = require('../../data/seed');
const { generateAuthTokens } = require('../utils/token.utils');

const router = express.Router();

const OAUTH_CODE_TTL_MS = 5 * 60 * 1000;
const POSTMAN_CALLBACKS = [
  'https://oauth.pstmn.io/v1/callback',
  'https://oauth.pstmn.io/v1/browser-callback',
];

const clients = new Map([
  ['postman-public', {
    clientId: 'postman-public',
    clientSecret: null,
    redirectUris: [...POSTMAN_CALLBACKS, 'http://localhost:3000/callback'],
    scopes: ['users.read', 'users.write', 'openid', 'profile'],
  }],
  ['postman-confidential', {
    clientId: 'postman-confidential',
    clientSecret: process.env.OAUTH_DEMO_CLIENT_SECRET || 'postman-secret',
    redirectUris: [...POSTMAN_CALLBACKS, 'http://localhost:3000/callback'],
    scopes: ['users.read', 'users.write', 'openid', 'profile'],
  }],
]);

const authCodes = new Map();

function normalizeRedirectUri(value) {
  if (!value) return '';

  try {
    const normalized = new URL(value);
    if (normalized.pathname.length > 1) {
      normalized.pathname = normalized.pathname.replace(/\/+$/, '');
    }
    normalized.hash = '';
    return normalized.toString();
  } catch (_) {
    return value.replace(/\/+$/, '');
  }
}

function encodeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildRedirectUri(base, params) {
  const redirectUrl = new URL(base);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      redirectUrl.searchParams.set(key, value);
    }
  });
  return redirectUrl.toString();
}

function resolveClient(clientId) {
  return clients.get(clientId);
}

function parseBasicClientCredentials(authHeader) {
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return {};
  }

  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      return {};
    }

    return {
      clientId: decoded.slice(0, separatorIndex),
      clientSecret: decoded.slice(separatorIndex + 1),
    };
  } catch (_) {
    return {};
  }
}

function validateClient(clientId, redirectUri) {
  const client = resolveClient(clientId);
  if (!client) {
    return { error: 'Unknown client_id' };
  }

  const normalizedRedirectUri = normalizeRedirectUri(redirectUri);
  const allowedRedirectUris = client.redirectUris.map(normalizeRedirectUri);

  if (!allowedRedirectUris.includes(normalizedRedirectUri)) {
    return { error: 'redirect_uri is not allowed for this client' };
  }

  return { client };
}

function validateScope(scope, client) {
  if (!scope) {
    return ['users.read'];
  }

  const requested = scope.split(/\s+/).filter(Boolean);
  const invalid = requested.filter((item) => !client.scopes.includes(item));
  if (invalid.length) {
    return { error: `Unsupported scope: ${invalid.join(', ')}` };
  }

  return requested;
}

function renderConsentPage({ clientId, redirectUri, scope, state, codeChallenge, codeChallengeMethod, users }) {
  const userOptions = users.map((user) => {
    const label = `${user.name} (${user.email}) - ${user.role}`;
    return `<option value="${encodeHtml(user.id)}">${encodeHtml(label)}</option>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Authorize Demo Client</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe7;
        --panel: #fffaf2;
        --text: #1f1a17;
        --muted: #695a4b;
        --accent: #a64b2a;
        --accent-strong: #7d3419;
        --border: #dccdbd;
      }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background: radial-gradient(circle at top, #fff8ef 0%, var(--bg) 65%);
        color: var(--text);
      }
      main {
        max-width: 760px;
        margin: 48px auto;
        padding: 0 20px;
      }
      .card {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 28px;
        box-shadow: 0 20px 60px rgba(69, 41, 23, 0.12);
      }
      h1 {
        margin-top: 0;
        font-size: 2rem;
      }
      p, li, label, select, button, input {
        font-size: 1rem;
        line-height: 1.5;
      }
      .meta {
        margin: 20px 0;
        padding: 16px;
        border-radius: 12px;
        background: #fff;
        border: 1px solid var(--border);
      }
      .meta code {
        word-break: break-word;
      }
      form {
        display: grid;
        gap: 16px;
        margin-top: 24px;
      }
      select {
        width: 100%;
        padding: 12px;
        border-radius: 10px;
        border: 1px solid var(--border);
        background: #fff;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      button {
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        cursor: pointer;
      }
      .approve {
        background: var(--accent);
        color: #fff;
      }
      .deny {
        background: #efe5d9;
        color: var(--text);
      }
    </style>
  </head>
  <body>
    <main>
      <section class="card">
        <h1>OAuth 2.0 Demo Consent</h1>
        <p>This page simulates a hosted authorization screen so you can demonstrate the browser redirect step in Postman.</p>
        <div class="meta">
          <p><strong>Client:</strong> <code>${encodeHtml(clientId)}</code></p>
          <p><strong>Redirect URI:</strong> <code>${encodeHtml(redirectUri)}</code></p>
          <p><strong>Scope:</strong> <code>${encodeHtml(scope || 'users.read')}</code></p>
          <p><strong>State:</strong> <code>${encodeHtml(state || '(none)')}</code></p>
          <p><strong>PKCE:</strong> <code>${encodeHtml(codeChallenge ? (codeChallengeMethod || 'plain') : 'disabled')}</code></p>
        </div>

        <form method="post" action="/oauth/authorize">
          <input type="hidden" name="client_id" value="${encodeHtml(clientId)}" />
          <input type="hidden" name="redirect_uri" value="${encodeHtml(redirectUri)}" />
          <input type="hidden" name="scope" value="${encodeHtml(scope)}" />
          <input type="hidden" name="state" value="${encodeHtml(state)}" />
          <input type="hidden" name="code_challenge" value="${encodeHtml(codeChallenge)}" />
          <input type="hidden" name="code_challenge_method" value="${encodeHtml(codeChallengeMethod)}" />

          <label for="user_id">Demo user</label>
          <select id="user_id" name="user_id">
            ${userOptions}
          </select>

          <div class="actions">
            <button class="approve" type="submit" name="decision" value="approve">Approve and redirect</button>
            <button class="deny" type="submit" name="decision" value="deny">Deny</button>
          </div>
        </form>
      </section>
    </main>
  </body>
</html>`;
}

function createAuthorizationCode({ clientId, redirectUri, user, scope, codeChallenge, codeChallengeMethod }) {
  const code = crypto.randomBytes(32).toString('hex');
  authCodes.set(code, {
    clientId,
    redirectUri,
    userId: user.id,
    scope,
    codeChallenge: codeChallenge || null,
    codeChallengeMethod: codeChallengeMethod || null,
    expiresAt: Date.now() + OAUTH_CODE_TTL_MS,
  });
  return code;
}

function verifyPkce(entry, codeVerifier) {
  if (!entry.codeChallenge) {
    return true;
  }

  if (!codeVerifier) {
    return false;
  }

  if (entry.codeChallengeMethod === 'S256') {
    const hashed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    return hashed === entry.codeChallenge;
  }

  return codeVerifier === entry.codeChallenge;
}

router.get('/authorize', (req, res, next) => {
  const {
    client_id: clientId,
    response_type: responseType,
    redirect_uri: redirectUri,
    scope = 'users.read',
    state = '',
    code_challenge: codeChallenge = '',
    code_challenge_method: codeChallengeMethod = '',
  } = req.query;

  if (!clientId || !redirectUri) {
    return next({ status: 400, message: 'client_id and redirect_uri are required' });
  }
  if (responseType !== 'code') {
    return next({ status: 400, message: 'response_type must be "code"' });
  }
  if (codeChallengeMethod && !['plain', 'S256'].includes(codeChallengeMethod)) {
    return next({ status: 400, message: 'code_challenge_method must be "plain" or "S256"' });
  }
  if (codeChallengeMethod && !codeChallenge) {
    return next({ status: 400, message: 'code_challenge is required when code_challenge_method is provided' });
  }

  const { client, error } = validateClient(clientId, redirectUri);
  if (error) {
    return next({ status: 400, message: error });
  }

  const requestedScope = validateScope(scope, client);
  if (requestedScope.error) {
    return next({ status: 400, message: requestedScope.error });
  }

  const users = getStore().users;
  res.type('html').send(renderConsentPage({
    clientId,
    redirectUri,
    scope: requestedScope.join(' '),
    state,
    codeChallenge,
    codeChallengeMethod,
    users,
  }));
});

router.post('/authorize', (req, res, next) => {
  const {
    decision,
    client_id: clientId,
    redirect_uri: redirectUri,
    user_id: userId,
    scope = 'users.read',
    state = '',
    code_challenge: codeChallenge = '',
    code_challenge_method: codeChallengeMethod = '',
  } = req.body;

  const { client, error } = validateClient(clientId, redirectUri);
  if (error) {
    return next({ status: 400, message: error });
  }

  const requestedScope = validateScope(scope, client);
  if (requestedScope.error) {
    return next({ status: 400, message: requestedScope.error });
  }

  if (decision !== 'approve') {
    return res.redirect(buildRedirectUri(redirectUri, { error: 'access_denied', state }));
  }

  const user = getStore().users.find((item) => item.id === userId);
  if (!user) {
    return next({ status: 400, message: 'Invalid user selection' });
  }

  const code = createAuthorizationCode({
    clientId,
    redirectUri,
    user,
    scope: requestedScope.join(' '),
    codeChallenge,
    codeChallengeMethod,
  });

  return res.redirect(buildRedirectUri(redirectUri, { code, state }));
});

router.post('/token', (req, res, next) => {
  const basicCredentials = parseBasicClientCredentials(req.headers.authorization);
  const {
    grant_type: grantType,
    code,
    client_id: bodyClientId,
    client_secret: bodyClientSecret,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  } = req.body;
  const clientId = bodyClientId || basicCredentials.clientId;
  const clientSecret = bodyClientSecret ?? basicCredentials.clientSecret;

  if (grantType !== 'authorization_code') {
    return next({ status: 400, message: 'grant_type must be "authorization_code"' });
  }
  if (!code || !clientId || !redirectUri) {
    return next({ status: 400, message: 'code, client_id and redirect_uri are required' });
  }

  const { client, error } = validateClient(clientId, redirectUri);
  if (error) {
    return next({ status: 400, message: error });
  }

  if (client.clientSecret && client.clientSecret !== clientSecret) {
    return next({ status: 401, message: 'Invalid client credentials' });
  }

  const entry = authCodes.get(code);
  if (!entry || entry.expiresAt < Date.now()) {
    return next({ status: 400, message: 'Invalid or expired code' });
  }
  if (entry.clientId !== clientId || entry.redirectUri !== redirectUri) {
    return next({ status: 400, message: 'Authorization code does not match the client or redirect_uri' });
  }
  if (!verifyPkce(entry, codeVerifier)) {
    return next({ status: 400, message: 'Invalid or missing code_verifier' });
  }

  authCodes.delete(code);

  const user = getStore().users.find((item) => item.id === entry.userId);
  if (!user) {
    return next({ status: 400, message: 'User for authorization code no longer exists' });
  }

  const { accessToken, refreshToken } = generateAuthTokens(user, { scope: entry.scope });
  return res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: entry.scope,
  });
});

module.exports = router;