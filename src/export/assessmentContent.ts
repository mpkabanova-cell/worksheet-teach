import { criteriaDisplayLines, ensureCriteriaLevels, isNumberedTaskBlock, platformTaskNumbers } from '@/data/assessmentCriteria'
import { blockAnswerText, modeParamsOf, stripDuplicateAnswer } from '@/data/materialModes'
import { defaultGradeScale, pointsLabel, type WorksheetBlock, type WorksheetDraft } from '@/data/worksheet'

/** Shared teacher content for Word and PDF; never infer a missing solution. */
export function teacherDetailLines(block: WorksheetBlock): string[] {
  const checked = block.points != null ? ensureCriteriaLevels(block) : block
  const solution = stripDuplicateAnswer(checked.solution, blockAnswerText(checked))
  return [
    ...(checked.criteriaStatus === 'needs-review' ? [checked.criteriaReviewReason ?? 'Проверьте ключ и критерии'] : []),
    ...(checked.criteria ? ['Критерии', ...criteriaDisplayLines(checked.criteria)] : []),
    ...(solution ? ['Решение', ...solution.split('\n')] : []),
  ]
}

export function hasExportCriteria(draft: WorksheetDraft, showAnswers: boolean): boolean {
  return showAnswers && draft.materialType === 'assessment' && modeParamsOf(draft).assessment.grading !== 'none'
}

export function exportCriteriaSections(draft: WorksheetDraft) {
  const blocks = draft.exportCriteriaBlocks ?? draft.blocks
  const numbers = platformTaskNumbers(blocks, draft.groups)
  const groups = (draft.groups ?? []).filter((g) => blocks.some((b) => b.groupId === g.id))
  return (groups.length ? groups : [{ id: '', label: '' }]).map((group) => {
    const tasks = blocks.filter((b) => (!group.id || b.groupId === group.id) && isNumberedTaskBlock(b))
      .map(ensureCriteriaLevels).sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0))
    return { label: group.label, tasks: tasks.map((b) => ({ ...b, exportNumber: numbers.get(b.id) })), total: tasks.reduce((n, b) => n + (b.points ?? 0), 0) }
  })
}

export function exportGradeScaleLines(draft: WorksheetDraft, maxTotal: number): string[] {
  const params = modeParamsOf(draft).assessment
  if (params.grading !== 'grade') return []
  const scale = [...(params.gradeScale ?? defaultGradeScale(maxTotal || 15))].sort((a, b) => b.min - a.min)
  return ['Шкала отметок', ...scale.map((t, i) => `«${t.grade}» — ${t.min}–${i === 0 ? maxTotal : scale[i - 1].min - 1} баллов`)]
}

export { pointsLabel }