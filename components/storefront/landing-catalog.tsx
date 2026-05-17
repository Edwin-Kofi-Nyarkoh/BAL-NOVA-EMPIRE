"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ShoppingCart, Star } from "lucide-react"
import {
  addGuestCartItem,
  formatNovaCredits,
  getInternalReviewSummary,
  getProductSignal,
  readGuestCart,
  sortProductsForDiscovery,
  type CommerceProduct
} from "@/lib/commerce"

type LandingCatalogProps = {
  products: CommerceProduct[]
  catalogError: boolean
}

export function LandingCatalog({ products, catalogError }: LandingCatalogProps) {
  const [cartCount, setCartCount] = useState(0)
  const sortedProducts = useMemo(() => sortProductsForDiscovery(products), [products])

  useEffect(() => {
    const syncCount = () => {
      const items = readGuestCart()
      setCartCount(items.reduce((sum, item) => sum + item.qty, 0))
    }
    syncCount()
    window.addEventListener("guest-cart:updated", syncCount)
    return () => window.removeEventListener("guest-cart:updated", syncCount)
  }, [])

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Products available</p>
          <h2 className="mt-2 text-xl font-bold">Shop straight from the landing page</h2>
          <p className="mt-2 text-xs text-slate-400">
            Add to cart now. Login only kicks in when you proceed to checkout.
          </p>
        </div>
        <div className="text-right">
          <Link
            href="/storefront"
            className="text-xs font-semibold text-amber-300 hover:text-amber-200"
          >
            View all
          </Link>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] text-white">
            <ShoppingCart className="h-3.5 w-3.5 text-amber-300" />
            {cartCount} in guest cart
          </div>
        </div>
      </div>

      {catalogError ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-slate-400">
          Catalog is temporarily unavailable. Please check back soon.
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-slate-400">
          No products have been published yet.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {sortedProducts.map((product) => {
            const review = getInternalReviewSummary(product)
            return (
              <div
                key={product.id}
                className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4"
              >
                {product.imageUrl ? (
                  <div className="mb-3 h-28 w-full overflow-hidden rounded-xl bg-white/5">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{product.name}</p>
                    <p className="text-xs text-slate-400">{product.brand || "Bal Nova"}</p>
                  </div>
                  <span className="rounded-full bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-200">
                    {formatNovaCredits(product.price)}
                  </span>
                </div>
                {product.desc ? (
                  <p className="mt-2 text-[11px] text-slate-400">{product.desc}</p>
                ) : null}
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{getProductSignal(product)}</span>
                  <span>Stock base: {product.baseStock || 0}</span>
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-xs text-amber-200">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {review.rating}/5 internal rating
                    <span className="text-slate-400">({review.count} reviews)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{review.note}</p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => addGuestCartItem(product)}
                    className="flex-1 rounded-full bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-300"
                  >
                    Add to Cart
                  </button>
                  <Link
                    href="/storefront"
                    className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    Open Store
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
        Guest carts are preserved on this device until checkout. Checkout will ask you to log in before payment.
      </div>
    </div>
  )
}
