import { prisma } from "@/lib/server/prisma"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params

  const vendor = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      vendorProfile: {
        select: {
          name: true,
          initials: true,
          tier: true,
          bio: true,
          contactPhone: true,
          contactEmail: true,
          businessAddress: true
        }
      },
      settings: {
        select: {
          region: true
        }
      },
      vendorHubs: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true
        }
      },
      vendorReviewsReceived: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    }
  })

  if (!vendor || !vendor.vendorProfile) {
    return Response.json({ error: "Vendor not found" }, { status: 404 })
  }

  const productCount = await prisma.inventoryItem.count({ where: { vendorId: id } })
  const avgRating =
    vendor.vendorReviewsReceived.length > 0
      ? vendor.vendorReviewsReceived.reduce((sum, review) => sum + review.rating, 0) / vendor.vendorReviewsReceived.length
      : 0

  return Response.json({
    vendor: {
      id: vendor.id,
      name: vendor.vendorProfile.name || vendor.name || vendor.email,
      initials: vendor.vendorProfile.initials || (vendor.name || vendor.email || "VN").slice(0, 2).toUpperCase(),
      tier: vendor.vendorProfile.tier ?? 1,
      bio: vendor.vendorProfile.bio || null,
      contactPhone: vendor.vendorProfile.contactPhone || null,
      contactEmail: vendor.vendorProfile.contactEmail || null,
      businessAddress: vendor.vendorProfile.businessAddress || null,
      region: vendor.settings?.region || null,
      hubs: vendor.vendorHubs,
      productCount,
      reviewCount: vendor.vendorReviewsReceived.length,
      averageRating: Number(avgRating.toFixed(1)),
      reviews: vendor.vendorReviewsReceived.map((review) => ({
        id: review.id,
        rating: review.rating,
        title: review.title || null,
        comment: review.comment || null,
        createdAt: review.createdAt,
        reviewerName: review.user.name || review.user.email || "Customer"
      }))
    }
  })
}
