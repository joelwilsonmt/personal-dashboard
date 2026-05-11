import { useId } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { AmortizationRow } from '@/lib/mortgage'
import { formatCurrency } from '@/lib/formatters'

type Props = {
  schedule: AmortizationRow[]
  currentMonth: number
  height?: number
}

export function AmortizationChart({ schedule, currentMonth, height = 300 }: Props) {
  const id = useId()
  const chartData = schedule.map((r) => ({
    month: r.month,
    Interest: r.interest,
    Principal: r.principal,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`ig-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f87171" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#f87171" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id={`pg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#4ade80" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="month"
          tickFormatter={(v: number) => `Yr ${Math.ceil(v / 12)}`}
          tick={{ fontSize: 11, fill: 'oklch(0.708 0 0)' }}
          axisLine={false}
          tickLine={false}
          interval={Math.floor(schedule.length / 6)}
        />
        <YAxis
          tickFormatter={(v: number) => formatCurrency(v, 'USD', { compact: true })}
          tick={{ fontSize: 11, fill: 'oklch(0.708 0 0)' }}
          axisLine={false}
          tickLine={false}
          width={70}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'oklch(0.205 0 0)',
            border: '1px solid oklch(0.3 0 0)',
            borderRadius: '6px',
            fontSize: '12px',
          }}
          formatter={(value: number, name: string) => [
            formatCurrency(value, 'USD', { showCents: false }),
            name,
          ]}
          labelFormatter={(month: number) => `Month ${month} (Year ${Math.ceil(month / 12)})`}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          iconType="circle"
          iconSize={8}
        />
        <ReferenceLine
          x={currentMonth}
          stroke="oklch(0.708 0 0)"
          strokeDasharray="4 4"
          label={{ value: 'Today', position: 'top', fontSize: 11, fill: 'oklch(0.708 0 0)' }}
        />
        <Area
          type="monotone"
          dataKey="Interest"
          stroke="#f87171"
          strokeWidth={1.5}
          fill={`url(#ig-${id})`}
          stackId="a"
        />
        <Area
          type="monotone"
          dataKey="Principal"
          stroke="#4ade80"
          strokeWidth={1.5}
          fill={`url(#pg-${id})`}
          stackId="a"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
