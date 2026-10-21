import { describe, expect, it } from 'vitest'
import { sanitizeBlock } from './blockUtils'
import type { WorksheetBlock } from './worksheet'

const base = { id: 'b', page: 0, title: 'Задание', issued: false } as const

describe('пропуски никогда не делаются в формулах', () => {
  it('пропуск внутри дробей превращается в краткий ответ с целой формулой', () => {
    const block = sanitizeBlock({
      ...base,
      type: 'fill_gaps',
      question: 'Вычислите.',
      gapsText: '$\\frac{1}{2} + \\frac{1}{3} = ___$',
      gapsAnswers: ['\\frac{5}{6}'],
    } as WorksheetBlock)
    expect(block.type).toBe('short_answer')
    expect(block.question).toContain('\\frac{1}{2} + \\frac{1}{3}')
    expect(block.correctAnswers).toEqual(['\\frac{5}{6}'])
  })

  it('обычный текст со словами остаётся заданием с пропусками', () => {
    const block = sanitizeBlock({
      ...base,
      type: 'fill_gaps',
      question: 'Вставьте слова.',
      gapsSourceText: 'Верхнее число дроби называется числитель.',
      gapsAnswers: ['числитель'],
    } as WorksheetBlock)
    expect(block.type).toBe('fill_gaps')
  })
})
