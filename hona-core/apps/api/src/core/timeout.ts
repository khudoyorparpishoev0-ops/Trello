/** Ограничение времени ожидания промиса. Поздний отказ исходного промиса подавляется. */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label}: timed out after ${ms} ms`)
    this.name = 'TimeoutError'
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
  })
  promise.catch(() => undefined)
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
