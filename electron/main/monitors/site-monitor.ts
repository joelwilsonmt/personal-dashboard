import cron from 'node-cron'
import tls from 'node:tls'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client'
import { sites, site_checks } from '@shared/db/schema'
import { log } from '../logger'

const TIMEOUT_MS = 10_000
const SSL_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour
const SSL_WARN_DAYS = 30

const tasks = new Map<string, cron.ScheduledTask>()

type SiteStatus = 'up' | 'slow' | 'down'
const lastStatus = new Map<string, SiteStatus>()
const lastSslCheck = new Map<string, number>()
const lastSslWarnNotified = new Map<string, number>()

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
      start = Date.now()
      res = await fetch(site.url, { method: 'GET', signal: getController.signal, redirect: 'follow' })
      clearTimeout(getTimer)
    } else {
      clearTimeout(timer)
    }
    const ms = Date.now() - start
    const ok = res.status < 400
    return { ok, status_code: res.status, response_ms: ms, error: null }
  } catch (err) {
    clearTimeout(timer)
    return {
      ok: false,
      status_code: null,
      response_ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

async function checkSSLExpiry(url: string): Promise<Date | null> {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return null
    return await new Promise<Date | null>((resolve) => {
      const socket = tls.connect({ host: hostname, port: 443, servername: hostname }, () => {
        const cert = socket.getPeerCertificate()
        socket.destroy()
        resolve(cert?.valid_to ? new Date(cert.valid_to) : null)
      })
      socket.on('error', () => { socket.destroy(); resolve(null) })
      socket.setTimeout(5000, () => { socket.destroy(); resolve(null) })
    })
  } catch {
    return null
  }
}

async function notify(title: string, body: string): Promise<void> {
  try {
    const { Notification } = await import('electron')
    new Notification({ title, body }).show()
  } catch {
    // Electron may not have notification support in all environments
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

  // Determine effective status
  const isSlow =
    result.ok &&
    site.alert_on_slow_ms != null &&
    result.response_ms != null &&
    result.response_ms > site.alert_on_slow_ms
  const currentStatus: SiteStatus = !result.ok ? 'down' : isSlow ? 'slow' : 'up'
  const prevStatus = lastStatus.get(site.id)

  if (prevStatus !== undefined && prevStatus !== currentStatus) {
    if (site.alert_on_down && currentStatus === 'down') {
      await notify(`🔴 ${site.name} is down`, result.error ?? `Status ${result.status_code}`)
    } else if (site.alert_on_down && prevStatus === 'down' && currentStatus !== 'down') {
      await notify(`✅ ${site.name} is back up`, `Recovered after outage`)
    } else if (site.alert_on_slow_ms && currentStatus === 'slow') {
      await notify(
        `⚠️ ${site.name} is slow`,
        `Response time ${result.response_ms}ms exceeds ${site.alert_on_slow_ms}ms`,
      )
    } else if (site.alert_on_slow_ms && prevStatus === 'slow' && currentStatus === 'up') {
      await notify(`✅ ${site.name} response time normal`, `Back below ${site.alert_on_slow_ms}ms`)
    }
  }
  lastStatus.set(site.id, currentStatus)

  // SSL cert check — at most once per hour per site
  const lastCheck = lastSslCheck.get(site.id) ?? 0
  if (now.getTime() - lastCheck > SSL_CHECK_INTERVAL_MS) {
    lastSslCheck.set(site.id, now.getTime())
    const expiresAt = await checkSSLExpiry(site.url)
    if (expiresAt !== null) {
      await db.update(sites).set({ ssl_expires_at: expiresAt }).where(eq(sites.id, site.id))

      const daysLeft = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (daysLeft <= SSL_WARN_DAYS) {
        const lastWarn = lastSslWarnNotified.get(site.id) ?? 0
        if (now.getTime() - lastWarn > 24 * 60 * 60 * 1000) {
          await notify(
            `🔒 ${site.name} SSL cert expiring soon`,
            `Certificate expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString()})`,
          )
          lastSslWarnNotified.set(site.id, now.getTime())
        }
      }
    }
  }

  log.debug({ site: site.name, status: currentStatus, ms: result.response_ms }, 'Site check complete')
}

function intervalFromSeconds(seconds: number): string {
  if (seconds < 60) return `*/${seconds} * * * * *`
  const mins = Math.max(1, Math.floor(seconds / 60))
  return `*/${mins} * * * *`
}

export async function startSiteMonitor(): Promise<void> {
  const activeSites = await db.select().from(sites).where(eq(sites.is_active, true))
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
