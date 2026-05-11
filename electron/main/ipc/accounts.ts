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
import { handle } from './handle'

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

// Fetches only the single latest snapshot per account via correlated subquery.
// Avoids loading the full snapshot history when only the most recent row is needed.
async function latestSnapshotsForAccounts(
  accountIds: string[],
): Promise<Map<string, typeof balance_snapshots.$inferSelect>> {
  const map = new Map<string, typeof balance_snapshots.$inferSelect>()
  if (accountIds.length === 0) return map
  const snaps = await db
    .select()
    .from(balance_snapshots)
    .where(
      and(
        inArray(balance_snapshots.account_id, accountIds),
        sql`${balance_snapshots.recorded_at} = (
          SELECT MAX(recorded_at) FROM balance_snapshots b2
          WHERE b2.account_id = ${balance_snapshots.account_id}
        )`,
      ),
    )
  for (const s of snaps) {
    map.set(s.account_id, s)
  }
  return map
}

export function registerAccountHandlers(): void {
  handle('ping', (_e, raw) => {
    PingRequest.parse(raw ?? {})
    return { pong: true, ts: Date.now() }
  })

  handle('accounts:list', async (_e, raw) => {
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
    const snapshotMap = await latestSnapshotsForAccounts(rows.map((r) => r.id))
    return rows.map((r) => accountWithBalance(r, snapshotMap.get(r.id) ?? null))
  })

  handle('accounts:create', async (_e, raw) => {
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
    const snapshotMap = await latestSnapshotsForAccounts([id])
    return accountWithBalance(acct, snapshotMap.get(id) ?? null)
  })

  handle('accounts:update', async (_e, raw) => {
    const { id, ...data } = UpdateAccountRequest.parse(raw)
    await db
      .update(accounts)
      .set({ ...data, updated_at: new Date() })
      .where(eq(accounts.id, id))
    const acct = await db.select().from(accounts).where(eq(accounts.id, id)).get()
    if (!acct) throw new Error('Account not found')
    const snapshotMap = await latestSnapshotsForAccounts([id])
    return accountWithBalance(acct, snapshotMap.get(id) ?? null)
  })

  handle('accounts:getHistory', async (_e, raw) => {
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

  handle('balances:update', async (_e, raw) => {
    const { updates } = UpdateBalancesRequest.parse(raw)
    const now = new Date()
    const accountIds = updates.map((u) => u.account_id)
    const latestMap = await latestSnapshotsForAccounts(accountIds)
    let updated = 0
    for (const u of updates) {
      const latest = latestMap.get(u.account_id)
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

  handle('accounts:netWorthTrend', async (_e, raw) => {
    const { months } = GetNetWorthTrendRequest.parse(raw ?? {})

    const accts = await db
      .select({ id: accounts.id, kind: accounts.kind })
      .from(accounts)
      .where(eq(accounts.is_archived, false))

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

    // Batch-fetch the latest snapshot for accounts with no data in the window
    const missingIds = accts.map((a) => a.id).filter((id) => !accountsInWindow.has(id))
    if (missingIds.length > 0) {
      const fallbacks = await db
        .select()
        .from(balance_snapshots)
        .where(
          and(
            inArray(balance_snapshots.account_id, missingIds),
            sql`${balance_snapshots.recorded_at} = (
              SELECT MAX(recorded_at) FROM balance_snapshots b2
              WHERE b2.account_id = ${balance_snapshots.account_id}
            )`,
          ),
        )
      for (const s of fallbacks) {
        snapsByAccount.set(s.account_id, [{ balance_cents: s.balance_cents, recorded_at: s.recorded_at }])
      }
    }

    const results = []
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
      let assetsCents = 0,
        liabilitiesCents = 0
      for (const acct of accts) {
        const snap = (snapsByAccount.get(acct.id) ?? []).find(
          (s) => s.recorded_at.getTime() <= monthEnd.getTime(),
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
