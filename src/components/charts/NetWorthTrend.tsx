import { useId } from 'react'
import { useTheme } from 'next-themes'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { NetWorthPoint } from '@shared/types'
import { formatCurrency } from '@/lib/formatters'
import { format, parseISO } from 'date-fns'

type Props = {
  data: NetWorthPoint[]
  height?: number
}

function formatMonthLabel(iso: string) {
  try {
    return format(parseISO(iso), 'MMM')
  } catch {
    return iso
  }
}

export function NetWorthTrend({ data, height = 200 }: Props) {
  const id = useId()
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme !== 'light'
  const mutedFg = dark ? 'oklch(0.708 0 0)' : 'oklch(0.556 0 0)'
  const gridStroke = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const tooltipBg = dark ? 'oklch(0.205 0 0)' : 'oklch(0.985 0 0)'
  const tooltipBorder = dark ? 'oklch(0.3 0 0)' : 'oklch(0.922 0 0)'

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data yet
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`nwg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
        <XAxis
          dataKey="month"
          tickFormatter={formatMonthLabel}
          tick={{ fontSize: 11, fill: mutedFg }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v, 'USD', { compact: true })}
          tick={{ fontSize: 11, fill: mutedFg }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: '6px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [formatCurrency(value, 'USD', { showCents: false }), 'Net Worth']}
          labelFormatter={(label: string) => {
            try {
              return format(parseISO(label), 'MMMM yyyy')
            } catch {
              return label
            }
          }}
        />
        <Area
          type="monotone"
          dataKey="net_worth_cents"
          stroke="#6366f1"
          strokeWidth={2}
          fill={`url(#nwg-${id})`}
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
