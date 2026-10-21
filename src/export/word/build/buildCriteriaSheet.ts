import { isNumberedTaskBlock } from '@/data/assessmentCriteria'
import { blockAnswerText, modeParamsOf } from '@/data/materialModes'
import { defaultGradeScale, pointsLabel, type WorksheetBlock, type WorksheetDraft } from '@/data/worksheet'
import {
  BorderStyle,
  HeadingLevel,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
} from 'docx'

const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }
const borders = { top: border, bottom: border, left: border, right: border }
const COLS = [700, 2600, 1300, 4400]

function cell(text: string, width: number, bold = false): TableCell {
  const lines = (text || '—').split('\n')
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: lines.map((l) => new Paragraph({ children: [new TextRun({ text: l, bold, size: 20 })] })),
  })
}

/** Есть ли в выгрузке лист «Критерии и оценивание» (учительская версия работы с баллами). */
export function hasCriteriaSheet(draft: WorksheetDraft, showAnswers: boolean): boolean {
  return showAnswers && draft.materialType === 'assessment' && modeParamsOf(draft).assessment.grading !== 'none'
}

/** Лист критериев по всем вариантам; номера — как на платформе (exportNumber). */
export function buildCriteriaSheet(draft: WorksheetDraft): FileChild[] {
  const params = modeParamsOf(draft).assessment
  const groups = (draft.groups ?? []).filter((g) => draft.blocks.some((b) => b.groupId === g.id))
  const sections = groups.length
    ? groups.map((g) => ({ label: g.label, tasks: draft.blocks.filter((b) => b.groupId === g.id && isNumberedTaskBlock(b)) }))
    : [{ label: '', tasks: draft.blocks.filter(isNumberedTaskBlock) }]
  const out: FileChild[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Критерии и оценивание', bold: true, size: 28 })] }),
  ]
  let maxTotal = 0
  for (const s of sections) {
    const total = s.tasks.reduce((sum, b) => sum + (b.points ?? 0), 0)
    maxTotal = Math.max(maxTotal, total)
    if (s.label) out.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: s.label, bold: true, size: 24 })] }))
    const rows = [
      new TableRow({ tableHeader: true, children: ['№', 'Ответ', 'Баллы', 'Критерии и решение'].map((t, i) => cell(t, COLS[i], true)) }),
      ...s.tasks.map((b: WorksheetBlock, i) => {
        const details = [b.criteria, b.solution ? `Решение: ${b.solution}` : ''].filter(Boolean).join('\n')
        return new TableRow({
          children: [
            cell(String(b.exportNumber ?? i + 1), COLS[0]),
            cell(blockAnswerText(b), COLS[1]),
            cell(b.points != null ? String(b.points) : '—', COLS[2]),
            cell(details, COLS[3]),
          ],
        })
      }),
    ]
    out.push(new Table({ width: { size: COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: COLS, rows }))
    out.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: `Всего: ${pointsLabel(total)}`, bold: true, size: 20 })] }))
  }
  if (params.grading === 'grade') {
    const scale = params.gradeScale ?? defaultGradeScale(maxTotal || 15)
    const sorted = [...scale].sort((a, b) => b.min - a.min)
    out.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Шкала отметок', bold: true, size: 22 })] }))
    sorted.forEach((t, i) => {
      const upper = i === 0 ? maxTotal : sorted[i - 1].min - 1
      out.push(new Paragraph({ children: [new TextRun({ text: `«${t.grade}» — ${t.min}–${upper} баллов`, size: 20 })] }))
    })
  }
  return out
}
