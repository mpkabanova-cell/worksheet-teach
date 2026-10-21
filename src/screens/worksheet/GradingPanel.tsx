import { useState } from 'react'
import { MathText } from '@/components/MathText'
import { CriteriaLevelsView } from '@/components/CriteriaLevelsView'
import { Button } from '@/components/ui'
import { blockAnswerText, modeParamsOf } from '@/data/materialModes'
import { ensureCriteriaLevels, isNumberedTaskBlock, platformTaskNumbers } from '@/data/assessmentCriteria'
import { defaultGradeScale, gradeForPoints, isValidGradeScale, pointsLabel, type GradeThreshold, type WorksheetDraft } from '@/data/worksheet'

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

  const groups = (draft.groups ?? []).filter((g) => draft.blocks.some((b) => b.groupId === g.id))
  const numbers = platformTaskNumbers(draft.blocks, groups)
  const sections = (groups.length ? groups : [{ id: '', label: '' }]).map((g) => ({
    id: g.id,
    label: g.label,
    tasks: draft.blocks
      .filter((b) => (g.id ? b.groupId === g.id : true) && isNumberedTaskBlock(b))
      .map(ensureCriteriaLevels)
      .sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0)),
  }))
  const sectionTotal = (tasks: typeof draft.blocks) => tasks.reduce((sum, b) => sum + (b.points ?? 0), 0)
  // Варианты равноценны: шкала строится по максимуму одного варианта.
  const total = Math.max(0, ...sections.map((s) => sectionTotal(s.tasks)))
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
      <h2 className="grading-title">Критерии и оценивание</h2>
      {sections.map((section) => (
        <div key={section.id || 'all'} className="grading-section">
          {section.label ? <h3 className="grading-variant">{section.label}</h3> : null}
        <table className="grading-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Задание / умение</th>
              <th>Ответ</th>
              <th>Баллы</th>
            </tr>
          </thead>
          <tbody>
            {section.tasks.map((b) => (
              <tr key={b.id} className={openId === b.id ? 'is-open' : ''}>
                <td>{numbers.get(b.id)}</td>
                <td>
                  <MathText as="div" text={b.question || b.instruction || b.title || 'Задание'} />
                  {b.skill ? <span className="grading-skill-name">{b.skill}</span> : null}
                  <Button variant="ghost" size="sm" type="button" className="grading-expand" onClick={() => setOpenId(openId === b.id ? null : b.id)}>
                    {openId === b.id ? 'Скрыть решение и критерии ▴' : 'Решение и критерии ▾'}
                  </Button>
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
                          <CriteriaLevelsView text={b.criteria} />
                        </div>
                      ) : null}
                      {!b.solution && !b.criteria ? <p className="grading-empty">Решение и критерии не указаны.</p> : null}
                    </div>
                  ) : null}
                </td>
                <td>
                  <div className="grading-answer"><MathText as="span" text={blockAnswerText(b) || 'Ответ не задан'} /></div>
                </td>
                <td>{b.points ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
          <p className="grading-total">Всего: {pointsLabel(sectionTotal(section.tasks))}</p>
        </div>
      ))}
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
