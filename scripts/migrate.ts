/**
 * Run this with system Node (not Electron) to apply migrations.
 *   node --import tsx ./scripts/migrate.ts
 *
 * Uses DB_PATH env var or falls back to ./dev-data/dashboard.db
 */
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = process.env['DB_PATH'] ?? path.join(__dirname, '..', 'dev-data', 'dashboard.db')
const migrationsFolder = path.join(__dirname, '..', 'electron', 'main', 'db', 'migrations')

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

const db = drizzle(sqlite)

migrate(db, { migrationsFolder })

sqlite.close()
