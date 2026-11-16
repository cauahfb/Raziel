
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import AppLayout from './components/layout/AppLayout'
import { trees } from './data/trees'
import { isSupabaseConfigured, supabase } from './lib/supabase'

import Dashboard from './pages/Dashboard/Dashboard'
import Login from './pages/Login/Login'
import SupremeTalents from './pages/SupremeTalents/SupremeTalents'
import TalentTree from './pages/TalentTrees/TalentTree'
import StatBlock from './pages/StatBlock'

import TalentManagement from './pages/admin/TalentManagement'
import ResetProgress from './pages/admin/ResetProgress'
import AdminHistory from './pages/admin/AdminHistory'
import AdminBackup from './pages/admin/AdminBackup'

import type { PageKey, Tree } from './types/tree'

type ActiveTalentSummary = { id: string; name: string; tree_key: string; points: number; is_supreme: boolean }

type TalentTreeProgressRow = {
  tree_key: string
  total_points: number
  talents_with_progress: number
  total_talents: number
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  const [activePage, setActivePage] = useState<PageKey>('dashboard')

  const [visitedPages, setVisitedPages] = useState<Set<PageKey>>(
    () => new Set<PageKey>(['dashboard']),
  )

  const [isAdmin, setIsAdmin] = useState(false)
  const [adminCheckReady, setAdminCheckReady] = useState(false)

  const [characterLevel, setCharacterLevel] = useState(4)
  const [totalDistributed, setTotalDistributed] = useState(0)

  const [treeProgress, setTreeProgress] = useState<
    Record<string, { points: number; visible: number }>
  >({})

  const [activeTalentsByTree, setActiveTalentsByTree] = useState<Record<string, ActiveTalentSummary[]>>({})
  const [activeSupremeTalents, setActiveSupremeTalents] = useState<ActiveTalentSummary[]>([])
  const [activeApexTreeKeys, setActiveApexTreeKeys] = useState<string[]>([])
  const [pendingTalentId, setPendingTalentId] = useState<string | null>(null)
  const [progressReady, setProgressReady] = useState(false)
  const [progressError, setProgressError] = useState<string | null>(null)
  const [progressRefresh, setProgressRefresh] = useState(0)
  const [supremeRefresh, setSupremeRefresh] = useState(0)
  const progressLoadedForUser = useRef<string | null>(null)
  const [supremeAvailableCount, setSupremeAvailableCount] = useState(0)
  const [unlockedSupremeTalentIds, setUnlockedSupremeTalentIds] = useState<string[]>([])
  const [supremeUnlocksReady, setSupremeUnlocksReady] = useState(false)
  const supremeUnlocksLoadedForUser = useRef<string | null>(null)
  const [supremeUnlockNotice, setSupremeUnlockNotice] = useState(false)
  const [supremeUnlockNoticeName, setSupremeUnlockNoticeName] = useState('')
  const [supremeUnlockQueue, setSupremeUnlockQueue] = useState<string[]>([])
  const seenSupremeUnlocks = useRef<Set<string>>(new Set())
  const supremeUnlocksInitialized = useRef(false)

  const [isUpdatingLevel, setIsUpdatingLevel] = useState(false)
  const [levelUpdateMessage, setLevelUpdateMessage] = useState<string | null>(
    null,
  )

  useEffect(() => {
    if (!supabase || !isSupabaseConfigured) {
      setSession(null)
      setAuthReady(true)
      return
    }

    let mounted = true
    const client = supabase

    async function loadSession() {
      const { data, error } = await client.auth.getSession()

      if (!mounted) return

      if (error) {
        console.error('Erro ao recuperar sessão:', error.message)
      }

      setSession(data.session)
      setAuthReady(true)
    }

    void loadSession()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return

      if (event === 'TOKEN_REFRESHED') {
        return
      }

      setSession((currentSession) => {
        const currentUserId = currentSession?.user.id ?? null
        const nextUserId = nextSession?.user.id ?? null

        if (currentUserId === nextUserId && event !== 'USER_UPDATED') {
          return currentSession
        }

        return nextSession
      })

      setAuthReady(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    let cancelled = false

    async function checkAdminAccess() {
      setAdminCheckReady(false)

      if (!userId || !supabase) {
        setIsAdmin(false)
        setAdminCheckReady(true)
        return
      }

      const client = supabase
      const { data, error } = await client.rpc('is_admin')

      if (cancelled) return

      if (error) {
        console.error(
          'Não foi possível verificar as permissões administrativas:',
          error.message,
        )

        setIsAdmin(false)
      } else {
        setIsAdmin(data === true)
      }

      setAdminCheckReady(true)
    }

    void checkAdminAccess()

    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    let cancelled = false

    async function loadProgress() {
      const isInitialLoadForUser = progressLoadedForUser.current !== userId
      if (isInitialLoadForUser) setProgressReady(false)
      setProgressError(null)

      if (!userId || !supabase) {
        progressLoadedForUser.current = null
        setProgressReady(true)
        return
      }

      const client = supabase

      const [levelResult, treeProgressResult, talentsResult, talentProgressResult, apexProgressResult] = await Promise.all([
        client
          .from('compendium_progress')
          .select('character_level')
          .eq('id', 1)
          .single(),

        client
          .from('talent_tree_progress_safe')
          .select(
            'tree_key, total_points, talents_with_progress, total_talents',
          ),
        client.from('talents_safe').select('id, tree_key, name, is_supreme, is_hidden'),
        client.from('talent_progress_safe').select('talent_id, points'),
        client.from('talent_tree_apices_safe_v2').select('tree_key, current_points, is_unlocked'),
      ])

      if (cancelled) return

      if (levelResult.error) {
        console.error(
          'Erro ao carregar o nível global:',
          levelResult.error.message,
        )

        if (progressLoadedForUser.current !== userId) {
          setProgressError('Não foi possível carregar o nível global do Compendium.')
          setProgressReady(true)
        }
        return
      }

      if (treeProgressResult.error) {
        console.error(
          'Erro ao carregar o resumo de progressão das árvores:',
          treeProgressResult.error.message,
        )

        if (progressLoadedForUser.current !== userId) {
          setProgressError('Não foi possível carregar a distribuição de pontos.')
          setProgressReady(true)
        }
        return
      }

      if (talentsResult.error || talentProgressResult.error || apexProgressResult.error) {
        console.error('Erro ao carregar talentos ativos do Dashboard:', talentsResult.error?.message ?? talentProgressResult.error?.message ?? apexProgressResult.error?.message)
        if (progressLoadedForUser.current !== userId) {
          setProgressError('Não foi possível carregar os talentos ativos do Dashboard.')
          setProgressReady(true)
        }
        return
      }

      const loadedLevel = Number(levelResult.data.character_level)

      if (!Number.isInteger(loadedLevel) || loadedLevel < 1) {
        if (progressLoadedForUser.current !== userId) {
          setProgressError('O nível global armazenado no banco é inválido.')
          setProgressReady(true)
        }
        return
      }

      const rows = (
        treeProgressResult.data ?? []
      ) as TalentTreeProgressRow[]

      const nextTreeProgress: Record<
        string,
        { points: number; visible: number }
      > = {}

      for (const tree of trees) {
        nextTreeProgress[tree.id] = {
          points: 0,
          visible: 0,
        }
      }

      let distributed = 0

      for (const row of rows) {
        const points = Number(row.total_points)
        const visible = Number(row.talents_with_progress)

        if (
          !Number.isInteger(points) ||
          points < 0 ||
          !Number.isInteger(visible) ||
          visible < 0
        ) {
          if (progressLoadedForUser.current !== userId) {
            setProgressError('Foi encontrada uma distribuição de pontos inválida no banco.')
            setProgressReady(true)
          }
          return
        }

        distributed += points

        const tree = nextTreeProgress[row.tree_key]

        if (!tree) continue

        tree.points = points
        tree.visible = visible
      }

      const pointsByTalent = new Map((talentProgressResult.data ?? []).map((row) => [row.talent_id, Number(row.points)]))
      const activeByTree: Record<string, ActiveTalentSummary[]> = {}
      const activeSupremes: ActiveTalentSummary[] = []
      for (const talent of talentsResult.data ?? []) {
        const points = pointsByTalent.get(talent.id) ?? 0
        if (points <= 0 || talent.is_hidden) continue
        const item = { id: talent.id, name: talent.name, tree_key: talent.tree_key, points, is_supreme: talent.is_supreme }
        if (talent.is_supreme || talent.tree_key === 'supremo') activeSupremes.push(item)
        else (activeByTree[talent.tree_key] ??= []).push(item)
      }
      const activeApexKeys = (apexProgressResult.data ?? [])
        .filter((apex) => Boolean(apex.is_unlocked) && Number(apex.current_points) > 0)
        .map((apex) => apex.tree_key)
      for (const apex of apexProgressResult.data ?? []) {
        const points = Number(apex.current_points) || 0
        distributed += points
        const target = nextTreeProgress[apex.tree_key]
        if (target) target.points += points
      }

      setActiveTalentsByTree(activeByTree)
      setActiveSupremeTalents(activeSupremes)
      setActiveApexTreeKeys(activeApexKeys)

      setCharacterLevel(loadedLevel)
      setTotalDistributed(distributed)
      setTreeProgress(nextTreeProgress)
      progressLoadedForUser.current = userId
      setProgressReady(true)
    }

    void loadProgress()

    return () => {
      cancelled = true
    }
  }, [userId, progressRefresh])

  useEffect(() => {
    let cancelled = false

    async function checkNewSupremeUnlocks() {
      const isInitialLoadForUser = supremeUnlocksLoadedForUser.current !== userId
      if (isInitialLoadForUser) setSupremeUnlocksReady(false)

      if (!userId || !supabase) {
        setUnlockedSupremeTalentIds([])
        setSupremeAvailableCount(0)
        setSupremeUnlocksReady(true)
        supremeUnlocksLoadedForUser.current = null
        return
      }

      // refresh_automatic_compendium_unlocks is already invoked transactionally
      // by the talent_progress trigger. Read the resulting authoritative state
      // in one request instead of recomputing all prerequisites in the browser.
      const { data, error } = await supabase
        .from('talents_safe')
        .select('id, name')
        .eq('tree_key', 'supremo')
        .eq('is_supreme', true)
        .eq('supreme_unlocked', true)
        .eq('is_hidden', false)

      if (cancelled) return
      if (error) {
        console.error('Erro ao consultar desbloqueios supremos:', error.message)
        if (isInitialLoadForUser) setSupremeUnlocksReady(true)
        return
      }

      const readyUnlocked = data ?? []
      const unlockedIds = readyUnlocked.map((item) => item.id).sort()
      setUnlockedSupremeTalentIds(unlockedIds)
      supremeUnlocksLoadedForUser.current = userId
      setSupremeUnlocksReady(true)
      const storageKey = `raziel:seen-supreme-unlocks:${userId}`
      let persisted: string[] = []
      try {
        persisted = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as string[]
      } catch {
        persisted = []
      }

      const seen = new Set([...persisted, ...seenSupremeUnlocks.current])
      setSupremeAvailableCount(readyUnlocked.length)

      if (!supremeUnlocksInitialized.current) {
        readyUnlocked.forEach((item) => seen.add(item.id))
        supremeUnlocksInitialized.current = true
      } else {
        const newlyUnlocked = readyUnlocked.filter((item) => !seen.has(item.id))
        if (newlyUnlocked.length) {
          setSupremeUnlockQueue((current) => [
            ...current,
            ...newlyUnlocked.map((item) => item.name),
          ])
          newlyUnlocked.forEach((item) => seen.add(item.id))
        }
      }

      seenSupremeUnlocks.current = seen
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...seen]))
      } catch {
        /* armazenamento indisponível */
      }
    }

    void checkNewSupremeUnlocks()
    return () => { cancelled = true }
  }, [userId, supremeRefresh, progressRefresh])

  useEffect(() => {
    if (supremeUnlockNotice || supremeUnlockQueue.length === 0) return
    setSupremeUnlockNoticeName(supremeUnlockQueue[0])
    setSupremeUnlockQueue((current) => current.slice(1))
    setSupremeUnlockNotice(true)
  }, [supremeUnlockNotice, supremeUnlockQueue])

  const treesWithProgress: Tree[] = useMemo(
    () =>
      trees.map((tree) => ({
        ...tree,
        points: treeProgress[tree.id]?.points ?? 0,
        visible: treeProgress[tree.id]?.visible ?? 0,
      })),
    [treeProgress],
  )

  // 3 pontos por nível do 1 ao 20; 5 pontos por nível a partir do 21.
  const totalPoints =
    Math.min(characterLevel, 20) * 3 +
    Math.max(characterLevel - 20, 0) * 5

  const totalAvailable = Math.max(
    totalPoints - totalDistributed,
    0,
  )

  async function handleChangeCharacterLevel(level: number) {
    if (!supabase || !isAdmin || isUpdatingLevel) return

    if (!Number.isInteger(level) || level < 1) {
      setLevelUpdateMessage('Informe um nível inteiro maior que zero.')
      return
    }

    if (level === characterLevel) {
      setLevelUpdateMessage('O nível informado já está definido.')
      return
    }

    setIsUpdatingLevel(true)
    setLevelUpdateMessage(null)

    const client = supabase

    const { data, error } = await client.rpc('set_character_level', {
      p_level: level,
    })

    if (error) {
      console.error('Erro ao alterar o nível global:', error.message)

      setLevelUpdateMessage(
        `Não foi possível alterar o nível: ${error.message}`,
      )

      setIsUpdatingLevel(false)
      return
    }

    const updatedLevel = Number(data)

    setCharacterLevel(updatedLevel)

    setLevelUpdateMessage(
      `Nível global atualizado para ${updatedLevel}.`,
    )

    setIsUpdatingLevel(false)
  }

  useEffect(() => {
    setActivePage('dashboard')
    setVisitedPages(new Set<PageKey>(['dashboard']))
    setPendingTalentId(null)
    setLevelUpdateMessage(null)
    seenSupremeUnlocks.current = new Set()
    supremeUnlocksInitialized.current = false
    supremeUnlocksLoadedForUser.current = null
    setUnlockedSupremeTalentIds([])
    setSupremeUnlocksReady(false)
    setSupremeUnlockQueue([])
    setSupremeUnlockNotice(false)
  }, [userId])

  const navigate = useCallback((page: PageKey) => {
    setVisitedPages((current) => {
      if (current.has(page)) {
        return current
      }

      const next = new Set(current)
      next.add(page)

      return next
    })

    setActivePage(page)
  }, [])

  async function handleSignOut() {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Erro ao sair da aplicação:', error.message)
      return
    }

    setActivePage('dashboard')
    setVisitedPages(new Set<PageKey>(['dashboard']))
    setIsAdmin(false)
    setTreeProgress({})
    setActiveTalentsByTree({})
    setActiveSupremeTalents([])
    setSupremeAvailableCount(0)
    setPendingTalentId(null)
    seenSupremeUnlocks.current = new Set()
    supremeUnlocksInitialized.current = false
    supremeUnlocksLoadedForUser.current = null
    setUnlockedSupremeTalentIds([])
    setSupremeUnlocksReady(false)
    setSupremeUnlockQueue([])
    setSupremeUnlockNotice(false)
    setTotalDistributed(0)
    setLevelUpdateMessage(null)
  }

  function renderAccessDenied() {
    return (
      <section className="admin-page-placeholder">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          ACESSO RESTRITO
        </div>

        <h1>Acesso não autorizado</h1>

        <p>
          Esta área está disponível somente para administradores.
        </p>
      </section>
    )
  }

  function renderAdminPage(page: PageKey) {
    if (!adminCheckReady) {
      return (
        <section className="admin-page-placeholder">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            VERIFICANDO PERMISSÕES
          </div>

          <h1>Preparando área administrativa</h1>

          <p>
            Aguarde enquanto verificamos seu nível de acesso.
          </p>
        </section>
      )
    }

    if (!isAdmin) {
      return renderAccessDenied()
    }

    switch (page) {
      case 'talents':
        return <TalentManagement />

      case 'history':
        return <AdminHistory />

      case 'reset':
        return <ResetProgress onResetComplete={() => { setProgressRefresh((value) => value + 1); setSupremeRefresh((value) => value + 1) }} />

      case 'backup':
        return <AdminBackup />

      default:
        return null
    }
  }

  function renderPage(page: PageKey) {
    if (
      page === 'talents' ||
      page === 'history' ||
      page === 'backup' ||
      page === 'reset'
    ) {
      return renderAdminPage(page)
    }

    if (page === 'summary') return <StatBlock />

    if (page === 'dashboard') {
      return (
        <Dashboard
          trees={treesWithProgress}
          activeTalentsByTree={activeTalentsByTree}
          activeSupremeTalents={activeSupremeTalents}
          activeApexTreeKeys={activeApexTreeKeys}
          isAdmin={isAdmin && adminCheckReady}
          totalAvailable={totalAvailable}
          totalDistributed={totalDistributed}
          characterLevel={characterLevel}
          isUpdatingLevel={isUpdatingLevel}
          levelUpdateMessage={levelUpdateMessage}
          onChangeCharacterLevel={handleChangeCharacterLevel}
          onNavigate={navigate}
        />
      )
    }

    if (page === 'supremas') {
      return (
        <SupremeTalents
          isAdmin={isAdmin && adminCheckReady}
          totalAvailable={totalAvailable}
          totalDistributed={totalDistributed}
          unlockedSupremeTalentIds={unlockedSupremeTalentIds}
          accessReady={supremeUnlocksReady}
          focusTalentId={pendingTalentId}
          onFocusTalentHandled={() => setPendingTalentId(null)}
          onProgressChanged={(_treeId, previousPoints, updatedPoints, item) => {
            const difference = updatedPoints - previousPoints
            setTotalDistributed((current) => current + difference)
            if (item?.kind === 'talent') {
              setActiveSupremeTalents((current) => {
                const withoutItem = current.filter((talent) => talent.id !== item.id)
                return item.points > 0
                  ? [...withoutItem, { id: item.id, name: item.name, tree_key: 'supremo', points: item.points, is_supreme: true }]
                  : withoutItem
              })
            }
            setSupremeRefresh((current) => current + 1)
          }}
          onTalentDeleted={(_treeId, removedPoints, _wasActive, talent) => {
            setTotalDistributed((current) => Math.max(0, current - removedPoints))
            if (talent) {
              setActiveSupremeTalents((current) => current.filter((item) => item.id !== talent.id))
            }
            setSupremeRefresh((current) => current + 1)
          }}
        />
      )
    }

    const selectedTree = treesWithProgress.find(
      (tree) => tree.id === page,
    )

    if (selectedTree) {
      return (
        <TalentTree
          tree={selectedTree}
          isAdmin={isAdmin && adminCheckReady}
          totalAvailable={totalAvailable}
          totalDistributed={totalDistributed}
          refreshKey={progressRefresh}
          focusTalentId={pendingTalentId}
          onFocusTalentHandled={() => setPendingTalentId(null)}
          onProgressChanged={(treeId, previousPoints, updatedPoints, item) => {
            const difference = updatedPoints - previousPoints
            setTotalDistributed((current) => current + difference)

            if (item?.kind === 'talent') {
              const summary = {
                id: item.id,
                name: item.name,
                tree_key: treeId,
                points: item.points,
                is_supreme: item.is_supreme,
              }
              if (item.is_supreme || treeId === 'supremo') {
                setActiveSupremeTalents((current) => {
                  const withoutItem = current.filter((talent) => talent.id !== item.id)
                  return item.points > 0 ? [...withoutItem, summary] : withoutItem
                })
              } else {
                setActiveTalentsByTree((current) => {
                  const existing = current[treeId] ?? []
                  const withoutItem = existing.filter((talent) => talent.id !== item.id)
                  return {
                    ...current,
                    [treeId]: item.points > 0 ? [...withoutItem, summary] : withoutItem,
                  }
                })
              }
            } else if (item?.kind === 'apex') {
              setActiveApexTreeKeys((current) =>
                updatedPoints > 0
                  ? (current.includes(treeId) ? current : [...current, treeId])
                  : current.filter((key) => key !== treeId),
              )
            }

            setTreeProgress((current) => {
              const currentTree = current[treeId] ?? { points: 0, visible: 0 }
              const isTalentChange = item?.kind === 'talent'
              const becameActive = isTalentChange && previousPoints === 0 && updatedPoints > 0
              const becameInactive = isTalentChange && previousPoints > 0 && updatedPoints === 0

              return {
                ...current,
                [treeId]: {
                  points: Math.max(0, currentTree.points + difference),
                  visible: Math.max(0, currentTree.visible + (becameActive ? 1 : 0) - (becameInactive ? 1 : 0)),
                },
              }
            })

            // A alteração no banco já recalcula as Supremas pelo trigger.
            // Esta atualização consulta apenas o estado final para a notificação.
            setSupremeRefresh((current) => current + 1)
          }}
          onTalentDeleted={(treeId, removedPoints, wasActive, talent) => {
            setTotalDistributed((current) => Math.max(0, current - removedPoints))
            if (talent) {
              if (talent.is_supreme || treeId === 'supremo') {
                setActiveSupremeTalents((current) => current.filter((item) => item.id !== talent.id))
              } else {
                setActiveTalentsByTree((current) => ({
                  ...current,
                  [treeId]: (current[treeId] ?? []).filter((item) => item.id !== talent.id),
                }))
              }
            }
            setSupremeRefresh((current) => current + 1)

            setTreeProgress((current) => {
              const currentTree = current[treeId] ?? { points: 0, visible: 0 }
              return {
                ...current,
                [treeId]: {
                  points: Math.max(0, currentTree.points - removedPoints),
                  visible: Math.max(0, currentTree.visible - (wasActive ? 1 : 0)),
                },
              }
            })
          }}
        />
      )
    }

    return (
      <Dashboard
        trees={treesWithProgress}
        activeTalentsByTree={activeTalentsByTree}
        activeSupremeTalents={activeSupremeTalents}
        activeApexTreeKeys={activeApexTreeKeys}
        isAdmin={isAdmin && adminCheckReady}
        totalAvailable={totalAvailable}
        totalDistributed={totalDistributed}
        characterLevel={characterLevel}
        isUpdatingLevel={isUpdatingLevel}
        levelUpdateMessage={levelUpdateMessage}
        onChangeCharacterLevel={handleChangeCharacterLevel}
        onNavigate={navigate}
      />
    )
  }

  if (!authReady) {
    return (
      <main className="auth-screen">
        <div className="auth-loading">
          Preparando o Compendium...
        </div>
      </main>
    )
  }

  if (!session) {
    return <Login />
  }

  if (!progressReady) {
    return (
      <main className="auth-screen">
        <div className="auth-loading">
          Convencendo Raziel a abrir...
        </div>
      </main>
    )
  }

  if (progressError) {
    return (
      <main className="auth-screen">
        <div
          className="auth-loading"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
            padding: '24px',
          }}
        >
          <p>{progressError}</p>

          <button
            type="button"
            onClick={() => setProgressRefresh((current) => current + 1)}
          >
            Tentar novamente
          </button>
        </div>
      </main>
    )
  }

  return (
    <AppLayout
      activePage={activePage}
      trees={treesWithProgress}
      isAdmin={isAdmin && adminCheckReady}
      supremeAvailableCount={supremeAvailableCount}
      onNavigate={navigate}
      onSignOut={handleSignOut}
    >
      {Array.from(visitedPages).map((page) => (
        <div
          key={page}
          style={{
            display: page === activePage ? 'contents' : 'none',
          }}
        >
          {renderPage(page)}
        </div>
      ))}
      {supremeUnlockNotice && (
        <div className="talent-modal-backdrop supreme-talent-notice-backdrop" role="presentation">
          <section className="talent-modal supreme-talent-notice" role="dialog" aria-modal="true" aria-labelledby="supreme-unlock-notice-title">
            <div className="supreme-notice-ornament" aria-hidden="true"><span>✦</span></div>
            <div className="supreme-notice-eyebrow">UM NOVO PODER DESPERTA</div>
            <h2 id="supreme-unlock-notice-title">Você atingiu um novo patamar supremo</h2>
            <div className="supreme-notice-divider" aria-hidden="true"><span>✧</span></div>
            <p className="supreme-notice-talent-name">{supremeUnlockNoticeName}</p>
            <p className="supreme-notice-description">Uma nova habilidade suprema foi desbloqueada. Confira a árvore de Habilidades Supremas.</p>
            <button type="button" className="supreme-notice-button" onClick={() => { setSupremeUnlockNotice(false); navigate('supremas') }}>ETA PORRAKKKK <span aria-hidden="true">↗</span></button>
          </section>
        </div>
      )}
      
    </AppLayout>
  )
}

export default App
