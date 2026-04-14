# ledger-api

A financial ledger reference implementation demonstrating fintech-grade patterns: ACID transactions, idempotency, optimistic locking, and JWT authentication across two microservices.

> This is a **technical demonstration**, not a production product. It is intended to showcase architectural patterns and engineering practices in a Node.js/Fastify/PostgreSQL stack.

---

## Architecture

```
                        External Clients
                               |
              (JWT — JWT_EXTERNAL_SECRET)
               ________________|________________
              |                                 |
       identity-api (3002)             ledger-api (3001)
       [User management, auth]         [Transactions, balance]
              |                                 |
       identity-db (PostgreSQL)        ledger-db (PostgreSQL)
              |                                 |
              |_____ internal HTTP _____________|
                 (JWT — JWT_INTERNAL_SECRET)
```

Each microservice has its own dedicated PostgreSQL database. Internal service-to-service calls use a separate JWT secret (`JWT_INTERNAL_SECRET`) so that external tokens cannot be used to call internal endpoints.

---

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Runtime    | Node.js 20 (ESM modules)            |
| HTTP       | Fastify                             |
| Database   | PostgreSQL 16                       |
| Auth       | JWT (jsonwebtoken)                  |
| Validation | Zod                                 |
| Testing    | Jest (with experimental VM modules) |
| Containers | Docker + Docker Compose             |
| Monorepo   | npm workspaces                      |

---

## Project Structure

```
.
├── apps
│   ├── identity/          # Identity microservice (port 3002)
│   │   ├── src/
│   │   │   ├── http/      # Fastify routes (external + internal)
│   │   │   ├── use-cases/ # Business logic
│   │   │   └── repos/     # Database access
│   │   └── Dockerfile
│   └── ledger/            # Ledger microservice (port 3001)
│       ├── src/
│       │   ├── http/      # Fastify routes (external + internal)
│       │   ├── use-cases/ # Business logic
│       │   └── repos/     # Database access
│       └── Dockerfile
├── packages
│   └── shared/            # Shared utilities (JWT, errors, logger, env)
├── docs
│   └── openapi/           # OpenAPI 3.0 YAML specs
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Local Setup

### Prerequisites

- Docker Desktop (with Docker Compose v2)
- Node.js 20+

### Steps

1. Clone the repository:

   ```bash
   git clone <repo-url>
   cd ledger-api
   ```

2. Copy the example environment file and fill in the JWT secrets:

   ```bash
   cp .env.example .env
   ```

   Open `.env` and set values for:

   ```
   JWT_EXTERNAL_SECRET=<your-external-secret>
   JWT_INTERNAL_SECRET=<your-internal-secret>
   ```

3. Start all services:

   ```bash
   docker compose up -d --build
   ```

4. Services are available at:
   - Ledger API: http://localhost:3001
   - Identity API: http://localhost:3002

---

## API Overview

### Identity Service (port 3002)

| Method   | Path         | Auth     | Description             |
| -------- | ------------ | -------- | ----------------------- |
| `POST`   | `/users`     | None     | Create a new user       |
| `GET`    | `/users`     | External | List all users          |
| `GET`    | `/users/:id` | External | Get user by ID          |
| `PATCH`  | `/users/:id` | External | Update user             |
| `DELETE` | `/users/:id` | External | Delete user             |
| `POST`   | `/auth`      | None     | Authenticate, get token |

Internal endpoint (service-to-service only):

| Method | Path                  | Auth     | Description           |
| ------ | --------------------- | -------- | --------------------- |
| `GET`  | `/internal/users/:id` | Internal | Verify user existence |

### Ledger Service (port 3001)

| Method | Path            | Auth     | Description                    |
| ------ | --------------- | -------- | ------------------------------ |
| `POST` | `/transactions` | External | Create a credit/debit entry    |
| `GET`  | `/transactions` | External | List transactions (filterable) |
| `GET`  | `/balance`      | External | Get consolidated balance       |

Internal endpoint (service-to-service only):

| Method | Path                        | Auth     | Description            |
| ------ | --------------------------- | -------- | ---------------------- |
| `GET`  | `/internal/balance/:userId` | Internal | Get balance for a user |

---

## Development

### Available npm scripts

Run from the monorepo root:

```bash
# Type check all workspaces
npm run typecheck

# Lint all workspaces
npm run lint

# Run all unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Check formatting
npm run format:check

# Fix formatting
npm run format:write
```

### Running tests for a single service

```bash
npm -w @ledger/identity test
npm -w @ledger/ledger test
```

> Tests use Jest with `node --experimental-vm-modules` for ESM compatibility. No database is required to run unit tests — repositories are mocked at the use-case layer.

### Git hooks

Enable the pre-push CI gates (lint + test + OpenAPI validation):

```bash
git config core.hooksPath .githooks
```

### Smoke tests

Smoke tests require docker-compose to be running:

```bash
docker-compose up -d
npm run test:smoke
```

### GitHub CLI authentication

If `GITHUB_TOKEN` causes issues with the `gh` CLI:

```bash
unset GITHUB_TOKEN && gh auth login
```

---

## OpenAPI Specs

OpenAPI 3.0 specifications are available under `docs/openapi/`:

- `docs/openapi/ms-identity.yaml` — Identity service (user management + auth)
- `docs/openapi/ms-ledger.yaml` — Ledger service (transactions + balance)

Validate both specs:

```bash
npm run validate:openapi
```

---

## Milestones

| Milestone | Status  | Scope                                                      |
| --------- | ------- | ---------------------------------------------------------- |
| M0        | Done    | Monorepo bootstrap, shared package, CI skeleton            |
| M1        | Done    | Core microservices: identity, ledger, docker-compose, docs |
| M2        | Planned | Reliability: retries, circuit breakers, observability      |
