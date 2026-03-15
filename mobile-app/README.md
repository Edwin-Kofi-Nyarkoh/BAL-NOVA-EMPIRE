# BAL Mobile App (React Native)

This app is separate from Next.js and talks to the gateway only.

## Run

1. Install dependencies:

```bash
pnpm --dir mobile-app install
```

2. Start Expo:

```bash
pnpm --dir mobile-app start
```

## Environment

Set these in `mobile-app/.env`:

```bash
EXPO_PUBLIC_GATEWAY_URL=http://localhost:8080
EXPO_PUBLIC_SERVICE_CLIENT_KEY=change-me-client-key
```

All API calls go through:
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/inventory`
- `GET /api/finance/summary`
- `GET /api/analytics/overview`
