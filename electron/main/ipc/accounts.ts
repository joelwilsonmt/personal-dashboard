import { ipcMain } from 'electron'
import { eq, desc, and, gte, sql, inArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client'
import { accounts, balance_snapshots } from '@shared/db/schema'
import {
  PingRequest,
  ListAccountsRequest,
  CreateAccountRequest,
  UpdateAccountRequest,
  GetAccountHistoryRequest,
  UpdateBalancesRequest,
  GetNetWorthTrendRequest,
} from '@shared/ipc/contracts'
import type { Account } from '@shared/types'
import { log } from '../logger'

function accountWithBalance(
  acct: typeof accounts.$inferSelect,
  snapshot: typeof balance_snapshots.$inferSelect | null,
): Account {
  return {
    ...acct,
    latest_balance_cents: snapshot?.balance_cents ?? null,
    latest_balance_at: snapshot?.recorded_at ?? null,
    latest_balance_source: snapshot?.source ?? null,
  }
}

async function getLatestSnapshot(accountId: string) {
  const rows = await db
    .select()
    .from(balance_snapshots)
    .where(eq(balance_snapshots.account_id, accountId))
    .orderBy(desc(balance_snapshots.recorded_at))
    .limit(1)
  return rows[0] ?? null
}

export function registerAccountHandlers(): void {
  ipcMain.handle('ping', (_e, raw: unknown) => {
    PingRequest.parse(raw ?? {})
    return { pong: true, ts: Date.now() }
  })

  ipcMain.handle('accounts:list', async (_e, raw: unknown) => {
    const { kind, includeArchived } = ListAccountsRequest.parse(raw ?? {})
    const rows = await db
      .select()
      .from(accounts)
      .where(
        and(
          kind ? eq(accounts.kind, kind) : undefined,
          includeArchived ? undefined : eq(accounts.is_archived, false),
        ),
      )
      .orderBy(accounts.name)
    const accountIds = rows.map(r => r.id)
    const snapshotMap = new Map<string, typeof balance_snapshots.$inferSelect>()
    if (accountIds.length > 0) {
      const snaps = await db
        .select()
        .from(balance_snapshots)
        .where(inArray(balance_snapshots.account_id, accountIds))
        .orderBy(desc(balance_snapshots.recorded_at))
      for (const s of snaps) {
        if (!snapshotMap.has(s.account_id)) snapshotMap.set(s.account_id, s)
      }
    }
    return rows.map(r => accountWithBalance(r, snapshotMap.get(r.id) ?? null))
  })

  ipcMain.handle('accounts:create', async (_e, raw: unknown) => {
    const data = CreateAccountRequest.parse(raw)
    const now = new Date()
    const id = nanoid()

    await db.insert(accounts).values({
      id,
      name: data.name,
      kind: data.kind,
      type: data.type,
      institution: data.institution,
      currency: data.currency,
      is_archived: false,
      created_at: now,
      updated_at: now,
    })

    await db.insert(balance_snapshots).values({
      id: nanoid(),
      account_id: id,
      balance_cents: data.initial_balance_cents,
      source: 'manual',
      recorded_at: now,
    })

    const acct = await db.select().from(accounts).where(eq(accounts.id, id)).get()
    if (!acct) throw new Error('Account not found after insert')
    return accountWithBalance(acct, await getLatestSnapshot(id))
  })

  ipcMain.handle('accounts:update', async (_e, raw: unknown) => {
    const { id, ...data } = UpdateAccountRequest.parse(raw)
    await db
      .update(accounts)
      .set({ ...data, updated_at: new Date() })
      .where(eq(accounts.id, id))
    const acct = await db.select().from(accounts).where(eq(accounts.id, id)).get()
    if (!acct) throw new Error('Account not found')
    return accountWithBalance(acct, await getLatestSnapshot(id))
  })

  ipcMain.handle('accounts:getHistory', async (_e, raw: unknown) => {
    const { id } = GetAccountHistoryRequest.parse(raw)
    const acct = await db.select().from(accounts).where(eq(accounts.id, id)).get()
    if (!acct) throw new Error('Account not found')
    const snapshots = await db
      .select()
      .from(balance_snapshots)
      .where(eq(balance_snapshots.account_id, id))
      .orderBy(desc(balance_snapshots.recorded_at))
      .limit(100)
    return {
      account: accountWithBalance(acct, snapshots[0] ?? null),
      snapshots,
    }
  })

  ipcMain.handle('balances:update', async (_e, raw: unknown) => {
    const { updates } = UpdateBalancesRequest.parse(raw)
    const now = new Date()
    let updated = 0
    for (const u of updates) {
      const latest = await getLatestSnapshot(u.account_id)
      if (latest?.balance_cents === u.balance_cents) continue
      await db.insert(balance_snapshots).values({
        id: nanoid(),
        account_id: u.account_id,
        balance_cents: u.balance_cents,
        source: 'manual',
        recorded_at: now,
      })
      updated++
    }
    return { updated }
  })

  ipcMain.handle('accounts:netWorthTrend', async (_e, raw: unknown) => {
    const { months } = GetNetWorthTrendRequest.parse(raw ?? {})

    const accts = await db.select({ id: accounts.id, kind: accounts.kind }).from(accounts).where(eq(accounts.is_archived, false))

    // Load only snapshots within the lookback window to avoid unbounded memory use
    const now = new Date()
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - months, 1)
    const windowSnaps = await db
      .select()
      .from(balance_snapshots)
      .where(gte(balance_snapshots.recorded_at, cutoffDate))
      .orderBy(desc(balance_snapshots.recorded_at))

    const snapsByAccount = new Map<string, Array<{ balance_cents: number; recorded_at: Date }>>()
    const accountsInWindow = new Set<string>()
    for (const s of windowSnaps) {
      accountsInWindow.add(s.account_id)
      const arr = snapsByAccount.get(s.account_id) ?? []
      arr.push({ balance_cents: s.balance_cents, recorded_at: s.recorded_at })
      snapsByAccount.set(s.account_id, arr)
    }

    // For accounts with no snapshot in the window, fall back to their latest ever snapshot
    for (const acct of accts) {
      if (accountsInWindow.has(acct.id)) continue
      const snap = await getLatestSnapshot(acct.id)
      if (snap) {
        snapsByAccount.set(acct.id, [{ balance_cents: snap.balance_cents, recorded_at: snap.recorded_at }])
      }
    }

    const results = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      let assetsCents = 0, liabilitiesCents = 0
      for (const acct of accts) {
        const snap = (snapsByAccount.get(acct.id) ?? []).find(
          s => s.recorded_at.getTime() <= monthEnd.getTime()
        )
        if (snap) {
          if (acct.kind === 'asset') assetsCents += snap.balance_cents
          else liabilitiesCents += snap.balance_cents
        }
      }
      results.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        net_worth_cents: assetsCents - liabilitiesCents,
        assets_cents: assetsCents,
        liabilities_cents: liabilitiesCents,
      })
    }

    return results
  })

  log.debug('Account IPC handlers registered')
}
