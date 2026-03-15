import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type MetricCardProps = {
  label: string
  value: string | number
  caption?: string
  tone?: "default" | "success" | "warning"
  className?: string
}

export function MetricCard({ label, value, caption, tone = "default", className }: MetricCardProps) {
  const toneClass =
    tone === "success"
      ? "text-green-600 dark:text-green-400"
      : tone === "warning"
        ? "text-myamber"
        : "text-mynavy dark:text-white"

  return (
    <Card className={cn("bg-white dark:bg-mydark", className)}>
      <CardContent className="p-6">
        <p className="text-xs text-gray-500 uppercase">{label}</p>
        <p className={cn("text-2xl font-bold", toneClass)}>{value}</p>
        {caption ? <p className="text-xs text-gray-400 mt-2">{caption}</p> : null}
      </CardContent>
    </Card>
  )
}
