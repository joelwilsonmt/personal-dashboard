import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core'

// ---------------------------------------------------------------------------
// accounts
// ---------------------------------------------------------------------------

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['asset', 'liability'] }).notNull(),
  type: text('type', {
    enum: ['checking', 'savings', 'brokerage', 'retirement', 'credit_card', 'mortgage', 'other'],
  }).notNull(),
  institution: text('institution').notNull().default(''),
  currency: text('currency').notNull().default('USD'),
  plaid_account_id: text('plaid_account_id'),
  is_archived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

// ---------------------------------------------------------------------------
// balance_snapshots
// ---------------------------------------------------------------------------

export const balance_snapshots = sqliteTable(
  'balance_snapshots',
  {
    id: text('id').primaryKey(),
    account_id: text('account_id')
      .notNull()
      .references(() => accounts.id),
    balance_cents: integer('balance_cents').notNull(),
    source: text('source', { enum: ['manual', 'plaid'] }).notNull().default('manual'),
    recorded_at: integer('recorded_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    index('balance_snapshots_account_recorded').on(t.account_id, t.recorded_at),
  ],
)

// ---------------------------------------------------------------------------
// transactions
// ---------------------------------------------------------------------------

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey(),
    account_id: text('account_id')
      .notNull()
      .references(() => accounts.id),
    posted_at: integer('posted_at', { mode: 'timestamp' }).notNull(),
    amount_cents: integer('amount_cents').notNull(),
    merchant: text('merchant').notNull().default(''),
    category: text('category').notNull().default(''),
    description: text('description').notNull().default(''),
    plaid_transaction_id: text('plaid_transaction_id').unique(),
    source: text('source', { enum: ['manual', 'plaid'] }).notNull().default('manual'),
  },
  (t) => [
    index('transactions_account_posted').on(t.account_id, t.posted_at),
  ],
)

// ---------------------------------------------------------------------------
// mortgages
// ---------------------------------------------------------------------------

export const mortgages = sqliteTable('mortgages', {
  id: text('id').primaryKey(),
  account_id: text('account_id')
    .notNull()
    .references(() => accounts.id),
  property_id: text('property_id').references(() => properties.id),
  original_principal_cents: integer('original_principal_cents').notNull(),
  interest_rate_bps: integer('interest_rate_bps').notNull(),
  term_months: integer('term_months').notNull(),
  start_date: integer('start_date', { mode: 'timestamp' }).notNull(),
  payment_day_of_month: integer('payment_day_of_month').notNull().default(1),
})

// ---------------------------------------------------------------------------
// mortgage_extra_payments
// ---------------------------------------------------------------------------

export const mortgage_extra_payments = sqliteTable('mortgage_extra_payments', {
  id: text('id').primaryKey(),
  mortgage_id: text('mortgage_id')
    .notNull()
    .references(() => mortgages.id),
  amount_cents: integer('amount_cents').notNull(),
  applied_date: integer('applied_date', { mode: 'timestamp' }).notNull(),
  kind: text('kind', {
    enum: ['extra_monthly', 'biweekly_conversion', 'lump_sum'],
  }).notNull(),
})

// ---------------------------------------------------------------------------
// properties & home_value_snapshots
// ---------------------------------------------------------------------------

export const properties = sqliteTable('properties', {
  id: text('id').primaryKey(),
  address: text('address').notNull(),
  purchase_price_cents: integer('purchase_price_cents').notNull(),
  purchase_date: integer('purchase_date', { mode: 'timestamp' }).notNull(),
  beds: real('beds'),
  baths: real('baths'),
  sqft: integer('sqft'),
  year_built: integer('year_built'),
  zillow_zpid: text('zillow_zpid'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const home_value_snapshots = sqliteTable(
  'home_value_snapshots',
  {
    id: text('id').primaryKey(),
    property_id: text('property_id')
      .notNull()
      .references(() => properties.id),
    value_cents: integer('value_cents').notNull(),
    recorded_at: integer('recorded_at', { mode: 'timestamp' }).notNull(),
    source: text('source', { enum: ['manual', 'zillow', 'other'] }).notNull().default('manual'),
    notes: text('notes').notNull().default(''),
  },
  (t) => [
    index('home_value_snapshots_property_recorded').on(t.property_id, t.recorded_at),
  ],
)

// ---------------------------------------------------------------------------
// monthly_expenses
// ---------------------------------------------------------------------------

export const monthly_expenses = sqliteTable('monthly_expenses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount_cents: integer('amount_cents').notNull(),
  category: text('category').notNull().default(''),
  due_day: integer('due_day').notNull().default(1),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

// ---------------------------------------------------------------------------
// devices
// ---------------------------------------------------------------------------

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', {
    enum: ['macbook', 'server', 'laptop', 'phone', 'other'],
  }).notNull(),
  agent_token: text('agent_token').notNull().unique(),
  last_seen_at: integer('last_seen_at', { mode: 'timestamp' }),
  last_metrics_json: text('last_metrics_json'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
})

// ---------------------------------------------------------------------------
// sites & site_checks
// ---------------------------------------------------------------------------

export const sites = sqliteTable('sites', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  check_interval_seconds: integer('check_interval_seconds').notNull().default(300),
  is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  alert_on_down: integer('alert_on_down', { mode: 'boolean' }).notNull().default(true),
  alert_on_slow_ms: integer('alert_on_slow_ms'),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const site_checks = sqliteTable(
  'site_checks',
  {
    id: text('id').primaryKey(),
    site_id: text('site_id')
      .notNull()
      .references(() => sites.id),
    checked_at: integer('checked_at', { mode: 'timestamp' }).notNull(),
    status_code: integer('status_code'),
    response_ms: integer('response_ms'),
    ok: integer('ok', { mode: 'boolean' }).notNull(),
    error_message: text('error_message'),
  },
  (t) => [
    index('site_checks_site_checked').on(t.site_id, t.checked_at),
  ],
)

// ---------------------------------------------------------------------------
// alerts
// ---------------------------------------------------------------------------

export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey(),
  target_kind: text('target_kind', { enum: ['site', 'device'] }).notNull(),
  target_id: text('target_id').notNull(),
  condition_json: text('condition_json').notNull(),
  last_triggered_at: integer('last_triggered_at', { mode: 'timestamp' }),
})
