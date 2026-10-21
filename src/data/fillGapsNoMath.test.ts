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
      gapsSourceText: 'Маша купила в магазине свежие яблоки.',
      gapsAnswers: ['яблоки'],
    } as WorksheetBlock)
    expect(block.type).toBe('fill_gaps')
  })

  it('формулировка переписывается под краткий ответ без «…» и без «Заполните пропуски»', () => {
    const block = sanitizeBlock({
      ...base,
      type: 'fill_gaps',
      question: 'Заполните пропуски, восстановив коэффициенты.',
      gapsText: 'Разность $11m - 4m$ записывается как ___$m$. Коэффициент при $m$ равен ___.',
      gapsAnswers: ['7', '7'],
    } as WorksheetBlock)
    expect(block.type).toBe('short_answer')
    expect(block.question).not.toMatch(/…|___|пропуск/i)
    expect(block.question).toContain('Найдите коэффициент при $m$.')
  })
})
