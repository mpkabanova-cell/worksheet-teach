import { describe, expect, it } from 'vitest'
import { applyCriteriaReply, needsCriteriaRepair } from './criteriaRepair'
import type { WorksheetBlock } from './worksheet'

const b = { id: 't1', page: 0, title: '', issued: false, type: 'matching', points: 3, criteria: '3 балла — всё верно\n0 баллов — неверно' } as WorksheetBlock

describe('все уровни баллов обязательны', () => {
  it('задание на 3 балла без уровней 2 и 1 требует дозапроса', () => {
    expect(needsCriteriaRepair(b)).toBe(true)
  })
  it('ответ модели с пропущенным уровнем не принимается', () => {
    const out = applyCriteriaReply([b], { tasks: [{ id: 't1', criteria_levels: [{ points: 3, description: 'a' }, { points: 1, description: 'b' }, { points: 0, description: 'c' }] }] })
    expect(needsCriteriaRepair(out[0])).toBe(true)
  })
  it('полный ответ модели с уровнями 3, 2, 1, 0 принимается', () => {
    const out = applyCriteriaReply([b], { tasks: [{ id: 't1', criteria_levels: [3, 2, 1, 0].map((p) => ({ points: p, description: `ур ${p}` })) }] })
    expect(needsCriteriaRepair(out[0])).toBe(false)
  })
})
