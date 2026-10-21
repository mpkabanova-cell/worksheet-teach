/**
 * PDF → текст на рабочем окружении без canvas/LibreOffice:
 * документ целиком отправляется в мультимодальную модель OpenRouter (file input),
 * которая сама читает текстовый слой и сканы.
 */

import { USER_PROMPT_VISION } from './visionOcr.js'
import { stripMarkdownImages } from './markdownClean.js'
import { DEFAULT_CHAT_MODEL } from './openrouterEnv.js'

/** @param {string} text @param {'sparse'|'all'|'off'} mode @param {number} minChars */
export function pageNeedsVision(text, mode, minChars) {
  if (mode === 'off') return false
  if (mode === 'all') return true
  return text.length < minChars
}

function toBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + chunk))
  }
  return btoa(bin)
}

/**
 * @param {Uint8Array} data
 * @param {{ apiKey: string, baseUrl: string, timeoutMs: number, referer: string }} config
 */
export async function extractTextFromPdf(data, config) {
  const model = (process.env.CONTEXT_PDF_MODEL || '').trim() || process.env.OPENAI_MODEL || DEFAULT_CHAT_MODEL
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': config.referer,
        'X-Title': 'Worksheet Constructor',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${USER_PROMPT_VISION}\n\nРаздели страницы строкой ---.` },
              {
                type: 'file',
                file: { filename: 'document.pdf', file_data: `data:application/pdf;base64,${toBase64(data)}` },
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    })
    const body = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 800)}`)
    const json = JSON.parse(body)
    const content = json.choices?.[0]?.message?.content
    const text = Array.isArray(content) ? content.map((c) => c?.text ?? '').join('') : String(content ?? '')
    return stripMarkdownImages(text.trim())
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Превышено время ожидания распознавания')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
