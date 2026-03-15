// components/dashboard/stat-card.tsx
import { Card, CardContent } from "@/components/ui/card"
import { cn, formatCurrency } from "@/lib/utils"

type StatCardProps = {
  label: string
  value: string | number
  currency?: string
  showCurrency?: boolean
  subLabel?: string
  accentClassName?: string
  labelClassName?: string
  valueClassName?: string
  currencyClassName?: string
  subLabelClassName?: string
  icon?: React.ReactNode
  className?: string
}

export function StatCard({
  label,
  value,
  currency = "GHS",
  showCurrency = true,
  subLabel,
  accentClassName,
  labelClassName,
  valueClassName,
  currencyClassName,
  subLabelClassName,
  icon,
  className,
}: StatCardProps) {
  const formattedValue =
    typeof value === "number"
      ? formatCurrency(value)
      : value

  return (
    <Card className={cn("border-l-4 bg-white dark:bg-gray-800 shadow-sm", accentClassName, className)}>
      <CardContent className="p-5">
        <div className={cn("text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1", labelClassName)}>
          {icon} {label}
        </div>
        <div className={cn("text-2xl font-black text-mynavy dark:text-white mt-1", valueClassName)}>
          {showCurrency ? <span className={cn("currency-symbol", currencyClassName)}>{currency}</span> : null}
          {formattedValue}
        </div>
        {subLabel ? (
          <div className={cn("text-[9px] text-gray-500 mt-1", subLabelClassName)}>{subLabel}</div>
        ) : null}
      </CardContent>
    </Card>
  )
}
