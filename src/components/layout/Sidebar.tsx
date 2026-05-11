import { Link, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  TrendingUp,
  Home,
  Monitor,
  Globe,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/net-worth', label: 'Net Worth', icon: TrendingUp },
  { to: '/mortgage', label: 'Mortgage', icon: Home },
  { to: '/devices', label: 'Devices', icon: Monitor },
  { to: '/sites', label: 'Sites', icon: Globe },
] as const

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-200',
          collapsed ? 'w-14' : 'w-56',
        )}
      >
        {/* Logo / app name */}
        <div className="flex h-14 items-center gap-2 px-3 border-b border-border shrink-0">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold shrink-0">
            D
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm truncate">Dashboard</span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 p-2 flex-1" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to)
            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>
                  <Link
                    to={to}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      collapsed && 'justify-center px-0',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon size={18} className="shrink-0" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p>{label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </nav>

        {/* Settings + collapse */}
        <div className="flex flex-col gap-1 p-2 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  currentPath.startsWith('/settings')
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  collapsed && 'justify-center px-0',
                )}
              >
                <Settings size={18} className="shrink-0" />
                {!collapsed && <span>Settings</span>}
              </Link>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                <p>Settings</p>
              </TooltipContent>
            )}
          </Tooltip>

          <button
            onClick={toggle}
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full cursor-pointer"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRight size={18} className="shrink-0" />
            ) : (
              <>
                <ChevronLeft size={18} className="shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
