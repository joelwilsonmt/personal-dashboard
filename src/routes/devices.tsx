import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { Monitor, Plus, Cpu, HardDrive, MemoryStick, Trash2, Copy } from 'lucide-react'
import { useDevices, useCreateDevice, useDeleteDevice } from '@/hooks/useDevices'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatRelativeTime } from '@/lib/formatters'
import type { Device, DeviceStatus, DeviceMetrics } from '@shared/types'
import { differenceInSeconds } from 'date-fns'

export const Route = createFileRoute('/devices')({
  component: DevicesPage,
})

function getDeviceStatus(device: Device): DeviceStatus {
  if (!device.last_seen_at) return 'unknown'
  const secs = differenceInSeconds(new Date(), new Date(device.last_seen_at))
  if (secs < 60) return 'online'
  if (secs < 3600) return 'recent'
  return 'offline'
}

function parseMetrics(json: string | null): DeviceMetrics | null {
  if (!json) return null
  try {
    return JSON.parse(json) as DeviceMetrics
  } catch {
    return null
  }
}

function StatusDot({ status }: { status: DeviceStatus }) {
  const colorMap: Record<DeviceStatus, string> = {
    online: 'bg-green-500',
    recent: 'bg-amber-500',
    offline: 'bg-red-500',
    unknown: 'bg-zinc-500',
  }
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${colorMap[status]} shadow-sm`}
      aria-label={status}
    />
  )
}

function MetricBar({ label, value, icon: Icon }: {
  label: string
  value: number | null | undefined
  icon: React.ElementType
}) {
  const pct = value ?? 0
  const color = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Icon size={11} />
          {label}
        </div>
        <span className="text-xs font-medium tabular-nums">
          {value != null ? `${value.toFixed(0)}%` : '—'}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DeviceCard({ device, onClick, onDelete }: {
  device: Device
  onClick: () => void
  onDelete: () => void
}) {
  const status = getDeviceStatus(device)
  const metrics = parseMetrics(device.last_metrics_json)

  return (
    <Card
      className="cursor-pointer hover:border-border/80 transition-colors"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusDot status={status} />
            <CardTitle className="text-sm font-semibold">{device.name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs capitalize">{device.kind}</Badge>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none"
              aria-label={`Delete ${device.name}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {status === 'unknown' ? 'Never connected' : `Last seen ${formatRelativeTime(device.last_seen_at)}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {metrics ? (
          <>
            <MetricBar label="CPU" value={metrics.cpu} icon={Cpu} />
            <MetricBar label="RAM" value={metrics.ram} icon={MemoryStick} />
            <MetricBar label="Disk" value={metrics.disk} icon={HardDrive} />
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-3">
            No metrics yet
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function AgentInstallInstructions({ device, port = 53117 }: { device: Device; port?: number }) {
  const curlCmd = `curl -X POST http://localhost:${port}/agent/report \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Token: ${device.agent_token}" \\
  -d '{"cpu":12,"ram":68,"disk":41}'`

  function copy(text: string) {
    void navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Run this on the device to report metrics. Schedule it with launchd / systemd / Task Scheduler every 30s.
      </p>
      <div className="relative">
        <pre className="text-xs bg-secondary rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
          {curlCmd}
        </pre>
        <button
          onClick={() => copy(curlCmd)}
          className="absolute top-2 right-2 p-1.5 rounded bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Copy curl command"
        >
          <Copy size={13} />
        </button>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <p>Token: <code className="font-mono bg-secondary px-1 rounded">{device.agent_token}</code></p>
        <p>For remote devices on a different network, expose the endpoint via Tailscale.</p>
      </div>
    </div>
  )
}

function DeviceDrawer({ device, onClose }: { device: Device; onClose: () => void }) {
  const metrics = parseMetrics(device.last_metrics_json)
  const status = getDeviceStatus(device)

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <div className="flex items-center gap-3">
            <StatusDot status={status} />
            <DrawerTitle>{device.name}</DrawerTitle>
            <Badge variant="outline" className="text-xs capitalize">{device.kind}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {status === 'unknown' ? 'Never connected' : `Last seen ${formatRelativeTime(device.last_seen_at)}`}
          </p>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-4 overflow-auto">
          {metrics && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'CPU', value: metrics.cpu, icon: Cpu },
                { label: 'RAM', value: metrics.ram, icon: MemoryStick },
                { label: 'Disk', value: metrics.disk, icon: HardDrive },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="rounded-lg bg-secondary p-3 text-center">
                  <Icon size={16} className="mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xl font-bold">{value.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}
          <div>
            <h3 className="text-sm font-medium mb-2">Agent install instructions</h3>
            <AgentInstallInstructions device={device} />
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function DevicesPage() {
  const devicesQ = useDevices()
  const createDevice = useCreateDevice()
  const deleteDevice = useDeleteDevice()

  const [showAdd, setShowAdd] = useState(false)
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null)
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [form, setForm] = useState({ name: '', kind: 'macbook' as Device['kind'] })

  const devices = devicesQ.data ?? []

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    createDevice.mutate(
      { name: form.name, kind: form.kind },
      {
        onSuccess: (device) => {
          toast.success(`${form.name} added`)
          setShowAdd(false)
          setSelectedDevice(device)
          setForm({ name: '', kind: 'macbook' })
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  function handleDelete(device: Device) {
    deleteDevice.mutate(device.id, {
      onSuccess: () => {
        toast.success(`${device.name} removed`)
        setDeletingDevice(null)
        if (selectedDevice?.id === device.id) setSelectedDevice(null)
      },
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Devices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Agents report metrics over local HTTP
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="gap-2">
          <Plus size={14} />
          Add device
        </Button>
      </div>

      {devicesQ.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Monitor size={40} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No devices yet</p>
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-2">
            <Plus size={14} />
            Add your first device
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              onClick={() => setSelectedDevice(d)}
              onDelete={() => setDeletingDevice(d)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <Dialog open onOpenChange={(open) => !open && setShowAdd(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Device</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="deviceName">Device name</Label>
                <Input
                  id="deviceName"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="MacBook Pro"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Device type</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm((f) => ({ ...f, kind: v as Device['kind'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="macbook">MacBook</SelectItem>
                    <SelectItem value="server">Server</SelectItem>
                    <SelectItem value="laptop">Laptop</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createDevice.isPending || !form.name}>
                  Add Device
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {deletingDevice && (
        <AlertDialog open onOpenChange={(open) => !open && setDeletingDevice(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {deletingDevice.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the device and its agent token. Any agents using this token will stop reporting.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleDelete(deletingDevice)}>
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {selectedDevice && (
        <DeviceDrawer device={selectedDevice} onClose={() => setSelectedDevice(null)} />
      )}
    </div>
  )
}
