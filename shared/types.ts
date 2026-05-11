import { z } from 'zod'
import type {
  AccountSchema,
  SnapshotSchema,
  MortgageSchema,
  ExtraPaymentSchema,
  PropertySchema,
  HomeValueSnapshotSchema,
  SiteSchema,
  SiteCheckSchema,
  DeviceSchema,
  MonthlyExpenseSchema,
  GetSettingsResponse,
  ListMortgagesResponse,
  ListPropertiesResponse,
  GetNetWorthTrendResponse,
} from './ipc/contracts'

export type Account = z.infer<typeof AccountSchema>
export type Snapshot = z.infer<typeof SnapshotSchema>
export type Mortgage = z.infer<typeof MortgageSchema>
export type ExtraPayment = z.infer<typeof ExtraPaymentSchema>
export type Property = z.infer<typeof PropertySchema>
export type HomeValueSnapshot = z.infer<typeof HomeValueSnapshotSchema>
export type Site = z.infer<typeof SiteSchema>
export type SiteCheck = z.infer<typeof SiteCheckSchema>
export type Device = z.infer<typeof DeviceSchema>
export type MonthlyExpense = z.infer<typeof MonthlyExpenseSchema>
export type Settings = z.infer<typeof GetSettingsResponse>
export type MortgageWithDetails = z.infer<typeof ListMortgagesResponse>[number]
export type PropertyWithValue = z.infer<typeof ListPropertiesResponse>[number]
export type NetWorthPoint = z.infer<typeof GetNetWorthTrendResponse>[number]

export type AccountKind = 'asset' | 'liability'
export type AccountType =
  | 'checking'
  | 'savings'
  | 'brokerage'
  | 'retirement'
  | 'credit_card'
  | 'mortgage'
  | 'other'

export type DeviceMetrics = {
  cpu: number
  ram: number
  disk: number
  battery?: number
  network?: number
}

export type SiteStatus = 'up' | 'slow' | 'down' | 'unknown'
export type DeviceStatus = 'online' | 'recent' | 'offline' | 'unknown'
