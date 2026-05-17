import { StorefrontShell } from "@/components/storefront/storefront-shell"
import { prisma } from "@/lib/server/prisma"

export const dynamic = "force-dynamic"

async function getInitialProducts() {
  try {
    const items = await prisma.inventoryItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            email: true,
            vendorProfile: {
              select: {
                name: true,
                initials: true,
                tier: true
              }
            },
            settings: {
              select: {
                region: true
              }
            },
            vendorHubs: {
              orderBy: { createdAt: "asc" },
              take: 1,
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      desc: item.desc || undefined,
      brand: item.brand || undefined,
      imageUrl: item.imageUrl || undefined,
      vendor: item.vendor
        ? {
            id: item.vendor.id,
            name: item.vendor.vendorProfile?.name || item.vendor.name || item.vendor.email,
            initials: item.vendor.vendorProfile?.initials || (item.vendor.name || item.vendor.email || "VN").slice(0, 2).toUpperCase(),
            tier: item.vendor.vendorProfile?.tier ?? 1,
            region: item.vendor.settings?.region || null,
            hubName: item.vendor.vendorHubs[0]?.name || null
          }
        : null
    }))
  } catch {
    return []
  }
}

export default async function LandingPage() {
  const products = await getInitialProducts()
  return <StorefrontShell initialProducts={products} />
}
