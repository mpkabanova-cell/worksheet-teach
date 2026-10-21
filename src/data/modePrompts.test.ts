import { describe, expect, it } from 'vitest'
import { cardsPrompt, differentiatedPrompt, taskCountForMode } from './materialModes'
import { emptyDraft, mergeModeParams } from './worksheet'

const base = { ...emptyDraft(), subject: 'Математика', grade: '6', topic: 'Сложение дробей' }

describe('режимы из документа с промптами', () => {
  it('«Одно задание в трёх версиях» — одно задание на уровень, подборка — до 3', () => {
    const p = mergeModeParams()
    expect(taskCountForMode({ ...base, materialType: 'differentiated', modeParams: { ...p, differentiated: { ...p.differentiated, format: 'versions' } } })).toBe(1)
    expect(taskCountForMode({ ...base, materialType: 'differentiated', modeParams: p })).toBe(3)
  })

  it('старые черновики получают тип карточки и ответы для учителя по умолчанию', () => {
    const p = mergeModeParams({ cards: { format: 'task', purpose: 'practice', count: 2, perPage: 'auto', work: 'individual' } as never })
    expect(p.cards.kind).toBe('consolidate')
    expect(p.cards.teacherAnswers).toBe(true)
    expect(p.differentiated.format).toBe('levels')
  })

  it('промпты подставляют входные данные и не просят ссылок на ФГОС в материале', () => {
    const d = differentiatedPrompt(base, 'levels')
    expect(d).toContain('Тема урока: Сложение дробей')
    expect(d).toContain('не упоминай нормативные документы')
    expect(cardsPrompt(base, 'support', 4)).toContain('Тип карточки: Нужна опора')
  })
})

import { stripCardHeading } from './materialModes'
describe('заголовок карточки', () => {
  it('убирается из текста задания', () => {
    expect(stripCardHeading('Карточка 2. Нужна опора.\n\nВычисли сумму.')).toBe('Вычисли сумму.')
    expect(stripCardHeading('Вычисли сумму.')).toBe('Вычисли сумму.')
  })
})
