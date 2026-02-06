# Bal Nova - Project Documentation

## Overview
Bal Nova is a Next.js 16 app that delivers a multi-portal logistics/commerce experience:
- Admin command center (financial engine, dispatch tower, fleet command, QC firewall, customer data, etc.)
- Customer experience (shopping, cart, orders, chat, saved locations)
- Vendor, reseller, pro/service, and rider portals
- Authentication with NextAuth
- Data layer with Prisma + PostgreSQL (Neon)

## Tech Stack
- Next.js 16 (App Router)
- React 19
- Tailwind CSS
- NextAuth 4
- Prisma 7 + PostgreSQL (Neon compatible)

## Project Structure (high level)
- `app/` - Routes and pages (App Router)
- `components/` - Reusable UI and dashboard components
- `lib/` - Utilities and server helpers (auth, Prisma, crypto, API helpers)
- `prisma/` - Schema and Prisma config

## Environment Variables
Create `.env.local` (or `.env`) with:
```
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret
SETTINGS_ENCRYPTION_KEY=32_or_64_char_key
ADMIN_NOTIFY_EMAIL=admin@yourcompany.com
EMAIL_FROM="Bal Nova <no-reply@yourcompany.com>"
SMTP_HOST=smtp.yourcompany.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_SECURE=false
PAYSTACK_PUBLIC_KEY=your-paystack-public-key
PAYSTACK_SECRET_KEY=your-paystack-secret-key
```

Forgot password:
- Public pages: `/forgot-password`, `/reset-password`
- API endpoints: `POST /api/auth/forgot`, `POST /api/auth/reset`

Uploads:
- Endpoint: `POST /api/upload` (admin only, `multipart/form-data` with `file`)
- Files stored in `public/uploads` and returned as `/uploads/...`

Payments (Paystack Standard):
- `POST /api/payments/checkout` (auth required) -> `{ link, txRef }`
- `POST /api/payments/checkout-order` (auth required) -> `{ link, txRef }`
- Webhook: `POST /api/payments/webhook`
- Verify: `GET /api/payments/verify?reference=...`
- Callback page: `/payment/callback`
Webhook signature:
- Paystack sends `x-paystack-signature` (HMAC SHA512 of the raw body using `PAYSTACK_SECRET_KEY`).

Admin payments:
- Page: `/payments`
- API: `GET /api/payments`

Notes:
- `SETTINGS_ENCRYPTION_KEY` is used to encrypt/decrypt API keys in settings.
- `NEXTAUTH_SECRET` must be stable across restarts in production.

## Install and Run
```
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm dev
```

## Authentication and Roles
- Users are created via **System Config** (admin only).
- Roles: `admin` and `user`. Admin-only endpoints:
  - `/api/users`
  - `/api/finance/ledger`
  - `/api/finance/ledger/backfill`
  - `/api/orders/backfill-user`
  - `/api/admin/vendors`
  - `/api/admin/resellers`
  - `/api/admin/pros`

## Data Model (core)
- `User` with `UserSettings`, `Order`, `Cart`, `CartItem`
- `FinanceLedger` for revenue/escrow/adjustments
- `DebtProfile` for tax-safe engine metrics
- `VendorProfile`, `VendorStaff`, `VendorHub`
- `ResellerBrand`, `ResellerTeam`
- `ProPortfolio`, `ProTeam`
- `CartSnapshot`, `CartSnapshotItem`

## Key Admin Pages
- **Financial Engine**: `components/dashboard/financial-engine.tsx`
  - Range selector (7/30/90/all)
  - Revenue trend via `/api/analytics/trends`
  - Finance metrics via `/api/financial-metrics`
  - Debt profile via `/api/finance/debt`

- **Financial Cockpit**: `app/financial-cockpit/page.tsx`
  - Ledger rollups and latest orders

- **Dispatch Tower**: `components/dashboard/DispatchTower.tsx`
  - Uses `/api/orders?all=1`
  - Bay capacity/hot thresholds from `/api/settings`
  - Auto-Hot toggle and bay load meters

- **Fleet Command**: `app/fleet-command/page.tsx`
  - Live queue metrics from orders and audit logs

- **QC Firewall**: `app/qc-firewall/page.tsx`
  - Audit log table via `/api/audit`

- **Finance Ledger**: `app/finance-ledger/page.tsx`
  - Manual adjustments and CSV export

## Customer Experience
Main customer flow in `app/customer/page.tsx`:
- Shop / Service / Orders / Chats / Locations / Cart / Profile
- Cart uses server-side `/api/cart`
- Cart snapshots in `/api/cart/snapshots`

**Manage Cart view**: `app/customer/cart/page.tsx`
- Quantity +/- controls
- Save/load snapshots

## Data APIs (high level)
- Orders: `GET /api/orders` (user scoped), `GET /api/orders?all=1` (admin)
- Analytics trend: `GET /api/analytics/trends?range=7d|30d|90d|all`
- Finance ledger: `GET/POST /api/finance/ledger` (admin)
- Backfill ledger: `POST /api/finance/ledger/backfill` (admin)
- Backfill order owners: `POST /api/orders/backfill-user` (admin)
- Settings: `GET/PUT /api/settings`

## API Reference (condensed)
### Auth
- `GET /api/auth/*` - NextAuth routes.

### Users (Admin)
- `GET /api/users` - list users.
- `POST /api/users` - create user.

### Orders
- `GET /api/orders` - current user orders.
- `GET /api/orders?all=1` - admin only.
- `POST /api/orders` - create order.
- `POST /api/orders/backfill-user` - admin backfill userId.

### Finance
- `GET /api/finance/ledger` - list ledger entries (admin).
- `POST /api/finance/ledger` - create adjustment (admin).
- `PATCH /api/finance/ledger/[id]` - update entry (admin).
- `DELETE /api/finance/ledger/[id]` - delete entry (admin).
- `POST /api/finance/ledger/backfill` - build ledger from orders (admin).
- `GET /api/finance/debt` - read debt profile.
- `PUT /api/finance/debt` - update debt profile.

### Analytics
- `GET /api/analytics/trends?range=7d|30d|90d|all` - revenue trend.
- `GET /api/financial-metrics?range=7d|30d|90d|all` - KPI totals.

### Cart
- `GET /api/cart` - current user cart.
- `POST /api/cart` - add/update item.
- `DELETE /api/cart` - remove item.
- `GET /api/cart/snapshots` - list snapshots.
- `POST /api/cart/snapshots` - create snapshot.
- `GET /api/cart/snapshots/[id]` - get snapshot.
- `DELETE /api/cart/snapshots/[id]` - delete snapshot.

### Settings
- `GET /api/settings` - current user settings.
- `PUT /api/settings` - update settings.

### Admin Data
- `GET /api/admin/vendors` - vendor network feed (admin).
- `GET /api/admin/resellers` - reseller data (admin).
- `GET /api/admin/pros` - pro/service data (admin).

## Operational Notes
- After schema changes, always run:
  - `pnpm prisma generate`
  - `pnpm prisma db push` (or `pnpm prisma migrate dev`)

## Deployment Guide (baseline)
### Production Build
```
pnpm install
pnpm prisma generate
pnpm prisma db push
pnpm build
pnpm start
```

### Hosting Notes
- Ensure `NEXTAUTH_URL` matches the deployed domain.
- Set `NEXTAUTH_SECRET` and `DATABASE_URL` in the host environment.
- Use a stable `SETTINGS_ENCRYPTION_KEY` across all environments.

### Neon and Prisma 7
- Keep the Prisma config in `prisma.config.ts` aligned with your Neon connection.
- If you rotate database credentials, update `DATABASE_URL` and redeploy.

## Troubleshooting
- **Prisma model errors**: Run `pnpm prisma generate` after schema updates.
- **Missing admin data**: Ensure your account role is `admin`.
- **500s on APIs**: Check server logs and ensure DB is reachable.

---
If you want a deeper API reference or deployment guide, we can extend this documentation further.
