import { createFileRoute, Link } from '@tanstack/react-router'
import { TrendingUp, Home, Monitor, Globe, ArrowUpRight } from 'lucide-react'
import { useAccounts, useNetWorthTrend } from '@/hooks/useAccounts'
import { useSites } from '@/hooks/useSites'
import { useDevices } from '@/hooks/useDevices'
import { useMortgages } from '@/hooks/useMortgage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NetWorthTrend } from '@/components/charts/NetWorthTrend'
import { formatCurrency, formatRelativeTime } from '@/lib/formatters'
import type { Account, Site, Device, SiteStatus, DeviceStatus } from '@shared/types'
import { differenceInSeconds } from 'date-fns'

export const Route = createFileRoute('/')({
  component: Overview,
})

function computeNetWorth(accounts: Account[]): number {
  return accounts.reduce((sum, a) => {
    const b = a.latest_balance_cents ?? 0
    return sum + (a.kind === 'asset' ? b : -b)
  }, 0)
}

function siteStatus(site: Site): SiteStatus {
  if (!site.latest_check) return 'unknown'
  if (!site.latest_check.ok) return 'down'
  if (site.alert_on_slow_ms && (site.latest_check.response_ms ?? 0) > site.alert_on_slow_ms)
    return 'slow'
  return 'up'
}

function deviceStatus(device: Device): DeviceStatus {
  if (!device.last_seen_at) return 'unknown'
  const secs = differenceInSeconds(new Date(), new Date(device.last_seen_at))
  if (secs < 60) return 'online'
  if (secs < 3600) return 'recent'
  return 'offline'
}

function StatusDot({ status }: { status: SiteStatus | DeviceStatus }) {
  const colorMap: Record<string, string> = {
    up: 'bg-green-500',
    online: 'bg-green-500',
    slow: 'bg-amber-500',
    recent: 'bg-amber-500',
    down: 'bg-red-500',
    offline: 'bg-red-500',
    unknown: 'bg-zinc-500',
  }
  return (
    <span
      className={`inline-block size-2 rounded-full ${colorMap[status] ?? 'bg-zinc-500'}`}
      aria-label={status}
    />
  )
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  to,
  loading,
  error,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  to: string
  loading?: boolean
  error?: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon size={16} className="text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : error ? (
          <p className="text-sm text-destructive">Failed to load</p>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </>
        )}
        <Link
          to={to}
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View details <ArrowUpRight size={12} />
        </Link>
      </CardContent>
    </Card>
  )
}

function Overview() {
  const accountsQ = useAccounts()
  const trendQ = useNetWorthTrend(12)
  const sitesQ = useSites()
  const devicesQ = useDevices()
  const mortgagesQ = useMortgages()

  const accounts = accountsQ.data ?? []
  const sites = sitesQ.data ?? []
  const devices = devicesQ.data ?? []
  const mortgages = mortgagesQ.data ?? []

  const netWorth = computeNetWorth(accounts)
  const sitesUp = sites.filter((s) => siteStatus(s) === 'up').length
  const devicesOnline = devices.filter((d) => deviceStatus(d) === 'online').length
  const mortgage = mortgages[0]
  const mortgageAccount = accounts.find((a) => a.id === mortgage?.account_id)
  const paidOff =
    mortgage && mortgageAccount && mortgageAccount.latest_balance_cents != null
      ? Math.max(
          0,
          Math.round(
            ((mortgage.original_principal_cents - mortgageAccount.latest_balance_cents) /
              mortgage.original_principal_cents) *
              100,
          ),
        )
      : null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your personal dashboard</p>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Net Worth"
          value={formatCurrency(netWorth)}
          icon={TrendingUp}
          to="/net-worth"
          loading={accountsQ.isLoading}
          error={accountsQ.isError}
        />
        <MetricCard
          title="Mortgage"
          value={paidOff != null ? `${paidOff}% paid` : '—'}
          sub={
            mortgageAccount?.latest_balance_cents != null
              ? formatCurrency(mortgageAccount.latest_balance_cents) + ' remaining'
              : undefined
          }
          icon={Home}
          to="/mortgage"
          loading={mortgagesQ.isLoading}
          error={mortgagesQ.isError}
        />
        <MetricCard
          title="Devices Online"
          value={`${devicesOnline} / ${devices.length}`}
          icon={Monitor}
          to="/devices"
          loading={devicesQ.isLoading}
          error={devicesQ.isError}
        />
        <MetricCard
          title="Sites Up"
          value={`${sitesUp} / ${sites.length}`}
          icon={Globe}
          to="/sites"
          loading={sitesQ.isLoading}
          error={sitesQ.isError}
        />
      </div>

      {/* Net worth trend chart */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">12-Month Net Worth Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : trendQ.isError ? (
            <p className="h-48 flex items-center justify-center text-sm text-destructive">Failed to load trend data</p>
          ) : (
            <NetWorthTrend data={trendQ.data ?? []} height={192} />
          )}
        </CardContent>
      </Card>

      {/* Recent activity — accounts sorted by last updated */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Recent Account Updates</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {accountsQ.isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No accounts yet.{' '}
              <Link to="/net-worth" className="text-foreground underline underline-offset-2">
                Add your first account
              </Link>
            </div>
          ) : (
            <ul>
              {accounts
                .filter((a) => a.latest_balance_at != null)
                .sort(
                  (a, b) =>
                    new Date(b.latest_balance_at!).getTime() -
                    new Date(a.latest_balance_at!).getTime(),
                )
                .slice(0, 8)
                .map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.institution || a.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium tabular-nums">
                        {a.latest_balance_cents != null
                          ? formatCurrency(a.latest_balance_cents)
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(a.latest_balance_at)}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

