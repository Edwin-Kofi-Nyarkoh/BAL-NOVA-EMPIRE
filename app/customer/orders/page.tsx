// app/customer/orders/page.tsx
import { Card, CardContent } from "@/components/ui/card"

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <header className="pt-4">
        <h1 className="text-2xl font-black text-mynavy dark:text-white">Orders</h1>
        <p className="text-sm text-gray-500">Track active deliveries and past purchases.</p>
      </header>

      <Card className="bg-white dark:bg-mydark">
        <CardContent className="p-5">
          <p className="text-sm text-gray-500">You have no active orders yet.</p>
        </CardContent>
      </Card>
    </div>
  )
}
