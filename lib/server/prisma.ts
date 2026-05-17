import "dotenv/config"
import { PrismaClient } from "../../generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"

const { Pool } = require("pg") as { Pool: new (config: Record<string, unknown>) => any }

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaPool?: any }

const pool =
  globalForPrisma.prismaPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000
  })

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ["error"]
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaPool = pool
}
