import { contextBridge, ipcRenderer } from 'electron'
import type { z } from 'zod'
import type {
  CreateAccountRequest,
  UpdateAccountRequest,
  ListAccountsRequest,
  UpdateBalancesRequest,
  GetNetWorthTrendRequest,
  CreateMortgageRequest,
  UpsertExtraPaymentRequest,
  DeleteExtraPaymentRequest,
  SaveRecurringPaymentsRequest,
  CreatePropertyRequest,
  AddHomeValueSnapshotRequest,
  GetHomeValueHistoryRequest,
  CreateSiteRequest,
  UpdateSiteRequest,
  DeleteSiteRequest,
  GetSiteChecksRequest,
  CreateDeviceRequest,
  DeleteDeviceRequest,
  GetDeviceHistoryRequest,
  UpdateSettingsRequest,
} from '@shared/ipc/contracts'

type In<T extends z.ZodTypeAny> = z.input<T>

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
    list: (req?: In<typeof ListAccountsRequest>) => invoke('accounts:list', req),
    create: (req: In<typeof CreateAccountRequest>) => invoke('accounts:create', req),
    update: (req: In<typeof UpdateAccountRequest>) => invoke('accounts:update', req),
    getHistory: (req: { id: string }) => invoke('accounts:getHistory', req),
  },

  balances: {
    update: (req: In<typeof UpdateBalancesRequest>) => invoke('balances:update', req),
  },

  netWorth: {
    trend: (req?: In<typeof GetNetWorthTrendRequest>) => invoke('accounts:netWorthTrend', req ?? {}),
  },

  // Mortgages
  mortgages: {
    list: () => invoke('mortgages:list', {}),
    create: (req: In<typeof CreateMortgageRequest>) => invoke('mortgages:create', req),
    upsertExtraPayment: (req: In<typeof UpsertExtraPaymentRequest>) =>
      invoke('mortgages:upsertExtraPayment', req),
    deleteExtraPayment: (req: In<typeof DeleteExtraPaymentRequest>) =>
      invoke('mortgages:deleteExtraPayment', req),
    saveRecurring: (req: In<typeof SaveRecurringPaymentsRequest>) =>
      invoke('mortgages:saveRecurring', req),
  },

  // Properties
  properties: {
    list: () => invoke('properties:list', {}),
    create: (req: In<typeof CreatePropertyRequest>) => invoke('properties:create', req),
    addHomeValue: (req: In<typeof AddHomeValueSnapshotRequest>) =>
      invoke('properties:addHomeValue', req),
    homeValueHistory: (req: In<typeof GetHomeValueHistoryRequest>) =>
      invoke('properties:homeValueHistory', req),
  },

  // Sites
  sites: {
    list: () => invoke('sites:list', {}),
    create: (req: In<typeof CreateSiteRequest>) => invoke('sites:create', req),
    update: (req: In<typeof UpdateSiteRequest>) => invoke('sites:update', req),
    delete: (req: In<typeof DeleteSiteRequest>) => invoke('sites:delete', req),
    getChecks: (req: In<typeof GetSiteChecksRequest>) => invoke('sites:getChecks', req),
  },

  // Devices
  devices: {
    list: () => invoke('devices:list', {}),
    create: (req: In<typeof CreateDeviceRequest>) => invoke('devices:create', req),
    delete: (req: In<typeof DeleteDeviceRequest>) => invoke('devices:delete', req),
    getHistory: (req: In<typeof GetDeviceHistoryRequest>) => invoke('devices:getHistory', req),
  },

  // Settings
  settings: {
    get: () => invoke('settings:get', {}),
    update: (req: In<typeof UpdateSettingsRequest>) => invoke('settings:update', req),
    export: () => invoke('settings:export', {}),
    import: () => invoke('settings:import', {}),
    openDataFolder: () => invoke('settings:openDataFolder'),
  },
} as const

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
