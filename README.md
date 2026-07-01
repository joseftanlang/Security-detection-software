# Untye Test API

Untye Test API is an Express-based service for testing a Semaphore-style identity flow. It creates identities, adds them to groups, issues Merkle proofs, and verifies Semaphore proofs. The code here is still a testing/simulation setup rather than a blockchain-backed deployment.

## What This Repo Contains

- `src/` is the main API server.
- `demo/` is a Docker Compose stack that runs the API, a policy checker, an init service, and a browser UI.
- `forms/` is a separate Docker Compose stack for the forms integration path.
- `custom_script.html` is a small client-side proof verification helper.
- `python_testing/` contains a lightweight Python test script.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env` and fill in the values you need. At minimum, set `ADMIN_TOKEN` if you plan to call admin endpoints.

### 3. Start the API

```bash
npm run dev
```

The API listens on `PORT`, which defaults to `2026`.

### 4. Check it is up

```bash
curl "http://localhost:2026/api/echo?msg=ok"
```

## Local Usage Notes

The server code uses ES module syntax. If your local Node setup does not already treat `.js` files as modules, enable ESM support for this package before running `npm start` or `npm run dev`.

The root server also serves a small login page at `GET /?formId=...` and a failure page at `/failure`.

## Demo Stack

The demo stack is the easiest way to see the full flow end to end:

1. A user signs in with an OpenID JWT.
2. The UI creates a temporary Semaphore identity.
3. The API adds the commitment to a group through `/api/addtogroup`.
4. The init service creates the demo group and advances batches.
5. The UI refreshes the Merkle proof and generates a Semaphore proof when the identity becomes active.

Run it from the repository root:

```bash
docker compose -f demo/demo-compose.yml up --build
```

Useful demo URLs:

- UI: `http://localhost:8080`
- API health check: `http://localhost:2026/api/echo?msg=ok`

The demo stack includes:

- `api`: the main Untye API
- `checker`: policy endpoint used by `CHECKER_ENDPOINT`
- `init`: bootstrap service that creates the demo group
- `ui`: browser dashboard for the identity flow

## Forms Stack

The `forms/` folder is a separate deployment path that reuses the API server and connects to the `formbricks_default` Docker network.

Run it from the repository root:

```bash
docker compose -f forms/forms-compose.yml up --build
```

## Environment Variables

### Core API

- `PORT`: server port, default `2026`.
- `ADMIN_TOKEN`: required for admin-only endpoints.
- `BOOTSTRAP_GROUPS`: number of groups to auto-create at startup.
- `OPENID_IDENTIFIER_CLAIM`: JWT claim used as the permanent user identifier, default `sub`.
- `CHECKER_ENDPOINT`: optional policy service used by `/api/addtogroup`.
- `MESSAGE_VAL` and `SCOPE_VAL`: fixed values used by proof validation when no custom validator is configured.
- `VALIDATE_MESSAGESCOPE_ENDPOINT`: optional external validation service for message/scope checks.
- `DEBUG_IGNORE_JWT`: bypasses JWT checking for local debugging when set to a truthy value.
- `ENFORCE_SAME_SITE_REQUESTS`: blocks cross-site requests when enabled outside development.
- `FORMS_LINK`: redirect base used by the login page after a proof is generated.

### Demo Services

- `API_BASE_URL`: internal URL used by the demo UI and init service.
- `ALLOWED_GROUP`: group name allowed by the demo checker, default `demo-users`.
- `MAX_IDENTITIES_PER_USER`: how many commitments the checker allows per user.
- `DEMO_GROUP_NAME`: group created by the init service.
- `BATCH_INTERVAL_SECONDS`: batch timing used by the demo bootstrap flow.

## API Overview

### Public endpoints

- `GET /api/newidentity`: create a fresh Semaphore identity.
- `POST /api/recoveridentity`: rebuild an identity from a private key.
- `POST /api/addtogroup`: add a commitment to a group for the current user.
- `GET /api/getmerkleproof`: fetch the Merkle proof for a commitment.
- `POST /api/generateproof`: generate a Semaphore proof.
- `GET /api/grouproot`: fetch the current Merkle root for a group.
- `POST /api/verifymessagescope`: validate message/scope rules without checking a proof.
- `POST /api/verifyproof`: verify a Semaphore proof.
- `GET /api/echo` and `POST /api/echo`: simple health-check and echo endpoints.

### Admin endpoints

- `GET /api/newgroup`: create a new group.
- `GET /api/nextbatch`: promote the next batch to the current batch.
- `GET /api/getgroupidx`: look up a group index by group name.
- `GET /api/getgroupidxwithgid`: look up a group index by group ID.

## Typical Request Flow

1. Create or recover an identity.
2. Add the commitment to a group with `/api/addtogroup`.
3. Wait until the admin advances the batch with `/api/nextbatch`.
4. Fetch the Merkle proof with `/api/getmerkleproof`.
5. Generate a proof with `/api/generateproof`.
6. Verify it with `/api/verifyproof`.

The batch delay is intentional: identities are added to the next batch first, so they are not immediately verifiable until the batch is promoted.

## Integration Notes

- `CHECKER_ENDPOINT` is a policy hook. The API sends `{ groupName, commitment, identifier }` and expects `{ success: true }` or `{ success: false, error: "..." }`.
- `VALIDATE_MESSAGESCOPE_ENDPOINT` follows the same pattern for message/scope validation.
- `OPENID_IDENTIFIER_CLAIM` should match the claim name in your JWTs if you do not want to use the default `sub` claim.

## Limitations

- The backend is still in-memory/testing oriented.
- Admin authentication is token-based and should be hardened before production use.
- JWT handling currently relies on claim extraction rather than full signature verification.


## Liscence
This is the liscence of this project on 2026 in Singapore.