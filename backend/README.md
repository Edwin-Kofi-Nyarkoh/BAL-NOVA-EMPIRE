# Backend (Node Microservices)

The backend is TypeScript-based and split into:
- `backend/gateway/server.ts` (API gateway)
- `backend/api/server.ts` (core DB-backed API)

## Env Vars
Set these in your environment (or `.env`):
```bash
SERVICE_CLIENT_KEY=change-me-client-key
INTERNAL_SERVICE_KEY=change-me-internal-key
API_SERVICE_URL=http://localhost:8101
NEXT_LEGACY_API_BASE=http://localhost:3000
```

API service only:
```bash
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NEXTAUTH_SECRET=your-secret
```

## Run API Service
```bash
pnpm backend:api
```

## Run Gateway
```bash
pnpm backend:gateway
```

## Security Model
- Next API routes call gateway with `x-service-client-key`.
- Gateway validates `SERVICE_CLIENT_KEY` and applies per-service rate limiting.
 - Gateway forwards to API with `x-internal-key`.
 - API only serves protected endpoints when `x-internal-key` matches `INTERNAL_SERVICE_KEY`.

## Ports
Both services honor `PORT` (recommended for hosts like Render). They also accept:
- `GATEWAY_PORT` (gateway, default `8080`)
- `API_SERVICE_PORT` (api, default `8101`)

Client apps (web/mobile) should call the gateway, not the internal API directly.
