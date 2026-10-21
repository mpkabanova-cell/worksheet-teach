import { blockAnswerText } from '@/data/materialModes'
import { exportCriteriaSections, exportGradeScaleLines, pointsLabel, teacherDetailLines } from '@/export/assessmentContent'
import { rasterizeRichTextBlock } from './renderExportHeaderDom'
import { TYPO, LAYOUT } from '@/export/word/layoutTokens'
import type { ExportContext } from '@/export/word/types'
import type { PdfSlice } from './pdfSlice'

/** Separate rows allow the full appendix to flow across pages without clipping. */
export async function collectCriteriaSlices(ctx: ExportContext): Promise<PdfSlice[]> {
  const slices: PdfSlice[] = [{ kind: 'pageBreak' }]
  let index = 0
  const add = async (text: string, title = false) => {
    const image = await rasterizeRichTextBlock(text, ctx, `criteria-${index++}`, title ? TYPO.sheetTitle : TYPO.plainBody)
    if (image) slices.push({ kind: 'image', image, gapAfterPx: LAYOUT.taskGap })
  }
  await add('Критерии и оценивание', true)
  const sections = exportCriteriaSections(ctx.draft)
  for (const section of sections) {
    if (section.label) await add(section.label, true)
    for (const task of section.tasks) {
      await add(`${task.exportNumber}. ${task.question || task.instruction || task.title || 'Задание'}`)
      if (task.skill) await add(task.skill)
      await add(`Ответ: ${blockAnswerText(task) || 'Ответ не задан'}`)
      await add(pointsLabel(task.points ?? 0))
      for (const line of teacherDetailLines(task)) await add(line)
    }
    await add(`Всего: ${pointsLabel(section.total)}`)
  }
  for (const line of exportGradeScaleLines(ctx.draft, Math.max(0, ...sections.map((s) => s.total)))) await add(line)
  return slices
}