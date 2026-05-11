/**
 * Site monitor — self-contained, no Electron-specific imports except Notification.
 * Can be ported to a standalone Node service against the same SQLite file.
 */
import cron from 'node-cron'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client'
import { sites, site_checks } from '@shared/db/schema'
import { log } from '../logger'

const TIMEOUT_MS = 10_000
const tasks = new Map<string, cron.ScheduledTask>()
// Track last known status per site to avoid notification spam
const lastStatus = new Map<string, boolean>()

async function checkSite(
  site: typeof sites.$inferSelect,
): Promise<{ ok: boolean; status_code: number | null; response_ms: number | null; error: string | null }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let start = Date.now()

  try {
    let res = await fetch(site.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    })
    if (res.status === 405) {
      clearTimeout(timer)
      const getController = new AbortController()
      const getTimer = setTimeout(() => getController.abort(), TIMEOUT_MS)
      start = Date.now() // reset timer to measure only the GET
      res = await fetch(site.url, { method: 'GET', signal: getController.signal, redirect: 'follow' })
      clearTimeout(getTimer)
    } else {
      clearTimeout(timer)
    }
    const ms = Date.now() - start
    const ok = res.status < 400
    return { ok, status_code: res.status, response_ms: ms, error: null }
  } catch (err) {
    return {
      ok: false,
      status_code: null,
      response_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function runCheck(siteId: string): Promise<void> {
  const site = await db.select().from(sites).where(eq(sites.id, siteId)).get()
  if (!site || !site.is_active) return

  const result = await checkSite(site)
  const now = new Date()

  await db.insert(site_checks).values({
    id: nanoid(),
    site_id: site.id,
    checked_at: now,
    status_code: result.status_code,
    response_ms: result.response_ms,
    ok: result.ok,
    error_message: result.error,
  })

  const prev = lastStatus.get(site.id)
  if (prev !== undefined && prev !== result.ok && site.alert_on_down) {
    try {
      const { Notification } = await import('electron')
      new Notification({
        title: result.ok ? `✅ ${site.name} is back up` : `🔴 ${site.name} is down`,
        body: result.ok ? `Recovered after outage` : result.error ?? `Status ${result.status_code}`,
      }).show()
    } catch {
      // Electron may not have notification support in all environments
    }
  }
  lastStatus.set(site.id, result.ok)

  log.debug(
    { site: site.name, ok: result.ok, ms: result.response_ms },
    'Site check complete',
  )
}

function intervalFromSeconds(seconds: number): string {
  if (seconds < 60) return `*/${seconds} * * * * *`
  const mins = Math.max(1, Math.floor(seconds / 60))
  return `*/${mins} * * * *`
}

export async function startSiteMonitor(): Promise<void> {
  const activeSites = await db
    .select()
    .from(sites)
    .where(eq(sites.is_active, true))

  for (const site of activeSites) {
    scheduleCheck(site)
  }
  log.info({ count: activeSites.length }, 'Site monitor started')
}

export function scheduleCheck(site: typeof sites.$inferSelect): void {
  stopCheck(site.id)
  const cronExpr = intervalFromSeconds(site.check_interval_seconds)
  const task = cron.schedule(cronExpr, () => void runCheck(site.id))
  tasks.set(site.id, task)
}

export function stopCheck(siteId: string): void {
  const existing = tasks.get(siteId)
  if (existing) {
    existing.stop()
    tasks.delete(siteId)
  }
}

export function stopAllChecks(): void {
  for (const [id] of tasks) stopCheck(id)
}
