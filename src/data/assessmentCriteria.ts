import type { BlockGroup, WorksheetBlock } from './worksheet'
import { pointsLabel } from './worksheet'

/** Уровень критерия: сколько баллов и за какой наблюдаемый результат. */
export interface CriteriaLevel {
  points: number
  description: string
}

/** Правила оценивания из документа «Правила генерации критериев оценивания» (сокращённо для модели). */
export const ASSESSMENT_CRITERIA_RULES = `ПРАВИЛА КРИТЕРИЕВ ОЦЕНИВАНИЯ:
- Сначала определи проверяемое умение и ожидаемое действие ученика, затем критерии. Оценивай только то, что требует условие; не требуй неоговорённых доказательств, единиц или единственного способа.
- Для каждого задания добавь в JSON поля: "skill" (проверяемое умение), "solution" (достаточное решение или признаки качественного выполнения), "max_points" (целое 1–5), "criteria_levels" — массив [{"points": N, "description": "..."}].
- В criteria_levels ОБЯЗАТЕЛЬНО перечисли ВСЕ уровни от max_points до 0 без пропусков, по одному на каждое целое значение. Каждый уровень описывает наблюдаемый результат, за который он ставится. «Максимум 3 балла» без описания — не критерий.
- Начисляй баллы за достижения; снижение объясняй невыполненным условием. Не ставь штрафы за почерк, исправления, краткость, необычный верный способ, отличие формулировки от эталона.
- Принимай равносильные ответы и альтернативные верные способы; если проверяется конкретная форма записи — это сказано в условии.
- Различай вычислительную ошибку, неверный способ, неполное обоснование и несущественный недочёт. Не применяй несколько снижений за одно исходное отклонение (зависимые ошибки).
- Краткий ответ и выбор одного ответа — обычно 1 балл: «1 — верный ответ, 0 — неверный или отсутствует». Для выбора нескольких ответов задай правило частичного зачёта и исключи максимум за выбор всех вариантов. Для соответствия и последовательности укажи единицу зачёта. Для развёрнутого ответа опиши содержание каждого уровня.
- Грамотность оценивается отдельным критерием только если она объект проверки.
- В разных вариантах на одной позиции одинаковы умение, существенные шаги, max_points и основания частичного зачёта.`

const LEVEL_RE = /^\s*[-•]?\s*(\d+)\s*(?:балл\p{L}*|б\.?)?\s*[—–:-]\s*(.+?)\s*$/u

export function formatCriteriaLevels(levels: CriteriaLevel[]): string {
  return [...levels]
    .sort((a, b) => b.points - a.points)
    .map((l) => `${pointsLabel(l.points)} — ${l.description.trim()}`)
    .join('\n')
}

export function parseCriteriaLevels(text: string | undefined): CriteriaLevel[] {
  if (!text) return []
  const out: CriteriaLevel[] = []
  for (const line of text.split(/\n|;\s*(?=\d+\s*балл)/u)) {
    const m = LEVEL_RE.exec(line)
    if (m) out.push({ points: Number(m[1]), description: m[2] })
  }
  return out
}

/** Все уровни от max до 0 описаны ровно по одному разу. */
export function criteriaCoversAllLevels(text: string | undefined, max: number): boolean {
  const levels = parseCriteriaLevels(text)
  if (max < 1) return false
  const seen = new Set(levels.map((l) => l.points))
  if (levels.some((l) => l.points > max)) return false
  for (let p = 0; p <= max; p++) if (!seen.has(p)) return false
  return true
}

/** Предложение сервиса, когда модель не дала полных уровней. */
export function defaultCriteriaLevels(type: WorksheetBlock['type'], max: number): CriteriaLevel[] {
  if (max <= 1) {
    return [
      { points: 1, description: 'дан верный ответ (засчитываются равносильные записи)' },
      { points: 0, description: 'ответ неверный или отсутствует' },
    ]
  }
  const levels: CriteriaLevel[] = []
  for (let p = max; p >= 0; p--) {
    const errors = max - p
    let description: string
    if (type === 'multiple_choice') {
      description =
        p === max
          ? 'выбраны все верные варианты и ни одного лишнего'
          : p === 0
            ? `допущено ${errors} и более ошибок (лишний или пропущенный вариант) либо выбраны все варианты`
            : `допущена ${errors === 1 ? 'одна ошибка' : `${errors} ошибки`} (лишний или пропущенный вариант)`
    } else if (type === 'matching' || type === 'ordering' || type === 'grouping' || type === 'fill_gaps') {
      const unit = type === 'matching' ? 'соответствие' : type === 'ordering' ? 'позиция' : type === 'grouping' ? 'элемент' : 'пропуск'
      description =
        p === max
          ? 'все элементы указаны верно'
          : p === 0
            ? `допущено ${errors} и более ошибок или ответ отсутствует`
            : `неверно указано ${errors} (${unit}: каждая ошибка снижает на 1 балл)`
    } else {
      description =
        p === max
          ? 'верное полное решение с обоснованием, получен верный ответ'
          : p === 0
            ? 'решение неверное, не начато или верно выполнено менее одного существенного этапа'
            : `верно выполнено ${p} из ${max} существенных этапов решения (например, одна вычислительная ошибка при верном способе)`
    }
    levels.push({ points: p, description })
  }
  return levels
}

/** Критерии блока содержат все уровни; иначе подставляется предложение сервиса и ставится отметка проверки. */
export function ensureCriteriaLevels(block: WorksheetBlock): WorksheetBlock {
  if (block.type === 'page_break' || block.type === 'text' || block.type === 'answer_field') return block
  const max = Math.max(1, Math.round(block.points ?? 1))
  if (criteriaCoversAllLevels(block.criteria, max)) {
    const levels = parseCriteriaLevels(block.criteria)
    return { ...block, points: max, criteria: formatCriteriaLevels(levels) }
  }
  const hadModelCriteria = Boolean(block.criteria?.trim())
  return {
    ...block,
    points: max,
    criteria: formatCriteriaLevels(defaultCriteriaLevels(block.type, max)),
    criteriaStatus: hadModelCriteria || max > 1 ? 'needs-review' : block.criteriaStatus,
  }
}

export function isNumberedTaskBlock(b: WorksheetBlock): boolean {
  return b.type !== 'page_break' && b.type !== 'text' && b.type !== 'answer_field'
}

/** Номера заданий так, как их показывает платформа: внутри варианта, по страницам и порядку. */
export function platformTaskNumbers(blocks: WorksheetBlock[], groups: BlockGroup[] = []): Map<string, number> {
  const numbers = new Map<string, number>()
  const parts = groups.length
    ? groups.map((g) => blocks.filter((b) => b.groupId === g.id))
    : [blocks]
  for (const part of parts) {
    const pages = [...new Set(part.map((b) => b.page))].sort((a, b) => a - b)
    let n = 0
    for (const page of pages) {
      for (const b of part) {
        if (b.page === page && isNumberedTaskBlock(b)) numbers.set(b.id, ++n)
      }
    }
  }
  return numbers
}
