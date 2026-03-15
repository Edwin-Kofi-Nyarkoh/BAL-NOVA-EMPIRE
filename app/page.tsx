import Link from "next/link"
import { prisma } from "@/lib/server/prisma"

export const revalidate = 60

export default async function LandingPage() {
  let products: Array<{
    id: string
    name: string
    price: number
    brand: string | null
    imageUrl?: string | null
    desc?: string | null
    baseStock: number
    updatedAt: Date
  }> = []
  let catalogError = false

  try {
    products = await prisma.inventoryItem.findMany({
      orderBy: { createdAt: "desc" },
      take: 8
    })
  } catch {
    catalogError = true
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-40 -left-24 h-96 w-96 rounded-full bg-blue-600/30 blur-[140px]" />
          <div className="absolute top-10 right-0 h-[420px] w-[420px] rounded-full bg-amber-500/25 blur-[160px]" />
          <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-cyan-400/20 blur-[140px]" />
        </div>

        <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-12">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-[#0B2340] flex items-center justify-center shadow-xl">
              <img
                src="/empire-shield.svg"
                alt="Bal Nova Shield"
                className="h-12 w-12 md:h-16 md:w-16"
                decoding="async"
                fetchPriority="high"
              />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight">Bal Nova</p>
              <p className="text-xs text-slate-300">Logistics + Commerce OS</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg hover:bg-amber-300"
            >
              Sign Up
            </Link>
          </div>
        </header>

        <section className="relative z-10 px-6 pb-14 pt-8 md:px-12 md:pt-12">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/90">
                Unified operations
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl lg:text-6xl">
                Command your supply chain.
                <span className="block text-amber-300">Sell, dispatch, and scale.</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm text-slate-300 md:text-base">
                Bal Nova connects customers, vendors, riders, resellers, and service professionals in one
                operational cockpit. Every product, order, and dispatch is visible in real time.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/storefront"
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg hover:bg-slate-100"
                >
                  Browse Storefront
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Create Account
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 px-3 py-1">Live inventory</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Finance ledger</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Dispatch automation</span>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Products available</p>
                  <h2 className="mt-2 text-xl font-bold">Live catalog snapshot</h2>
                </div>
                <Link
                  href="/storefront"
                  className="text-xs font-semibold text-amber-300 hover:text-amber-200"
                >
                  View all
                </Link>
              </div>

              {catalogError ? (
                <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-slate-400">
                  Catalog is temporarily unavailable. Please check back soon.
                </div>
              ) : products.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-slate-400">
                  No products have been published yet.
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {products.map((product) => (
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
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{product.name}</p>
                          {product.brand ? (
                            <p className="text-xs text-slate-400">{product.brand}</p>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-amber-400/15 px-2 py-1 text-xs font-semibold text-amber-200">
                          GHS {product.price.toFixed(2)}
                        </span>
                      </div>
                      {product.desc ? (
                        <p className="mt-2 text-[11px] text-slate-400">{product.desc}</p>
                      ) : null}
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                        <span>Stock base: {product.baseStock}</span>
                        <span>Updated {product.updatedAt.toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="px-6 pb-16 md:px-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: "Financial Engine",
              description: "Track revenue, escrow, tax-safe metrics, and ledger adjustments in one view."
            },
            {
              title: "Dispatch Tower",
              description: "Monitor bay utilization, route plans, and live operational loads."
            },
            {
              title: "Partner Network",
              description: "Coordinate vendors, resellers, riders, and service pros with approvals."
            }
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300"
            >
              <h3 className="text-base font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-xs text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/80">Join as a partner</p>
              <h3 className="mt-3 text-xl font-bold text-white md:text-2xl">Apply to the Bal Nova network</h3>
              <p className="mt-2 text-sm text-slate-400">
                Vendor, rider, reseller, and pro applications require admin approval before activation.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Vendor", role: "vendor" },
                { label: "Rider", role: "rider" },
                { label: "Reseller", role: "reseller" },
                { label: "Pro", role: "pro" }
              ].map((item) => (
                <Link
                  key={item.role}
                  href={`/signup?role=${item.role}`}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
                >
                  Join as {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
