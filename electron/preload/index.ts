import { contextBridge, ipcRenderer } from 'electron'

function invoke<T>(channel: string, data?: unknown): Promise<T> {
  return (ipcRenderer.invoke(channel, data) as Promise<T>).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`IPC ${channel}: ${msg}`)
  })
}

const api = {
  // System
  ping: () => invoke<{ pong: boolean; ts: number }>('ping'),

  // Accounts
  accounts: {
    list: (req?: { kind?: 'asset' | 'liability'; includeArchived?: boolean }) =>
      invoke('accounts:list', req),
    create: (req: {
      name: string
      kind: 'asset' | 'liability'
      type: string
      institution: string
      currency?: string
      initial_balance_cents: number
    }) => invoke('accounts:create', req),
    update: (req: { id: string; name?: string; institution?: string; is_archived?: boolean }) =>
      invoke('accounts:update', req),
    getHistory: (req: { id: string }) => invoke('accounts:getHistory', req),
  },

  balances: {
    update: (req: { updates: { account_id: string; balance_cents: number }[] }) =>
      invoke('balances:update', req),
  },

  netWorth: {
    trend: (req?: { months?: number }) => invoke('accounts:netWorthTrend', req ?? {}),
  },

  // Mortgages
  mortgages: {
    list: () => invoke('mortgages:list', {}),
    create: (req: {
      account_id: string
      property_id?: string | null
      original_principal_cents: number
      interest_rate_bps: number
      term_months: number
      start_date: string
      payment_day_of_month?: number
    }) => invoke('mortgages:create', req),
    upsertExtraPayment: (req: {
      mortgage_id: string
      kind: 'extra_monthly' | 'lump_sum'
      amount_cents: number
      applied_date: string
    }) => invoke('mortgages:upsertExtraPayment', req),
    deleteExtraPayment: (req: { id: string }) => invoke('mortgages:deleteExtraPayment', req),
  },

  // Properties
  properties: {
    list: () => invoke('properties:list', {}),
    create: (req: {
      address: string
      purchase_price_cents: number
      purchase_date: string
      beds?: number | null
      baths?: number | null
      sqft?: number | null
      year_built?: number | null
    }) => invoke('properties:create', req),
    addHomeValue: (req: {
      property_id: string
      value_cents: number
      source?: 'manual' | 'zillow' | 'other'
      notes?: string
    }) => invoke('properties:addHomeValue', req),
    homeValueHistory: (req: { property_id: string }) =>
      invoke('properties:homeValueHistory', req),
  },

  // Sites
  sites: {
    list: () => invoke('sites:list', {}),
    create: (req: {
      name: string
      url: string
      check_interval_seconds?: number
      alert_on_down?: boolean
      alert_on_slow_ms?: number | null
    }) => invoke('sites:create', req),
    update: (req: {
      id: string
      name?: string
      url?: string
      check_interval_seconds?: number
      is_active?: boolean
      alert_on_down?: boolean
      alert_on_slow_ms?: number | null
    }) => invoke('sites:update', req),
    delete: (req: { id: string }) => invoke('sites:delete', req),
    getChecks: (req: { site_id: string; limit?: number }) => invoke('sites:getChecks', req),
  },

  // Devices
  devices: {
    list: () => invoke('devices:list', {}),
    create: (req: { name: string; kind: string }) => invoke('devices:create', req),
    delete: (req: { id: string }) => invoke('devices:delete', req),
  },

  // Settings
  settings: {
    get: () => invoke('settings:get', {}),
    update: (req: { theme?: 'dark' | 'light' | 'system'; agent_server_port?: number }) =>
      invoke('settings:update', req),
    export: () => invoke('settings:export', {}),
    import: () => invoke('settings:import', {}),
    openDataFolder: () => invoke('settings:openDataFolder'),
  },
} as const

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
