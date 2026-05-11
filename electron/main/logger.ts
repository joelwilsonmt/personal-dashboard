import pino from 'pino'

const isDev = process.env['NODE_ENV'] === 'development'

export const logger = pino({
  level: isDev ? 'debug' : 'info',
})

export const log = logger
