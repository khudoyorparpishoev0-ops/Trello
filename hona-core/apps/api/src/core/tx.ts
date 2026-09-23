import type { Db, Tx } from '@hona/db'

export type { Tx }

/**
 * Явная граница транзакции. Сервис открывает её, пишет данные и события через
 * `emit(tx, …)`; всё коммитится или откатывается вместе (§10.1). Вложенных
 * транзакций `emit` сам не открывает.
 */
export function withTransaction<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn)
}
