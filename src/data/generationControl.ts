/** Управление долгой генерацией: этапы, отмена, общий лимит времени. */

export type GenerationStage = 'plan' | 'tasks' | 'check' | 'finalize'

export const GENERATION_STAGE_LABELS: Record<GenerationStage, string> = {
  plan: 'Составляю план',
  tasks: 'Пишу задания',
  check: 'Проверяю задания',
  finalize: 'Готовлю результат',
}

/** Лимит одного запроса к модели. */
export const CHAT_CALL_TIMEOUT_MS = 120_000
/** После этого времени необязательные доработки пропускаются. */
export const GENERATION_SOFT_BUDGET_MS = 150_000

interface ActiveRun {
  signal: AbortSignal
  startedAt: number
  onStage?: (stage: GenerationStage) => void
}

let active: ActiveRun | null = null

export class GenerationCancelled extends Error {
  constructor() {
    super('Генерация отменена')
    this.name = 'GenerationCancelled'
  }
}

export async function runGeneration<T>(
  fn: () => Promise<T>,
  opts: { signal: AbortSignal; onStage?: (stage: GenerationStage) => void },
): Promise<T> {
  const prev = active
  active = { signal: opts.signal, startedAt: Date.now(), onStage: opts.onStage }
  try {
    return await fn()
  } finally {
    active = prev
  }
}

export function reportStage(stage: GenerationStage): void {
  active?.onStage?.(stage)
}

export function currentGenerationSignal(): AbortSignal | undefined {
  return active?.signal
}

/** true, если время на необязательные доработки истекло. */
export function generationBudgetExceeded(now = Date.now()): boolean {
  if (!active) return false
  return now - active.startedAt > GENERATION_SOFT_BUDGET_MS
}

export function throwIfCancelled(): void {
  if (active?.signal.aborted) throw new GenerationCancelled()
}

/** Сигнал для одного запроса: отмена пользователем или таймаут. */
export function callSignal(timeoutMs = CHAT_CALL_TIMEOUT_MS): { signal: AbortSignal; timedOut: () => boolean; dispose: () => void } {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const parent = active?.signal
  const onAbort = () => controller.abort()
  if (parent) {
    if (parent.aborted) controller.abort()
    else parent.addEventListener('abort', onAbort, { once: true })
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer)
      parent?.removeEventListener('abort', onAbort)
    },
  }
}
