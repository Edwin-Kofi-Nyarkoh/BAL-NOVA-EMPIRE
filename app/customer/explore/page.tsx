// app/customer/explore/page.tsx
import { Card, CardContent } from "@/components/ui/card"

export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <header className="pt-4">
        <h1 className="text-2xl font-black text-mynavy dark:text-white">Explore</h1>
        <p className="text-sm text-gray-500">Browse the latest Empire services and partners.</p>
      </header>

      <Card className="bg-white dark:bg-mydark">
        <CardContent className="p-5">
          <p className="text-sm text-gray-500">No featured drops yet. Check back soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
