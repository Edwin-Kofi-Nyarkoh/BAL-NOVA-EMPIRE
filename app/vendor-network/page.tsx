// app/vendor-network/page.tsx
import { AdminShell } from "@/components/dashboard/admin-shell"
import { VendorGrid } from "@/components/dashboard/VendorGrid"

export default function VendorNetworkPage() {
  return (
    <AdminShell title="Vendor Network" subtitle="Active partners and revenue performance">
      <VendorGrid />
    </AdminShell>
  )
}
