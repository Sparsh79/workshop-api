# Workshop API

A unified API server exposing a **User Management** domain across three protocols — REST, GraphQL, and gRPC — built for Postman training workshops.

| Protocol | Server | Port |
|----------|--------|------|
| REST | Express.js | `3000` |
| GraphQL | Apollo Server | `4000` |
| gRPC | @grpc/grpc-js | `50051` |

All three servers share a single **in-memory data store** seeded with 12 users on startup. No database required.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
  - [Option 1: Node.js](#option-1-nodejs)
  - [Option 2: Docker](#option-2-docker)
- [Environment Variables](#environment-variables)
- [Seeded Users](#seeded-users)
- [REST API](#rest-api)
  - [Utility](#utility-endpoints)
  - [Authentication](#authentication-endpoints)
  - [OAuth Mock](#oauth-mock-endpoints)
  - [Users](#user-endpoints)
- [GraphQL API](#graphql-api)
  - [Queries](#queries)
  - [Mutations](#mutations)
- [gRPC API](#grpc-api)
  - [Postman Setup](#postman-grpc-setup)
  - [Methods](#grpc-methods)
- [Authentication Guide](#authentication-guide)
- [Resetting Data](#resetting-data)
- [TLS Setup (gRPC)](#tls-setup-grpc)
- [Project Structure](#project-structure)

---

## Prerequisites

- **Node.js** v18 or higher (`node --version`)
- **npm** v8 or higher (`npm --version`)
- **Docker** + **Docker Compose** *(optional, for containerised run)*
- **Postman** v10+ *(for gRPC server reflection support)*

---

## Quick Start

### Option 1: Node.js

```bash
# 1. Clone or enter the project directory
cd workshop-api

# 2. Install dependencies
npm install

# 3. Start all three servers concurrently
npm start
```

Expected output:
```
[0] REST server running on http://localhost:3000
[1] GraphQL server running on http://localhost:4000/graphql
[2] gRPC server running on port 50051 (TLS: false)
```

**Development mode** (auto-restarts on file change, requires `nodemon`):
```bash
npm install -g nodemon
npm run dev
```

**Run servers individually:**
```bash
npm run start:rest      # REST only
npm run start:graphql   # GraphQL only
npm run start:grpc      # gRPC only
```

---

### Option 2: Docker

```bash
# Build and start all servers
docker compose up

# Run in background
docker compose up -d

# Stop
docker compose down
```

> TLS certificates are mounted from `./certs` into the container. Generate them first if using `GRPC_TLS=true` (see [TLS Setup](#tls-setup-grpc)).

---

## Environment Variables

Copy `.env.example` to `.env` (already included). All variables with their defaults:

```env
PORT_REST=3000
PORT_GRAPHQL=4000
PORT_GRPC=50051

JWT_SECRET=workshop-secret-2024
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

GRPC_TLS=false
NODE_ENV=development
```

---

## Seeded Users

The server seeds **12 users** on startup. All share the same password: **`Workshop@123`**

| ID | Name | Email | Role | Department | API Key |
|----|------|-------|------|------------|---------|
| u-001 | Alice Johnson | alice@example.com | admin | Backend | `ak-alice-001` |
| u-002 | Bob Martinez | bob@example.com | user | Frontend | `ak-bob-002` |
| u-003 | Carol Smith | carol@example.com | moderator | DevOps | `ak-carol-003` |
| u-004 | David Lee | david@example.com | user | Backend | `ak-david-004` |
| u-005 | Eva Williams | eva@example.com | user | Frontend | `ak-eva-005` |
| u-006 | Frank Brown | frank@example.com | admin | DevOps | `ak-frank-006` |
| u-007 | Grace Kim | grace@example.com | user | QA | `ak-grace-007` |
| u-008 | Henry Davis | henry@example.com | user | Backend | `ak-henry-008` |
| u-009 | Irene Taylor | irene@example.com | moderator | Frontend | `ak-irene-009` |
| u-010 | Jake Wilson | jake@example.com | user | QA | `ak-jake-010` |
| u-011 | Karen Moore | karen@example.com | user | DevOps | `ak-karen-011` |
| u-012 | Liam Chen | liam@example.com | admin | Backend | `ak-liam-012` |

> **Roles:** `admin` — full CRUD access. `moderator` / `user` — read-only.

---

## REST API

Base URL: `http://localhost:3000`

All error responses are JSON — never HTML:
```json
{ "error": "Message here", "statusCode": 404 }
```

---

### Utility Endpoints

#### `GET /health`
No authentication required.

```bash
curl http://localhost:3000/health
```
```json
{ "status": "ok", "uptime": 42.3, "timestamp": "2026-03-20T08:00:00.000Z" }
```

---

#### `GET /version`
No authentication required.

```bash
curl http://localhost:3000/version
```
```json
{ "version": "1.0.0", "environment": "development", "protocols": ["REST", "GraphQL", "gRPC"] }
```

---

### Authentication Endpoints

#### `POST /auth/login`

Accepts **Basic Auth** header or **JSON body**.

**JSON body:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "Workshop@123"}'
```

**Basic Auth header** (`base64(email:password)`):
```bash
curl -X POST http://localhost:3000/auth/login \
  -u "alice@example.com:Workshop@123"
```

**Response:**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": {
    "id": "u-001",
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "role": "admin",
    "department": "Backend"
  }
}
```

> Access token expires in **1 hour**. Refresh token expires in **7 days**.

---

#### `POST /auth/refresh`

Exchange a refresh token for a new access token.

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<your-refresh-token>"}'
```

**Response:**
```json
{
  "accessToken": "<new-jwt>",
  "refreshToken": "<rotated-refresh-token>"
}
```

---

#### `POST /auth/logout`

Invalidates the current access token. You can also provide a `refreshToken` in the JSON body to revoke that refresh token during logout.

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <access-token>"
```

**Response:**
```json
{ "message": "Logged out successfully" }
```

---

### OAuth Mock Endpoints

A browser-based OAuth 2.0 Authorization Code demo flow for Postman workshops. `GET /oauth/authorize` now renders a consent page and redirects back to the client callback with `code` and `state`.

#### `GET /oauth/authorize`

```bash
open "http://localhost:3000/oauth/authorize?client_id=postman-public&response_type=code&redirect_uri=https://oauth.pstmn.io/v1/callback&scope=users.read%20openid%20profile&state=demo-state"
```

The browser shows a demo consent screen. After approval, it redirects to:
```text
https://oauth.pstmn.io/v1/callback?code=<authorization-code>&state=demo-state
```

> Codes expire after **5 minutes**.

Supported demo clients:
- `postman-public` for Postman with PKCE and no client secret
- `postman-confidential` for a classic client secret demo (`client_secret` defaults to `postman-secret`)

Allowed callback URIs:
- `https://oauth.pstmn.io/v1/callback`
- `https://oauth.pstmn.io/v1/browser-callback`
- `http://localhost:3000/callback`

---

#### `POST /oauth/token`

```bash
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "authorization_code",
    "code": "<authorization-code>",
    "client_id": "postman-public",
    "redirect_uri": "https://oauth.pstmn.io/v1/callback",
    "code_verifier": "<pkce-code-verifier>"
  }'
```

**Response:**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "users.read openid profile"
}
```

---

### User Endpoints

All user endpoints require authentication via **Bearer token** or **API Key**.

| Method | Auth | Roles |
|--------|------|-------|
| `GET /users` | Bearer or API Key | any |
| `GET /users/me` | Bearer only | any |
| `GET /users/:id` | Bearer or API Key | any |
| `POST /users` | Bearer | admin only |
| `PUT /users/:id` | Bearer | admin only |
| `PATCH /users/:id` | Bearer | admin only |
| `DELETE /users/:id` | Bearer | admin only |

---

#### `GET /users`

Supports filtering and pagination via query parameters.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `10` | Results per page (max 50) |
| `department` | string | — | Filter: `Backend`, `Frontend`, `DevOps`, `QA` |
| `role` | string | — | Filter: `admin`, `moderator`, `user` |
| `isActive` | boolean | — | Filter: `true` or `false` |

```bash
# Bearer token
curl "http://localhost:3000/users?page=1&limit=5&department=Backend" \
  -H "Authorization: Bearer <token>"

# API Key
curl "http://localhost:3000/users" \
  -H "x-api-key: ak-alice-001"
```

**Response:**
```json
{
  "data": [ ...users ],
  "pagination": { "page": 1, "limit": 5, "total": 4, "totalPages": 1 }
}
```

---

#### `GET /users/me`

Returns the authenticated user's full profile including their `apiKey`.

```bash
curl http://localhost:3000/users/me \
  -H "Authorization: Bearer <token>"
```

---

#### `GET /users/:id`

```bash
curl http://localhost:3000/users/u-001 \
  -H "Authorization: Bearer <token>"
```

Returns `404` if user does not exist.

---

#### `POST /users`

Admin only. Creates a new user.

```bash
curl -X POST http://localhost:3000/users \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New User",
    "email": "newuser@example.com",
    "password": "Secure@123",
    "role": "user",
    "department": "QA"
  }'
```

**Responses:**
- `201` — user created (no `password` field)
- `409` — email already exists
- `422` — missing required fields

---

#### `PATCH /users/:id`

Admin only. Partial update — only include fields to change.

```bash
curl -X PATCH http://localhost:3000/users/u-002 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"department": "DevOps", "isActive": false}'
```

---

#### `PUT /users/:id`

Admin only. Full replacement update.

```bash
curl -X PUT http://localhost:3000/users/u-002 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bob Martinez",
    "email": "bob@example.com",
    "role": "moderator",
    "department": "DevOps",
    "isActive": true
  }'
```

---

#### `DELETE /users/:id`

Admin only. Returns `204 No Content` on success.

```bash
curl -X DELETE http://localhost:3000/users/u-002 \
  -H "Authorization: Bearer <admin-token>"
```

---

### Resetting Data

Restores all 12 seeded users. Requires admin Bearer token.

```bash
curl -X POST http://localhost:3000/reset \
  -H "Authorization: Bearer <admin-token>"
```

```json
{ "message": "Data reset to seed state", "userCount": 12 }
```

> Run this between workshop sessions to restore a clean state.

---

## GraphQL API

**Endpoint:** `http://localhost:4000/graphql`

**Apollo Sandbox** is available at the same URL when `NODE_ENV=development`. Open it in your browser to explore and run queries interactively.

Pass the JWT via header:
```
Authorization: Bearer <access-token>
```

---

### Schema Overview

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  role: String!
  department: String!
  avatar: String
  isActive: Boolean!
  apiKey: String
  createdAt: String!
  updatedAt: String!
}

type PaginatedUsers {
  data: [User!]!
  total: Int!
  page: Int!
  totalPages: Int!
}

type AuthPayload {
  accessToken: String!
  refreshToken: String!
  user: User!
}
```

---

### Queries

#### List users (with optional filters)

```graphql
query {
  users(department: "Backend", page: 1, limit: 5) {
    total
    page
    totalPages
    data {
      id
      name
      email
      role
      department
    }
  }
}
```

---

#### Get user by ID

```graphql
query {
  user(id: "u-001") {
    id
    name
    email
    role
    department
  }
}
```

> **Workshop note:** If the user is not found, the response is `{ "data": { "user": null } }` with HTTP **200** and no `errors` array. This is intentional — it demonstrates the GraphQL HTTP 200 trap where a "missing" result is invisible to naive status-code checks.

---

#### Get current authenticated user

```graphql
query {
  me {
    id
    name
    email
    apiKey
  }
}
```

---

#### Introspect the schema

```graphql
{
  __schema {
    types {
      name
    }
  }
}
```

---

### Mutations

#### Login

```graphql
mutation {
  login(email: "alice@example.com", password: "Workshop@123") {
    accessToken
    refreshToken
    user {
      id
      name
      role
    }
  }
}
```

---

#### Create user *(admin)*

```graphql
mutation {
  createUser(
    name: "New User"
    email: "newuser@example.com"
    password: "Secure@123"
    role: "user"
    department: "Frontend"
  ) {
    id
    name
    email
  }
}
```

---

#### Update user *(admin)*

```graphql
mutation {
  updateUser(id: "u-002", department: "DevOps", isActive: false) {
    id
    name
    department
    isActive
  }
}
```

---

#### Delete user *(admin)*

```graphql
mutation {
  deleteUser(id: "u-002")
}
```

Returns `true` on success.

---

#### Reset data *(admin)*

```graphql
mutation {
  resetData
}
```

Returns `true` on success.

---

## gRPC API

**Server:** `localhost:50051`
**TLS:** disabled by default (`GRPC_TLS=false`)

Server reflection is enabled — Postman can auto-discover all services and methods without uploading a `.proto` file.

---

### Postman gRPC Setup

1. Open Postman → click **New** → select **gRPC**
2. Enter URL: `localhost:50051` *(no protocol prefix)*
3. Click **Use Server Reflection**
4. From the **Select a method** dropdown, choose a method under `user.UserService`
5. Paste the request message in the **Message** tab
6. Click **Invoke**

---

### gRPC Methods

#### `GetUser` — Unary

Send one request, receive one response.

```json
{ "id": "u-001" }
```

**Not found:**
```json
{ "id": "nonexistent" }
```
Returns gRPC status `NOT_FOUND`.

---

#### `ListUsers` — Server Streaming

Send one request, receive a stream of `User` messages with a **200ms delay** between each (intentional — makes streaming visible in Postman).

```json
{ "department": "Backend", "limit": 5 }
```

Omit `department` to stream all users. Omit `limit` (or set to `0`) for the default of 10.

---

#### `CreateUsers` — Client Streaming

Send multiple `CreateUserRequest` messages, receive a single summary response.

In Postman, send each message individually using **Send Message** while the stream is open:

```json
{ "name": "Stream User 1", "email": "stream1@example.com", "role": "user", "department": "QA" }
```
```json
{ "name": "Stream User 2", "email": "stream2@example.com", "role": "moderator", "department": "DevOps" }
```

Click **End Stream** when done. Response:
```json
{ "created_count": 2, "ids": ["<uuid1>", "<uuid2>"] }
```

---

#### `Chat` — Bidirectional Streaming

Send messages and receive echo responses in real time.

```json
{ "sender": "postman", "text": "Hello server!", "timestamp": "2026-03-20T00:00:00Z" }
```

Server replies:
```json
{ "sender": "server", "text": "Echo: Hello server!", "timestamp": "<iso-timestamp>" }
```

Keep sending messages; each gets echoed back. Click **End Stream** to close.

---

## Authentication Guide

### Bearer Token (JWT)

1. Call `POST /auth/login` (REST) or `mutation { login }` (GraphQL)
2. Copy the `accessToken` from the response
3. Add to request headers:
   ```
   Authorization: Bearer <accessToken>
   ```

Tokens expire in **1 hour**. Use `POST /auth/refresh` with your `refreshToken` to get a new one.

### API Key

API keys are per-user and never change (unless data is reset). Retrieve your key from `GET /users/me`.

Add to request headers:
```
x-api-key: ak-alice-001
```

API keys grant read access to user endpoints. Write operations (create, update, delete) require a Bearer token with `admin` role.

---

## TLS Setup (gRPC)

By default gRPC runs without TLS (`GRPC_TLS=false`). To enable TLS:

**1. Generate a self-signed certificate:**

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout certs/server.key \
  -out certs/server.crt \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

**2. Set the environment variable:**

```env
GRPC_TLS=true
```

**3. Restart the gRPC server:**

```bash
npm run start:grpc
```

**4. In Postman:** when connecting to `localhost:50051`, enable **TLS** and disable certificate verification (since the cert is self-signed).

---

## Project Structure

```
workshop-api/
├── src/
│   ├── data/
│   │   └── seed.js                  # 12 seeded users, in-memory store, reset logic
│   ├── rest/
│   │   ├── server.js                # Express app — port 3000
│   │   ├── routes/
│   │   │   ├── auth.routes.js       # POST /auth/login, /auth/logout, /auth/refresh
│   │   │   ├── users.routes.js      # CRUD /users
│   │   │   └── oauth.routes.js      # GET /oauth/authorize, POST /oauth/token
│   │   └── middleware/
│   │       ├── auth.middleware.js   # verifyJWT, verifyApiKey, requireRole
│   │       └── error.middleware.js  # Global JSON error handler
│   ├── graphql/
│   │   ├── server.js                # Apollo Server — port 4000
│   │   ├── schema.js                # GraphQL type definitions
│   │   └── resolvers.js             # Query + Mutation resolvers
│   └── grpc/
│       ├── server.js                # gRPC server — port 50051
│       ├── user.proto               # Protobuf service definition
│       └── handlers.js              # RPC method implementations
├── certs/
│   ├── server.crt                   # Self-signed TLS cert
│   └── server.key                   # Private key
├── .env                             # Environment variables
├── .env.example                     # Example env file
├── docker-compose.yml
├── Dockerfile
├── package.json
├── workshop-api.postman_collection.json
└── README.md
```
