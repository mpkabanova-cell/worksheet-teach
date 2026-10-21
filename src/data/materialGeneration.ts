import { ensureCriteriaLevels } from './assessmentCriteria'
import { repairCriteriaLevels } from './criteriaRepair'
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
    const points = type === 'assessment' && params.assessment.grading !== 'none'
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
      blocks: (points
        ? (await repairCriteriaLevels(verifyBlockAnswers(result.blocks).map((b) => (b.points ? b : { ...b, points: b.difficulty ?? 1 })))).map(ensureCriteriaLevels)
        : verifyBlockAnswers(result.blocks)
      ).map(cardTitle),
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
    const points = type === 'assessment' && params.assessment.grading !== 'none'
    const partBlocks = verifyBlockAnswers(result.blocks)
        .filter((b) => b.type !== 'page_break')
        .map((b) => ({
          ...b,
          page: 0,
          groupId: g.id,
          difficulty: stars ?? b.difficulty,
          points: points ? (b.points ?? b.difficulty ?? 1) : b.points,
        }))
    allBlocks.push(...(points ? (await repairCriteriaLevels(partBlocks)).map(ensureCriteriaLevels) : partBlocks))
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
    blocks: checked,
    groups,
    pages: 1,
    materialType: type,
    modeParams: params,
    savedAt: undefined,
  }
}

/** Заменить блок новым, сохранив место, группу, уровень и баллы. */
function keepSlot(prev: WorksheetBlock, fresh: WorksheetBlock): WorksheetBlock {
  return {
    ...fresh,
    id: prev.id,
    page: prev.page,
    groupId: prev.groupId,
    difficulty: prev.difficulty ?? fresh.difficulty,
    points: prev.points ?? fresh.points,
    skill: prev.skill ?? fresh.skill,
  }
}

/**
 * Если модель выдала описание из плана вместо условия — перегенерировать задание
 * (до 2 попыток), иначе оставить пометку для учителя.
 */
async function repairPlanDescriptions(draft: WorksheetDraft, blocks: WorksheetBlock[]): Promise<WorksheetBlock[]> {
  const out = [...blocks]
  for (let i = 0; i < out.length; i++) {
    const b = out[i]
    if (b.type === 'page_break' || b.type === 'text') continue
    if (!looksLikePlanDescription(blockTaskText(b))) continue
    let fixed: WorksheetBlock | null = null
    for (let attempt = 0; attempt < 2 && !fixed; attempt++) {
      try {
        const fresh = await generateSingleTaskAI(
          { ...draft, blocks: out },
          b.type,
          b.skill ?? '',
          'В прошлый раз вместо условия для ученика получилось описание задания из плана. Напиши готовое условие, которое ученик читает и выполняет, без слов «ученику нужно», «задание проверяет» и тому подобных.',
        )
        if (!looksLikePlanDescription(blockTaskText(fresh))) fixed = keepSlot(b, fresh)
      } catch {
        break
      }
    }
    out[i] = fixed ?? { ...b, criteriaStatus: 'needs-review' as const, criteriaReviewReason: 'Условие похоже на описание из плана, а не на задание для ученика.' }
  }
  return out
}

/**
 * Равноценность вариантов: одинаковые условия на одной позиции перегенерируются
 * (до 2 попыток на позицию); несовпадение типа или баллов помечается.
 */
async function repairVariantIssues(
  draft: WorksheetDraft,
  blocks: WorksheetBlock[],
  groups: WorksheetDraft['groups'],
): Promise<WorksheetBlock[]> {
  let out = await repairPlanDescriptions(draft, blocks)
  const gs = groups ?? []
  for (let attempt = 0; attempt < 2; attempt++) {
    const issues = findVariantIssues(out, gs)
    const duplicates = issues.filter((i) => i.kind === 'duplicate')
    if (!duplicates.length) break
    for (const issue of duplicates) {
      // Перегенерируем задание во втором (и далее) варианте на этой позиции.
      const variantBlocks = gs.map((g) =>
        out.filter((b) => b.groupId === g.id && b.type !== 'page_break' && b.type !== 'text'),
      )
      const firstText = blockTaskText(variantBlocks[0]?.[issue.position] ?? ({} as WorksheetBlock))
      for (const gid of issue.variantIds.slice(1)) {
        const target = variantBlocks[gs.findIndex((g) => g.id === gid)]?.[issue.position]
        if (!target) continue
        try {
          const fresh = await generateSingleTaskAI(
            { ...draft, blocks: out },
            target.type,
            target.skill ?? '',
            `Это вариант работы, позиция ${issue.position + 1}. Условие не должно совпадать с вариантом 1: «${firstText.slice(0, 300)}». То же умение, тип рассуждения и число шагов, но другие числа и сюжет.`,
          )
          const fixed = keepSlot(target, fresh)
          if (target.points != null) fixed.points = target.points
          out = out.map((b) => (b.id === target.id ? fixed : b))
        } catch {
          /* оставляем как есть */
        }
      }
    }
  }
  // Оставшиеся несовпадения типов/баллов и дубли помечаем для ручной проверки.
  const remaining = findVariantIssues(out, gs)
  if (remaining.length) {
    const marked = new Set<string>()
    for (const issue of remaining) {
      for (const gid of issue.variantIds) {
        const vb = out.filter((b) => b.groupId === gid && b.type !== 'page_break' && b.type !== 'text')
        const b = vb[issue.position]
        if (b) marked.add(b.id)
      }
    }
    out = out.map((b) => (marked.has(b.id) ? { ...b, criteriaStatus: 'needs-review' as const, criteriaReviewReason: 'Задание на этой позиции в другом варианте отличается по типу, баллам или совпадает по условию.' } : b))
  }
  return out
}
