import { useId } from 'react'
import { useTheme } from 'next-themes'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { DeviceMetric } from '@shared/types'

type Props = {
  metrics: DeviceMetric[]
  height?: number
}

export function DeviceMetricsChart({ metrics, height = 160 }: Props) {
  const id = useId()
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme !== 'light'
  const mutedFg = dark ? 'oklch(0.708 0 0)' : 'oklch(0.556 0 0)'
  const gridStroke = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const tooltipBg = dark ? 'oklch(0.205 0 0)' : 'oklch(0.985 0 0)'
  const tooltipBorder = dark ? 'oklch(0.3 0 0)' : 'oklch(0.922 0 0)'

  const data = [...metrics]
    .reverse()
    .map((m) => ({
      time: new Date(m.recorded_at).getTime(),
      CPU: Math.round(m.cpu),
      RAM: Math.round(m.ram),
      Disk: Math.round(m.disk),
    }))

  if (data.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-8">No history yet</p>
    )
  }

  return (
    <div id={id}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="time"
            tickFormatter={(v: number) => {
              const d = new Date(v)
              return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
            }}
            tick={{ fontSize: 10, fill: mutedFg }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 10, fill: mutedFg }}
            axisLine={false}
            tickLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: '6px',
              fontSize: '12px',
            }}
            formatter={(v: number, name: string) => [`${v}%`, name]}
            labelFormatter={(v: number) => new Date(v).toLocaleTimeString()}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
            iconType="plainline"
            iconSize={16}
          />
          <Line type="monotone" dataKey="CPU" stroke="#6366f1" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="RAM" stroke="#f59e0b" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="Disk" stroke="#10b981" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
