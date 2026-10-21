import { formatCriteriaLevels, parseCriteriaLevels } from '@/data/assessmentCriteria'
import { pointsLabel, type WorksheetBlock } from '@/data/worksheet'

/** Редактирование критериев: отдельное поле на каждый уровень от максимума до 0 и решение. */
export function CriteriaLevelsEditor({
  block,
  onPatch,
}: {
  block: WorksheetBlock
  onPatch: (patch: Partial<WorksheetBlock>) => void
}) {
  const max = Math.max(1, Math.round(block.points ?? 1))
  const parsed = parseCriteriaLevels(block.criteria)
  const levels = Array.from({ length: max + 1 }, (_, i) => {
    const points = max - i
    return { points, description: parsed.find((l) => l.points === points)?.description ?? '' }
  })

  const setLevel = (points: number, description: string) => {
    const next = levels.map((l) => (l.points === points ? { ...l, description } : l))
    const complete = next.every((l) => l.description.trim())
    onPatch({
      criteria: formatCriteriaLevels(next.filter((l) => l.description.trim())),
      criteriaStatus: complete ? 'ok' : 'needs-review',
      criteriaReviewReason: complete ? undefined : 'Опишите каждый уровень баллов.',
    })
  }

  return (
    <div className="ws-teacher-key ws-criteria-editor" aria-label="Критерии и решение для учителя">
      <strong>Критерии</strong>
      {levels.map((l) => (
        <label key={l.points} className="ws-criteria-editor-row">
          <span>{pointsLabel(l.points)}</span>
          <textarea
            rows={1}
            value={l.description}
            placeholder="За что ставится этот балл"
            onChange={(e) => setLevel(l.points, e.target.value)}
          />
        </label>
      ))}
      <label className="ws-criteria-editor-row ws-criteria-editor-solution">
        <span>Решение</span>
        <textarea rows={3} value={block.solution ?? ''} onChange={(e) => onPatch({ solution: e.target.value })} />
      </label>
    </div>
  )
}
