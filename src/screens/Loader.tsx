import './Loader.css'

interface LoaderProps {
  title?: string
  message?: string
  onHome?: () => void
}

export function Loader({
  title = 'Закрепление материала',
  message = 'Думаю над темой',
  onHome,
}: LoaderProps) {
  return (
    <div className="loader-page">
      <header className="ws-navbar">
        <nav className="breadcrumbs" aria-label="Навигация">
          <button type="button" onClick={onHome}>
            Главная
          </button>
          <span>/</span>
          <button type="button" onClick={onHome}>
            Рабочие листы
          </button>
          <span>/</span>
          <span className="current">{title}</span>
        </nav>
      </header>
      <div className="loader-center">
        <span className="spinner" aria-hidden />
        <p>{message}</p>
      </div>
    </div>
  )
}
