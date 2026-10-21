import type { BlockGroup, WorksheetBlock } from './worksheet'

/** Нормализация текста задания для сравнения вариантов. */
export function normalizeTaskText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»"'"']/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Текст задания похож на описание из плана, а не на условие для ученика. */
export function looksLikePlanDescription(text: string): boolean {
  const t = normalizeTaskText(text)
  return (
    /ученику (нужно|следует|предлагается|необходимо)/.test(t) ||
    /учащимся (нужно|следует|предлагается)/.test(t) ||
    /задание (должно|направлено|проверяет|формирует)/.test(t) ||
    /цель задания/.test(t) ||
    /например, в скобках/.test(t) ||
    /(составь|придумай) задание (для|по)/.test(t)
  )
}

/** Текст задания блока для проверок. */
export function blockTaskText(b: WorksheetBlock): string {
  return (b.question || b.body || b.gapsSourceText || '').trim()
}

export interface VariantIssue {
  position: number
  variantIds: string[]
  kind: 'duplicate' | 'type-mismatch' | 'points-mismatch'
  detail: string
}

/**
 * Позиции заданий по вариантам: блоки-задания каждой группы в порядке следования.
 */
export function tasksByVariant(blocks: WorksheetBlock[], groups: BlockGroup[]): WorksheetBlock[][] {
  return groups.map((g) =>
    blocks.filter((b) => b.groupId === g.id && b.type !== 'page_break' && b.type !== 'text'),
  )
}

/**
 * Проверка равноценности вариантов: на одной позиции — тот же тип и баллы,
 * условия не совпадают дословно.
 */
export function findVariantIssues(blocks: WorksheetBlock[], groups: BlockGroup[]): VariantIssue[] {
  if (groups.length < 2) return []
  const variants = tasksByVariant(blocks, groups)
  const issues: VariantIssue[] = []
  const maxLen = Math.max(...variants.map((v) => v.length))
  for (let pos = 0; pos < maxLen; pos++) {
    const atPos = variants.map((v, i) => ({ block: v[pos], groupId: groups[i].id })).filter((x) => x.block)
    const first = atPos[0]
    if (!first) continue
    for (let i = 1; i < atPos.length; i++) {
      const other = atPos[i]
      if (other.block.type !== first.block.type) {
        issues.push({
          position: pos,
          variantIds: [first.groupId, other.groupId],
          kind: 'type-mismatch',
          detail: `позиция ${pos + 1}: тип «${first.block.type}» vs «${other.block.type}»`,
        })
        continue
      }
      if (
        first.block.points != null &&
        other.block.points != null &&
        first.block.points !== other.block.points
      ) {
        issues.push({
          position: pos,
          variantIds: [first.groupId, other.groupId],
          kind: 'points-mismatch',
          detail: `позиция ${pos + 1}: баллы ${first.block.points} vs ${other.block.points}`,
        })
      }
      const t1 = normalizeTaskText(blockTaskText(first.block))
      const t2 = normalizeTaskText(blockTaskText(other.block))
      if (t1 && t1 === t2) {
        issues.push({
          position: pos,
          variantIds: [first.groupId, other.groupId],
          kind: 'duplicate',
          detail: `позиция ${pos + 1}: одинаковое условие в вариантах`,
        })
      }
    }
  }
  return issues
}
