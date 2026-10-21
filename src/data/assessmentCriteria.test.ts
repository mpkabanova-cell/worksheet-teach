import { describe, expect, it } from 'vitest'
import { changeTaskPoints, criteriaCoversAllLevels, criteriaDisplayLines, ensureCriteriaLevels, platformTaskNumbers } from './assessmentCriteria'
import { draftForExport } from './materialModes'
import { emptyDraft, type WorksheetBlock } from './worksheet'

const task = (id: string, groupId: string, extra: Partial<WorksheetBlock> = {}): WorksheetBlock => ({
  id, type: 'short_answer', page: 0, title: id, groupId, ...extra,
})

describe('критерии по всем уровням', () => {
  it('разделяет каждый балл даже в старых однострочных критериях', () => {
    expect(criteriaDisplayLines('2 балла — всё верно. 1 балл — одна ошибка. 0 баллов — неверно.')).toEqual([
      '2 балла — всё верно', '1 балл — одна ошибка', '0 баллов — неверно',
    ])
  })
  it('сохраняет изменённые баллы и требует проверки всех уровней', () => {
    const b = changeTaskPoints(task('a', 'v1', { points: 1, criteria: '1 балл — верно\n0 баллов — неверно' }), 2)
    expect(b.points).toBe(2)
    expect(criteriaCoversAllLevels(b.criteria, 2)).toBe(true)
    expect(b.criteriaStatus).toBe('needs-review')
  })
  it('требует описания каждого уровня от максимума до 0', () => {
    expect(criteriaCoversAllLevels('1 балл — верно\n1 балл — верно\n0 баллов — неверно', 1)).toBe(false)
    expect(criteriaCoversAllLevels('2 балла — верно\n0 баллов — неверно', 2)).toBe(false)
    expect(criteriaCoversAllLevels('2 балла — верно\n1 балл — одна ошибка\n0 баллов — неверно', 2)).toBe(true)
  })
  it('не придумывает этапы решения для задания с кратким ответом', () => {
    const b = ensureCriteriaLevels(task('a', 'v1', { points: 3, criteria: '3 балла — верное полное решение с обоснованием\n2 балла — верно выполнено 2 из 3 существенных этапов\n1 балл — верно выполнено 1 из 3 существенных этапов\n0 баллов — неверно' }))
    expect(b.criteria).not.toContain('этапов')
    expect(b.criteria).toContain('правило частичного зачёта не задано')
    expect(b.criteriaStatus).toBe('needs-review')
  })
  it('дополняет неполные критерии всеми уровнями и просит проверки', () => {
    const b = ensureCriteriaLevels(task('a', 'v1', { points: 3, criteria: 'Максимум 3 балла' }))
    expect(criteriaCoversAllLevels(b.criteria, 3)).toBe(true)
    expect(b.criteriaStatus).toBe('needs-review')
  })
})

describe('нумерация в выгрузке как на платформе', () => {
  it('каждый вариант начинается с задания 1', () => {
    const blocks = [task('a', 'v1'), task('b', 'v1'), task('c', 'v2'), task('d', 'v2')]
    const groups = [{ id: 'v1', label: 'Вариант 1', kind: 'variant' as const }, { id: 'v2', label: 'Вариант 2', kind: 'variant' as const }]
    expect(platformTaskNumbers(blocks, groups).get('c')).toBe(1)
    const exp = draftForExport({ ...emptyDraft(), blocks, groups, print: { ...emptyDraft().print, groupFilter: 'all' } })
    expect(exp.blocks.find((b) => b.id === 'd')?.exportNumber).toBe(2)
  })
})
