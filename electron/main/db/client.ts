import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import * as schema from '@shared/db/schema'

const dataDir = path.join(app.getPath('userData'), 'data')
fs.mkdirSync(dataDir, { recursive: true })

const dbPath = path.join(dataDir, 'dashboard.db')

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })

// In dev: __dirname = out/main/ → go up two levels to project root, then into migrations
// In prod (packaged): migrations are bundled into the asar alongside the main bundle
const migrationsFolder = app.isPackaged
  ? path.join(path.dirname(process.execPath), '../Resources/app.asar.unpacked/electron/main/db/migrations')
  : path.join(__dirname, '../../electron/main/db/migrations')

export function runMigrations(): void {
  if (fs.existsSync(migrationsFolder)) {
    migrate(db, { migrationsFolder })
  } else {
    // Fallback: inline migrations for dev if the path is wrong
    // This should not happen in normal flow
    const fallback = path.join(process.cwd(), 'electron/main/db/migrations')
    if (fs.existsSync(fallback)) {
      migrate(db, { migrationsFolder: fallback })
    }
  }
}

export { sqlite }
