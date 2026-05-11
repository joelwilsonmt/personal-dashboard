import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { log } from '../logger'

export function handle(
  channel: string,
  fn: (e: IpcMainInvokeEvent, raw: unknown) => Promise<unknown> | unknown,
): void {
  ipcMain.handle(channel, async (e, raw) => {
    try {
      return await fn(e, raw)
    } catch (err) {
      log.error({ channel, err }, 'IPC handler error')
      throw err
    }
  })
}
