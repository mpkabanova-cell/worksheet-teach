import { blockAnswerText } from '@/data/materialModes'
import { type WorksheetDraft } from '@/data/worksheet'
import { exportCriteriaSections, exportGradeScaleLines, hasExportCriteria, pointsLabel, teacherDetailLines } from '@/export/assessmentContent'
import { richParagraphs } from '@/export/word/richText/toDocxContent'
import { COLORS, TYPO, SHEET_CONTENT_WIDTH_PX, pxToDxa } from '@/export/word/layoutTokens'
import type { ExportContext } from '@/export/word/types'
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

const border = { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderSecondary }
const borders = { top: border, bottom: border, left: border, right: border }
const WIDTH = pxToDxa(SHEET_CONTENT_WIDTH_PX)
const COLS = [500, 2500, 2200, 1100, WIDTH - 6300]

async function cell(text: string, width: number, ctx: ExportContext, bold = false): Promise<TableCell> {
  const lines = (text || '—').split('\n')
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (await Promise.all(lines.map((l) => richParagraphs(l, { ...TYPO.plainBody, bold }, ctx)))).flat(),
  })
}

/** Есть ли в выгрузке лист «Критерии и оценивание» (учительская версия работы с баллами). */
export function hasCriteriaSheet(draft: WorksheetDraft, showAnswers: boolean): boolean {
  return hasExportCriteria(draft, showAnswers)
}

/** Лист критериев по всем вариантам; номера — как на платформе (exportNumber). */
export async function buildCriteriaSheet(ctx: ExportContext): Promise<FileChild[]> {
  const draft = ctx.draft
  const sections = exportCriteriaSections(draft)
  const out: FileChild[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: 'Критерии и оценивание', bold: true, size: 28 })] }),
  ]
  let maxTotal = 0
  for (const s of sections) {
    const total = s.tasks.reduce((sum, b) => sum + (b.points ?? 0), 0)
    maxTotal = Math.max(maxTotal, total)
    if (s.label) out.push(new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: s.label, bold: true, size: 24 })] }))
    const rows = [
      new TableRow({ tableHeader: true, children: await Promise.all(['№', 'Задание / умение', 'Ответ', 'Баллы', 'Критерии и решение'].map((t, i) => cell(t, COLS[i], ctx, true))) }),
      ...await Promise.all(s.tasks.map(async (b, i) => {
        const details = teacherDetailLines(b).join('\n')
        return new TableRow({
          children: [
            await cell(String(b.exportNumber ?? i + 1), COLS[0], ctx),
            await cell([b.question || b.instruction || b.title, b.skill].filter(Boolean).join('\n'), COLS[1], ctx),
            await cell(blockAnswerText(b) || 'Ответ не задан', COLS[2], ctx),
            await cell(b.points != null ? String(b.points) : '—', COLS[3], ctx),
            await cell(details, COLS[4], ctx),
          ],
        })
      })),
    ]
    out.push(new Table({ width: { size: COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: COLS, rows }))
    out.push(new Paragraph({ spacing: { before: 80 }, children: [new TextRun({ text: `Всего: ${pointsLabel(total)}`, bold: true, size: 20 })] }))
  }
  for (const line of exportGradeScaleLines(draft, maxTotal)) out.push(...await richParagraphs(line, TYPO.plainBody, ctx))
  return out
}
