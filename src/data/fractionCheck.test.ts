import { describe, expect, it } from 'vitest'
import { evaluateExact, formatFrac, parseAnswer, verifiedAnswer } from './fractionCheck'

describe('fractionCheck', () => {
  it('3/4 - 1/6 = 7/12', () => {
    expect(formatFrac(evaluateExact('3/4 - 1/6')!)).toBe('7/12')
  })
  it('handles LaTeX fractions', () => {
    expect(formatFrac(evaluateExact('\\frac{1}{3} + \\frac{1}{4}')!)).toBe('7/12')
  })
  it('parses mixed number answers', () => {
    expect(formatFrac(parseAnswer('1 1/2')!)).toBe('3/2')
  })
  it('fixes a wrong computed answer', () => {
    expect(verifiedAnswer('Вычислите: 1/3 + 1/4.', '2/7')).toBe('7/12')
  })
  it('keeps a correct equivalent answer', () => {
    expect(verifiedAnswer('Вычислите: 1/3 + 1/4.', '14/24')).toBeNull()
  })
  it('ignores word problems', () => {
    expect(verifiedAnswer('На сколько килограммов больше?', '7/12')).toBeNull()
  })
})
