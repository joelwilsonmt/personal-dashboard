import { eq, desc, and, gte, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client'
import { sites, site_checks } from '@shared/db/schema'
import {
  ListSitesRequest,
  CreateSiteRequest,
  UpdateSiteRequest,
  DeleteSiteRequest,
  GetSiteChecksRequest,
} from '@shared/ipc/contracts'
import type { Site } from '@shared/types'
import { log } from '../logger'
import { handle } from './handle'
import { stopCheck, scheduleCheck } from '../monitors/site-monitor'

async function siteWithStats(site: typeof sites.$inferSelect): Promise<Site> {
  const latest = await db
    .select()
    .from(site_checks)
    .where(eq(site_checks.site_id, site.id))
    .orderBy(desc(site_checks.checked_at))
    .limit(1)
    .get()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const checksResult = await db
    .select({
      total: sql<number>`count(*)`,
      ok_count: sql<number>`sum(case when ${site_checks.ok} = 1 then 1 else 0 end)`,
    })
    .from(site_checks)
    .where(
      and(
        eq(site_checks.site_id, site.id),
        gte(site_checks.checked_at, thirtyDaysAgo),
      ),
    )
    .get()

  const total = checksResult?.total ?? 0
  const uptime = total > 0 ? ((checksResult?.ok_count ?? 0) / total) * 100 : null

  return {
    ...site,
    latest_check: latest
      ? {
          ok: latest.ok,
          status_code: latest.status_code,
          response_ms: latest.response_ms,
          checked_at: latest.checked_at,
          error_message: latest.error_message,
        }
      : null,
    uptime_30d_pct: uptime,
  }
}

export function registerSiteHandlers(): void {
  handle('sites:list', async (_e, raw: unknown) => {
    ListSitesRequest.parse(raw ?? {})
    const allSites = await db.select().from(sites).orderBy(sites.name)
    return Promise.all(allSites.map(siteWithStats))
  })

  handle('sites:create', async (_e, raw: unknown) => {
    const data = CreateSiteRequest.parse(raw)
    const id = nanoid()
    const now = new Date()
    await db.insert(sites).values({
      id,
      name: data.name,
      url: data.url,
      check_interval_seconds: data.check_interval_seconds,
      is_active: true,
      alert_on_down: data.alert_on_down,
      alert_on_slow_ms: data.alert_on_slow_ms ?? null,
      created_at: now,
    })
    const site = await db.select().from(sites).where(eq(sites.id, id)).get()
    if (!site) throw new Error('Site not found after insert')
    return siteWithStats(site)
  })

  handle('sites:update', async (_e, raw: unknown) => {
    const { id, ...data } = UpdateSiteRequest.parse(raw)
    await db.update(sites).set(data).where(eq(sites.id, id))
    const site = await db.select().from(sites).where(eq(sites.id, id)).get()
    if (!site) throw new Error('Site not found')
    stopCheck(id)
    if (site.is_active) scheduleCheck(site)
    return siteWithStats(site)
  })

  handle('sites:delete', async (_e, raw: unknown) => {
    const { id } = DeleteSiteRequest.parse(raw)
    stopCheck(id)
    await db.delete(site_checks).where(eq(site_checks.site_id, id))
    await db.delete(sites).where(eq(sites.id, id))
    return { deleted: true }
  })

  handle('sites:getChecks', async (_e, raw: unknown) => {
    const { site_id, limit } = GetSiteChecksRequest.parse(raw)
    return db
      .select()
      .from(site_checks)
      .where(eq(site_checks.site_id, site_id))
      .orderBy(desc(site_checks.checked_at))
      .limit(limit)
  })

  log.debug('Site IPC handlers registered')
}
