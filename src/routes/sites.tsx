import { createFileRoute } from '@tanstack/react-router'
import { useState, useId } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Globe, Plus, Pause, Play, Pencil, Trash2, Clock, BarChart3, ShieldCheck } from 'lucide-react'
import {
  useSites,
  useCreateSite,
  useUpdateSite,
  useDeleteSite,
  useSiteChecks,
} from '@/hooks/useSites'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatRelativeTime, formatResponseTime, formatAbsoluteDate } from '@/lib/formatters'
import type { Site, SiteCheck, SiteStatus } from '@shared/types'

export const Route = createFileRoute('/sites')({
  component: SitesPage,
})

function getSiteStatus(site: Site): SiteStatus {
  if (!site.latest_check) return 'unknown'
  if (!site.latest_check.ok) return 'down'
  if (
    site.alert_on_slow_ms &&
    (site.latest_check.response_ms ?? 0) > site.alert_on_slow_ms
  )
    return 'slow'
  return 'up'
}

function StatusPill({ status }: { status: SiteStatus }) {
  const map: Record<SiteStatus, { label: string; class: string }> = {
    up: { label: 'Up', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
    slow: { label: 'Slow', class: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    down: { label: 'Down', class: 'bg-red-500/20 text-red-400 border-red-500/30' },
    unknown: { label: 'Unknown', class: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
  }
  const { label, class: cls } = map[status]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

function UptimeBar({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex items-center gap-2">
      <Progress
        value={pct}
        className="h-1.5 w-16"
      />
      <span className="text-xs tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
    </div>
  )
}

type SiteForm = {
  name: string
  url: string
  check_interval_seconds: string
  alert_on_slow_ms: string
  alert_on_down: boolean
}

function SiteFormDialog({
  initial,
  onSave,
  onClose,
  loading,
  title,
}: {
  initial?: Partial<SiteForm>
  onSave: (data: SiteForm) => void
  onClose: () => void
  loading: boolean
  title: string
}) {
  const [form, setForm] = useState<SiteForm>({
    name: initial?.name ?? '',
    url: initial?.url ?? '',
    check_interval_seconds: initial?.check_interval_seconds ?? '300',
    alert_on_slow_ms: initial?.alert_on_slow_ms ?? '',
    alert_on_down: initial?.alert_on_down ?? true,
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSave(form)
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="siteName">Name</Label>
            <Input
              id="siteName"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="My Website"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="siteUrl">URL</Label>
            <Input
              id="siteUrl"
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://example.com"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="interval">Check interval (sec)</Label>
              <Input
                id="interval"
                type="number"
                min="30"
                value={form.check_interval_seconds}
                onChange={(e) =>
                  setForm((f) => ({ ...f, check_interval_seconds: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slowMs">Slow threshold (ms)</Label>
              <Input
                id="slowMs"
                type="number"
                min="100"
                value={form.alert_on_slow_ms}
                onChange={(e) => setForm((f) => ({ ...f, alert_on_slow_ms: e.target.value }))}
                placeholder="2000"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Alert when down</Label>
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, alert_on_down: !f.alert_on_down }))}
              className={`flex h-9 w-full items-center justify-between rounded-md border px-3 text-sm transition-colors cursor-pointer ${
                form.alert_on_down
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-input bg-transparent text-muted-foreground hover:bg-accent'
              }`}
            >
              {form.alert_on_down ? 'Enabled' : 'Disabled'}
            </button>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.name || !form.url}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SslBadge({ expiresAt }: { expiresAt: Date | string | null | undefined }) {
  if (!expiresAt) return null
  const d = new Date(expiresAt)
  const daysLeft = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const color =
    daysLeft <= 7
      ? 'text-red-400 border-red-500/30 bg-red-500/10'
      : daysLeft <= 30
        ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
        : 'text-green-400 border-green-500/30 bg-green-500/10'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${color}`}>
      <ShieldCheck size={10} />
      {daysLeft <= 0 ? 'Expired' : `${daysLeft}d`}
    </span>
  )
}

function SiteChecksChart({ checks }: { checks: SiteCheck[] }) {
  const id = useId()
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme !== 'light'
  const mutedFg = dark ? 'oklch(0.708 0 0)' : 'oklch(0.556 0 0)'
  const gridStroke = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const tooltipBg = dark ? 'oklch(0.205 0 0)' : 'oklch(0.985 0 0)'
  const tooltipBorder = dark ? 'oklch(0.3 0 0)' : 'oklch(0.922 0 0)'

  const data = [...checks]
    .reverse()
    .slice(-100)
    .map((c) => ({
      time: new Date(c.checked_at).getTime(),
      ms: c.response_ms ?? 0,
      ok: c.ok ? 1 : 0,
    }))

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
        />
        <YAxis
          tickFormatter={(v: number) => `${v}ms`}
          tick={{ fontSize: 10, fill: mutedFg }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: tooltipBg,
            border: `1px solid ${tooltipBorder}`,
            borderRadius: '6px',
            fontSize: '12px',
          }}
          formatter={(v: number) => [`${v}ms`, 'Response time']}
        />
        <Area
          type="monotone"
          dataKey="ms"
          stroke="#6366f1"
          strokeWidth={1.5}
          fill={`url(#rtg-${id})`}
          dot={false}
        />
        <defs>
          <linearGradient id={`rtg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
      </AreaChart>
    </ResponsiveContainer>
  )
}

function StatusTimeline({ checks }: { checks: SiteCheck[] }) {
  const last24h = checks.filter(
    (c) => new Date(c.checked_at).getTime() > Date.now() - 24 * 3600 * 1000,
  )
  if (last24h.length === 0) {
    return <p className="text-xs text-muted-foreground">No checks in the last 24 hours</p>
  }
  return (
    <div className="flex gap-px h-6 rounded overflow-hidden">
      {last24h
        .slice(-120)
        .reverse()
        .map((c) => (
          <div
            key={c.id}
            className={`flex-1 ${c.ok ? 'bg-green-500' : 'bg-red-500'}`}
            title={`${new Date(c.checked_at).toLocaleTimeString()} — ${c.ok ? 'Up' : 'Down'} ${c.response_ms ? `(${c.response_ms}ms)` : ''}`}
          />
        ))}
    </div>
  )
}

function SiteDrawer({ site, onClose }: { site: Site; onClose: () => void }) {
  const checksQ = useSiteChecks(site.id)
  const checks = checksQ.data ?? []
  const status = getSiteStatus(site)

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <div className="flex items-center gap-3">
            <DrawerTitle>{site.name}</DrawerTitle>
            <StatusPill status={status} />
          </div>
          <a
            href={site.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {site.url}
          </a>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-4 overflow-auto">
          {checksQ.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : checksQ.isError ? (
            <p className="text-sm text-destructive">Failed to load check history</p>
          ) : (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <BarChart3 size={12} /> Response time (last 100 checks)
                </p>
                <SiteChecksChart checks={checks} />
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock size={12} /> Status timeline (last 24h)
                </p>
                <StatusTimeline checks={checks} />
              </div>

              {site.ssl_expires_at && (
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    SSL cert expires{' '}
                    <span className="font-medium text-foreground">
                      {formatAbsoluteDate(site.ssl_expires_at)}
                    </span>
                    {' '}
                    <SslBadge expiresAt={site.ssl_expires_at} />
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Recent incidents</p>
                {checks.filter((c) => !c.ok).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No incidents in last 200 checks</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                    {checks
                      .filter((c) => !c.ok)
                      .slice(0, 10)
                      .map((c) => (
                        <li key={c.id} className="px-3 py-2.5">
                          <p className="text-xs font-medium text-red-400">
                            {formatRelativeTime(c.checked_at)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {c.error_message ?? `Status ${c.status_code}`}
                          </p>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function SitesPage() {
  const sitesQ = useSites()
  const createSite = useCreateSite()
  const updateSite = useUpdateSite()
  const deleteSite = useDeleteSite()

  const [showAdd, setShowAdd] = useState(false)
  const [editingSite, setEditingSite] = useState<Site | null>(null)
  const [deletingSite, setDeletingSite] = useState<Site | null>(null)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)

  const sites = sitesQ.data ?? []

  function handleCreate(form: SiteForm) {
    createSite.mutate(
      {
        name: form.name,
        url: form.url,
        check_interval_seconds: parseInt(form.check_interval_seconds),
        alert_on_down: form.alert_on_down,
        alert_on_slow_ms: form.alert_on_slow_ms ? parseInt(form.alert_on_slow_ms) : null,
      },
      {
        onSuccess: () => {
          toast.success(`${form.name} added`)
          setShowAdd(false)
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function handleEdit(site: Site, form: SiteForm) {
    updateSite.mutate(
      {
        id: site.id,
        name: form.name,
        url: form.url,
        check_interval_seconds: parseInt(form.check_interval_seconds),
        alert_on_down: form.alert_on_down,
        alert_on_slow_ms: form.alert_on_slow_ms ? parseInt(form.alert_on_slow_ms) : null,
      },
      {
        onSuccess: () => {
          toast.success('Site updated')
          setEditingSite(null)
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function handleTogglePause(site: Site) {
    updateSite.mutate(
      { id: site.id, is_active: !site.is_active },
      {
        onSuccess: () =>
          toast.success(site.is_active ? 'Checks paused' : 'Checks resumed'),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function handleDelete(site: Site) {
    deleteSite.mutate(site.id, {
      onSuccess: () => {
        toast.success(`${site.name} deleted`)
        setDeletingSite(null)
      },
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sites</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitoring only runs while the app is open
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2">
          <Plus size={14} />
          Add site
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {sitesQ.isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sitesQ.isError ? (
            <p className="py-12 text-sm text-destructive text-center">Failed to load sites</p>
          ) : sites.length === 0 ? (
            <div className="py-16 text-center">
              <Globe size={32} className="mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No sites monitored yet</p>
              <Button
                variant="link"
                size="sm"
                onClick={() => setShowAdd(true)}
                className="mt-1"
              >
                Add your first site
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response time</TableHead>
                  <TableHead>30d uptime</TableHead>
                  <TableHead>SSL</TableHead>
                  <TableHead>Last checked</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => {
                  const status = getSiteStatus(site)
                  return (
                    <TableRow
                      key={site.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedSite(site)}
                    >
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{site.name}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-48">
                            {site.url}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusPill status={status} />
                          {!site.is_active && (
                            <Badge variant="outline" className="text-xs">Paused</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatResponseTime(site.latest_check?.response_ms)}
                      </TableCell>
                      <TableCell>
                        <UptimeBar pct={site.uptime_30d_pct} />
                      </TableCell>
                      <TableCell>
                        <SslBadge expiresAt={site.ssl_expires_at} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {site.latest_check
                          ? formatRelativeTime(site.latest_check.checked_at)
                          : '—'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label="Site options"
                            >
                              <span className="sr-only">Options</span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                              >
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                              </svg>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleTogglePause(site)}>
                              {site.is_active ? (
                                <>
                                  <Pause size={14} className="mr-2" />
                                  Pause checks
                                </>
                              ) : (
                                <>
                                  <Play size={14} className="mr-2" />
                                  Resume checks
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingSite(site)}>
                              <Pencil size={14} className="mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeletingSite(site)}
                            >
                              <Trash2 size={14} className="mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {showAdd && (
        <SiteFormDialog
          title="Add Site"
          onSave={handleCreate}
          onClose={() => setShowAdd(false)}
          loading={createSite.isPending}
        />
      )}
      {editingSite && (
        <SiteFormDialog
          title="Edit Site"
          initial={{
            name: editingSite.name,
            url: editingSite.url,
            check_interval_seconds: String(editingSite.check_interval_seconds),
            alert_on_slow_ms: editingSite.alert_on_slow_ms
              ? String(editingSite.alert_on_slow_ms)
              : '',
            alert_on_down: editingSite.alert_on_down,
          }}
          onSave={(form) => handleEdit(editingSite, form)}
          onClose={() => setEditingSite(null)}
          loading={updateSite.isPending}
        />
      )}
      {deletingSite && (
        <AlertDialog open onOpenChange={(open) => !open && setDeletingSite(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {deletingSite.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the site and all its check history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(deletingSite)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {selectedSite && (
        <SiteDrawer site={selectedSite} onClose={() => setSelectedSite(null)} />
      )}
    </div>
  )
}
