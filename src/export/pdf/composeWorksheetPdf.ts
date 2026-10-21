import { jsPDF } from 'jspdf'
import { pngBytesToDataUrl } from '@/export/pdf/pngDataUrl'
import type { PdfSlice } from '@/export/pdf/pdfSlice'
import { SHEET_CONTENT_WIDTH_PX } from '@/export/word/layoutTokens'
import { PAGE_MARGIN_TWIPS } from '@/export/word/build/buildHeader'

/** twips → mm (1440 twips = 1 inch). */
function twipsToMm(twips: number): number {
  return (twips / 1440) * 25.4
}

const MARGIN_MM = twipsToMm(PAGE_MARGIN_TWIPS)
const PX_TO_MM = 25.4 / 96

export async function composeWorksheetPdf(
  slices: PdfSlice[],
  orientation: 'portrait' | 'landscape',
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: orientation === 'landscape' ? 'l' : 'p',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  let pageWidth = pdf.internal.pageSize.getWidth()
  let pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidthMm = pageWidth - MARGIN_MM * 2
  let y = MARGIN_MM

  const startNewPage = () => {
    pdf.addPage()
    pageWidth = pdf.internal.pageSize.getWidth()
    pageHeight = pdf.internal.pageSize.getHeight()
    y = MARGIN_MM
  }

  for (const slice of slices) {
    if (slice.kind === 'pageBreak') {
      if (y > MARGIN_MM) startNewPage()
      continue
    }

    const { image, gapAfterPx = 0 } = slice
    const imgWidthMm = (image.width / SHEET_CONTENT_WIDTH_PX) * contentWidthMm
    const imgHeightMm = imgWidthMm * (image.height / Math.max(1, image.width))
    const gapMm = gapAfterPx * PX_TO_MM

    if (y + imgHeightMm > pageHeight - MARGIN_MM && y > MARGIN_MM) {
      startNewPage()
    }

    const imgData = pngBytesToDataUrl(image.data)
    const maxHeight = pageHeight - MARGIN_MM * 2
    if (imgHeightMm > maxHeight) {
      const source = new Image()
      source.src = imgData
      await source.decode()
      let offset = 0
      const pixelsPerMm = source.height / imgHeightMm
      while (offset < source.height) {
        const height = Math.min(source.height - offset, Math.floor(maxHeight * pixelsPerMm))
        const canvas = document.createElement('canvas')
        canvas.width = source.width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Не удалось подготовить страницу PDF')
        context.drawImage(source, 0, offset, source.width, height, 0, 0, source.width, height)
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN_MM, y, imgWidthMm, height / pixelsPerMm, undefined, 'SLOW')
        offset += height
        y += height / pixelsPerMm
        if (offset < source.height) startNewPage()
      }
      y += gapMm
      continue
    }
    pdf.addImage(imgData, 'PNG', MARGIN_MM, y, imgWidthMm, imgHeightMm, undefined, 'SLOW')
    y += imgHeightMm + gapMm
  }

  return pdf.output('blob')
}
