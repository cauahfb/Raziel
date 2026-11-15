
import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Crown,
  Compass,
  Sparkles,
  X,
} from 'lucide-react'

import type { Tree } from '../../types/tree'
import TalentDetailsModal, { type TalentDetails } from '../../components/TalentDetailsModal'
import { supabase } from '../../lib/supabase'

type ActiveTalent = { id: string; name: string; tree_key: string; points: number; is_supreme: boolean }
type DashboardProps = {
  trees: Tree[]
  activeTalentsByTree: Record<string, ActiveTalent[]>
  activeSupremeTalents: ActiveTalent[]
  totalAvailable: number
  totalDistributed: number
  characterLevel: number
  isAdmin: boolean
  isUpdatingLevel: boolean
  levelUpdateMessage: string | null
  onChangeCharacterLevel: (level: number) => void
  onNavigate: (page: string) => void
}

export default function Dashboard({
  trees,
  activeTalentsByTree,
  activeSupremeTalents,
  isAdmin,
  totalAvailable,
  totalDistributed,
  characterLevel,
  isUpdatingLevel,
  levelUpdateMessage,
  onChangeCharacterLevel,
  onNavigate,
}: DashboardProps) {
  const [showWelcome, setShowWelcome] = useState(true)
  const [selectedTalent, setSelectedTalent] = useState<TalentDetails | null>(null)
  const [pendingTalentId, setPendingTalentId] = useState<string | null>(null)
  const [talentDetailsCache, setTalentDetailsCache] = useState<Record<string, TalentDetails>>({})
  const [levelInput, setLevelInput] = useState(String(characterLevel))

  useEffect(() => {
    setLevelInput(String(characterLevel))
  }, [characterLevel])

  // Pré-carrega os detalhes dos talentos ativos enquanto o Dashboard é exibido.
  // Assim, abrir um talento usa dados em memória e não dispara novas consultas.
  useEffect(() => {
    let cancelled = false
    const activeTalents = [
      ...Object.values(activeTalentsByTree).flat(),
      ...activeSupremeTalents,
    ]
    const ids = [...new Set(activeTalents.map((talent) => talent.id))]
    if (!supabase || ids.length === 0) {
      setTalentDetailsCache({})
      return () => { cancelled = true }
    }

    async function preloadTalentDetails() {
      const [talentsResult, prerequisitesResult, treeRequirementsResult, progressResult, treeProgressResult] = await Promise.all([
        supabase!.from('talents_safe')
          .select('id, tree_key, name, icon_url, description, max_level, points_per_level, is_hidden, is_supreme, supreme_stars, supreme_unlocked')
          .in('id', ids),
        supabase!.from('talent_prerequisites_safe')
          .select('talent_id, prerequisite_talent_id, required_points, prerequisite_name, prerequisite_is_hidden')
          .in('talent_id', ids),
        supabase!.from('talent_tree_requirements_safe')
          .select('talent_id, required_tree_key, required_points')
          .in('talent_id', ids),
        supabase!.from('talent_progress_safe').select('talent_id, points'),
        supabase!.from('talent_tree_progress_safe').select('tree_key, total_points'),
      ])

      if (cancelled || talentsResult.error || prerequisitesResult.error || treeRequirementsResult.error || progressResult.error || treeProgressResult.error) return

      const activePoints = new Map(activeTalents.map((talent) => [talent.id, talent.points]))
      const allTalentPoints = new Map((progressResult.data ?? []).map((row) => [row.talent_id, Number(row.points)]))
      const pointsByTree = new Map((treeProgressResult.data ?? []).map((row) => [row.tree_key, Number(row.total_points)]))
      const nextCache: Record<string, TalentDetails> = {}
      for (const talent of talentsResult.data ?? []) {
        nextCache[talent.id] = {
          ...talent,
          current_points: activePoints.get(talent.id) ?? 0,
          prerequisites: (prerequisitesResult.data ?? []).filter((item) => item.talent_id === talent.id),
          treeRequirements: (treeRequirementsResult.data ?? [])
            .filter((item) => item.talent_id === talent.id)
            .map(({ required_tree_key, required_points }) => ({ required_tree_key, required_points })),
          requirements_met:
            (prerequisitesResult.data ?? []).filter((item) => item.talent_id === talent.id)
              .every((item) => (allTalentPoints.get(item.prerequisite_talent_id) ?? 0) >= Number(item.required_points)) &&
            (treeRequirementsResult.data ?? []).filter((item) => item.talent_id === talent.id)
              .every((item) => (pointsByTree.get(item.required_tree_key) ?? 0) >= Number(item.required_points)),
        } as TalentDetails
      }
      setTalentDetailsCache(nextCache)
      if (pendingTalentId && nextCache[pendingTalentId]) {
        setSelectedTalent(nextCache[pendingTalentId])
        setPendingTalentId(null)
      }
    }

    void preloadTalentDetails()
    return () => { cancelled = true }
  }, [activeTalentsByTree, activeSupremeTalents, pendingTalentId])

  function openTalentDetails(talentId: string) {
    const cachedTalent = talentDetailsCache[talentId]
    if (cachedTalent) {
      setSelectedTalent(cachedTalent)
      return
    }
    // Se o usuário clicar antes do pré-carregamento terminar, abre assim que o cache chegar.
    setPendingTalentId(talentId)
  }

  const awakenedTrees = trees.filter((tree) => tree.visible > 0).length
  const totalActiveTalents = Object.values(activeTalentsByTree).reduce((sum, items) => sum + items.length, 0) + activeSupremeTalents.length
  const totalSupremePoints = activeSupremeTalents.reduce((sum, talent) => sum + talent.points, 0)

  // Mantém o total exibido no Dashboard igual ao cálculo central do App.
  const totalPoints =
    Math.min(characterLevel, 20) * 3 +
    Math.max(characterLevel - 20, 0) * 5

  const progress =
    totalPoints > 0
      ? Math.min((totalDistributed / totalPoints) * 100, 100)
      : 0

  function handleLevelSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const parsedLevel = Number(levelInput)

    if (
      !Number.isInteger(parsedLevel) ||
      parsedLevel < 1 ||
      parsedLevel === characterLevel
    ) {
      return
    }

    onChangeCharacterLevel(parsedLevel)
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            REGISTRO DE EVOLUÇÃO
          </div>

          <h1>Visão geral</h1>

          <p>
            O conhecimento adquirido molda aquilo que você pode se tornar.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div className="level-seal">
            <span>NÍVEL</span>
            <strong>{String(characterLevel).padStart(2, '0')}</strong>
            <small>ATUAL</small>
          </div>

          {isAdmin && (
            <form
              onSubmit={handleLevelSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                alignItems: 'center',
              }}
            >
              <label
                htmlFor="character-level-input"
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  color: 'var(--text-muted)',
                }}
              >
                ALTERAR NÍVEL
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}
              >
                <input
                  id="character-level-input"
                  type="number"
                  min="1"
                  step="1"
                  value={levelInput}
                  onChange={(event) => setLevelInput(event.target.value)}
                  disabled={isUpdatingLevel}
                  style={{
                    width: '65px',
                    padding: '8px',
                    border: '1px solid var(--border-color, #ddd)',
                    borderRadius: '6px',
                    textAlign: 'center',
                    background: 'var(--surface, #fff)',
                    color: 'var(--text-primary, #333)',
                  }}
                />

                <button
                  type="submit"
                  disabled={
                    isUpdatingLevel ||
                    !levelInput ||
                    !Number.isInteger(Number(levelInput)) ||
                    Number(levelInput) < 1 ||
                    Number(levelInput) === characterLevel
                  }
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isUpdatingLevel ? 'wait' : 'pointer',
                    background: 'var(--accent, #b49a68)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    opacity: isUpdatingLevel ? 0.6 : 1,
                  }}
                >
                  {isUpdatingLevel ? 'Salvando...' : 'Salvar'}
                </button>
              </div>

              {levelUpdateMessage && (
                <span
                  role="status"
                  style={{
                    maxWidth: '180px',
                    fontSize: '11px',
                    textAlign: 'center',
                    color: 'var(--text-secondary, #666)',
                  }}
                >
                  {levelUpdateMessage}
                </span>
              )}
            </form>
          )}
        </div>
      </section>

      {showWelcome && (
        <section className="welcome-banner">
          <div className="welcome-symbol">
            <Sparkles size={23} />
          </div>

          <div className="welcome-copy">
            <strong>Todo conhecimento tem um começo.</strong>
            <span>
              Explore as árvores, descubra novos talentos e trace seu próprio caminho.
            </span>
          </div>

          <button
            className="banner-dismiss"
            onClick={() => setShowWelcome(false)}
            aria-label="Fechar"
          >
            <X size={17} />
          </button>
        </section>
      )}

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">
            <span>PONTOS DISPONÍVEIS</span>
            <span className="stat-icon blue-icon">
              <Sparkles size={17} />
            </span>
          </div>

          <div className="stat-value">
            {totalAvailable}
            <small> pts</small>
          </div>

          <div className="stat-foot">
            Prontos para serem distribuídos
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>PONTOS DISTRIBUÍDOS</span>
            <span className="stat-icon gold-icon">
              <Activity size={17} />
            </span>
          </div>

          <div className="stat-value">
            {totalDistributed}
            <small> pts</small>
          </div>

          <div className="stat-foot">
            De {totalPoints} pontos conquistados
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-top">
            <span>TALENTOS ATIVOS</span>
            <span className="stat-icon teal-icon">
              <Compass size={17} />
            </span>
          </div>

          <div className="stat-value">
            {totalActiveTalents}
            <small> talentos</small>
          </div>

          <div className="stat-foot">
            {awakenedTrees} de {trees.length} árvores despertas
          </div>
        </article>
      </section>

      <section className="section-heading">
        <div>
          <div className="eyebrow">PROGRESSÃO</div>
          <h2>Árvores de talentos</h2>
          <p>Talentos ativos e pontos distribuídos em cada vertente.</p>
        </div>
      </section>

      <section className="dashboard-tree-list">
        {trees.map((tree) => {
          const Icon = tree.icon
          const activeTalents = activeTalentsByTree[tree.id] ?? []
          return (
            <article className="dashboard-tree-card" key={tree.id}>
              <button type="button" className="dashboard-tree-heading" onClick={() => onNavigate(tree.id)}>
                <span className={`tree-icon ${tree.color}`}><Icon size={20} strokeWidth={1.7} /></span>
                <span className="dashboard-tree-title"><strong>{tree.name}</strong><small>{tree.subtitle}</small></span>
                <span className="dashboard-tree-metrics"><strong>{activeTalents.length}</strong><small>{activeTalents.length === 1 ? 'talento ativo' : 'talentos ativos'}</small></span>
                <span className="dashboard-tree-points"><strong>{tree.points}</strong><small>pontos gastos</small></span>
                <ArrowUpRight size={16} className="tree-arrow" />
              </button>
              {activeTalents.length > 0 ? (
                <div className="dashboard-active-talents">
                  {activeTalents.map((talent) => (
                    <button type="button" key={talent.id} onClick={() => openTalentDetails(talent.id)}>
                      <span>{talent.name}</span><small>Nível {talent.points}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="dashboard-empty-talents">Nenhum talento ativo nesta árvore.</p>
              )}
            </article>
          )
        })}
      </section>

      {activeSupremeTalents.length > 0 && (
        <section className="dashboard-supreme-panel">
          <div className="dashboard-supreme-heading">
            <span className="dashboard-supreme-emblem"><Crown size={20} /></span>
            <div><div className="eyebrow">CONHECIMENTO RESTRITO</div><h2>Potenciais Supremos Despertos</h2><p>Conhecimentos que transcendem os limites conhecidos.</p></div>
            <span className="dashboard-supreme-count">{activeSupremeTalents.length} ATIVA{activeSupremeTalents.length === 1 ? '' : 'S'} · {totalSupremePoints} PONTOS</span>
          </div>
          <div className="dashboard-supreme-talents">
            {activeSupremeTalents.map((talent) => (
              <button type="button" key={talent.id} onClick={() => openTalentDetails(talent.id)}>
                <Crown size={15} /><span>{talent.name}</span><small>Nível {talent.points}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="quote-card">
        <div className="quote-ornament">✧</div>

        <div>
          <span>FRAGMENTO DO COMPENDIUM</span>
          <p>
            “O poder não se revela àquele que o busca, mas àquele que compreende o preço de conhecê-lo.”
          </p>
        </div>

        <div className="quote-author">
          — REGISTRO ANÔNIMO
        </div>
      </section>
      {selectedTalent && <TalentDetailsModal talent={selectedTalent} onClose={() => { setSelectedTalent(null); setPendingTalentId(null) }} />}
    </>
  )
}
