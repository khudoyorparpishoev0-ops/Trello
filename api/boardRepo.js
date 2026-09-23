/**
 * Доступ к состоянию доски и журналу событий (архитектура AI, фаза 2).
 *
 * Слой введён ради двух вещей.
 *
 * Первая — граница пространства. Все методы принимают `workspaceId` первым
 * параметром, даже пока пространство одно: когда появится второе, менять
 * придётся вызовы, а не искать строку «default» по всему репозиторию.
 *
 * Вторая — согласованность. Состояние доски и события о её изменении обязаны
 * записываться вместе. Иначе возможны два одинаково плохих исхода: доска
 * сохранилась, а история о ней молчит, или история есть, а изменения нет.
 * Поэтому снимок, запись доски и вставка событий идут одной транзакцией.
 */

/** Схема журнала. Дописывается только вперёд: ни UPDATE, ни DELETE здесь нет. */
export const EVENTS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS core_events (
     id bigserial PRIMARY KEY,
     workspace_id text NOT NULL,
     board_id text,
     card_id text,
     subject_user_id text,
     actor_user_id text,
     event_type text NOT NULL,
     payload jsonb NOT NULL DEFAULT '{}'::jsonb,
     board_version bigint NOT NULL,
     event_key text NOT NULL,
     created_at timestamptz NOT NULL DEFAULT now())`,
  // Ключ уникален — на нём держится защита от повторной записи одного события.
  `CREATE UNIQUE INDEX IF NOT EXISTS core_events_key_idx ON core_events (event_key)`,
  // Выборки истории: «что происходило в пространстве» и «что было с проектом».
  `CREATE INDEX IF NOT EXISTS core_events_ws_time_idx
     ON core_events (workspace_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS core_events_board_type_idx
     ON core_events (workspace_id, board_id, event_type, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS core_events_version_idx
     ON core_events (workspace_id, board_version)`,
]

/** Развернуть события в параметры одной вставки. */
function eventValues(events) {
  const params = []
  const rows = []
  for (const e of events) {
    const base = params.length
    params.push(
      e.workspaceId,
      e.boardId,
      e.cardId,
      e.subjectUserId,
      e.actorUserId,
      e.eventType,
      JSON.stringify(e.payload ?? {}),
      e.boardVersion,
      e.eventKey,
    )
    rows.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, ` +
        `$${base + 6}, $${base + 7}::jsonb, $${base + 8}, $${base + 9})`,
    )
  }
  return { rows, params }
}

export function createBoardRepo(pool) {
  /**
   * Вставить события. Повтор ничего не добавляет: ключ уникален, конфликт
   * гасится молча. Возвращает, сколько записей действительно легло в журнал.
   */
  async function writeEvents(client, workspaceId, events) {
    if (!events?.length) return 0
    const scoped = events.filter((e) => e.workspaceId === workspaceId)
    if (scoped.length !== events.length) {
      throw new Error('событие принадлежит другому пространству')
    }
    const { rows, params } = eventValues(scoped)
    const res = await client.query(
      `INSERT INTO core_events
         (workspace_id, board_id, card_id, subject_user_id, actor_user_id,
          event_type, payload, board_version, event_key)
       VALUES ${rows.join(', ')}
       ON CONFLICT (event_key) DO NOTHING`,
      params,
    )
    return res.rowCount
  }

  return {
    /** Текущее состояние пространства. null — записи ещё не было. */
    async getBoardState(workspaceId) {
      const { rows } = await pool.query(
        'SELECT data, version FROM board_state WHERE id = $1',
        [workspaceId],
      )
      if (!rows.length) return null
      return { data: rows[0].data, version: Number(rows[0].version) }
    },

    /**
     * Записать доску вместе с её событиями.
     *
     * `expectedVersion` — версия, которую видел клиент; null, если записи ещё
     * не было. `buildEvents(nextVersion)` вызывается уже внутри транзакции:
     * до записи новый номер версии неизвестен, а событие без него бесполезно
     * для порядка и для поиска расхождений.
     */
    async saveBoardState(workspaceId, { body, expectedVersion, snapshot, buildEvents }) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Блокировка строки: между чтением выше и записью мог вклиниться
        // другой запрос, и проверка в приложении его бы не поймала.
        const cur = await client.query(
          'SELECT version FROM board_state WHERE id = $1 FOR UPDATE',
          [workspaceId],
        )
        const currentVersion = cur.rows.length ? Number(cur.rows[0].version) : null

        if (currentVersion !== expectedVersion) {
          await client.query('ROLLBACK')
          return { ok: false, conflict: true, version: currentVersion ?? 0 }
        }

        // Снимок — страховка, а не условие записи. Его сбой не должен стоить
        // сохранения доски, поэтому он идёт под точкой отката.
        if (snapshot) {
          try {
            await client.query('SAVEPOINT snapshot')
            await client.query(
              `INSERT INTO board_history (board_id, data, cards, actor)
               VALUES ($4, $1::jsonb, $2, $3)`,
              [snapshot.data, snapshot.cards, snapshot.actor, workspaceId],
            )
            await client.query(
              `DELETE FROM board_history WHERE board_id = $1 AND id NOT IN (
                 SELECT id FROM board_history WHERE board_id = $1
                 ORDER BY created_at DESC LIMIT 50)`,
              [workspaceId],
            )
            await client.query('RELEASE SAVEPOINT snapshot')
          } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT snapshot')
            console.error('[api] снимок истории не сохранён:', e.message)
          }
        }

        let nextVersion
        if (currentVersion === null) {
          const ins = await client.query(
            `INSERT INTO board_state (id, data, version) VALUES ($2, $1::jsonb, 1)
             ON CONFLICT (id) DO UPDATE SET data = $1::jsonb,
               version = board_state.version + 1, updated_at = now()
             RETURNING version`,
            [body, workspaceId],
          )
          nextVersion = Number(ins.rows[0].version)
        } else {
          const upd = await client.query(
            `UPDATE board_state SET data = $1::jsonb, version = version + 1, updated_at = now()
             WHERE id = $3 AND version = $2 RETURNING version`,
            [body, expectedVersion, workspaceId],
          )
          if (!upd.rowCount) {
            await client.query('ROLLBACK')
            const now = await pool.query('SELECT version FROM board_state WHERE id = $1', [
              workspaceId,
            ])
            return { ok: false, conflict: true, version: Number(now.rows[0]?.version ?? 0) }
          }
          nextVersion = Number(upd.rows[0].version)
        }

        const events = buildEvents ? buildEvents(nextVersion) : []
        const written = await writeEvents(client, workspaceId, events)

        await client.query('COMMIT')
        return { ok: true, version: nextVersion, events: events.length, written }
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        client.release()
      }
    },

    /** Когда последний раз делали снимок истории. */
    async lastSnapshotAt(workspaceId) {
      const { rows } = await pool.query(
        'SELECT created_at FROM board_history WHERE board_id = $1 ORDER BY created_at DESC LIMIT 1',
        [workspaceId],
      )
      return rows[0]?.created_at
    },

    /** События пространства, свежие первыми. */
    async getEvents(workspaceId, { limit = 100, boardId = null, sinceVersion = null } = {}) {
      const params = [workspaceId]
      let where = 'workspace_id = $1'
      if (boardId) {
        params.push(boardId)
        where += ` AND board_id = $${params.length}`
      }
      if (sinceVersion !== null) {
        params.push(sinceVersion)
        where += ` AND board_version > $${params.length}`
      }
      params.push(Math.min(Number(limit) || 100, 1000))
      const { rows } = await pool.query(
        `SELECT id, workspace_id, board_id, card_id, subject_user_id, actor_user_id,
                event_type, payload, board_version, event_key, created_at
           FROM core_events WHERE ${where}
          ORDER BY id DESC LIMIT $${params.length}`,
        params,
      )
      return rows
    },

    /** Сколько событий в пространстве. Нужен тестам и диагностике. */
    async countEvents(workspaceId) {
      const { rows } = await pool.query(
        'SELECT count(*)::int AS n FROM core_events WHERE workspace_id = $1',
        [workspaceId],
      )
      return rows[0].n
    },

    writeEvents,
  }
}
