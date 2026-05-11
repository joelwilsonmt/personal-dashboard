import { eq, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client'
import { devices, device_metrics } from '@shared/db/schema'
import {
  ListDevicesRequest,
  CreateDeviceRequest,
  DeleteDeviceRequest,
  GetDeviceHistoryRequest,
} from '@shared/ipc/contracts'
import { log } from '../logger'
import { handle } from './handle'

function generateToken(): string {
  return nanoid(32)
}

export function registerDeviceHandlers(): void {
  handle('devices:list', async (_e, raw) => {
    ListDevicesRequest.parse(raw ?? {})
    return db.select().from(devices).orderBy(devices.name)
  })

  handle('devices:create', async (_e, raw) => {
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

  handle('devices:delete', async (_e, raw) => {
    const { id } = DeleteDeviceRequest.parse(raw)
    await db.delete(devices).where(eq(devices.id, id))
    return { deleted: true }
  })

  handle('devices:getHistory', async (_e, raw) => {
    const { device_id, limit } = GetDeviceHistoryRequest.parse(raw)
    return db
      .select()
      .from(device_metrics)
      .where(eq(device_metrics.device_id, device_id))
      .orderBy(desc(device_metrics.recorded_at))
      .limit(limit)
  })

  log.debug('Device IPC handlers registered')
}
