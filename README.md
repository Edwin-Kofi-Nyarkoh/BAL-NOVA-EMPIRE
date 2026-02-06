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
