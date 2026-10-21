import { describe, expect, it } from 'vitest'
import { defaultGradeScale, gradeForPoints, isValidGradeScale } from './worksheet'

describe('шкала оценивания', () => {
  it('шкала по умолчанию для 15 баллов: 13–15 «5», 10–12 «4», 7–9 «3», 0–6 «2»', () => {
    const scale = defaultGradeScale(15)
    expect(isValidGradeScale(scale)).toBe(true)
    expect(gradeForPoints(15, scale)).toBe('5')
    expect(gradeForPoints(13, scale)).toBe('5')
    expect(gradeForPoints(12, scale)).toBe('4')
    expect(gradeForPoints(10, scale)).toBe('4')
    expect(gradeForPoints(9, scale)).toBe('3')
    expect(gradeForPoints(7, scale)).toBe('3')
    expect(gradeForPoints(6, scale)).toBe('2')
    expect(gradeForPoints(0, scale)).toBe('2')
  })

  it('отклоняет пересекающиеся и неполные шкалы', () => {
    expect(isValidGradeScale([
      { grade: '5', min: 10 },
      { grade: '4', min: 12 },
      { grade: '3', min: 7 },
      { grade: '2', min: 0 },
    ])).toBe(false)
    expect(isValidGradeScale([{ grade: '5', min: 10 }])).toBe(false)
  })

  it('отрицательные баллы не получают отметку', () => {
    expect(gradeForPoints(-1, defaultGradeScale(15))).toBeNull()
  })
})
