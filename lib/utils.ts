import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  value: number,
  {
    currency = "GHS",
    showCurrency = false,
    ...options
  }: Intl.NumberFormatOptions & { currency?: string; showCurrency?: boolean } = {}
) {
  const formatOptions: Intl.NumberFormatOptions = showCurrency
    ? { style: "currency", currency, minimumFractionDigits: 2, ...options }
    : { style: "decimal", minimumFractionDigits: 2, ...options }

  return new Intl.NumberFormat(undefined, formatOptions).format(value)
}
