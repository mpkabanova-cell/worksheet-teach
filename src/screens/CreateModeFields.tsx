import { Field, Input, Select } from '@/components/ui'
import type { DiffLevel, MaterialType, ModeParams } from '@/data/worksheet'
import {
  ASSESSMENT_KIND_LABELS,
  CARD_FORMAT_LABELS,
  CARD_PURPOSE_LABELS,
  CARD_WORK_LABELS,
  LEVEL_LABELS,
  suggestTaskCountForMinutes,
} from '@/data/materialModes'

function LabelSelect<T extends string>({
  labels,
  value,
  onChange,
}: {
  labels: Record<T, string>
  value: T
  onChange: (v: T) => void
}) {
  const entries = Object.entries(labels) as [T, string][]
  return (
    <Select
      options={entries.map(([, l]) => l)}
      value={labels[value]}
      onChange={(e) => {
        const found = entries.find(([, l]) => l === e.target.value)
        if (found) onChange(found[0])
      }}
    />
  )
}

interface Props {
  materialType: MaterialType
  params: ModeParams
  setParams: <K extends keyof ModeParams>(key: K, patch: Partial<ModeParams[K]>) => void
  onTaskCount: (n: number) => void
}

export function ModeFields({ materialType, params, setParams, onTaskCount }: Props) {
  if (materialType === 'assessment') {
    const a = params.assessment
    return (
      <div className="mode-fields">
        <div className="row-3">
          <Field label="Вид работы">
            <LabelSelect labels={ASSESSMENT_KIND_LABELS} value={a.kind} onChange={(kind) => setParams('assessment', { kind })} />
          </Field>
          <Field label="Время, мин">
            <Input
              type="number"
              min={5}
              max={90}
              value={a.minutes}
              onChange={(e) => {
                const minutes = Math.min(90, Math.max(5, Number(e.target.value) || 5))
                setParams('assessment', { minutes })
                onTaskCount(suggestTaskCountForMinutes(minutes))
              }}
            />
          </Field>
          <Field label="Вариантов">
            <Select
              options={['1', '2', '3', '4']}
              value={String(a.variants)}
              onChange={(e) => setParams('assessment', { variants: Number(e.target.value) || 1 })}
            />
          </Field>
        </div>
        <Field label="Проверяемые умения (необязательно)">
          <Input
            placeholder="Например: приводить дроби к общему знаменателю; складывать дроби"
            value={a.skills}
            maxLength={300}
            onChange={(e) => setParams('assessment', { skills: e.target.value })}
          />
        </Field>
        <Field label="Оценивание">
          <LabelSelect
            labels={{ none: 'Без отметки', points: 'Баллы и критерии' }}
            value={a.grading}
            onChange={(grading) => setParams('assessment', { grading })}
          />
        </Field>
        <p className="mode-hint">Число заданий подбирается под время — его можно поправить вручную.</p>
      </div>
    )
  }

  if (materialType === 'differentiated') {
    const d = params.differentiated
    const toggle = (level: DiffLevel) => {
      const has = d.levels.includes(level)
      const next = has ? d.levels.filter((l) => l !== level) : [...d.levels, level]
      const order: DiffLevel[] = ['basic', 'advanced', 'high']
      setParams('differentiated', { levels: order.filter((l) => next.includes(l)) })
    }
    return (
      <div className="mode-fields">
        <fieldset className="mode-levels">
          <legend>Уровни</legend>
          {(Object.keys(LEVEL_LABELS) as DiffLevel[]).map((l) => (
            <label key={l} className="mode-check">
              <input type="checkbox" checked={d.levels.includes(l)} onChange={() => toggle(l)} />
              {LEVEL_LABELS[l]}
            </label>
          ))}
        </fieldset>
        <div className="row-2">
          <Field label="Заданий на уровень">
            <Select
              options={['1', '2', '3', '4', '5']}
              value={String(d.perLevel)}
              onChange={(e) => setParams('differentiated', { perLevel: Number(e.target.value) || 1 })}
            />
          </Field>
          <Field label="Форма выдачи">
            <LabelSelect
              labels={{ sets: 'Отдельные комплекты', shared: 'Общий набор' }}
              value={d.delivery}
              onChange={(delivery) => setParams('differentiated', { delivery })}
            />
          </Field>
        </div>
        <Field label="Учебное умение (необязательно)">
          <Input
            placeholder="Например: сложение дробей с разными знаменателями"
            value={d.skill}
            maxLength={200}
            onChange={(e) => setParams('differentiated', { skill: e.target.value })}
          />
        </Field>
        <label className="mode-check">
          <input
            type="checkbox"
            checked={d.printLevelNames}
            onChange={(e) => setParams('differentiated', { printLevelNames: e.target.checked })}
          />
          Печатать названия уровней для учеников
        </label>
        {d.levels.length === 0 ? <p className="mode-hint mode-hint--error">Выберите хотя бы один уровень.</p> : null}
      </div>
    )
  }

  if (materialType === 'cards') {
    const c = params.cards
    return (
      <div className="mode-fields">
        <div className="row-2">
          <Field label="Формат">
            <LabelSelect labels={CARD_FORMAT_LABELS} value={c.format} onChange={(format) => setParams('cards', { format })} />
          </Field>
          <Field label="Назначение">
            <LabelSelect labels={CARD_PURPOSE_LABELS} value={c.purpose} onChange={(purpose) => setParams('cards', { purpose })} />
          </Field>
        </div>
        <div className="row-3">
          <Field label="Разных карточек">
            <Select
              options={['1', '2', '3', '4', '6', '8']}
              value={String(c.count)}
              onChange={(e) => setParams('cards', { count: Number(e.target.value) || 1 })}
            />
          </Field>
          <Field label="На листе A4">
            <LabelSelect
              labels={{ auto: 'Авто', '2': 'По 2', '4': 'По 4' }}
              value={c.perPage}
              onChange={(perPage) => setParams('cards', { perPage })}
            />
          </Field>
          {c.format === 'handout' ? (
            <Field label="Работа">
              <LabelSelect labels={CARD_WORK_LABELS} value={c.work} onChange={(work) => setParams('cards', { work })} />
            </Field>
          ) : null}
        </div>
        <p className="mode-hint">Количество печатных копий выбирается позже, при печати.</p>
      </div>
    )
  }

  return null
}
