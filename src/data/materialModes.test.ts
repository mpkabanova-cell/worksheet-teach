import { describe, expect, it } from 'vitest'
import { draftForExport, exportAnswerOptions, groupsForMode, replaceBlockKeepingSlot, stripDuplicateAnswer } from './materialModes'
import { emptyDraft, type WorksheetBlock } from './worksheet'

const block = (id: string, extra: Partial<WorksheetBlock> = {}): WorksheetBlock => ({
  id,
  type: 'short_answer',
  page: 0,
  title: id,
  question: 'q',
  correctAnswers: ['7/12'],
  ...extra,
})

describe('materialModes', () => {
  it('student export never contains answers, even after teacher view', () => {
    const d = { ...emptyDraft(), showAnswers: true, print: { ...emptyDraft().print, audience: 'student' as const, answersSeparate: true } }
    expect(exportAnswerOptions(d.print)).toEqual({ showAnswers: false, answersSeparate: false })
    const out = draftForExport({ ...d, blocks: [block('a', { solution: 's', criteria: 'c' })] })
    expect(out.showAnswers).toBe(false)
    expect(out.blocks[0].solution).toBeUndefined()
  })

  it('teacher export includes answers', () => {
    expect(exportAnswerOptions({ answersSeparate: true, copies: 1, orientation: 'portrait', audience: 'teacher' }).showAnswers).toBe(true)
  })

  it('replacing a task keeps block count, position, level and points', () => {
    const blocks = [block('a'), block('b', { difficulty: 3, points: 2, groupId: 'variant-1' }), block('c')]
    const next = replaceBlockKeepingSlot(blocks, 'b', block('new', { difficulty: 1 }))
    expect(next).toHaveLength(3)
    expect(next[1].id).toBe('b')
    expect(next[1].difficulty).toBe(3)
    expect(next[1].points).toBe(2)
    expect(next[1].groupId).toBe('variant-1')
  })

  it('assessment with 2 variants produces 2 tabs', () => {
    const d = emptyDraft()
    d.materialType = 'assessment'
    d.modeParams!.assessment.variants = 2
    expect(groupsForMode(d).map((g) => g.label)).toEqual(['Вариант 1', 'Вариант 2'])
  })

  it('differentiated mode makes one tab per chosen level', () => {
    const d = emptyDraft()
    d.materialType = 'differentiated'
    expect(groupsForMode(d)).toHaveLength(3)
  })
})
