import type {
  BlockGroup,
  DiffLevel,
  MaterialType,
  ModeParams,
  PrintSettings,
  WorksheetBlock,
  WorksheetDraft,
} from './worksheet'
import { defaultModeParams, uid } from './worksheet'

export const MATERIAL_FORM_TITLE = 'Создание материала'

export const ASSESSMENT_KIND_LABELS = {
  independent: 'Самостоятельная',
  check: 'Проверочная',
  control: 'Контрольная',
} as const

export const LEVEL_LABELS: Record<DiffLevel, string> = {
  basic: 'Базовый',
  advanced: 'Повышенный',
  high: 'Высокий',
}

export const CARD_FORMAT_LABELS = {
  task: 'Карточка-задание',
  memo: 'Памятка',
  handout: 'Раздаточный материал',
} as const

export const CARD_PURPOSE_LABELS = {
  practice: 'Отработка',
  error: 'Исправление ошибки',
  apply: 'Применение',
  support: 'Опора',
} as const

export const CARD_WORK_LABELS = {
  individual: 'Индивидуально',
  pair: 'В паре',
  group: 'В группе',
} as const

export function materialTypeOf(draft: WorksheetDraft): MaterialType {
  return draft.materialType ?? 'worksheet'
}

export function modeParamsOf(draft: WorksheetDraft): ModeParams {
  return { ...defaultModeParams(), ...(draft.modeParams ?? {}) }
}

/** Общая инструкция модели из ТЗ. */
export const GENERAL_MATERIAL_INSTRUCTION = `Создай учебный материал по входным данным. По умолчанию используй учебный стиль и среднюю детализацию. Соблюдай содержание российского школьного курса указанного класса. Цель каждого задания — конкретное учебное действие. Разнообразие форматов не самоцель. Не заполняй необязательные блоки шаблонным текстом. Условия должны быть достаточными и однозначными, математические ответы — проверенными; решения согласованы с условиями. Не включай ответы в ученическую часть. Если требования противоречат друг другу, сформулируй конкретный конфликт вместо выдуманного содержания.`

/** Правила выбранного режима, добавляются к системной инструкции. */
export function modePromptRules(draft: WorksheetDraft): string {
  const type = materialTypeOf(draft)
  const p = modeParamsOf(draft)
  if (type === 'assessment') {
    const a = p.assessment
    return `${GENERAL_MATERIAL_INSTRUCTION}

РЕЖИМ: ${ASSESSMENT_KIND_LABELS[a.kind]} работа, ${a.minutes} мин.
- Это работа для проверки: никаких теории, подсказок, вводных и рефлексии.
- Каждое задание проверяет конкретное умение${a.skills.trim() ? ` (умения: ${a.skills.trim()})` : ''}.
- Объём соразмерен ${a.minutes} минутам для ученика ${draft.grade || ''} класса.
- Контрольная — не удлинённая самостоятельная: больше умений и их сочетание, а не больше однотипных примеров.
- Если указан вариант — у соответствующих позиций совпадают умение, тип рассуждения, уровень, число шагов; различаются только данные. Не допускай более лёгкого случая, отрицательного результата вне изученного или несопоставимых вычислений.
${a.grading === 'points' ? '- Для каждого задания укажи в explanation решение и критерии: «Баллы: N. Критерии: …».' : ''}`
  }
  if (type === 'differentiated') {
    const d = p.differentiated
    return `${GENERAL_MATERIAL_INSTRUCTION}

РЕЖИМ: дифференцированные задания${d.skill.trim() ? ` по умению «${d.skill.trim()}»` : ''}.
- Общий навык, различная познавательная деятельность.
- Базовый уровень — применение алгоритма, при необходимости опора (образец, подсказка).
- Повышенный — самостоятельный выбор способа, объяснение, анализ ошибки.
- Высокий — перенос, обоснование, исследование или построение примера.
- Не повышай уровень только большими числами, лишними однотипными действиями или длинным условием.`
  }
  if (type === 'cards') {
    const c = p.cards
    const formatRule =
      c.format === 'memo'
        ? 'Памятка: опорный материал (правило/алгоритм) и короткий разобранный пример, без обязательного теста.'
        : c.format === 'handout'
          ? `Раздаточный материал: таблица, набор данных или схема с короткой инструкцией. Форма работы: ${CARD_WORK_LABELS[c.work].toLowerCase()}.`
          : 'Карточка-задание: короткая инструкция и одно задание с необходимыми подпунктами.'
    return `${GENERAL_MATERIAL_INSTRUCTION}

РЕЖИМ: карточки (${CARD_FORMAT_LABELS[c.format]}), назначение — ${CARD_PURPOSE_LABELS[c.purpose].toLowerCase()}.
- Каждое задание = одна отдельная карточка с ОДНОЙ адресной учебной задачей.
- ${formatRule}
- Без вводной, теории рабочего листа, пяти форматов ответа и рефлексии.
- Карточка компактная: умещается на четверть листа A4.`
  }
  return ''
}

/** Группы (вкладки) для выбранного режима. */
export function groupsForMode(draft: WorksheetDraft): BlockGroup[] {
  const type = materialTypeOf(draft)
  const p = modeParamsOf(draft)
  if (type === 'assessment') {
    const n = Math.min(4, Math.max(1, p.assessment.variants))
    if (n <= 1) return []
    return Array.from({ length: n }, (_, i) => ({ id: `variant-${i + 1}`, label: `Вариант ${i + 1}`, kind: 'variant' as const }))
  }
  if (type === 'differentiated') {
    const levels = p.differentiated.levels.length ? p.differentiated.levels : (['basic'] as DiffLevel[])
    return levels.map((l) => ({ id: `level-${l}`, label: LEVEL_LABELS[l], kind: 'level' as const }))
  }
  return []
}

/** Число заданий на одну вкладку (вариант/уровень) или на весь материал. */
export function taskCountForMode(draft: WorksheetDraft): number {
  const type = materialTypeOf(draft)
  const p = modeParamsOf(draft)
  if (type === 'differentiated') return Math.min(10, Math.max(1, p.differentiated.perLevel))
  if (type === 'cards') return Math.min(12, Math.max(1, p.cards.count))
  if (type === 'assessment' && !draft.taskCount) {
    return Math.min(15, Math.max(2, Math.round(p.assessment.minutes / 5)))
  }
  return draft.taskCount
}

/** Сколько заданий предложить под время работы. */
export function suggestTaskCountForMinutes(minutes: number): number {
  return Math.min(15, Math.max(2, Math.round(minutes / 5)))
}

export function levelToStars(level: DiffLevel): 1 | 2 | 3 {
  return level === 'basic' ? 1 : level === 'advanced' ? 2 : 3
}

/** Ответы в файле: ученику — никогда; учителю — по настройке размещения. */
export function exportAnswerOptions(print: PrintSettings): { showAnswers: boolean; answersSeparate: boolean } {
  if ((print.audience ?? 'student') === 'student') return { showAnswers: false, answersSeparate: false }
  return { showAnswers: true, answersSeparate: print.answersSeparate }
}

/** Блоки выбранной вкладки (или всех, с разрывами страниц между группами). */
export function blocksForGroup(draft: WorksheetDraft, groupId: string | 'all'): WorksheetBlock[] {
  const groups = draft.groups ?? []
  if (!groups.length) return draft.blocks
  if (groupId !== 'all') return draft.blocks.filter((b) => b.groupId === groupId)
  const out: WorksheetBlock[] = []
  groups.forEach((g, i) => {
    const part = draft.blocks.filter((b) => b.groupId === g.id)
    if (!part.length) return
    if (out.length) out.push({ id: uid('pb'), type: 'page_break', page: 0, title: 'Разрыв страницы' })
    if (i >= 0) out.push(...part)
  })
  return out
}

/** Черновик для экспорта: нужная аудитория и нужные вкладки. */
export function draftForExport(draft: WorksheetDraft): WorksheetDraft {
  const { showAnswers, answersSeparate } = exportAnswerOptions(draft.print)
  const groupId = draft.print.groupFilter ?? 'all'
  const groups = draft.groups ?? []
  let blocks = blocksForGroup(draft, groupId)
  const hideLevelNames =
    materialTypeOf(draft) === 'differentiated' && !modeParamsOf(draft).differentiated.printLevelNames
  if (groups.length && !hideLevelNames) {
    blocks = blocks.flatMap((b, i, arr) => {
      const prev = arr[i - 1]
      if (b.type === 'page_break' || !b.groupId || prev?.groupId === b.groupId) return [b]
      const g = groups.find((x) => x.id === b.groupId)
      return g ? [{ id: uid('lbl'), type: 'text' as const, page: 0, title: g.label, body: g.label }, b] : [b]
    })
  }
  if (!showAnswers) {
    blocks = blocks.map((b) => ({ ...b, solution: undefined, criteria: undefined }))
  }
  return {
    ...draft,
    blocks,
    showAnswers,
    print: { ...draft.print, answersSeparate },
  }
}

/** Заменить блок на новую версию, сохранив место, страницу, уровень, баллы и группу. */
export function replaceBlockKeepingSlot(
  blocks: WorksheetBlock[],
  targetId: string,
  fresh: WorksheetBlock,
): WorksheetBlock[] {
  return blocks.map((b) =>
    b.id === targetId
      ? {
          ...fresh,
          id: b.id,
          page: b.page,
          groupId: b.groupId,
          difficulty: b.difficulty ?? fresh.difficulty,
          points: b.points ?? fresh.points,
          skill: b.skill ?? fresh.skill,
          title: b.title,
        }
      : b,
  )
}
