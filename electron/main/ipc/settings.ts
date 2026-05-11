import { ipcMain, app, dialog } from 'electron'
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
import type { AppStore } from '../store'

let store: AppStore

export function initSettingsStore(s: AppStore): void {
  store = s
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', (_e, raw: unknown) => {
    GetSettingsRequest.parse(raw ?? {})
    return {
      theme: (store.get('theme') as 'dark' | 'light' | 'system' | undefined) ?? 'dark',
      agent_server_port: (store.get('agent_server_port') as number | undefined) ?? 53117,
      plaid_configured: false, // Phase 2
      app_version: app.getVersion(),
    }
  })

  ipcMain.handle('settings:update', (_e, raw: unknown) => {
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

  ipcMain.handle('settings:export', async (_e, raw: unknown) => {
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
      'transactions',
      'mortgages',
      'mortgage_extra_payments',
      'properties',
      'home_value_snapshots',
      'monthly_expenses',
      'devices',
      'sites',
      'site_checks',
      'alerts',
    ]
    for (const table of tables) {
      exportData[table] = sqlite.prepare(`SELECT * FROM ${table}`).all()
    }

    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    log.info({ path: result.filePath }, 'Data exported')
    return { path: result.filePath }
  })

  ipcMain.handle('settings:import', async (_e, raw: unknown) => {
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
      'alerts', 'site_checks', 'home_value_snapshots', 'mortgage_extra_payments',
      'transactions', 'balance_snapshots', 'monthly_expenses', 'devices',
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
          const keys = Object.keys(firstRow)
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

  ipcMain.handle('settings:openDataFolder', async () => {
    const { shell } = await import('electron')
    const dataDir = path.join(app.getPath('userData'), 'data')
    await shell.openPath(dataDir)
  })

  log.debug('Settings IPC handlers registered')
}
