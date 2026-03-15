import { PrismaClient } from "../../generated/prisma"
import { PrismaPg } from "@prisma/adapter-pg"
import type { RouteHandler } from "../api/types"
import { json } from "../api/utils"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  log: ["error"]
})

const getInventory: RouteHandler = async ({ res }) => {
  try {
    const items = await prisma.inventoryItem.findMany({ orderBy: { createdAt: "desc" } })
    return json(res, 200, { items })
  } catch {
    return json(res, 500, { error: "Unable to load inventory." })
  }
}

export const inventoryRoutes: Record<string, RouteHandler> = {
  "GET /inventory": getInventory
}
