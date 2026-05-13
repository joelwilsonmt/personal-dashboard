import { eq, desc, inArray, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client'
import {
  mortgages,
  mortgage_extra_payments,
  properties,
  home_value_snapshots,
  accounts,
} from '@shared/db/schema'
import {
  ListMortgagesRequest,
  CreateMortgageRequest,
  UpsertExtraPaymentRequest,
  DeleteExtraPaymentRequest,
  DeleteMortgageRequest,
  ListPropertiesRequest,
  CreatePropertyRequest,
  AddHomeValueSnapshotRequest,
  GetHomeValueHistoryRequest,
  SaveRecurringPaymentsRequest,
} from '@shared/ipc/contracts'
import { sql } from 'drizzle-orm'
import { log } from '../logger'
import { handle } from './handle'

export function registerMortgageHandlers(): void {
  handle('mortgages:list', async (_e, raw) => {
    ListMortgagesRequest.parse(raw ?? {})
    const allMortgages = await db.select().from(mortgages)
    if (allMortgages.length === 0) return []

    const mortgageIds = allMortgages.map((m) => m.id)
    const propertyIds = allMortgages.map((m) => m.property_id).filter(Boolean) as string[]

    const allExtraPayments = await db
      .select()
      .from(mortgage_extra_payments)
      .where(inArray(mortgage_extra_payments.mortgage_id, mortgageIds))
      .orderBy(mortgage_extra_payments.applied_date)

    const allProperties =
      propertyIds.length > 0
        ? await db.select().from(properties).where(inArray(properties.id, propertyIds))
        : []

    const extraByMortgage = new Map<string, typeof mortgage_extra_payments.$inferSelect[]>()
    for (const ep of allExtraPayments) {
      const arr = extraByMortgage.get(ep.mortgage_id) ?? []
      arr.push(ep)
      extraByMortgage.set(ep.mortgage_id, arr)
    }
    const propertyMap = new Map(allProperties.map((p) => [p.id, p]))

    return allMortgages.map((m) => ({
      ...m,
      extra_payments: extraByMortgage.get(m.id) ?? [],
      property: m.property_id ? (propertyMap.get(m.property_id) ?? null) : null,
    }))
  })

  handle('mortgages:create', async (_e, raw: unknown) => {
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

  handle('mortgages:upsertExtraPayment', async (_e, raw: unknown) => {
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

  handle('mortgages:deleteExtraPayment', async (_e, raw: unknown) => {
    const { id } = DeleteExtraPaymentRequest.parse(raw)
    await db.delete(mortgage_extra_payments).where(eq(mortgage_extra_payments.id, id))
    return { deleted: true }
  })

  handle('mortgages:delete', async (_e, raw: unknown) => {
    const { id } = DeleteMortgageRequest.parse(raw)
    const mortgage = await db.select().from(mortgages).where(eq(mortgages.id, id)).get()
    await db.delete(mortgage_extra_payments).where(eq(mortgage_extra_payments.mortgage_id, id))
    await db.delete(mortgages).where(eq(mortgages.id, id))
    if (mortgage?.account_id) {
      await db.update(accounts)
        .set({ is_archived: true, updated_at: new Date() })
        .where(eq(accounts.id, mortgage.account_id))
    }
    return { deleted: true }
  })

  handle('mortgages:saveRecurring', async (_e, raw) => {
    const data = SaveRecurringPaymentsRequest.parse(raw)
    // Delete all existing recurring kinds for this mortgage
    await db
      .delete(mortgage_extra_payments)
      .where(
        and(
          eq(mortgage_extra_payments.mortgage_id, data.mortgage_id),
          sql`${mortgage_extra_payments.kind} IN ('extra_monthly', 'biweekly_conversion')`,
        ),
      )
    let saved = 0
    if (data.extra_monthly_cents > 0) {
      await db.insert(mortgage_extra_payments).values({
        id: nanoid(),
        mortgage_id: data.mortgage_id,
        kind: 'extra_monthly',
        amount_cents: data.extra_monthly_cents,
        applied_date: new Date(data.applied_date),
      })
      saved++
    }
    if (data.biweekly) {
      await db.insert(mortgage_extra_payments).values({
        id: nanoid(),
        mortgage_id: data.mortgage_id,
        kind: 'biweekly_conversion',
        amount_cents: 0, // actual amount computed from base payment at display time
        applied_date: new Date(data.applied_date),
      })
      saved++
    }
    return { saved }
  })

  // properties
  handle('properties:list', async (_e, raw: unknown) => {
    ListPropertiesRequest.parse(raw ?? {})
    const allProps = await db.select().from(properties)
    if (allProps.length === 0) return []

    const propIds = allProps.map((p) => p.id)
    const allSnaps = await db
      .select()
      .from(home_value_snapshots)
      .where(inArray(home_value_snapshots.property_id, propIds))
      .orderBy(desc(home_value_snapshots.recorded_at))

    const latestSnapByProp = new Map<string, typeof home_value_snapshots.$inferSelect>()
    for (const snap of allSnaps) {
      if (!latestSnapByProp.has(snap.property_id)) latestSnapByProp.set(snap.property_id, snap)
    }

    return allProps.map((p) => {
      const snap = latestSnapByProp.get(p.id) ?? null
      return {
        ...p,
        latest_value_cents: snap?.value_cents ?? null,
        latest_value_at: snap?.recorded_at ?? null,
        latest_value_source: snap?.source ?? null,
      }
    })
  })

  handle('properties:create', async (_e, raw: unknown) => {
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

  handle('properties:addHomeValue', async (_e, raw: unknown) => {
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

  handle('properties:homeValueHistory', async (_e, raw: unknown) => {
    const { property_id } = GetHomeValueHistoryRequest.parse(raw)
    return db
      .select()
      .from(home_value_snapshots)
      .where(eq(home_value_snapshots.property_id, property_id))
      .orderBy(desc(home_value_snapshots.recorded_at))
  })

  log.debug('Mortgage IPC handlers registered')
}
