import { useState } from 'react'
import { Button, Field, Select } from '@/components/ui'
import { sheetTopicLabel, type WorksheetDraft } from '@/data/worksheet'
import { materialTypeOf, modeParamsOf } from '@/data/materialModes'
import './Print.css'

interface PrintScreenProps {
  draft: WorksheetDraft
  onChangeDraft: (draft: WorksheetDraft) => void
  onBack: () => void
  onPrint: () => void
  onPdf: () => Promise<void> | void
  onDocx?: () => Promise<void> | void
  onSave?: () => void
}

export function PrintScreen({ draft, onChangeDraft, onBack, onPrint, onPdf, onDocx, onSave }: PrintScreenProps) {
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null)
  const audience = draft.print.audience ?? 'student'
  const groups = draft.groups ?? []
  const isCards = materialTypeOf(draft) === 'cards'
  const setPrint = (patch: Partial<WorksheetDraft['print']>) =>
    onChangeDraft({ ...draft, print: { ...draft.print, ...patch } })

  const run = async (kind: 'pdf' | 'docx', fn?: () => Promise<void> | void) => {
    if (!fn || busy) return
    setBusy(kind)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="print-page">
      <header className="print-head">
        <nav className="print-crumb">
          <button type="button" onClick={onBack}>
            Назад к предпросмотру
          </button>
        </nav>
        <h1>Скачать / печать</h1>
        <p>«{sheetTopicLabel(draft)}»</p>
      </header>

      <div className="print-settings">
        <fieldset className="print-audience">
          <legend>Версия</legend>
          <label className="print-check">
            <input type="radio" name="audience" checked={audience === 'student'} onChange={() => setPrint({ audience: 'student' })} />
            Для ученика — без ответов и решений
          </label>
          <label className="print-check">
            <input type="radio" name="audience" checked={audience === 'teacher'} onChange={() => setPrint({ audience: 'teacher' })} />
            Для учителя — с ответами{materialTypeOf(draft) === 'assessment' ? ', баллами и критериями' : ''}
          </label>
        </fieldset>

        {audience === 'teacher' ? (
          <label className="print-check">
            <input
              type="checkbox"
              checked={draft.print.answersSeparate}
              onChange={(e) => setPrint({ answersSeparate: e.target.checked })}
            />
            Ответы на отдельном листе
          </label>
        ) : null}

        {groups.length ? (
          <Field label={groups[0].kind === 'level' ? 'Уровни' : 'Варианты'}>
            <Select
              options={['Все', ...groups.map((g) => g.label)]}
              value={groups.find((g) => g.id === draft.print.groupFilter)?.label ?? 'Все'}
              onChange={(e) => setPrint({ groupFilter: groups.find((g) => g.label === e.target.value)?.id ?? 'all' })}
            />
          </Field>
        ) : null}

        {isCards ? (
          <p className="print-note">
            Карточек на листе A4: {modeParamsOf(draft).cards.perPage === 'auto' ? 'автоматически' : modeParamsOf(draft).cards.perPage}. При печати карточки
            не разрываются, между ними — линии разреза.
          </p>
        ) : null}

        <div className="print-row">
          <Field label="Количество копий (для печати)">
            <Select
              options={['1', '2', '3', '4', '5']}
              value={String(draft.print.copies)}
              onChange={(e) => setPrint({ copies: Number(e.target.value) || 1 })}
            />
          </Field>
          <Field label="Ориентация">
            <Select
              options={['Книжная', 'Альбомная']}
              value={draft.print.orientation === 'portrait' ? 'Книжная' : 'Альбомная'}
              onChange={(e) => setPrint({ orientation: e.target.value === 'Книжная' ? 'portrait' : 'landscape' })}
            />
          </Field>
        </div>
      </div>

      <div className="print-actions">
        {onSave ? (
          <Button variant="secondary" onClick={onSave}>
            Сохранить
          </Button>
        ) : null}
        {onDocx ? (
          <Button variant="secondary" disabled={Boolean(busy)} onClick={() => run('docx', onDocx)}>
            {busy === 'docx' ? 'Готовим DOCX…' : 'Скачать DOCX'}
          </Button>
        ) : null}
        <Button variant="secondary" disabled={Boolean(busy)} onClick={() => run('pdf', onPdf)}>
          {busy === 'pdf' ? 'Готовим PDF…' : 'Скачать PDF'}
        </Button>
        <Button variant="brand" onClick={onPrint}>
          Распечатать
        </Button>
      </div>
    </div>
  )
}
