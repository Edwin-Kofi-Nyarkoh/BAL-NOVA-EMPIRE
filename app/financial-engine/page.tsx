// app/financial-engine/page.tsx
import { AdminShell } from "@/components/dashboard/admin-shell"
import { FinancialEngine } from "@/components/dashboard/financial-engine"

export default function FinancialEnginePage() {
  return (
    <AdminShell title="Financial Engine" subtitle="Revenue, tax vault, and compliance protocol">
      <FinancialEngine />
    </AdminShell>
  )
}
