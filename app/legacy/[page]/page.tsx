// app/legacy/[page]/page.tsx
import { notFound } from "next/navigation"

const allowedPages = new Set([
  "admin_portal",
  "customer",
  "portal",
  "pro_portal",
  "reseller",
  "rider",
  "storefront",
])

export default function LegacyPage({ params }: { params: { page: string } }) {
  if (!allowedPages.has(params.page)) {
    notFound()
  }

  const src = `/legacy/${params.page}.html`

  return (
    <div className="min-h-screen bg-black">
      <iframe
        src={src}
        title={`Legacy ${params.page}`}
        className="w-full h-screen border-0"
      />
    </div>
  )
}
