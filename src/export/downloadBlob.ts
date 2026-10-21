export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  // Освобождаем ссылку позже: мгновенный revoke срывает скачивание в части браузеров.
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 60_000)
}
