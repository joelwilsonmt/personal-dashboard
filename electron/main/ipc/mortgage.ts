import { ipcMain } from 'electron'
import { eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client'
import {
  mortgages,
  mortgage_extra_payments,
  properties,
  home_value_snapshots,
} from '@shared/db/schema'
import {
  ListMortgagesRequest,
  CreateMortgageRequest,
  UpsertExtraPaymentRequest,
  DeleteExtraPaymentRequest,
  ListPropertiesRequest,
  CreatePropertyRequest,
  AddHomeValueSnapshotRequest,
  GetHomeValueHistoryRequest,
} from '@shared/ipc/contracts'
import { log } from '../logger'

export function registerMortgageHandlers(): void {
  ipcMain.handle('mortgages:list', async (_e, raw: unknown) => {
    ListMortgagesRequest.parse(raw ?? {})
    const allMortgages = await db.select().from(mortgages)
    return Promise.all(
      allMortgages.map(async (m) => {
        const extraPayments = await db
          .select()
          .from(mortgage_extra_payments)
          .where(eq(mortgage_extra_payments.mortgage_id, m.id))
          .orderBy(mortgage_extra_payments.applied_date)
        const property = m.property_id
          ? (await db.select().from(properties).where(eq(properties.id, m.property_id)).get()) ??
            null
          : null
        return { ...m, extra_payments: extraPayments, property }
      }),
    )
  })

  ipcMain.handle('mortgages:create', async (_e, raw: unknown) => {
    const data = CreateMortgageRequest.parse(raw)
    const id = nanoid()
    await db.insert(mortgages).values({
      id,
      account_id: data.account_id,
      property_id: data.property_id ?? null,
      original_principal_cents: data.original_principal_cents,
      interest_rate_bps: data.interest_rate_bps,
      term_months: data.term_months,
      start_date: new Date(data.start_date),
      payment_day_of_month: data.payment_day_of_month,
    })
    const m = await db.select().from(mortgages).where(eq(mortgages.id, id)).get()
    if (!m) throw new Error('Mortgage not found after insert')
    return m
  })

  ipcMain.handle('mortgages:upsertExtraPayment', async (_e, raw: unknown) => {
    const data = UpsertExtraPaymentRequest.parse(raw)
    const id = nanoid()
    await db.insert(mortgage_extra_payments).values({
      id,
      mortgage_id: data.mortgage_id,
      kind: data.kind,
      amount_cents: data.amount_cents,
      applied_date: new Date(data.applied_date),
    })
    const ep = await db
      .select()
      .from(mortgage_extra_payments)
      .where(eq(mortgage_extra_payments.id, id))
      .get()
    if (!ep) throw new Error('Extra payment not found')
    return ep
  })

  ipcMain.handle('mortgages:deleteExtraPayment', async (_e, raw: unknown) => {
    const { id } = DeleteExtraPaymentRequest.parse(raw)
    await db.delete(mortgage_extra_payments).where(eq(mortgage_extra_payments.id, id))
    return { deleted: true }
  })

  // properties
  ipcMain.handle('properties:list', async (_e, raw: unknown) => {
    ListPropertiesRequest.parse(raw ?? {})
    const allProps = await db.select().from(properties)
    return Promise.all(
      allProps.map(async (p) => {
        const snap = await db
          .select()
          .from(home_value_snapshots)
          .where(eq(home_value_snapshots.property_id, p.id))
          .orderBy(desc(home_value_snapshots.recorded_at))
          .limit(1)
          .get()
        return {
          ...p,
          latest_value_cents: snap?.value_cents ?? null,
          latest_value_at: snap?.recorded_at ?? null,
          latest_value_source: snap?.source ?? null,
        }
      }),
    )
  })

  ipcMain.handle('properties:create', async (_e, raw: unknown) => {
    const data = CreatePropertyRequest.parse(raw)
    const id = nanoid()
    const now = new Date()
    await db.insert(properties).values({
      id,
      address: data.address,
      purchase_price_cents: data.purchase_price_cents,
      purchase_date: new Date(data.purchase_date),
      beds: data.beds ?? null,
      baths: data.baths ?? null,
      sqft: data.sqft ?? null,
      year_built: data.year_built ?? null,
      zillow_zpid: null,
      created_at: now,
      updated_at: now,
    })
    const p = await db.select().from(properties).where(eq(properties.id, id)).get()
    if (!p) throw new Error('Property not found after insert')
    return p
  })

  ipcMain.handle('properties:addHomeValue', async (_e, raw: unknown) => {
    const data = AddHomeValueSnapshotRequest.parse(raw)
    const id = nanoid()
    await db.insert(home_value_snapshots).values({
      id,
      property_id: data.property_id,
      value_cents: data.value_cents,
      recorded_at: new Date(),
      source: data.source,
      notes: data.notes ?? '',
    })
    const snap = await db
      .select()
      .from(home_value_snapshots)
      .where(eq(home_value_snapshots.id, id))
      .get()
    if (!snap) throw new Error('Snapshot not found')
    return snap
  })

  ipcMain.handle('properties:homeValueHistory', async (_e, raw: unknown) => {
    const { property_id } = GetHomeValueHistoryRequest.parse(raw)
    return db
      .select()
      .from(home_value_snapshots)
      .where(eq(home_value_snapshots.property_id, property_id))
      .orderBy(desc(home_value_snapshots.recorded_at))
  })

  log.debug('Mortgage IPC handlers registered')
}
