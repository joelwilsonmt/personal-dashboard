import { app, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { db, sqlite } from '../db/client'
import {
  GetSettingsRequest,
  UpdateSettingsRequest,
  ExportDataRequest,
  ImportDataRequest,
} from '@shared/ipc/contracts'
import { log } from '../logger'
import { handle } from './handle'
import type { AppStore } from '../store'

const TABLE_COLUMNS: Record<string, ReadonlySet<string>> = {
  accounts: new Set(['id', 'name', 'kind', 'type', 'institution', 'currency', 'plaid_account_id', 'is_archived', 'created_at', 'updated_at']),
  balance_snapshots: new Set(['id', 'account_id', 'balance_cents', 'source', 'recorded_at']),
  mortgages: new Set(['id', 'account_id', 'property_id', 'original_principal_cents', 'interest_rate_bps', 'term_months', 'start_date', 'payment_day_of_month']),
  mortgage_extra_payments: new Set(['id', 'mortgage_id', 'amount_cents', 'applied_date', 'kind']),
  properties: new Set(['id', 'address', 'purchase_price_cents', 'purchase_date', 'beds', 'baths', 'sqft', 'year_built', 'zillow_zpid', 'created_at', 'updated_at']),
  home_value_snapshots: new Set(['id', 'property_id', 'value_cents', 'recorded_at', 'source', 'notes']),
  devices: new Set(['id', 'name', 'kind', 'agent_token', 'last_seen_at', 'last_metrics_json', 'created_at']),
  sites: new Set(['id', 'name', 'url', 'check_interval_seconds', 'is_active', 'alert_on_down', 'alert_on_slow_ms', 'created_at']),
  site_checks: new Set(['id', 'site_id', 'checked_at', 'status_code', 'response_ms', 'ok', 'error_message']),
}

let store: AppStore

export function initSettingsStore(s: AppStore): void {
  store = s
}

export function registerSettingsHandlers(): void {
  handle('settings:get', (_e, raw: unknown) => {
    GetSettingsRequest.parse(raw ?? {})
    return {
      theme: (store.get('theme') as 'dark' | 'light' | 'system' | undefined) ?? 'dark',
      agent_server_port: (store.get('agent_server_port') as number | undefined) ?? 53117,
      plaid_configured: false, // Phase 2
      app_version: app.getVersion(),
    }
  })

  handle('settings:update', (_e, raw: unknown) => {
    const data = UpdateSettingsRequest.parse(raw)
    if (data.theme) store.set('theme', data.theme)
    if (data.agent_server_port) store.set('agent_server_port', data.agent_server_port)
    return {
      theme: (store.get('theme') as 'dark' | 'light' | 'system' | undefined) ?? 'dark',
      agent_server_port: (store.get('agent_server_port') as number | undefined) ?? 53117,
      plaid_configured: false,
      app_version: app.getVersion(),
    }
  })

  handle('settings:export', async (_e, raw: unknown) => {
    ExportDataRequest.parse(raw ?? {})
    const result = await dialog.showSaveDialog({
      defaultPath: `dashboard-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (result.canceled || !result.filePath) return { path: '' }

    // Export all tables as JSON
    const exportData: Record<string, unknown[]> = {}
    const tables = [
      'accounts',
      'balance_snapshots',
      'mortgages',
      'mortgage_extra_payments',
      'properties',
      'home_value_snapshots',
      'devices',
      'sites',
      'site_checks',
    ]
    for (const table of tables) {
      exportData[table] = sqlite.prepare(`SELECT * FROM ${table}`).all()
    }

    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    log.info({ path: result.filePath }, 'Data exported')
    return { path: result.filePath }
  })

  handle('settings:import', async (_e, raw: unknown) => {
    ImportDataRequest.parse(raw ?? {})
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    })
    if (result.canceled || !result.filePaths[0]) return { imported: false }

    let data: Record<string, unknown[]>
    try {
      data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8')) as Record<string, unknown[]>
    } catch {
      return { imported: false, error: 'Invalid JSON file' }
    }

    // Delete children before parents, insert parents before children.
    const deleteOrder = [
      'site_checks', 'home_value_snapshots', 'mortgage_extra_payments',
      'balance_snapshots', 'devices',
      'sites', 'mortgages', 'properties', 'accounts',
    ]
    const insertOrder = [...deleteOrder].reverse()

    try {
      sqlite.transaction(() => {
        for (const table of deleteOrder) {
          sqlite.prepare(`DELETE FROM ${table}`).run()
        }
        for (const table of insertOrder) {
          const rows = data[table]
          if (!rows?.length) continue
          const firstRow = rows[0] as Record<string, unknown>
          const allowedCols = TABLE_COLUMNS[table]
          const keys = Object.keys(firstRow).filter((k) => allowedCols?.has(k))
          if (keys.length === 0) continue
          const cols = keys.join(', ')
          const placeholders = keys.map(() => '?').join(', ')
          const stmt = sqlite.prepare(`INSERT OR REPLACE INTO ${table} (${cols}) VALUES (${placeholders})`)
          for (const row of rows) {
            stmt.run(keys.map((k) => (row as Record<string, unknown>)[k]))
          }
        }
      })()
      log.info({ path: result.filePaths[0] }, 'Data imported')
      return { imported: true }
    } catch (err) {
      log.error(err, 'Import failed')
      return { imported: false, error: err instanceof Error ? err.message : 'Import failed' }
    }
  })

  handle('settings:openDataFolder', async () => {
    const { shell } = await import('electron')
    const dataDir = path.join(app.getPath('userData'), 'data')
    await shell.openPath(dataDir)
  })

  log.debug('Settings IPC handlers registered')
}
