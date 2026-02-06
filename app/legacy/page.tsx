// app/legacy/page.tsx
import Link from "next/link"

const pages = [
  { label: "Admin Portal", href: "/legacy/admin_portal" },
  { label: "Customer", href: "/legacy/customer" },
  { label: "Vendor Portal", href: "/legacy/portal" },
  { label: "Pro Portal", href: "/legacy/pro_portal" },
  { label: "Reseller", href: "/legacy/reseller" },
  { label: "Rider", href: "/legacy/rider" },
  { label: "Storefront", href: "/legacy/storefront" },
]

export default function LegacyIndexPage() {
  return (
    <div className="min-h-screen bg-mydark text-white p-8">
      <h1 className="text-2xl font-black mb-4">Legacy Pages</h1>
      <p className="text-sm text-gray-400 mb-6">Direct embeds of the original BAL-NOVA-EMPIRE HTML pages.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {pages.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-colors"
          >
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
