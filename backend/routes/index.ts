import type { RouteHandler } from "../api/types"
import { authRoutes } from "./auth"
import { inventoryRoutes } from "./inventory"
import { financeRoutes } from "./finance"
import { analyticsRoutes } from "./analytics"

export const routes: Record<string, RouteHandler> = {
  ...authRoutes,
  ...inventoryRoutes,
  ...financeRoutes,
  ...analyticsRoutes
}
