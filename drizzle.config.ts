import { defineConfig } from 'drizzle-kit'
import path from 'node:path'

const dbPath =
  process.env['DB_PATH'] ?? path.join(process.cwd(), 'dev-data', 'dashboard.db')

export default defineConfig({
  schema: './shared/db/schema.ts',
  out: './electron/main/db/migrations',
  dialect: 'sqlite',
  dbCredentials: { url: dbPath },
})
