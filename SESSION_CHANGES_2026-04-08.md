# Session Changes Log

Date: 2026-04-08

This file documents the work completed in this session on the REST auth and OAuth demo flows, including code changes, Postman collection changes, testing performed, and issues found during the process.

## 1. Scope of Work

The session focused on:

- reviewing the project with emphasis on the REST auth layer
- checking whether REST auth was working end to end
- improving the REST login / refresh / logout flows
- implementing a browser-redirect-based OAuth 2.0 demo for the REST API
- creating a separate Postman collection for the auth demo
- debugging Postman OAuth callback and token exchange behavior

## 2. Initial Findings

Before the implementation changes, the important issues identified were:

- `POST /auth/refresh` accepted any signed JWT rather than only refresh tokens
- access and refresh tokens were not explicitly separated by token type
- logout only revoked the current access token, not the refresh token
- the OAuth implementation was only a mock and did not perform a real browser redirect flow
- the token exchange was not aligned with standard OAuth client authentication behavior used by Postman

## 3. Files Added

### New REST auth token utility

Added:

- [src/rest/utils/token.utils.js](/home/nashtech/Documents/workshop-api/src/rest/utils/token.utils.js)

This file centralizes:

- access token issuance
- refresh token issuance
- access token revocation
- refresh token revocation
- token type validation
- refresh token rotation

### New Postman collection

Added:

- [REST Auth Demo.postman_collection.json](/home/nashtech/Documents/workshop-api/REST%20Auth%20Demo.postman_collection.json)

This collection is separate from the existing collections and is intended specifically for:

- JWT login demo
- token refresh demo
- logout / revocation demo
- OAuth 2.0 browser redirect demo in Postman

### Session documentation

Added:

- [SESSION_CHANGES_2026-04-08.md](/home/nashtech/Documents/workshop-api/SESSION_CHANGES_2026-04-08.md)

## 4. Files Modified

### REST auth middleware

Modified:

- [src/rest/middleware/auth.middleware.js](/home/nashtech/Documents/workshop-api/src/rest/middleware/auth.middleware.js)

Changes:

- switched Bearer verification to use the new token utility
- enforced access-token-only validation
- kept API key behavior unchanged
- preserved logout blacklist behavior via the exported revoke function

### REST auth routes

Modified:

- [src/rest/routes/auth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/auth.routes.js)

Changes:

- login now issues tokens through the shared token utility
- refresh now only accepts valid refresh tokens
- refresh rotates refresh tokens and returns a new access token plus new refresh token
- logout now optionally revokes a submitted refresh token in the request body
- scope from OAuth-issued refresh tokens is preserved when refreshing

### REST OAuth routes

Modified heavily:

- [src/rest/routes/oauth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/oauth.routes.js)

Changes:

- replaced the old JSON-only mock code response with a browser consent screen
- added `GET /oauth/authorize` rendering an HTML consent page
- added `POST /oauth/authorize` to approve or deny and redirect with `code` and `state`
- added in-memory authorization code storage with expiry
- added demo OAuth clients:
  - `postman-public`
  - `postman-confidential`
- added redirect URI allow-listing
- added scope validation
- added optional PKCE support
- added redirect URI normalization so callback variants like trailing slashes do not fail unnecessarily
- updated `/oauth/token` to accept client credentials from:
  - request body
  - HTTP Basic authorization header

This last change was required because Postman was sending:

- `Authorization: Basic ...`
- `Content-Type: application/x-www-form-urlencoded`

and the server was initially only checking `client_id` in the request body.

### REST server

Modified:

- [src/rest/server.js](/home/nashtech/Documents/workshop-api/src/rest/server.js)

Changes:

- added `express.urlencoded({ extended: false })`

This was required for the consent-form submission on `POST /oauth/authorize`.

### Environment example

Modified:

- [.env.example](/home/nashtech/Documents/workshop-api/.env.example)

Changes:

- added `OAUTH_DEMO_CLIENT_SECRET=postman-secret`

### README

Modified:

- [README.md](/home/nashtech/Documents/workshop-api/README.md)

Changes:

- updated refresh response docs to include rotated refresh tokens
- updated logout docs to mention optional refresh token revocation
- replaced the old mock OAuth examples with the browser-based consent and redirect flow
- documented demo OAuth clients and allowed callback URLs
- updated the token response shape to use:
  - `access_token`
  - `refresh_token`
  - `token_type`
  - `expires_in`
  - `scope`

## 5. Postman Collection Work

### Existing collections

Existing collections in the repo:

- [Workshop API.postman_collection.json](/home/nashtech/Documents/workshop-api/Workshop%20API.postman_collection.json)
- [Login Flow.postman_collection.json](/home/nashtech/Documents/workshop-api/Login%20Flow.postman_collection.json)

Current state:

- `Workshop API.postman_collection.json` was restored to its prior functional content
- `Login Flow.postman_collection.json` was restored exactly as it originally appeared in the workspace
- a new separate collection was created instead of modifying those collections further

### Separate auth demo collection

Created:

- [REST Auth Demo.postman_collection.json](/home/nashtech/Documents/workshop-api/REST%20Auth%20Demo.postman_collection.json)

It contains two folders:

- `JWT Login Flow`
- `OAuth 2.0 Browser Redirect`

The OAuth part is intentionally browser-driven and does not rely on a simulated approval request.

Important configuration embedded in the OAuth helper request:

- Auth URL: `http://localhost:3000/oauth/authorize`
- Access Token URL: `http://localhost:3000/oauth/token`
- Client ID: `postman-public`
- Callback URL: `https://oauth.pstmn.io/v1/browser-callback`
- Scope: `users.read openid profile`
- State: `demo-state`

## 6. Testing Performed

### Static checks

Ran syntax checks using `node --check` for:

- [src/rest/routes/auth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/auth.routes.js)
- [src/rest/middleware/auth.middleware.js](/home/nashtech/Documents/workshop-api/src/rest/middleware/auth.middleware.js)
- [src/rest/routes/oauth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/oauth.routes.js)
- [src/rest/utils/token.utils.js](/home/nashtech/Documents/workshop-api/src/rest/utils/token.utils.js)
- [src/rest/server.js](/home/nashtech/Documents/workshop-api/src/rest/server.js)

### Live server smoke tests

Started the REST server locally and verified:

- valid JSON login returns access and refresh tokens
- invalid login returns `401`
- access token cannot be used as a refresh token
- refresh token rotation works
- old refresh tokens cannot be reused after rotation
- logout revokes the current access token
- logout can revoke the current refresh token
- revoked access tokens fail on protected endpoints
- revoked refresh tokens fail on `/auth/refresh`
- OAuth consent page renders
- OAuth approval returns a `302` redirect to the Postman callback URL
- OAuth authorization code exchange works
- reused authorization codes are rejected

### Postman trace analysis

The following real Postman trace was analyzed:

- `GET /oauth/authorize` returned `200`
- `POST /oauth/authorize` returned `302` with a valid redirect to `https://oauth.pstmn.io/v1/browser-callback?...`
- `POST /oauth/token` failed with `400` because Postman sent client authentication using Basic auth instead of body parameters

This directly led to the Basic-auth parsing fix in:

- [src/rest/routes/oauth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/oauth.routes.js)

## 7. Bugs Found and Fixed During the Session

### Bug 1: refresh token flow failed even with a fresh token

Cause:

- `issueRefreshToken` was used in the refresh route but was not exported from the token utility at one point during implementation

Fix:

- exported `issueRefreshToken` from [src/rest/utils/token.utils.js](/home/nashtech/Documents/workshop-api/src/rest/utils/token.utils.js)

### Bug 2: refresh token tracking logic was too fragile

Cause:

- the refresh token store initially keyed off `jti` tracking in a way that complicated live verification

Fix:

- simplified the in-memory refresh token store to track full refresh token strings via a `Set`

### Bug 3: Postman token exchange failed with `client_id` missing

Cause:

- Postman sent client credentials in the Basic auth header during `/oauth/token`
- the server only looked for `client_id` in the request body

Fix:

- added Basic auth client credential parsing in [src/rest/routes/oauth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/oauth.routes.js#L69)

### Bug 4: redirect URI allow-list was too strict

Cause:

- exact string matching could reject callback URI variants

Fix:

- normalized redirect URIs before comparison in [src/rest/routes/oauth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/oauth.routes.js#L32)

## 8. Current Repo State Relevant to This Session

Current changed files related to the auth/OAuth work:

- [.env.example](/home/nashtech/Documents/workshop-api/.env.example)
- [README.md](/home/nashtech/Documents/workshop-api/README.md)
- [src/rest/middleware/auth.middleware.js](/home/nashtech/Documents/workshop-api/src/rest/middleware/auth.middleware.js)
- [src/rest/routes/auth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/auth.routes.js)
- [src/rest/routes/oauth.routes.js](/home/nashtech/Documents/workshop-api/src/rest/routes/oauth.routes.js)
- [src/rest/server.js](/home/nashtech/Documents/workshop-api/src/rest/server.js)
- [src/rest/utils/token.utils.js](/home/nashtech/Documents/workshop-api/src/rest/utils/token.utils.js)
- [REST Auth Demo.postman_collection.json](/home/nashtech/Documents/workshop-api/REST%20Auth%20Demo.postman_collection.json)

Collections intentionally preserved:

- [Workshop API.postman_collection.json](/home/nashtech/Documents/workshop-api/Workshop%20API.postman_collection.json)
- [Login Flow.postman_collection.json](/home/nashtech/Documents/workshop-api/Login%20Flow.postman_collection.json)

## 9. Remaining Caveat

At the end of the session, the browser redirect and code issuance were working, but Postman’s browser-auth UX still depended on Postman correctly consuming its own callback window. The server-side fixes now cover:

- redirect URI validation
- PKCE inputs
- authorization code issuance
- token exchange with Basic auth client credentials

If Postman still appears stuck after these fixes, the next thing to inspect is the exact token request it sends after restart, not the authorize step.
