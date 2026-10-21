import type {
  BlockGroup,
  DiffLevel,
  MaterialType,
  ModeParams,
  PrintSettings,
  WorksheetBlock,
  WorksheetDraft,
} from './worksheet'
import { mergeModeParams, uid } from './worksheet'
import type { CardKind, DiffFormat } from './worksheet'

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
  return mergeModeParams(draft.modeParams)
}

export const DIFF_FORMAT_LABELS: Record<DiffFormat, string> = {
  levels: 'Подборка по уровням',
  versions: 'Одно задание в трёх версиях',
}

export const CARD_KIND_LABELS: Record<CardKind, string> = {
  consolidate: 'Отработка навыка',
  support: 'Карточка с подсказкой',
  apply: 'Применение без подсказок',
  extra: 'Задание на перенос знаний',
}

/** Общая продуктовая логика из документа с промптами. */
const PRODUCT_BASE = `Материал должен быть пригоден для непосредственного использования на уроке и требовать минимальной ручной доработки.
Нормативная и содержательная основа: ориентируйся на актуальные ФГОС, федеральную образовательную программу соответствующего уровня и федеральную рабочую программу по предмету; учитывай содержание и планируемые предметные результаты для указанного класса; не требуй знаний из тем и классов, которые учащиеся ещё не должны были изучать; учитывай возрастные особенности учащихся; не упоминай нормативные документы (ФГОС, ФОП, приказы) в готовом материале.
Не создавай формальные задания ради заполнения шаблона. Таблицы, схемы и дополнительные элементы используй только тогда, когда они реально улучшают учебную ценность. Детализация — средняя, стиль — учебный.`

function inputLines(draft: WorksheetDraft): string {
  return `Входные данные:
— Предмет: ${draft.subject || 'не указан'}
— Класс: ${draft.grade || 'не указан'}
— Тема урока: ${draft.topic || 'не указана'}`
}

export function differentiatedPrompt(draft: WorksheetDraft, format: DiffFormat): string {
  const formatRule =
    format === 'versions'
      ? `Режим «Одно задание в трёх версиях»: создай три версии ОДНОЙ учебной задачи (по одной на каждый уровень); они проверяют один и тот же учебный результат; различия — в степени самостоятельности, количестве смысловых связей и характере рассуждения, а не только в исходных данных.`
      : `Режим «Подборка по уровням»: по 2–3 задания для каждого уровня; количество может быть меньше, если тема узкая и дополнительные задания приведут к повторам.`
  return `Ты помогаешь учителю подготовить дифференцированные задания по теме урока для использования в российской школе.
${inputLines(draft)}
— Формат: ${DIFF_FORMAT_LABELS[format]}
— Уровни: базовый, повышенный, высокий.
${PRODUCT_BASE}
Главный принцип: все уровни работают с одним и тем же ключевым содержанием темы и сопоставимым учебным результатом. Различай уровни не количеством примеров, размером чисел, длиной текста или искусственным усложнением формулировки, а характером учебной деятельности.
Базовый уровень: применение изученного понятия, правила или способа действия в типовой и узнаваемой ситуации; способ решения очевиден или задан условием; задание проверяет обязательное понимание содержания темы.
Повышенный уровень: ученик самостоятельно выбирает подходящий способ; требуется связать несколько элементов изученного содержания; возможна менее типичная ситуация, сравнение, объяснение или обоснование.
Высокий уровень: перенос изученного в новую, но доступную ученику данного класса ситуацию; самостоятельно построить ход решения, связать несколько знаний, проанализировать, доказать, аргументировать или исследовать — в зависимости от предмета; без содержания следующего класса и олимпиадных знаний.
Не используй подход «базовый = простые числа, повышенный = большие числа, высокий = ещё большие числа». Не делай высокий уровень просто более длинным.
Каждое задание: соответствует теме и классу; имеет понятную и однозначную инструкцию; содержит все необходимые данные; выполнимо; имеет проверяемый результат; не дублирует соседнее; использует корректную терминологию.
${formatRule}
Для учителя (в поле explanation каждого задания): правильный ответ; краткое решение или ожидаемый ход рассуждения; что проверяет задание; критерий выполнения. Если ответ допускает несколько корректных вариантов, укажи признаки правильного ответа.
Не используй маркировки «для слабых / средних / сильных учеников».
Перед выдачей внутренне проверь: все уровни относятся к одной теме и классу; базовый проверяет обязательное содержание; повышенный и высокий сложнее по мыслительной деятельности, а не по объёму; ничего не требует неизученного; ответы соответствуют условиям; нет фактических дублей; высокий уровень в рамках программы класса; материал можно использовать без переписывания.`
}

const CARD_KIND_RULES: Record<CardKind, string> = {
  consolidate: 'типовая практика ключевого способа действия или содержания темы.',
  support:
    'работа с тем же ключевым содержанием, но с содержательной поддержкой: ориентиром, частично заполненной схемой, последовательностью действий, примером первого шага, таблицей или другим уместным способом помощи; не давай готовый ответ; не упрощай содержание до уровня другого класса.',
  apply: 'способ действия не указан напрямую; ученик самостоятельно определяет, как использовать изученное.',
  extra:
    'новое применение изученного материала, требующее более глубокого объяснения, сравнения, анализа или переноса знания; не выходи необоснованно за программу данного класса.',
}

export function cardsPrompt(draft: WorksheetDraft, kind: CardKind, count: number): string {
  return `Ты помогаешь учителю подготовить раздаточные учебные карточки по теме урока для использования непосредственно на занятии в российской школе.
${inputLines(draft)}
— Тип карточки: ${CARD_KIND_LABELS[kind]}
— Количество: ${count}
${PRODUCT_BASE}
Индивидуализацию обеспечивай характером помощи, степенью самостоятельности и типом задания, а не произвольным упрощением предметного содержания.
Карточка — компактный самостоятельный материал для решения одной конкретной учебной задачи (потренировать способ действия, закрепить, преодолеть типичное затруднение, дополнительная практика, самостоятельное применение, быстрая проверка понимания, содержательная опора). Карточка — не уменьшенный рабочий лист и не мини-конспект; она понятна ученику без дополнительного объяснения учителя. Не перегружай теорией: если нужна опора, дай только информацию, необходимую для выполнения.
Тип «${CARD_KIND_LABELS[kind]}»: ${CARD_KIND_RULES[kind]}
Каждая карточка (каждое задание в ответе = одна карточка): компактная; одна понятная учебная задача; 1–4 связанных подпункта в зависимости от объёма; корректная терминология; однозначные или проверяемые условия; 5–15 минут работы; не повторяет дословно другие карточки. Не пиши в тексте задания заголовок «Карточка N» — номер и тип программа добавит сама.
Не добавляй ФИО, дату, декоративные поля, длинную теорию и формальные методические фразы. Таблицы, схемы, данные, фрагменты текста — только когда они нужны для выполнения.
Адаптируй форму к предмету: математика и естественные науки — задачи, вычисления, данные, закономерности, модели, формулы, объяснение результата; русский и иностранные языки — распознавание явлений, выбор и применение правила, преобразование, анализ, создание конструкций; история и обществознание — источники, признаки, причинно-следственные связи, сравнение, аргументация, хронология; литература — фрагмент, образ, композиция, авторская позиция, сопоставление; информатика — алгоритмы, данные, модели, программные конструкции, логика. Не используй одинаковую структуру для всех предметов.
Для учителя (в поле explanation каждой карточки): назначение карточки; правильный ответ; краткое решение или ожидаемый результат; что проверяется; ориентировочное время выполнения.
Перед выдачей внутренне проверь: карточки соответствуют предмету, классу и теме; различаются по содержанию, а не только числами или формулировками; «Нужна опора» помогает, но не даёт готовый ответ; дополнительная задача не требует программы следующего класса; условия достаточны и однозначны; ответы соответствуют условиям; объём реалистичен; каждую карточку можно использовать отдельно.`
}

/** Добавка для кнопки «Создать ещё» в режиме карточек. */
export function anotherCardNote(previous: string): string {
  return `Предыдущая карточка:\n${previous}\nСоздай другую карточку того же назначения по той же теме. Она должна проверять тот же учебный результат и иметь сопоставимую сложность, но не должна повторять сюжет, исходные данные, формулировку, последовательность действий и готовый ответ предыдущей карточки. Не изменяй уровень требований к ученику.`
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
${a.grading !== 'none' ? '- Для каждого задания укажи в explanation решение и критерии по баллам: «Баллы: N. Критерии: …» — за что даётся каждый балл, допустимые альтернативы и типичные ошибки.' : ''}`
  }
  if (type === 'differentiated') {
    return differentiatedPrompt(draft, p.differentiated.format)
  }
  if (type === 'cards') {
    return cardsPrompt(draft, p.cards.kind, p.cards.count)
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
  if (type === 'differentiated') return p.differentiated.format === 'versions' ? 1 : 3
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

/** Краткий текст правильного ответа блока для учительской таблицы. */
export function blockAnswerText(b: WorksheetBlock): string {
  if (b.type === 'single_choice') {
    const opt = b.options?.find((o) => o.id === b.correctOptionId)
    return opt?.text ?? ''
  }
  if (b.type === 'multiple_choice') {
    const ids = new Set(b.correctOptionIds ?? [])
    return (b.options ?? []).filter((o) => ids.has(o.id)).map((o) => o.text).join('; ')
  }
  if (b.type === 'fill_gaps') return (b.gapsAnswers ?? []).join('; ')
  if (b.type === 'matching') {
    const right = new Map((b.rightItems ?? []).map((r) => [r.id, r.text]))
    return (b.leftItems ?? [])
      .map((l) => `${l.text} — ${right.get(l.id) ?? '?'}`)
      .join('; ')
  }
  if (b.type === 'ordering') return (b.orderItems ?? []).join(' → ')
  return (b.correctAnswers ?? []).join('; ')
}

/** Убирает из решения строку «Ответ: …», если она дублирует уже показанный ключ. */
export function stripDuplicateAnswer(solution: string | undefined, answerText: string): string | undefined {
  if (!solution) return solution
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const answer = norm(answerText)
  if (!answer) return solution
  const lines = solution.split('\n').filter((line) => {
    const t = norm(line.replace(/^ответ\s*:\s*/i, ''))
    return !(t && t === answer)
  })
  return lines.join('\n')
}

/** Убирает заголовок «Карточка N. …», если модель вписала его в текст. */
export function stripCardHeading(text?: string): string | undefined {
  if (!text) return text
  return text.replace(/^\s*(\*\*)?\s*Карточка\s*№?\s*\d+[^\n]*\n+/i, '').replace(/^\s*(\*\*)?Карточка\s*№?\s*\d+\.?[^.\n]*\.\s*(\*\*)?\s*/i, '')
}
