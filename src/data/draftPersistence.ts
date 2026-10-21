/**
 * Хранение черновиков и незавершённых генераций в браузере.
 * Ключи привязаны к id документа, чтобы две вкладки с разными
 * материалами не затирали и не подменяли друг друга.
 */

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  key(index: number): string | null
  readonly length: number
}

export const AUTOSAVE_PREFIX = 'ws-autosave-draft:'
export const PENDING_PREFIX = 'ws-pending-generation:'
const LEGACY_AUTOSAVE = 'ws-autosave-draft'
const LEGACY_PENDING = 'ws-pending-generation'
const TAB_DRAFT_KEY = 'ws-current-draft-id'

export function autosaveKey(draftId: string): string {
  return `${AUTOSAVE_PREFIX}${draftId}`
}

export function pendingKey(draftId: string): string {
  return `${PENDING_PREFIX}${draftId}`
}

/** id документа, с которым работает эта вкладка (sessionStorage переживает обновление). */
export function rememberTabDraft(session: StorageLike, draftId: string): void {
  session.setItem(TAB_DRAFT_KEY, draftId)
}

export function tabDraftId(session: StorageLike): string | null {
  return session.getItem(TAB_DRAFT_KEY)
}

export function forgetTabDraft(session: StorageLike): void {
  session.removeItem(TAB_DRAFT_KEY)
}

export function saveAutosave(storage: StorageLike, draftId: string, payload: unknown): void {
  storage.setItem(autosaveKey(draftId), JSON.stringify(payload))
}

export function clearAutosave(storage: StorageLike, draftId: string): void {
  storage.removeItem(autosaveKey(draftId))
}

export function savePending(storage: StorageLike, draftId: string, payload: unknown): void {
  storage.setItem(pendingKey(draftId), JSON.stringify(payload))
}

export function clearPending(storage: StorageLike, draftId: string): void {
  storage.removeItem(pendingKey(draftId))
}

function storageKeys(storage: StorageLike): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k) keys.push(k)
  }
  return keys
}

/** Незавершённые генерации других документов (не этой вкладки). */
export function foreignPendingIds(storage: StorageLike, ownDraftId: string | null): string[] {
  return storageKeys(storage)
    .filter((k) => k.startsWith(PENDING_PREFIX))
    .map((k) => k.slice(PENDING_PREFIX.length))
    .filter((id) => id && id !== ownDraftId)
}

/** Перенос записей старого формата (один глобальный ключ) в ключи по id. */
export function migrateLegacyKeys(storage: StorageLike): void {
  const legacyAuto = storage.getItem(LEGACY_AUTOSAVE)
  if (legacyAuto) {
    try {
      const parsed = JSON.parse(legacyAuto) as { draft?: { id?: string } }
      if (parsed.draft?.id) saveAutosave(storage, parsed.draft.id, parsed)
    } catch {
      /* повреждённая запись — просто удаляем */
    }
    storage.removeItem(LEGACY_AUTOSAVE)
  }
  const legacyPending = storage.getItem(LEGACY_PENDING)
  if (legacyPending) {
    try {
      const parsed = JSON.parse(legacyPending) as { draft?: { id?: string } }
      if (parsed.draft?.id) savePending(storage, parsed.draft.id, parsed)
    } catch {
      /* повреждённая запись — просто удаляем */
    }
    storage.removeItem(LEGACY_PENDING)
  }
}

export type RestoreResult =
  | { kind: 'pending-own'; payload: string }
  | { kind: 'pending-foreign' }
  | { kind: 'autosave'; payload: string }
  | { kind: 'none' }

/**
 * Что восстанавливать в этой вкладке после обновления страницы.
 * Своя прерванная генерация → перезапуск; чужая → только уведомление;
 * иначе — свой автосохранённый черновик.
 */
export function restoreForTab(storage: StorageLike, session: StorageLike): RestoreResult {
  migrateLegacyKeys(storage)
  const ownId = tabDraftId(session)
  if (ownId) {
    const pending = storage.getItem(pendingKey(ownId))
    if (pending) return { kind: 'pending-own', payload: pending }
  }
  if (foreignPendingIds(storage, ownId).length > 0) return { kind: 'pending-foreign' }
  if (ownId) {
    const auto = storage.getItem(autosaveKey(ownId))
    if (auto) return { kind: 'autosave', payload: auto }
  }
  return { kind: 'none' }
}
