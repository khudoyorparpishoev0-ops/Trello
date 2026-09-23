import { Writable } from 'node:stream'
import { createLogger, type Logger } from '../src/logger.js'

export function memoryLogger(level = 'debug'): {
  logger: Logger
  lines: () => Record<string, unknown>[]
} {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString('utf8'))
      callback()
    },
  })
  return {
    logger: createLogger({ level, destination: stream }),
    lines: () =>
      chunks
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  }
}
