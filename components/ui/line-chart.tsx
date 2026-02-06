import { cn } from "@/lib/utils"

type SeriesPoint = { label: string; value: number }

type LineChartProps = {
  data: SeriesPoint[]
  height?: number
  stroke?: string
  className?: string
}

export function LineChart({ data, height = 140, stroke = "#2563eb", className }: LineChartProps) {
  if (!data.length) {
    return <div className={cn("h-[140px] flex items-center justify-center text-xs text-gray-400", className)}>No data</div>
  }

  const max = Math.max(...data.map((d) => d.value), 1)
  const stepX = 100 / (data.length - 1 || 1)
  const points = data
    .map((d, i) => {
      const x = i * stepX
      const y = 100 - (d.value / max) * 100
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className={cn("w-full", className)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" height={height} className="w-full">
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          points={points}
        />
      </svg>
    </div>
  )
}
