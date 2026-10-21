import { blockAnswerText } from '@/data/materialModes'
import { exportCriteriaSections, exportGradeScaleLines, pointsLabel, teacherDetailLines } from '@/export/assessmentContent'
import { rasterizeRichTextBlock } from './renderExportHeaderDom'
import { TYPO, LAYOUT, COLORS, FONT_CSS, SHEET_CONTENT_WIDTH_PX } from '@/export/word/layoutTokens'
import { captureDomToPng, PDF_DOM_CAPTURE_PIXEL_RATIO } from '@/export/word/rasterize/domToPng'
import { appendMathText } from '@/export/word/rasterize/renderMathHtml'
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
  const row = async (values: string[], details: string[] = [], heading = false) => {
    const root = document.createElement('div')
    root.style.width = `${SHEET_CONTENT_WIDTH_PX}px`
    root.style.fontFamily = FONT_CSS
    root.style.background = `#${COLORS.white}`
    root.style.borderBottom = `1px solid #${COLORS.borderSecondary}`
    root.style.padding = '10px 0'
    root.style.boxSizing = 'border-box'
    const grid = document.createElement('div')
    grid.style.display = 'grid'
    grid.style.gridTemplateColumns = '32px minmax(0, 1fr) 200px 72px'
    grid.style.gap = '8px'
    grid.style.fontWeight = heading ? '600' : '400'
    for (const value of values) {
      const cell = document.createElement('div')
      cell.style.minWidth = '0'
      appendMathText(cell, value, { fontSize: TYPO.plainBody.sizePx, lineHeight: TYPO.plainBody.linePx })
      grid.appendChild(cell)
    }
    root.appendChild(grid)
    for (const line of details) {
      const detail = document.createElement('div')
      detail.style.marginLeft = '40px'
      detail.style.marginTop = '4px'
      appendMathText(detail, line, { fontSize: TYPO.plainBody.sizePx, lineHeight: TYPO.plainBody.linePx })
      root.appendChild(detail)
    }
    const image = await captureDomToPng(root, `criteria-row-${index++}`, ctx, undefined, { fitContent: false, pixelRatio: PDF_DOM_CAPTURE_PIXEL_RATIO })
    slices.push({ kind: 'image', image, gapAfterPx: 0 })
  }
  for (const section of sections) {
    if (section.label) await add(section.label, true)
    await row(['№', 'Задание / умение', 'Ответ', 'Баллы'], [], true)
    for (const task of section.tasks) {
      await row([String(task.exportNumber), [task.question || task.instruction || task.title || 'Задание', task.skill].filter(Boolean).join('\n'), blockAnswerText(task) || 'Ответ не задан', String(task.points ?? 0)], teacherDetailLines(task))
    }
    await add(`Всего: ${pointsLabel(section.total)}`)
  }
  for (const line of exportGradeScaleLines(ctx.draft, Math.max(0, ...sections.map((s) => s.total)))) await add(line)
  return slices
}