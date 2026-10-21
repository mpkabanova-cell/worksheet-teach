import { describe, expect, it } from 'vitest'
import { findVariantIssues, looksLikePlanDescription, normalizeTaskText } from './contentChecks'
import type { BlockGroup, WorksheetBlock } from './worksheet'

const groups: BlockGroup[] = [
  { id: 'variant-1', label: 'Вариант 1', kind: 'variant' },
  { id: 'variant-2', label: 'Вариант 2', kind: 'variant' },
]

const task = (id: string, groupId: string, question: string, extra: Partial<WorksheetBlock> = {}): WorksheetBlock => ({
  id,
  groupId,
  type: 'short_answer',
  page: 0,
  title: id,
  question,
  ...extra,
})

describe('findVariantIssues', () => {
  it('находит одинаковые условия на одной позиции в разных вариантах', () => {
    const blocks = [
      task('a1', 'variant-1', 'Вычислите: 3/4 + 1/4'),
      task('a2', 'variant-1', 'Решите уравнение: 2x = 8'),
      task('b1', 'variant-2', 'Вычислите: 3/4 + 1/4'),
      task('b2', 'variant-2', 'Решите уравнение: 3x = 12'),
    ]
    const issues = findVariantIssues(blocks, groups)
    expect(issues).toHaveLength(1)
    expect(issues[0].kind).toBe('duplicate')
    expect(issues[0].position).toBe(0)
  })

  it('пропускает сопоставимые задания с разными числами', () => {
    const blocks = [
      task('a1', 'variant-1', 'Вычислите: 3/4 + 1/4'),
      task('b1', 'variant-2', 'Вычислите: 5/8 + 2/8'),
    ]
    expect(findVariantIssues(blocks, groups)).toEqual([])
  })

  it('находит несовпадение типа задания на одной позиции', () => {
    const blocks = [
      task('a1', 'variant-1', 'Вычислите сумму'),
      task('b1', 'variant-2', 'Выберите ответ', { type: 'single_choice' }),
    ]
    const issues = findVariantIssues(blocks, groups)
    expect(issues.map((i) => i.kind)).toEqual(['type-mismatch'])
  })

  it('находит несовпадение баллов на одной позиции', () => {
    const blocks = [
      task('a1', 'variant-1', 'Задание про дроби', { points: 2 }),
      task('b1', 'variant-2', 'Другое задание про дроби', { points: 1 }),
    ]
    const issues = findVariantIssues(blocks, groups)
    expect(issues.map((i) => i.kind)).toEqual(['points-mismatch'])
  })

  it('без групп проверка не выполняется', () => {
    expect(findVariantIssues([task('a', 'variant-1', 'x')], [])).toEqual([])
  })
})

describe('looksLikePlanDescription', () => {
  it('распознаёт описание из плана, выданное как условие', () => {
    expect(looksLikePlanDescription('Ученику нужно составить уравнение, например, в скобках')).toBe(true)
    expect(looksLikePlanDescription('Задание проверяет умение решать уравнения')).toBe(true)
    expect(looksLikePlanDescription('Цель задания — закрепить сложение дробей')).toBe(true)
  })

  it('не помечает обычные условия для ученика', () => {
    expect(looksLikePlanDescription('Составьте уравнение по условию задачи и решите его.')).toBe(false)
    expect(looksLikePlanDescription('Вычислите: 7/12 + 5/12.')).toBe(false)
  })
})

describe('normalizeTaskText', () => {
  it('сравнивает тексты без учёта регистра и лишних пробелов', () => {
    expect(normalizeTaskText('Вычислите:  3/4 + 1/4')).toBe(normalizeTaskText('вычислите: 3/4 + 1/4'))
  })
})
