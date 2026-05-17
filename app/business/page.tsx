import Link from "next/link"
import { prisma } from "@/lib/server/prisma"
import { LandingCatalog } from "@/components/storefront/landing-catalog"

export const dynamic = "force-dynamic"

export default async function BusinessPage() {
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

        <header className="relative z-10 mx-auto flex max-w-[1440px] items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-4">
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
              <p className="text-xs text-slate-300">Business Operations Link</p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              Storefront
            </Link>
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
                  href="/"
                  className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-900 shadow-lg hover:bg-slate-100"
                >
                  Browse Storefront
                </Link>
                <Link
                  href="/partner"
                  className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Business Partnerships
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-400">
                <span className="rounded-full border border-white/10 px-3 py-1">Live inventory</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Finance ledger</span>
                <span className="rounded-full border border-white/10 px-3 py-1">Dispatch automation</span>
              </div>
            </div>

            <LandingCatalog products={products} catalogError={catalogError} />
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
                Clear, people-first partner onboarding for vendors, riders, resellers, and artisans.
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
              <Link
                href="/partner"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Why partner with us
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
