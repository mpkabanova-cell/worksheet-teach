import { describe, expect, it, vi } from 'vitest'
import { emptyDraft, mergeModeParams, type WorksheetBlock } from '@/data/worksheet'
import { draftForExport } from '@/data/materialModes'
import { exportCriteriaSections, hasExportCriteria, teacherDetailLines } from './assessmentContent'
import { buildWorksheetDocumentChildren } from './word/build/buildSheet'
import type { ExportContext } from './word/types'

vi.mock('@/export/word/build/buildHeader', () => ({ buildHeader: async () => [], buildPageFooter: () => ({}), buildAnswersTitle: () => ({}) }))
vi.mock('@/export/word/build/buildBlock', () => ({ buildBlockContent: async () => [] }))
vi.mock('@/export/word/build/buildCriteriaSheet', async (importOriginal) => {
  const original = await importOriginal<typeof import('./word/build/buildCriteriaSheet')>()
  return { ...original, buildCriteriaSheet: vi.fn(async () => []) }
})

const task = (id: string, groupId: string, page: number): WorksheetBlock => ({
  id, groupId, page, title: id, type: 'short_answer', question: 'Вычислите', points: 1,
  correctAnswers: ['6'], criteria: '1 балл — верный ответ. 0 баллов — неверный ответ.', solution: '2 × 3 = 6',
})
const draft = () => ({ ...emptyDraft(), materialType: 'assessment' as const, pages: 2,
  modeParams: { ...mergeModeParams(), assessment: { ...mergeModeParams().assessment, grading: 'points' as const } },
  groups: [{ id: 'v1', label: 'Вариант 1', kind: 'variant' as const }, { id: 'v2', label: 'Вариант 2', kind: 'variant' as const }],
  blocks: [task('b', 'v1', 1), task('a', 'v1', 0), task('c', 'v2', 0)],
  print: { ...emptyDraft().print, audience: 'teacher' as const, groupFilter: 'v1' },
})

describe('Export assessment rules', () => {
  it('teacher appendix retains both variants even when task pages are filtered', () => {
    const out = draftForExport(draft())
    expect(out.blocks.filter((b) => b.type === 'short_answer').map((b) => b.id)).toEqual(['b', 'a'])
    expect(exportCriteriaSections(out).map((s) => s.label)).toEqual(['Вариант 1', 'Вариант 2'])
  })
  it('appendix task numbers match platform order across pages and restart per variant', () => {
    expect(exportCriteriaSections(draftForExport(draft())).map((s) => s.tasks.map((b) => [b.id, b.exportNumber]))).toEqual([[['a', 1], ['b', 2]], [['c', 1]]])
  })
  it('student export cannot include solutions, criteria or the full teacher appendix', () => {
    const d = draft()
    const out = draftForExport({ ...d, print: { ...d.print, audience: 'student', answersSeparate: true } })
    expect(out.exportCriteriaBlocks).toBeUndefined()
    expect(out.blocks.every((b) => b.solution == null && b.criteria == null)).toBe(true)
    expect(hasExportCriteria(out, out.showAnswers)).toBe(false)
    expect(out.print.answersSeparate).toBe(false)
  })
  it('exports every criterion on a separate line with the existing solution', () => {
    expect(teacherDetailLines(task('a', 'v1', 0))).toEqual(['Критерии', '1 балл — верный ответ', '0 баллов — неверный ответ', 'Решение', '2 × 3 = 6'])
  })
  it('adds the Word assessment appendix exactly once for a multi-page teacher file', async () => {
    const { buildCriteriaSheet } = await import('./word/build/buildCriteriaSheet')
    vi.mocked(buildCriteriaSheet).mockClear()
    const d = draftForExport(draft())
    const ctx: ExportContext = { draft: d, options: { showAnswers: true, showDifficulty: false, answersSeparate: true, orientation: 'portrait' }, subject: d.subject, mathCache: new Map(), imageCache: new Map(), domImageCache: new Map() }
    await buildWorksheetDocumentChildren(ctx)
    expect(buildCriteriaSheet).toHaveBeenCalledTimes(1)
  })
})