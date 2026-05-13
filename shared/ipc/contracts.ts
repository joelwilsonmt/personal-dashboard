import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const AccountKindSchema = z.enum(['asset', 'liability'])
export const AccountTypeSchema = z.enum([
  'checking',
  'savings',
  'brokerage',
  'retirement',
  'credit_card',
  'mortgage',
  'other',
])
export const SourceSchema = z.enum(['manual', 'plaid'])

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: AccountKindSchema,
  type: AccountTypeSchema,
  institution: z.string(),
  currency: z.string(),
  plaid_account_id: z.string().nullable(),
  is_archived: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
  // Computed: latest balance snapshot
  latest_balance_cents: z.number().nullable(),
  latest_balance_at: z.date().nullable(),
  latest_balance_source: SourceSchema.nullable(),
})

export const SnapshotSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  balance_cents: z.number(),
  source: SourceSchema,
  recorded_at: z.date(),
})

export const MortgageSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  property_id: z.string().nullable(),
  original_principal_cents: z.number(),
  interest_rate_bps: z.number(),
  term_months: z.number(),
  start_date: z.date(),
  payment_day_of_month: z.number(),
})

export const ExtraPaymentSchema = z.object({
  id: z.string(),
  mortgage_id: z.string(),
  amount_cents: z.number(),
  applied_date: z.date(),
  kind: z.enum(['extra_monthly', 'biweekly_conversion', 'lump_sum']),
})

export const PropertySchema = z.object({
  id: z.string(),
  address: z.string(),
  purchase_price_cents: z.number(),
  purchase_date: z.date(),
  beds: z.number().nullable(),
  baths: z.number().nullable(),
  sqft: z.number().nullable(),
  year_built: z.number().nullable(),
  zillow_zpid: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
})

export const HomeValueSnapshotSchema = z.object({
  id: z.string(),
  property_id: z.string(),
  value_cents: z.number(),
  recorded_at: z.date(),
  source: z.enum(['manual', 'zillow', 'other']),
  notes: z.string(),
})

export const DeviceMetricSchema = z.object({
  id: z.string(),
  device_id: z.string(),
  recorded_at: z.date(),
  cpu: z.number(),
  ram: z.number(),
  disk: z.number(),
  battery: z.number().nullable(),
  network: z.number().nullable(),
})

export const SiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  check_interval_seconds: z.number(),
  is_active: z.boolean(),
  alert_on_down: z.boolean(),
  alert_on_slow_ms: z.number().nullable(),
  ssl_expires_at: z.date().nullable(),
  created_at: z.date(),
  // Computed stats
  latest_check: z
    .object({
      ok: z.boolean(),
      status_code: z.number().nullable(),
      response_ms: z.number().nullable(),
      checked_at: z.date(),
      error_message: z.string().nullable(),
    })
    .nullable(),
  uptime_30d_pct: z.number().nullable(),
})

export const SiteCheckSchema = z.object({
  id: z.string(),
  site_id: z.string(),
  checked_at: z.date(),
  status_code: z.number().nullable(),
  response_ms: z.number().nullable(),
  ok: z.boolean(),
  error_message: z.string().nullable(),
})

export const DeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['macbook', 'server', 'laptop', 'phone', 'other']),
  agent_token: z.string(),
  last_seen_at: z.date().nullable(),
  last_metrics_json: z.string().nullable(),
  created_at: z.date(),
})

// ---------------------------------------------------------------------------
// Channel request/response pairs
// ---------------------------------------------------------------------------

// ping
export const PingRequest = z.object({})
export const PingResponse = z.object({ pong: z.boolean(), ts: z.number() })

// accounts
export const ListAccountsRequest = z.object({
  kind: AccountKindSchema.optional(),
  includeArchived: z.boolean().optional(),
})
export const ListAccountsResponse = z.array(AccountSchema)

export const CreateAccountRequest = z.object({
  name: z.string().min(1),
  kind: AccountKindSchema,
  type: AccountTypeSchema,
  institution: z.string(),
  currency: z.string().default('USD'),
  initial_balance_cents: z.number(),
})
export const CreateAccountResponse = AccountSchema

export const UpdateAccountRequest = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  institution: z.string().optional(),
  is_archived: z.boolean().optional(),
})
export const UpdateAccountResponse = AccountSchema

export const GetAccountHistoryRequest = z.object({ id: z.string() })
export const GetAccountHistoryResponse = z.object({
  account: AccountSchema,
  snapshots: z.array(SnapshotSchema),
})

export const UpdateBalancesRequest = z.object({
  updates: z.array(
    z.object({
      account_id: z.string(),
      balance_cents: z.number(),
    }),
  ),
})
export const UpdateBalancesResponse = z.object({ updated: z.number() })

// net worth trend
export const GetNetWorthTrendRequest = z.object({ months: z.number().default(12) })
export const GetNetWorthTrendResponse = z.array(
  z.object({
    month: z.string(), // ISO date string YYYY-MM-DD
    net_worth_cents: z.number(),
    assets_cents: z.number(),
    liabilities_cents: z.number(),
  }),
)

// mortgages
export const ListMortgagesRequest = z.object({})
export const ListMortgagesResponse = z.array(
  MortgageSchema.extend({
    extra_payments: z.array(ExtraPaymentSchema),
    property: PropertySchema.nullable(),
  }),
)

export const CreateMortgageRequest = z.object({
  account_id: z.string(),
  property_id: z.string().nullable().optional(),
  original_principal_cents: z.number(),
  interest_rate_bps: z.number(),
  term_months: z.number(),
  start_date: z.string(), // ISO string
  payment_day_of_month: z.number().default(1),
})
export const CreateMortgageResponse = MortgageSchema

export const UpsertExtraPaymentRequest = z.object({
  mortgage_id: z.string(),
  kind: z.enum(['extra_monthly', 'lump_sum', 'biweekly_conversion']),
  amount_cents: z.number(),
  applied_date: z.string(), // ISO
})
export const UpsertExtraPaymentResponse = ExtraPaymentSchema

export const DeleteExtraPaymentRequest = z.object({ id: z.string() })
export const DeleteExtraPaymentResponse = z.object({ deleted: z.boolean() })

export const DeleteMortgageRequest = z.object({ id: z.string() })
export const DeleteMortgageResponse = z.object({ deleted: z.boolean() })

// properties
export const ListPropertiesRequest = z.object({})
export const ListPropertiesResponse = z.array(
  PropertySchema.extend({
    latest_value_cents: z.number().nullable(),
    latest_value_at: z.date().nullable(),
    latest_value_source: z.enum(['manual', 'zillow', 'other']).nullable(),
  }),
)

export const CreatePropertyRequest = z.object({
  address: z.string().min(1),
  purchase_price_cents: z.number(),
  purchase_date: z.string(), // ISO
  beds: z.number().nullable().optional(),
  baths: z.number().nullable().optional(),
  sqft: z.number().nullable().optional(),
  year_built: z.number().nullable().optional(),
})
export const CreatePropertyResponse = PropertySchema

export const AddHomeValueSnapshotRequest = z.object({
  property_id: z.string(),
  value_cents: z.number(),
  source: z.enum(['manual', 'zillow', 'other']).default('manual'),
  notes: z.string().optional(),
})
export const AddHomeValueSnapshotResponse = HomeValueSnapshotSchema

export const GetHomeValueHistoryRequest = z.object({ property_id: z.string() })
export const GetHomeValueHistoryResponse = z.array(HomeValueSnapshotSchema)

// sites
export const ListSitesRequest = z.object({})
export const ListSitesResponse = z.array(SiteSchema)

export const CreateSiteRequest = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  check_interval_seconds: z.number().min(30).default(300),
  alert_on_down: z.boolean().default(true),
  alert_on_slow_ms: z.number().nullable().optional(),
})
export const CreateSiteResponse = SiteSchema

export const UpdateSiteRequest = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  check_interval_seconds: z.number().min(30).optional(),
  is_active: z.boolean().optional(),
  alert_on_down: z.boolean().optional(),
  alert_on_slow_ms: z.number().nullable().optional(),
})
export const UpdateSiteResponse = SiteSchema

export const DeleteSiteRequest = z.object({ id: z.string() })
export const DeleteSiteResponse = z.object({ deleted: z.boolean() })

export const GetSiteChecksRequest = z.object({
  site_id: z.string(),
  limit: z.number().default(200),
})
export const GetSiteChecksResponse = z.array(SiteCheckSchema)

// devices
export const ListDevicesRequest = z.object({})
export const ListDevicesResponse = z.array(DeviceSchema)

export const CreateDeviceRequest = z.object({
  name: z.string().min(1),
  kind: z.enum(['macbook', 'server', 'laptop', 'phone', 'other']),
})
export const CreateDeviceResponse = DeviceSchema

export const DeleteDeviceRequest = z.object({ id: z.string() })
export const DeleteDeviceResponse = z.object({ deleted: z.boolean() })

export const GetDeviceHistoryRequest = z.object({
  device_id: z.string(),
  limit: z.number().default(200),
})
export const GetDeviceHistoryResponse = z.array(DeviceMetricSchema)

// Atomically replaces all recurring extra payments (extra_monthly + biweekly_conversion)
// for a mortgage. Pass 0 / false to clear.
export const SaveRecurringPaymentsRequest = z.object({
  mortgage_id: z.string(),
  extra_monthly_cents: z.number(),
  biweekly: z.boolean(),
  applied_date: z.string(),
})
export const SaveRecurringPaymentsResponse = z.object({ saved: z.number() })

// settings
export const GetSettingsRequest = z.object({})
export const GetSettingsResponse = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  agent_server_port: z.number().default(53117),
  plaid_configured: z.boolean(),
  app_version: z.string(),
})

export const UpdateSettingsRequest = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  agent_server_port: z.number().optional(),
})
export const UpdateSettingsResponse = GetSettingsResponse

export const ExportDataRequest = z.object({})
export const ExportDataResponse = z.object({ path: z.string() })

export const ImportDataRequest = z.object({})
export const ImportDataResponse = z.object({ imported: z.boolean(), error: z.string().optional() })
