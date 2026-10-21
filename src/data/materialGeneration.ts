import { generateSingleTaskAI, generateWorksheetAI, type GenerateMode } from './ai'
import { blockTaskText, findVariantIssues, looksLikePlanDescription } from './contentChecks'
import { verifiedAnswer } from './fractionCheck'
import { reportStage, throwIfCancelled } from './generationControl'
import { groupsForMode, levelToStars, materialTypeOf, modeParamsOf, taskCountForMode, LEVEL_LABELS, CARD_KIND_LABELS, stripCardHeading } from './materialModes'
import type { DiffLevel, WorksheetBlock, WorksheetDraft } from './worksheet'
import { createPlan } from './worksheet'

const LEVEL_TO_PLAN = { basic: 'basic', advanced: 'medium', high: 'advanced' } as const

function withWish(draft: WorksheetDraft, note: string): WorksheetDraft {
  return { ...draft, additionalWishes: [draft.additionalWishes.trim(), note].filter(Boolean).join('\n') }
}

/** Проверка числовых ответов точным вычислением. */
export function verifyBlockAnswers(blocks: WorksheetBlock[]): WorksheetBlock[] {
  return blocks.map((b) => {
    if (b.type !== 'short_answer' || !b.question) return b
    const fixed = verifiedAnswer(b.question, b.correctAnswers?.[0])
    return fixed ? { ...b, correctAnswers: [fixed] } : b
  })
}

/** Генерация материала любого типа поверх генератора рабочего листа. */
export async function generateMaterialAI(draft: WorksheetDraft, mode: GenerateMode = 'create'): Promise<WorksheetDraft> {
  const type = materialTypeOf(draft)
  const params = modeParamsOf(draft)
  const groups = groupsForMode(draft)

  if (type === 'worksheet' || (type === 'assessment' && groups.length === 0) || type === 'cards') {
    const base: WorksheetDraft =
      type === 'cards'
        ? { ...draft, taskCount: taskCountForMode(draft), taskPlan: createPlan(taskCountForMode(draft)), showIntro: false }
        : type === 'assessment'
          ? { ...draft, showIntro: false }
          : draft
    const result = await generateWorksheetAI(base, mode)
    const points = type === 'assessment' && params.assessment.grading === 'points'
    let cardN = 0
    const cardTitle = (b: WorksheetBlock): WorksheetBlock =>
      type === 'cards' && b.type !== 'page_break' && b.type !== 'text'
        ? { ...b, question: stripCardHeading(b.question), title: `Карточка ${++cardN}. ${CARD_KIND_LABELS[params.cards.kind]}` }
        : b
    return {
      ...result,
      materialType: type,
      modeParams: params,
      groups: [],
      blocks: verifyBlockAnswers(result.blocks)
        .map((b) => (points && !b.points ? { ...b, points: b.difficulty ?? 1 } : b))
        .map(cardTitle),
    }
  }

  const allBlocks: WorksheetBlock[] = []
  let sharedPlan = draft.taskPlan
  let title = draft.topic
  let intro = ''

  for (let gi = 0; gi < groups.length; gi++) {
    throwIfCancelled()
    const g = groups[gi]
    let part: WorksheetDraft
    if (type === 'assessment') {
      const base = { ...draft, showIntro: false, taskPlan: gi === 0 ? draft.taskPlan : sharedPlan }
      part =
        gi === 0
          ? base
          : withWish(
              base,
              `${g.label}. Та же спецификация, что у варианта 1 (умение, тип рассуждения, уровень, число шагов), другие числа и контексты сопоставимой сложности.`,
            )
    } else {
      const level = g.id.replace('level-', '') as DiffLevel
      const count = taskCountForMode(draft)
      const versions = params.differentiated.format === 'versions'
      const firstTask = allBlocks.find((b) => b.question || b.body)
      const versionNote =
        versions && firstTask
          ? ` Это версия той же учебной задачи, что и в базовом уровне: «${(firstTask.question || firstTask.body || '').slice(0, 400)}». Проверяй тот же учебный результат; меняй степень самостоятельности и характер рассуждения, а не только данные.`
          : ''
      part = withWish(
        {
          ...draft,
          showIntro: false,
          taskCount: count,
          taskPlan: createPlan(count).map((row) => ({ ...row, difficulty: LEVEL_TO_PLAN[level] })),
        },
        `Уровень: ${LEVEL_LABELS[level]}.${versionNote}`,
      )
    }
    reportStage('tasks')
    const result = await generateWorksheetAI(part, mode)
    if (gi === 0) {
      sharedPlan = result.taskPlan
      title = result.title
      intro = result.intro
    }
    const stars = type === 'differentiated' ? levelToStars(g.id.replace('level-', '') as DiffLevel) : undefined
    const points = type === 'assessment' && params.assessment.grading === 'points'
    allBlocks.push(
      ...verifyBlockAnswers(result.blocks)
        .filter((b) => b.type !== 'page_break')
        .map((b) => ({
          ...b,
          page: 0,
          groupId: g.id,
          difficulty: stars ?? b.difficulty,
          points: points ? (b.points ?? b.difficulty ?? 1) : b.points,
        })),
    )
  }

  reportStage('finalize')
  const checked =
    type === 'assessment'
      ? await repairVariantIssues(draft, allBlocks, groups)
      : await repairPlanDescriptions(draft, allBlocks)
  return {
    ...draft,
    title: title || draft.topic,
    intro: type === 'differentiated' ? '' : intro,
    taskPlan: sharedPlan,
    blocks: allBlocks,
    groups,
    pages: 1,
    materialType: type,
    modeParams: params,
    savedAt: undefined,
  }
}
