/**
 * Lightweight HTTP server that device agents POST metrics to.
 * Runs on 127.0.0.1:53117 (configurable).
 */
import http from 'node:http'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client'
import { devices } from '@shared/db/schema'
import { log } from '../logger'

const AgentReportSchema = z.object({
  cpu: z.number().min(0).max(100),
  ram: z.number().min(0).max(100),
  disk: z.number().min(0).max(100),
  battery: z.number().min(0).max(100).optional(),
  network: z.number().optional(),
})

let server: http.Server | null = null

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
      if (body.length > 8192) reject(new Error('Body too large'))
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJSON(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export function startDeviceServer(port = 53117): void {
  server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/agent/health') {
      sendJSON(res, 200, { ok: true })
      return
    }

    if (req.method === 'POST' && req.url === '/agent/report') {
      const token = req.headers['x-agent-token']
      if (!token || typeof token !== 'string') {
        sendJSON(res, 401, { error: 'Missing X-Agent-Token' })
        return
      }

      const device = await db
        .select()
        .from(devices)
        .where(eq(devices.agent_token, token))
        .get()

      if (!device) {
        sendJSON(res, 401, { error: 'Unauthorized' })
        return
      }

      try {
        const body = await parseBody(req)
        const metrics = AgentReportSchema.parse(body)

        await db
          .update(devices)
          .set({
            last_seen_at: new Date(),
            last_metrics_json: JSON.stringify(metrics),
          })
          .where(eq(devices.id, device.id))

        sendJSON(res, 200, { ok: true })
        log.debug({ device: device.name }, 'Agent report received')
      } catch (err) {
        sendJSON(res, 400, { error: err instanceof Error ? err.message : 'Bad request' })
      }
      return
    }

    sendJSON(res, 404, { error: 'Not found' })
  })

  server.listen(port, '127.0.0.1', () => {
    log.info({ port }, 'Device agent server started')
  })
}

export function stopDeviceServer(): void {
  server?.close()
  server = null
}
