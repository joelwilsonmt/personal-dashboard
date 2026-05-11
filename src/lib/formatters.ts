import { formatDistanceToNow, format } from 'date-fns'

export function formatCurrency(
  cents: number,
  currency = 'USD',
  opts: { showCents?: boolean; compact?: boolean } = {},
): string {
  const amount = cents / 100
  if (opts.compact && Math.abs(amount) >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: opts.showCents ? 2 : 0,
    maximumFractionDigits: opts.showCents ? 2 : 0,
  }).format(amount)
}

export function formatDelta(cents: number, currency = 'USD'): string {
  const prefix = cents >= 0 ? '+' : ''
  return `${prefix}${formatCurrency(cents, currency)}`
}

export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatAbsoluteDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  try {
    return format(new Date(date), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatResponseTime(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function centsToDisplay(cents: number): number {
  return cents / 100
}

export function displayToCents(value: number): number {
  return Math.round(value * 100)
}
