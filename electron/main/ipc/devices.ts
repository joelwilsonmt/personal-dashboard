import { ipcMain } from 'electron'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client'
import { devices } from '@shared/db/schema'
import { ListDevicesRequest, CreateDeviceRequest, DeleteDeviceRequest } from '@shared/ipc/contracts'
import { log } from '../logger'

function generateToken(): string {
  return nanoid(32)
}

export function registerDeviceHandlers(): void {
  ipcMain.handle('devices:list', async (_e, raw: unknown) => {
    ListDevicesRequest.parse(raw ?? {})
    return db.select().from(devices).orderBy(devices.name)
  })

  ipcMain.handle('devices:create', async (_e, raw: unknown) => {
    const data = CreateDeviceRequest.parse(raw)
    const id = nanoid()
    const now = new Date()
    await db.insert(devices).values({
      id,
      name: data.name,
      kind: data.kind,
      agent_token: generateToken(),
      last_seen_at: null,
      last_metrics_json: null,
      created_at: now,
    })
    const device = await db.select().from(devices).where(eq(devices.id, id)).get()
    if (!device) throw new Error('Device not found after insert')
    return device
  })

  ipcMain.handle('devices:delete', async (_e, raw: unknown) => {
    const { id } = DeleteDeviceRequest.parse(raw)
    await db.delete(devices).where(eq(devices.id, id))
    return { deleted: true }
  })

  log.debug('Device IPC handlers registered')
}
