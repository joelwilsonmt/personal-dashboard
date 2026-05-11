import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Info, FolderOpen, Download, Upload, Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSettings, useUpdateSettings } from '@/hooks/useSettings'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function ThemeButton({
  value,
  current,
  icon: Icon,
  label,
  onClick,
}: {
  value: string
  current: string
  icon: React.ElementType
  label: string
  onClick: () => void
}) {
  const active = value === current
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border px-4 py-3 text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  )
}

function SettingsPage() {
  const settingsQ = useSettings()
  const updateSettings = useUpdateSettings()
  const { setTheme: applyTheme } = useTheme()

  const settings = settingsQ.data

  function handleThemeChange(theme: 'dark' | 'light' | 'system') {
    applyTheme(theme)
    updateSettings.mutate(
      { theme },
      {
        onSuccess: () => toast.success(`Theme set to ${theme}`),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  async function handleImport() {
    try {
      const result = await window.api.settings.import()
      if (result && (result as { imported: boolean; error?: string }).imported) {
        toast.success('Data imported successfully — restart the app to see changes')
      } else {
        const err = (result as { imported: boolean; error?: string }).error
        if (err) toast.error(`Import failed: ${err}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    }
  }

  async function handleExport() {
    try {
      const result = await window.api.settings.export()
      if (result && (result as { path: string }).path) {
        toast.success(`Exported to ${(result as { path: string }).path}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  async function handleOpenDataFolder() {
    try {
      await window.api.settings.openDataFolder()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open folder')
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">App configuration and data management</p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Theme</CardTitle>
        </CardHeader>
        <CardContent>
          {settingsQ.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="flex gap-3">
              <ThemeButton
                value="dark"
                current={settings?.theme ?? 'dark'}
                icon={Moon}
                label="Dark"
                onClick={() => handleThemeChange('dark')}
              />
              <ThemeButton
                value="light"
                current={settings?.theme ?? 'dark'}
                icon={Sun}
                label="Light"
                onClick={() => handleThemeChange('light')}
              />
              <ThemeButton
                value="system"
                current={settings?.theme ?? 'dark'}
                icon={Monitor}
                label="System"
                onClick={() => handleThemeChange('system')}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Export data</p>
              <p className="text-xs text-muted-foreground">Download all data as JSON</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download size={14} />
              Export
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Import data</p>
              <p className="text-xs text-muted-foreground">Replace all data from a JSON export</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleImport} className="gap-2">
              <Upload size={14} />
              Import
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Open data folder</p>
              <p className="text-xs text-muted-foreground">Open the SQLite database directory</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenDataFolder}
              className="gap-2"
            >
              <FolderOpen size={14} />
              Open
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Plaid</p>
              <p className="text-xs text-muted-foreground">Automatic bank account sync</p>
            </div>
            <Badge variant="outline" className="text-xs">Phase 2</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Home value API</p>
              <p className="text-xs text-muted-foreground">Zillapi / RapidAPI estimate fetch</p>
            </div>
            <Badge variant="outline" className="text-xs">Phase 2</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Device agent server</p>
              <p className="text-xs text-muted-foreground">
                Running on port{' '}
                <code className="font-mono bg-secondary px-1 rounded text-xs">
                  {settings?.agent_server_port ?? 53117}
                </code>
              </p>
            </div>
            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">System notifications</p>
              <p className="text-xs text-muted-foreground">
                Sent when a monitored site goes down or recovers
              </p>
            </div>
            <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
              On
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info size={14} />
            About
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {settingsQ.isLoading ? (
            <Skeleton className="h-6 w-32" />
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Version</p>
              <Badge variant="secondary">{settings?.app_version ?? '—'}</Badge>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Database</p>
            <span className="text-xs text-muted-foreground">SQLite (local-first)</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Site monitoring</p>
            <span className="text-xs text-muted-foreground">
              Only active while app is open
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
