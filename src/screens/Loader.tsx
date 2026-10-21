import { GENERATION_STAGE_LABELS, type GenerationStage } from '@/data/generationControl'
import './Loader.css'

interface LoaderProps {
  title?: string
  message?: string
  onHome?: () => void
  stage?: GenerationStage | null
  error?: string | null
  onCancel?: () => void
  onRetry?: () => void
  onBackToForm?: () => void
}

const ORDER: GenerationStage[] = ['plan', 'tasks', 'check', 'finalize']

export function Loader({
  title = 'Закрепление материала',
  message = 'Думаю над темой',
  onHome,
  stage,
  error,
  onCancel,
  onRetry,
  onBackToForm,
}: LoaderProps) {
  const activeIdx = stage ? ORDER.indexOf(stage) : 0
  return (
    <div className="loader-page">
      <header className="ws-navbar">
        <nav className="breadcrumbs" aria-label="Навигация">
          <button type="button" onClick={onHome}>
            Главная
          </button>
          <span>/</span>
          <button type="button" onClick={onHome}>
            Материалы
          </button>
          <span>/</span>
          <span className="current">{title}</span>
        </nav>
      </header>
      <div className="loader-center">
        {error ? (
          <>
            <p className="loader-error" role="alert">{error}</p>
            <p className="loader-hint">Параметры сохранены — можно повторить или вернуться к форме.</p>
            <div className="loader-actions">
              {onBackToForm ? (
                <button type="button" className="loader-btn" onClick={onBackToForm}>
                  К параметрам
                </button>
              ) : null}
              {onRetry ? (
                <button type="button" className="loader-btn loader-btn--brand" onClick={onRetry}>
                  Повторить
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <span className="spinner" aria-hidden />
            <p>{stage ? GENERATION_STAGE_LABELS[stage] : message}</p>
            <ol className="loader-stages" aria-label="Этапы">
              {ORDER.map((s, i) => (
                <li key={s} className={i < activeIdx ? 'done' : i === activeIdx ? 'active' : ''}>
                  {GENERATION_STAGE_LABELS[s]}
                </li>
              ))}
            </ol>
            <p className="loader-hint">Обычно это занимает 1–3 минуты.</p>
            {onCancel ? (
              <button type="button" className="loader-btn" onClick={onCancel}>
                Отменить
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
