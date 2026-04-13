# API Collections

This directory contains API collections for the ledger-api services.

## Files

- `ledger-api.postman_collection.json` — Postman v2.1 collection (Identity + Ledger services)
- `ledger-api.insomnia_collection.json` — Insomnia v4 collection (Identity + Ledger services)

## Prerequisites

Start the services before running any requests:

```bash
docker-compose up -d
```

Services run on:
- Identity Service: `http://localhost:3002`
- Ledger Service: `http://localhost:3001`

---

## Postman

### Import

1. Open Postman.
2. Click **Import** (top left).
3. Select `ledger-api.postman_collection.json`.
4. The collection appears in the left sidebar under **Collections**.

### Environment variables

The collection uses collection-level variables. To view or edit them:

1. Click the collection name in the sidebar.
2. Select the **Variables** tab.

| Variable       | Default value           | Description                              |
|----------------|-------------------------|------------------------------------------|
| `baseUrl`      | `http://localhost`      | Base URL for both services               |
| `identityPort` | `3002`                  | Port for the Identity Service            |
| `ledgerPort`   | `3001`                  | Port for the Ledger Service              |
| `token`        | _(empty)_               | JWT set automatically after Login        |
| `userId`       | _(empty)_               | User ID set automatically after Login    |

### Auth flow

1. Run **Register User** to create an account.
2. Run **Login** — the post-request script automatically sets `token` and `userId` from the response.
3. All subsequent requests use `Bearer {{token}}` and `{{userId}}` automatically.

---

## Insomnia

### Import

1. Open Insomnia.
2. Click **Create** > **Import from File**.
3. Select `ledger-api.insomnia_collection.json`.
4. The workspace **ledger-api** is created with all folders and requests.

### Environment variables

1. In the top bar, click the environment selector and choose **Base Environment**.
2. Edit the following variables as needed:

| Variable       | Default value           | Description                              |
|----------------|-------------------------|------------------------------------------|
| `baseUrl`      | `http://localhost`      | Base URL for both services               |
| `identityPort` | `3002`                  | Port for the Identity Service            |
| `ledgerPort`   | `3001`                  | Port for the Ledger Service              |
| `token`        | _(empty)_               | Paste the JWT from the Login response    |
| `userId`       | _(empty)_               | Paste the user ID from the Login response|

### Auth flow

Insomnia does not support automatic post-request scripts. After running **Login**:

1. Copy `access_token` from the response.
2. Open the **Base Environment** and paste it into the `token` variable.
3. Copy `user.id` from the response and paste it into the `userId` variable.

---

## Idempotency

The POST `/transactions` requests include an `Idempotency-Key` header.

- In Postman, the value is `{{$guid}}` — a unique UUID generated per request.
- In Insomnia, replace the placeholder value with a unique string before each test run to avoid replaying a cached response.
