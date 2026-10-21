import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Sidebar } from '@/components/Sidebar'
import { generateSingleTaskAI } from '@/data/ai'
import { generateMaterialAI, verifyBlockAnswers } from '@/data/materialGeneration'
import { GenerationCancelled, runGeneration, type GenerationStage } from '@/data/generationControl'
import { anotherCardNote, CARD_KIND_LABELS, stripCardHeading, draftForExport, materialTypeOf, modeParamsOf, replaceBlockKeepingSlot } from '@/data/materialModes'
import type { GenerateMode } from '@/data/ai'
import {
  createEmptyBlock,
  generateWorksheet,
} from '@/data/generator'
import {
  breadcrumbLabel,
  emptyDraft,
  filledCreateDraft,
  loadWorksheet,
  migrateWorksheetDraft,
  uid,
  type Modal,
  type NavId,
  type Screen,
  type TaskType,
  type WorksheetBlock,
  type WorksheetDraft,
} from '@/data/worksheet'
import { cloneBlock, isPageEmpty, normalizeWorksheetDraft, removePageFromDraft, syncPagesFromBreaks } from '@/data/blockUtils'
import { exportWorksheetDocx } from '@/export/word/exportWorksheetDocx'
import { exportWorksheetPdf } from '@/export/exportWorksheetPdf'
import { Home } from '@/screens/Home'
import { Create } from '@/screens/Create'
import { Loader } from '@/screens/Loader'
import { WorksheetScreen } from '@/screens/Worksheet'
import { Modals } from '@/screens/Modals'
import { WorksheetsList } from '@/screens/WorksheetsList'
import { ComingSoon } from '@/screens/ComingSoon'
import { PrintScreen } from '@/screens/Print'

function demoDraft(): WorksheetDraft {
  return generateWorksheet({
    ...filledCreateDraft(),
    topic: 'Закрепление материалов',
    title: 'Закрепление материалов',
    additionalWishes: 'Класс только начал тему',
  })
}

const PENDING_KEY = 'ws-pending-generation'
const AUTOSAVE_KEY = 'ws-autosave-draft'

const SHELL_SCREENS: Screen[] = ['home', 'worksheets-list', 'coming-soon']

function navFromScreen(screen: Screen, stubNav: NavId): NavId {
  if (screen === 'home') return 'desk'
  if (screen === 'worksheets-list') return 'materials'
  if (screen === 'coming-soon') return stubNav
  return 'desk'
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [stubNav, setStubNav] = useState<NavId>('ai')
  const [createOpen, setCreateOpen] = useState(false)
  const [createAdvanced, setCreateAdvanced] = useState(false)
  const [draft, setDraftState] = useState<WorksheetDraft>(() => demoDraft())
  const [modal, setModal] = useState<Modal>(null)
  const modalRef = useRef<Modal>(null)
  modalRef.current = modal
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [deletePageIndex, setDeletePageIndex] = useState<number | null>(null)
  const [, setPendingGenerate] = useState(false)
  const [generateMode, setGenerateMode] = useState<GenerateMode>('create')
  const [generateTaskType, setGenerateTaskType] = useState<TaskType>('short_answer')
  const [generateTaskHint, setGenerateTaskHint] = useState('')
  const [generateTaskBusy, setGenerateTaskBusy] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [listRefresh, setListRefresh] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [genStage, setGenStage] = useState<GenerationStage | null>(null)
  const [genError, setGenError] = useState<string | null>(null)
  const [genRun, setGenRun] = useState(0)
  const genAbortRef = useRef<AbortController | null>(null)
  const genErrorRef = useRef<string | null>(null)
  genErrorRef.current = genError
  const taskAbortRef = useRef<AbortController | null>(null)
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [replaceReview, setReplaceReview] = useState<{ id: string; prev: WorksheetBlock } | null>(null)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  const draftRef = useRef(draft)
  const generateModeRef = useRef<GenerateMode>('create')
  const historyRef = useRef<WorksheetDraft[]>([])
  const historyIdxRef = useRef(-1)
  const skipHistoryRef = useRef(false)
  draftRef.current = draft
  generateModeRef.current = generateMode

  const pushHistory = useCallback((next: WorksheetDraft) => {
    const trimmed = historyRef.current.slice(0, historyIdxRef.current + 1)
    trimmed.push(JSON.parse(JSON.stringify(next)) as WorksheetDraft)
    if (trimmed.length > 20) trimmed.shift()
    historyRef.current = trimmed
    historyIdxRef.current = trimmed.length - 1
  }, [])

  const setDraft = useCallback(
    (updater: WorksheetDraft | ((prev: WorksheetDraft) => WorksheetDraft)) => {
      setDraftState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (!skipHistoryRef.current) pushHistory(next)
        return next
      })
    },
    [pushHistory],
  )

  const undo = useCallback(() => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current -= 1
    skipHistoryRef.current = true
    setDraftState(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])) as WorksheetDraft)
    skipHistoryRef.current = false
  }, [])

  const redo = useCallback(() => {
    if (historyIdxRef.current >= historyRef.current.length - 1) return
    historyIdxRef.current += 1
    skipHistoryRef.current = true
    setDraftState(JSON.parse(JSON.stringify(historyRef.current[historyIdxRef.current])) as WorksheetDraft)
    skipHistoryRef.current = false
  }, [])

  useEffect(() => {
    pushHistory(draft)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = (message: string) => {
    setToastMessage(message)
    setModal('toast')
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => {
      setModal(null)
      setToastMessage('')
    }, 2800)
  }

  useEffect(() => {
    if (!sidebarOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sidebarOpen])

  useEffect(() => {
    if (screen !== 'loader' || genErrorRef.current) return
    const controller = new AbortController()
    genAbortRef.current = controller
    const mode = generateModeRef.current
    setGenStage(null)
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ draft: draftRef.current, mode }))
    } catch {
      /* storage full */
    }

    ;(async () => {
      try {
        const next = await runGeneration(() => generateMaterialAI(draftRef.current, mode), {
          signal: controller.signal,
          onStage: (st) => {
            if (!controller.signal.aborted) setGenStage(st)
          },
        })
        if (controller.signal.aborted) return
        localStorage.removeItem(PENDING_KEY)
        setDraft(syncPagesFromBreaks(next))
        setActiveGroupId(next.groups?.[0]?.id ?? null)
        setPendingGenerate(false)
        setCurrentPage(0)
        setSelectedBlockId(null)
        setCreateOpen(false)
        setScreen(mode === 'regenerate' ? 'edit' : 'preview')
        showToast(mode === 'regenerate' ? 'Материал перегенерирован' : 'Материал готов')
      } catch (err) {
        if (controller.signal.aborted || err instanceof GenerationCancelled) return
        setPendingGenerate(false)
        setGenError(err instanceof Error && err.message ? err.message : 'Не удалось сгенерировать материал')
      }
    })()

    return () => {
      controller.abort()
    }
  }, [screen, genRun, setDraft])

  const cancelGeneration = () => {
    genAbortRef.current?.abort()
    localStorage.removeItem(PENDING_KEY)
    setGenError(null)
    setPendingGenerate(false)
    if (generateModeRef.current === 'regenerate') setScreen('edit')
    else {
      setCreateOpen(true)
      setScreen('home')
    }
    showToast('Генерация отменена')
  }

  const retryGeneration = () => {
    setGenError(null)
    genErrorRef.current = null
    setGenRun((n) => n + 1)
  }

  const backToFormFromError = () => {
    localStorage.removeItem(PENDING_KEY)
    setGenError(null)
    if (generateModeRef.current === 'regenerate') setScreen('edit')
    else {
      setCreateOpen(true)
      setScreen('home')
    }
  }

  // Восстановление после обновления страницы
  useEffect(() => {
    try {
      const pending = localStorage.getItem(PENDING_KEY)
      if (pending) {
        const parsed = JSON.parse(pending) as { draft: Record<string, unknown>; mode: GenerateMode }
        setDraftState(migrateWorksheetDraft(parsed.draft))
        setGenerateMode(parsed.mode)
        generateModeRef.current = parsed.mode
        setGenError('Генерация прервалась из‑за обновления страницы.')
        setScreen('loader')
        return
      }
      const auto = localStorage.getItem(AUTOSAVE_KEY)
      if (auto) {
        const parsed = JSON.parse(auto) as { draft: Record<string, unknown> }
        const restored = normalizeWorksheetDraft(migrateWorksheetDraft(parsed.draft))
        if (restored.blocks.length) {
          setDraftState(restored)
          setActiveGroupId(restored.groups?.[0]?.id ?? null)
          setScreen('edit')
          showToast('Черновик восстановлен')
        }
      }
    } catch {
      /* ignore corrupt storage */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Автосохранение черновика в браузере, пока открыт редактор
  useEffect(() => {
    const inEditor = ['edit', 'edit-widget', 'add-block', 'preview', 'show-answers', 'print'].includes(screen)
    try {
      if (inEditor) localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ draft }))
      else if (screen === 'home' || screen === 'worksheets-list') localStorage.removeItem(AUTOSAVE_KEY)
    } catch {
      /* storage full */
    }
  }, [draft, screen])

  useEffect(() => {
    if (screen === 'edit-widget' && !selectedBlockId && draft.blocks[0]) {
      setSelectedBlockId(draft.blocks[0].id)
    }
  }, [screen, selectedBlockId, draft.blocks])

  useEffect(() => {
    if (
      screen === 'edit' ||
      screen === 'edit-widget' ||
      screen === 'preview' ||
      screen === 'show-answers' ||
      screen === 'print'
    ) {
      setDraft((d) => syncPagesFromBreaks(d))
    }
  }, [screen])

  const openCreate = (advanced = false) => {
    setDraft(emptyDraft())
    setCreateAdvanced(advanced)
    setCreateOpen(true)
  }

  const closeCreate = () => {
    setCreateOpen(false)
    setCreateAdvanced(false)
  }

  const submitCreate = (createMode: 'generate' | 'manual' = 'generate') => {
    setCreateOpen(false)
    setCreateAdvanced(false)
    setDraft((d) => ({
      ...d,
      title: d.topic.trim() || d.title,
      blocks: createMode === 'manual' ? [] : d.blocks,
      intro: createMode === 'manual' ? '' : d.intro,
      createdManually: createMode === 'manual',
      showIntro: createMode === 'manual' ? false : d.showIntro,
    }))
    if (createMode === 'manual') {
      setSelectedBlockId(null)
      setScreen('edit')
      return
    }
    setPendingGenerate(true)
    setGenerateMode('create')
    generateModeRef.current = 'create'
    setGenError(null)
    setScreen('loader')
  }

  const updateBlock = (block: WorksheetBlock) => {
    setDraft((d) => ({
      ...d,
      blocks: d.blocks.map((b) => (b.id === block.id ? block : b)),
    }))
  }

  const addBlock = (type: TaskType, insertBeforeId?: string | null) => {
    if (type === 'page_break') {
      const block = createEmptyBlock('page_break', currentPage, draft.subject)
      setDraft((d) =>
        syncPagesFromBreaks({
          ...d,
          blocks: insertBlockInPage(d.blocks, block, currentPage, insertBeforeId),
        }),
      )
      setCurrentPage(currentPage + 1)
      setSelectedBlockId(null)
      setScreen('edit')
      return
    }
    const block = { ...createEmptyBlock(type, currentPage, draft.subject), groupId: activeGroupId ?? undefined }
    setDraft((d) =>
      syncPagesFromBreaks({
        ...d,
        blocks: insertBlockInPage(d.blocks, block, currentPage, insertBeforeId),
      }),
    )
    setSelectedBlockId(block.id)
    setScreen('edit')
  }

  const removeBlock = (id: string) => {
    setDraft((d) => syncPagesFromBreaks({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }))
    setSelectedBlockId(null)
    setScreen('edit')
  }

  const duplicateBlock = (id: string) => {
    const source = draft.blocks.find((b) => b.id === id)
    if (!source) return
    const copy = cloneBlock(source)
    setDraft((d) => {
      const idx = d.blocks.findIndex((b) => b.id === id)
      if (idx < 0) return d
      const blocks = [...d.blocks]
      blocks.splice(idx + 1, 0, copy)
      return syncPagesFromBreaks({ ...d, blocks })
    })
    setSelectedBlockId(copy.id)
    setScreen('edit')
    showToast(source.issued ? 'Создана копия выданного задания' : 'Блок скопирован')
  }

  const moveBlock = (id: string, dir: -1 | 1) => {
    setDraft((d) =>
      syncPagesFromBreaks(
        reorderPageBlocks(d, currentPage, (pageBlocks) => {
          const idx = pageBlocks.findIndex((b) => b.id === id)
          const swap = idx + dir
          if (idx < 0 || swap < 0 || swap >= pageBlocks.length) return pageBlocks
          const next = [...pageBlocks]
          ;[next[idx], next[swap]] = [next[swap], next[idx]]
          return next
        }),
      ),
    )
  }

  const reorderBlock = (
    fromId: string,
    toId: string,
    position: 'before' | 'after' = 'before',
  ) => {
    if (fromId === toId) return
    setDraft((d) =>
      syncPagesFromBreaks(
        reorderPageBlocks(d, currentPage, (pageBlocks) => {
          const fromIdx = pageBlocks.findIndex((b) => b.id === fromId)
          let toIdx = pageBlocks.findIndex((b) => b.id === toId)
          if (fromIdx < 0 || toIdx < 0) return pageBlocks
          const next = [...pageBlocks]
          const [item] = next.splice(fromIdx, 1)
          if (fromIdx < toIdx) toIdx -= 1
          const insertIdx = position === 'after' ? toIdx + 1 : toIdx
          next.splice(insertIdx, 0, item)
          return next
        }),
      ),
    )
  }

  const addPage = () => {
    setDraft((d) => ({ ...d, pages: d.pages + 1 }))
    setCurrentPage(draft.pages)
  }

  const confirmRemovePage = (page: number) => {
    setDraft((d) => syncPagesFromBreaks(removePageFromDraft(d, page)))
    setCurrentPage((prev) => {
      if (prev > page) return prev - 1
      if (prev === page) return Math.max(0, page - 1)
      return prev
    })
    setSelectedBlockId(null)
    setScreen('edit')
    setDeletePageIndex(null)
    setModal(null)
    showToast('Страница удалена')
  }

  const requestRemovePage = (page: number) => {
    if (draft.pages <= 1) return
    if (isPageEmpty(draft.blocks, page)) {
      confirmRemovePage(page)
      return
    }
    setDeletePageIndex(page)
    setModal('delete-page')
  }

  const openReplaceBlock = (id: string) => {
    const target = draft.blocks.find((b) => b.id === id)
    if (!target) return
    setReplaceTargetId(id)
    if (target.type !== 'text' && target.type !== 'page_break' && target.type !== 'answer_field') {
      setGenerateTaskType(target.type)
    }
    setModal('generate-task')
  }

  const openAddGeneratedTask = () => {
    setReplaceTargetId(null)
    setModal('generate-task')
  }

  const cancelGenerateTask = () => {
    taskAbortRef.current?.abort()
    taskAbortRef.current = null
    setGenerateTaskBusy(false)
    setReplaceTargetId(null)
    setModal(null)
  }

  const confirmGenerateTask = async () => {
    if (generateTaskBusy) return
    const controller = new AbortController()
    taskAbortRef.current = controller
    const targetId = replaceTargetId
    setGenerateTaskBusy(true)
    try {
      const fresh = await runGeneration(
        () => generateSingleTaskAI(draftRef.current, generateTaskType, generateTaskHint),
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      const [block] = verifyBlockAnswers([fresh])
      block.page = currentPage
      block.groupId = activeGroupId ?? undefined
      if (targetId) {
        const prev = draftRef.current.blocks.find((b) => b.id === targetId)
        setDraft((d) => ({ ...d, blocks: replaceBlockKeepingSlot(d.blocks, targetId, block) }))
        setSelectedBlockId(targetId)
        setGenerateTaskHint('')
        if (prev) {
          setReplaceReview({ id: targetId, prev })
          setModal('replace-review')
        } else setModal(null)
        setScreen('edit')
        return
      }
      setDraft((d) =>
        syncPagesFromBreaks({
          ...d,
          blocks: [...d.blocks, block],
          taskCount: d.taskCount + 1,
        }),
      )
      setSelectedBlockId(block.id)
      if (modalRef.current === 'generate-task') setModal(null)
      setGenerateTaskHint('')
      setScreen('edit')
      showToast('Задание добавлено')
    } catch (err) {
      if (controller.signal.aborted || err instanceof GenerationCancelled) return
      showToast(err instanceof Error ? err.message : 'Ошибка генерации задания')
    } finally {
      if (taskAbortRef.current === controller) taskAbortRef.current = null
      setGenerateTaskBusy(false)
      setReplaceTargetId(null)
    }
  }

  const [anotherCardBusy, setAnotherCardBusy] = useState(false)
  const createAnotherCard = async () => {
    if (anotherCardBusy) return
    const d0 = draftRef.current
    const cards = d0.blocks.filter((b) => b.type !== 'page_break' && b.type !== 'text')
    const prev = cards[cards.length - 1]
    if (!prev) return openAddGeneratedTask()
    const kind = modeParamsOf(d0).cards.kind
    setAnotherCardBusy(true)
    try {
      const prevText = [prev.question, prev.body, prev.gapsSourceText].filter(Boolean).join('\n')
      const fresh = await runGeneration(() =>
        generateSingleTaskAI(d0, prev.type as Parameters<typeof generateSingleTaskAI>[1], anotherCardNote(prevText)),
        { signal: new AbortController().signal },
      )
      const [block] = verifyBlockAnswers([fresh])
      block.page = prev.page
      block.question = stripCardHeading(block.question)
      block.title = `Карточка ${cards.length + 1}. ${CARD_KIND_LABELS[kind]}`
      setDraft((d) => syncPagesFromBreaks({ ...d, blocks: [...d.blocks, block], taskCount: d.taskCount + 1 }))
      setSelectedBlockId(block.id)
      showToast('Карточка добавлена')
    } catch (err) {
      if (!(err instanceof GenerationCancelled)) showToast(err instanceof Error ? err.message : 'Не удалось создать карточку')
    } finally {
      setAnotherCardBusy(false)
    }
  }

  const revertReplace = () => {
    if (!replaceReview) return
    const { id, prev } = replaceReview
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? prev : b)) }))
    setReplaceReview(null)
    setModal(null)
    showToast('Возвращена прежняя версия')
  }

  const handleSave = () => {
    const saved = { ...draft, savedAt: new Date().toISOString() }
    setDraft(saved)
    localStorage.setItem(`worksheet:${saved.id}`, JSON.stringify(saved))
    setListRefresh((n) => n + 1)
    setModal(null)
    showToast('Сохранено в «Материалы»')
  }

  const handleExportDocx = async () => {
    setModal(null)
    try {
      showToast('Готовим DOCX…')
      await exportWorksheetDocx(draftForExport(draft))
      showToast('DOCX скачан')
    } catch (err) {
      showToast(`Не удалось сделать DOCX: ${err instanceof Error ? err.message : 'ошибка'}. Документ сохранён — попробуйте ещё раз.`)
    }
  }

  const handleExportPdf = async () => {
    setModal(null)
    showToast('Формируем PDF…')
    try {
      await exportWorksheetPdf(draftForExport(draft))
      showToast('PDF скачан')
    } catch (err) {
      showToast(`Не удалось сделать PDF: ${err instanceof Error ? err.message : 'ошибка'}. Документ сохранён — попробуйте ещё раз.`)
    }
  }

  const handlePrint = () => {
    setModal(null)
    const prevAnswers = draft.showAnswers
    if ((draft.print.audience ?? 'student') === 'student') {
      setDraft((d) => ({ ...d, showAnswers: false }))
      window.setTimeout(() => {
        window.print()
        setDraft((d) => ({ ...d, showAnswers: prevAnswers }))
      }, 100)
      return
    }
    if (draft.print.answersSeparate) {
      setDraft((d) => ({ ...d, showAnswers: false }))
      window.setTimeout(() => {
        window.print()
        setDraft((d) => ({ ...d, showAnswers: true }))
        window.setTimeout(() => {
          window.print()
          setDraft((d) => ({ ...d, showAnswers: prevAnswers }))
        }, 400)
      }, 100)
    } else {
      window.setTimeout(() => window.print(), 50)
    }
  }

  const navigateNav = (id: NavId) => {
    setSidebarOpen(false)
    if (id === 'desk') {
      setScreen('home')
      return
    }
    if (id === 'materials') {
      setScreen('worksheets-list')
      return
    }
    setStubNav(id)
    setScreen('coming-soon')
  }

  const openWorksheet = (id: string) => {
    const loaded = loadWorksheet(id)
    if (!loaded) {
      showToast('Не удалось открыть рабочий лист')
      return
    }
    setDraft(normalizeWorksheetDraft(loaded))
    setCurrentPage(0)
    setSelectedBlockId(null)
    setScreen('edit')
  }

  const groups = draft.groups ?? []
  const activeGroup = groups.length
    ? groups.some((g) => g.id === activeGroupId)
      ? activeGroupId
      : groups[0].id
    : null
  const viewDraft: WorksheetDraft = activeGroup
    ? { ...draft, blocks: draft.blocks.filter((b) => b.groupId === activeGroup) }
    : draft
  const changeViewDraft = (next: WorksheetDraft) => {
    if (!activeGroup) {
      setDraft(next)
      return
    }
    setDraft((d) => ({
      ...next,
      groups: d.groups,
      blocks: [
        ...d.blocks.filter((b) => b.groupId !== activeGroup),
        ...next.blocks.map((b) => ({ ...b, groupId: activeGroup })),
      ],
    }))
  }

  const worksheetMode =
    screen === 'preview'
      ? 'preview'
      : screen === 'show-answers'
        ? 'answers'
        : screen === 'edit-widget'
          ? 'edit-widget'
          : screen === 'add-block'
            ? 'add-block'
            : 'edit'

  const activeNav = navFromScreen(screen, stubNav)
  const showCreateOverlay =
    createOpen &&
    (SHELL_SCREENS.includes(screen) ||
      screen === 'create' ||
      screen === 'create-advanced' ||
      screen === 'create-filled')

  return (
    <>
      {SHELL_SCREENS.includes(screen) ? (
        <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
          {sidebarOpen ? (
            <button
              type="button"
              className="sidebar-backdrop"
              aria-label="Закрыть меню"
              onClick={() => setSidebarOpen(false)}
            />
          ) : null}
          <Sidebar
            activeId={activeNav}
            mobileOpen={sidebarOpen}
            onMobileToggle={() => setSidebarOpen((v) => !v)}
            onNavigate={navigateNav}
            onSoon={showToast}
          />
          <div className="main-pane">
            <header className="mobile-topbar">
              <button
                type="button"
                className="mobile-menu-btn"
                aria-label="Открыть меню"
                onClick={() => setSidebarOpen(true)}
              >
                <span />
                <span />
                <span />
              </button>
              <span className="mobile-topbar-title">Ассистент Преподавателя</span>
            </header>
            <div className="main-card">
              {screen === 'home' ? (
                <Home onCreateWorksheet={() => openCreate()} onSoon={showToast} />
              ) : null}
              {screen === 'worksheets-list' ? (
                <WorksheetsList
                  refreshKey={listRefresh}
                  onHome={() => setScreen('home')}
                  onCreate={() => openCreate()}
                  onOpen={openWorksheet}
                  onDelete={() => setListRefresh((n) => n + 1)}
                />
              ) : null}
              {screen === 'coming-soon' ? (
                <ComingSoon navId={stubNav} onHome={() => setScreen('home')} />
              ) : null}
            </div>
          </div>
          {showCreateOverlay ? (
            <div className="create-overlay">
              <Create
                overlay
                draft={draft}
                advancedOpen={createAdvanced || screen === 'create-advanced' || screen === 'create-filled'}
                onChange={setDraft}
                onClose={closeCreate}
                onSubmit={submitCreate}
                onSoon={showToast}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {screen === 'loader' ? (
        <Loader
          title={breadcrumbLabel(draft)}
          message={
            generateMode === 'regenerate'
              ? 'Пересобираю задания…'
              : 'Думаю над темой'
          }
          onHome={() => {
            genAbortRef.current?.abort()
            localStorage.removeItem(PENDING_KEY)
            setGenError(null)
            setScreen('home')
          }}
          stage={genStage}
          error={genError}
          onCancel={cancelGeneration}
          onRetry={retryGeneration}
          onBackToForm={backToFormFromError}
        />
      ) : null}

      {screen === 'preview' ||
      screen === 'edit' ||
      screen === 'edit-widget' ||
      screen === 'add-block' ||
      screen === 'show-answers' ? (
        <ErrorBoundary onReset={() => setScreen('edit')}>
          <WorksheetScreen
          draft={viewDraft}
          groupTabs={draft.groups}
          activeGroupId={activeGroup}
          onGroupChange={(id) => {
            setActiveGroupId(id)
            setSelectedBlockId(null)
            setCurrentPage(0)
          }}
          onReplaceBlock={openReplaceBlock}
          mode={worksheetMode}
          selectedBlockId={selectedBlockId}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          onSelectBlock={(id) => {
            setSelectedBlockId(id)
            if (screen !== 'edit' && screen !== 'add-block') {
              setScreen('edit')
            }
          }}
          onChangeBlock={updateBlock}
          onChangeDraft={changeViewDraft}
          onAddBlock={addBlock}
          onRemoveBlock={removeBlock}
          onDuplicateBlock={duplicateBlock}
          onMoveBlock={moveBlock}
          onReorderBlock={reorderBlock}
          onAddPage={addPage}
          onRemovePage={requestRemovePage}
          onBack={() => setScreen('home')}
          onMaterials={() => setScreen('worksheets-list')}
          onEdit={() => setScreen('edit')}
          onPreview={() => {
            setSelectedBlockId(null)
            setScreen('preview')
          }}
          onConvert={() => setModal('convert')}
          onDownload={() => setScreen('print')}
          onMenu={() => setModal('menu')}
          onSettings={() => setModal('settings')}
          onShowAnswers={() => {
            setDraft((d) => ({ ...d, showAnswers: !d.showAnswers }))
            setSelectedBlockId(null)
            setScreen((s) => (s === 'show-answers' ? 'preview' : 'show-answers'))
          }}
          onAddBlockOpen={() => setScreen('edit')}
          onCloseAddBlock={() => setScreen('edit')}
          onGenerateTask={openAddGeneratedTask}
          onAnotherCard={materialTypeOf(draft) === 'cards' ? createAnotherCard : undefined}
          anotherCardBusy={anotherCardBusy}
          onRegenerate={() => setModal('regenerate')}
          onSave={handleSave}
          onUndo={undo}
          onRedo={redo}
          onSoon={showToast}
        />
        </ErrorBoundary>
      ) : null}

      {screen === 'print' ? (
        <PrintScreen
          draft={draft}
          onChangeDraft={setDraft}
          onBack={() => setScreen('preview')}
          onPrint={handlePrint}
          onPdf={handleExportPdf}
          onDocx={handleExportDocx}
          onSave={handleSave}
        />
      ) : null}

      <Modals
        modal={modal}
        draft={draft}
        generateTaskType={generateTaskType}
        generateTaskHint={generateTaskHint}
        generateTaskBusy={generateTaskBusy}
        toastMessage={toastMessage}
        deletePageIndex={deletePageIndex}
        onClose={() => {
          setModal(null)
          setDeletePageIndex(null)
        }}
        onOpen={(m) => {
          if (m === 'download') {
            setModal(null)
            setScreen('print')
            return
          }
          setModal(m)
        }}
        replaceMode={Boolean(replaceTargetId)}
        onCancelGenerateTask={cancelGenerateTask}
        onAcceptReplace={() => {
          setReplaceReview(null)
          setModal(null)
          showToast('Задание заменено')
        }}
        onRevertReplace={revertReplace}
        onChangeDraft={setDraft}
        onGenerateTaskType={setGenerateTaskType}
        onGenerateTaskHint={setGenerateTaskHint}
        onConfirmConvert={() => setModal('convert-success')}
        onConfirmDuplicate={() => {
          setDraft((d) => ({
            ...d,
            id: uid('ws'),
            title: `${d.title} (копия)`,
          }))
          setModal(null)
          showToast('Создана копия')
        }}
        onConfirmDelete={() => {
          setModal(null)
          setDraft(emptyDraft())
          setScreen('home')
          showToast('Рабочий лист удалён')
        }}
        onConfirmDeletePage={() => {
          if (deletePageIndex !== null) confirmRemovePage(deletePageIndex)
        }}
        onConfirmRegenerate={() => {
          if (!draft.topic.trim()) {
            setModal('regenerate-empty-topic')
            return
          }
          setModal(null)
          setPendingGenerate(true)
          setGenerateMode('regenerate')
          generateModeRef.current = 'regenerate'
          setGenError(null)
          setScreen('loader')
        }}
        onConfirmGenerateTask={confirmGenerateTask}
        onPrint={handlePrint}
        onExportDocx={handleExportDocx}
        onExportPdf={handleExportPdf}
        onSave={handleSave}
        onSoon={showToast}
      />

    </>
  )
}

function reorderPageBlocks(
  draft: WorksheetDraft,
  page: number,
  mutate: (pageBlocks: WorksheetBlock[]) => WorksheetBlock[],
): WorksheetDraft {
  const pageBlocks = draft.blocks.filter((b) => b.page === page)
  const others = draft.blocks.filter((b) => b.page !== page)
  return { ...draft, blocks: [...others, ...mutate(pageBlocks)] }
}

function insertBlockInPage(
  blocks: WorksheetBlock[],
  block: WorksheetBlock,
  page: number,
  insertBeforeId?: string | null,
): WorksheetBlock[] {
  const pageBlocks = blocks.filter((b) => b.page === page)
  const others = blocks.filter((b) => b.page !== page)

  if (!insertBeforeId) {
    return [...others, ...pageBlocks, block]
  }

  const idx = pageBlocks.findIndex((b) => b.id === insertBeforeId)
  if (idx < 0) {
    return [...others, ...pageBlocks, block]
  }

  const next = [...pageBlocks]
  next.splice(idx, 0, block)
  return [...others, ...next]
}
