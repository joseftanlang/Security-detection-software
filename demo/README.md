# Untye User Demo Stack

This compose stack runs a user-focused demo around your existing API flow:

1. Login with OpenID JWT (`sub` is treated as permanent identity)
2. `newidentity`
3. `addtogroup` with bearer token
4. Admin init service calls `nextbatch` periodically
5. User refreshes status via `getmerkleproof`
6. User generates proof via `generateproof`

## Services

- `api`: existing Untye API with hardcoded checker endpoint
- `checker`: hardcoded policy endpoint used by `CHECKER_ENDPOINT`
- `init`: hardcoded admin bootstrap loop creating `demo-users` group and running `nextbatch`
- `ui`: user dashboard for temporary identities

## Run

From the `demo` folder:

```bash
docker compose -f demo-compose.yml up --build
```

Open:

- UI: http://localhost:8080
- API: http://localhost:2026/api/echo?msg=ok

## Notes

- The UI supports pasted OpenID JWTs (for example from VoidAuth) and also has a demo-token button for local testing.
- Identity status logic:
  - `pending`: in next batch, not active yet
  - `active`: `getmerkleproof` succeeds
  - `expired`: previously active, but no longer in current batch
- Group name is `demo-users` by default across checker/init/UI.
