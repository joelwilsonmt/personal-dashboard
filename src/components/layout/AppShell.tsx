import { useEffect } from 'react'
import { Outlet } from '@tanstack/react-router'
import { useTheme } from 'next-themes'
import { Sidebar } from './Sidebar'
import { Toaster } from '@/components/ui/sonner'
import { useSettings } from '@/hooks/useSettings'

function ThemeSync() {
  const { setTheme } = useTheme()
  const settingsQ = useSettings()
  useEffect(() => {
    if (settingsQ.data?.theme) setTheme(settingsQ.data.theme)
  }, [settingsQ.data?.theme, setTheme])
  return null
}

export function AppShell() {
  const { theme } = useTheme()
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ThemeSync />
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <Toaster
        theme={(theme ?? 'dark') as 'light' | 'dark' | 'system'}
        position="bottom-right"
        richColors
      />
    </div>
  )
}
