# Bal Nova

Bal Nova is a multi-portal logistics and commerce platform built with Next.js, Prisma, and PostgreSQL.

## Quick Start
```
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm dev
```

## Environment
Create `.env.local` (or `.env`) with:
```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
SETTINGS_ENCRYPTION_KEY=32_or_64_char_key
```

## Documentation
- Project documentation: `DOCUMENTATION.md`
- User manual: `USER_MANUAL.md`
- Admin training: `ADMIN_TRAINING.md`

## Hosting (Vercel + Render)

### Vercel (Web App)
1. Import the repo in Vercel.
2. Root Directory: `BAL-NOVA`
3. Build Command: `pnpm build`

Env vars on Vercel:
```
NEXTAUTH_URL=https://<your-vercel-app>.vercel.app
NEXTAUTH_SECRET=your-secret
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
SETTINGS_ENCRYPTION_KEY=32_or_64_char_key
SERVICE_CLIENT_KEY=change-me-client-key
BACKEND_GATEWAY_URL=https://<your-gateway>.onrender.com
NEXT_PUBLIC_API_BASE_URL=https://<your-gateway>.onrender.com
NEXT_LEGACY_API_BASE=https://<your-vercel-app>.vercel.app
```

### Render (Backend)
Create two Render Web Services from the same repo.

Gateway service:
- Root Directory: `BAL-NOVA`
- Build Command: `pnpm install`
- Start Command: `pnpm backend:gateway`

Env vars:
```
API_SERVICE_URL=https://<your-api>.onrender.com
SERVICE_CLIENT_KEY=change-me-client-key
INTERNAL_SERVICE_KEY=change-me-internal-key
NEXT_LEGACY_API_BASE=https://<your-vercel-app>.vercel.app
```

API service:
- Root Directory: `BAL-NOVA`
- Build Command: `pnpm install`
- Start Command: `pnpm backend:api`

Env vars:
```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NEXTAUTH_SECRET=your-secret
INTERNAL_SERVICE_KEY=change-me-internal-key
```

### Mobile (React Native)
Point the mobile app base URL to:
```
https://<your-gateway>.onrender.com
```
