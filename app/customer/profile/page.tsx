// app/customer/profile/page.tsx
import { Card, CardContent } from "@/components/ui/card"

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <header className="pt-4">
        <h1 className="text-2xl font-black text-mynavy dark:text-white">Profile</h1>
        <p className="text-sm text-gray-500">Manage your account and preferences.</p>
      </header>

      <Card className="bg-white dark:bg-mydark">
        <CardContent className="p-5">
          <p className="text-sm text-gray-500">Profile setup coming online soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
