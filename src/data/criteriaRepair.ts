import { ASSESSMENT_CRITERIA_RULES, criteriaCoversAllLevels, formatCriteriaLevels } from './assessmentCriteria'
import { chatJson } from './aiClient'
import { throwIfCancelled } from './generationControl'
import { blockAnswerText } from './materialModes'
import type { WorksheetBlock } from './worksheet'

type LevelsReply = { tasks?: { id?: string; criteria_levels?: { points?: number; description?: string }[] }[] }

export function needsCriteriaRepair(b: WorksheetBlock): boolean {
  if (b.points == null || b.type === 'page_break' || b.type === 'text' || b.type === 'answer_field') return false
  return !criteriaCoversAllLevels(b.criteria, Math.max(1, Math.round(b.points)))
}

/** Применяет ответ модели: принимаются только полные наборы уровней max…0. */
export function applyCriteriaReply(blocks: WorksheetBlock[], reply: LevelsReply): WorksheetBlock[] {
  const byId = new Map((reply.tasks ?? []).map((t) => [String(t.id ?? ''), t.criteria_levels ?? []]))
  return blocks.map((b) => {
    if (!needsCriteriaRepair(b)) return b
    const raw = byId.get(b.id)
    if (!raw?.length) return b
    const levels = raw
      .filter((l) => Number.isFinite(Number(l.points)) && String(l.description ?? '').trim())
      .map((l) => ({ points: Math.round(Number(l.points)), description: String(l.description).trim() }))
    const text = formatCriteriaLevels(levels)
    return criteriaCoversAllLevels(text, Math.max(1, Math.round(b.points ?? 1))) ? { ...b, criteria: text } : b
  })
}

/** Модель обязана описать каждый уровень баллов: недостающие уровни запрашиваются повторно (до 2 раз). */
export async function repairCriteriaLevels(blocks: WorksheetBlock[]): Promise<WorksheetBlock[]> {
  let out = blocks
  for (let attempt = 0; attempt < 2; attempt++) {
    const broken = out.filter(needsCriteriaRepair)
    if (!broken.length) break
    throwIfCancelled()
    const tasks = broken.map((b) => ({
      id: b.id,
      type: b.type,
      max_points: Math.max(1, Math.round(b.points ?? 1)),
      question: (b.question || b.body || '').slice(0, 800),
      answer: blockAnswerText(b).slice(0, 400),
      solution: (b.solution ?? '').slice(0, 600),
      current_criteria: b.criteria ?? '',
    }))
    try {
      const reply = await chatJson<LevelsReply>(
        `Ты методист. ${ASSESSMENT_CRITERIA_RULES}\nВерни JSON {"tasks":[{"id":"...","criteria_levels":[{"points":N,"description":"..."}]}]}. Для каждого задания перечисли ВСЕ уровни от max_points до 0, ровно по одному на каждое целое число баллов. Пропуск любого уровня недопустим.`,
        JSON.stringify({ tasks }),
        { temperature: 0.2 },
      )
      out = applyCriteriaReply(out, reply)
    } catch {
      break
    }
  }
  return out
}
