import { createRootRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { ErrorBoundary } from '@/components/ErrorBoundary'

function RootWithBoundary() {
  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}

export const Route = createRootRoute({
  component: RootWithBoundary,
})
