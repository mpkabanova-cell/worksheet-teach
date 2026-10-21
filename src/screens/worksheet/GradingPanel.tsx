import { useState } from 'react'
import { MathText } from '@/components/MathText'
import { blockAnswerText, modeParamsOf } from '@/data/materialModes'
import { defaultGradeScale, gradeForPoints, isValidGradeScale, type GradeThreshold, type WorksheetDraft } from '@/data/worksheet'

/** Учительская панель «Ответы и оценивание» для работ для проверки. */
export function GradingPanel({
  draft,
  onChangeDraft,
}: {
  draft: WorksheetDraft
  onChangeDraft?: (draft: WorksheetDraft) => void
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const params = modeParamsOf(draft)
  const grading = params.assessment.grading
  if (grading === 'none') return null

  const tasks = draft.blocks.filter((b) => b.type !== 'page_break' && b.type !== 'text')
  const total = tasks.reduce((sum, b) => sum + (b.points ?? 0), 0)
  const scale = params.assessment.gradeScale ?? defaultGradeScale(total || 15)
  const scaleValid = isValidGradeScale(scale)

  const setThreshold = (grade: GradeThreshold['grade'], min: number) => {
    const next = scale.map((t) => (t.grade === grade ? { ...t, min } : t))
    onChangeDraft?.({
      ...draft,
      modeParams: { ...params, assessment: { ...params.assessment, gradeScale: next } },
    })
  }

  return (
    <section className="grading-panel" aria-label="Ответы и оценивание">
      <h2 className="grading-title">Ответы и оценивание</h2>
      <table className="grading-table">
        <thead>
          <tr>
            <th>№</th>
            <th>Умение</th>
            <th>Ответ</th>
            <th>Баллы</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((b, i) => (
            <tr key={b.id} className={openId === b.id ? 'is-open' : ''}>
              <td>{i + 1}</td>
              <td>
                <button type="button" className="grading-skill" onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                  {b.skill || b.title || 'Задание'}
                </button>
                {b.criteriaStatus === 'needs-review' ? (
                  <span className="grading-flag" role="note">Проверьте ключ и критерии</span>
                ) : null}
                {openId === b.id ? (
                  <div className="grading-details">
                    {b.solution ? (
                      <div className="grading-row">
                        <span>Решение</span>
                        <MathText as="div" text={b.solution} />
                      </div>
                    ) : null}
                    {b.criteria ? (
                      <div className="grading-row">
                        <span>Критерии</span>
                        <MathText as="div" text={b.criteria} />
                      </div>
                    ) : null}
                    {!b.solution && !b.criteria ? <p className="grading-empty">Решение и критерии не указаны.</p> : null}
                  </div>
                ) : null}
              </td>
              <td>
                <MathText as="span" text={blockAnswerText(b) || '—'} />
              </td>
              <td>{b.points ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="grading-total">Всего: {total} балл(ов)</p>
      {grading === 'grade' ? (
        <fieldset className="grading-scale">
          <legend>Шкала отметок</legend>
          {scale.map((t) => (
            <label key={t.grade} className="grading-scale-row">
              <span>«{t.grade}» от</span>
              <input
                type="number"
                min={0}
                max={total || undefined}
                value={t.min}
                onChange={(e) => setThreshold(t.grade, Math.max(0, Number(e.target.value) || 0))}
              />
              <span>баллов</span>
            </label>
          ))}
          {!scaleValid ? (
            <p className="grading-scale-error" role="alert">
              Пороги пересекаются: проверьте, что границы идут по убыванию от «5» к «2».
            </p>
          ) : (
            <p className="grading-scale-hint">
              Пример: {total} баллов — отметка «{gradeForPoints(total, scale) ?? '—'}».
            </p>
          )}
        </fieldset>
      ) : null}
    </section>
  )
}
