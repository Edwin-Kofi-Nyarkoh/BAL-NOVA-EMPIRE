import { StorefrontShell } from "@/components/storefront/storefront-shell"
import { prisma } from "@/lib/server/prisma"

export const dynamic = "force-dynamic"

async function getInitialProducts() {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        name: true,
        price: true,
        desc: true,
        brand: true,
        imageUrl: true
      }
    })
    return items.map((item) => ({
      ...item,
      desc: item.desc || undefined,
      brand: item.brand || undefined,
      imageUrl: item.imageUrl || undefined
    }))
  } catch {
    return []
  }
}

export default async function StorefrontPage() {
  const products = await getInitialProducts()
  return <StorefrontShell initialProducts={products} />
}
