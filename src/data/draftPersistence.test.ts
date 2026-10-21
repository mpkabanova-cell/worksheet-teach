import { describe, expect, it } from 'vitest'
import {
  autosaveKey,
  clearPending,
  foreignPendingIds,
  migrateLegacyKeys,
  pendingKey,
  rememberTabDraft,
  restoreForTab,
  saveAutosave,
  savePending,
  type StorageLike,
} from './draftPersistence'

function memStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
  }
}

describe('draftPersistence', () => {
  it('хранит автосохранение и генерацию под ключом с id документа', () => {
    const storage = memStorage()
    saveAutosave(storage, 'ws-1', { draft: { id: 'ws-1' } })
    savePending(storage, 'ws-2', { draft: { id: 'ws-2' }, mode: 'create' })
    expect(storage.getItem(autosaveKey('ws-1'))).toContain('ws-1')
    expect(storage.getItem(pendingKey('ws-2'))).toContain('ws-2')
    expect(storage.getItem(autosaveKey('ws-2'))).toBeNull()
  })

  it('вкладка восстанавливает только свой документ, а не чужой', () => {
    const storage = memStorage()
    const tabA = memStorage()
    const tabB = memStorage()
    saveAutosave(storage, 'ws-A', { draft: { id: 'ws-A', blocks: [{}] } })
    saveAutosave(storage, 'ws-B', { draft: { id: 'ws-B', blocks: [{}] } })
    rememberTabDraft(tabA, 'ws-A')
    rememberTabDraft(tabB, 'ws-B')
    const ra = restoreForTab(storage, tabA)
    const rb = restoreForTab(storage, tabB)
    expect(ra.kind).toBe('autosave')
    expect(ra.kind === 'autosave' && ra.payload).toContain('ws-A')
    expect(rb.kind === 'autosave')
    expect(rb.kind === 'autosave' && rb.payload).toContain('ws-B')
  })

  it('новая вкладка не подхватывает чужой документ', () => {
    const storage = memStorage()
    const freshTab = memStorage()
    saveAutosave(storage, 'ws-A', { draft: { id: 'ws-A' } })
    expect(restoreForTab(storage, freshTab).kind).toBe('none')
  })

  it('прерванная генерация своего документа предлагает перезапуск', () => {
    const storage = memStorage()
    const tab = memStorage()
    rememberTabDraft(tab, 'ws-1')
    savePending(storage, 'ws-1', { draft: { id: 'ws-1' }, mode: 'create' })
    expect(restoreForTab(storage, tab).kind).toBe('pending-own')
  })

  it('генерация другого документа — нейтральное уведомление, без «прервана»', () => {
    const storage = memStorage()
    const tabA = memStorage()
    const tabB = memStorage()
    rememberTabDraft(tabA, 'ws-A')
    rememberTabDraft(tabB, 'ws-B')
    savePending(storage, 'ws-A', { draft: { id: 'ws-A' }, mode: 'create' })
    expect(restoreForTab(storage, tabB).kind).toBe('pending-foreign')
    expect(foreignPendingIds(storage, 'ws-B')).toEqual(['ws-A'])
    clearPending(storage, 'ws-A')
    expect(restoreForTab(storage, tabB).kind).toBe('none')
  })

  it('переносит старые глобальные ключи в ключи по id', () => {
    const storage = memStorage()
    storage.setItem('ws-autosave-draft', JSON.stringify({ draft: { id: 'ws-old' } }))
    storage.setItem('ws-pending-generation', JSON.stringify({ draft: { id: 'ws-old2' }, mode: 'create' }))
    migrateLegacyKeys(storage)
    expect(storage.getItem('ws-autosave-draft')).toBeNull()
    expect(storage.getItem('ws-pending-generation')).toBeNull()
    expect(storage.getItem(autosaveKey('ws-old'))).toContain('ws-old')
    expect(storage.getItem(pendingKey('ws-old2'))).toContain('ws-old2')
  })
})
