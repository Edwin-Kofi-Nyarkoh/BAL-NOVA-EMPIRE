// app/dispatch-tower/page.tsx
import { AdminShell } from "@/components/dashboard/admin-shell"
import { DispatchTower } from "@/components/dashboard/DispatchTower"

export default function DispatchTowerPage() {
  return (
    <AdminShell title="Dispatch Tower" subtitle="Live ops, routing, and fleet activity">
      <DispatchTower />
    </AdminShell>
  )
}
