
import { useEffect, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  Compass,
  Sparkles,
  X,
} from 'lucide-react'

import type { Tree } from '../../types/tree'

type DashboardProps = {
  trees: Tree[]
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
  totalAvailable,
  totalDistributed,
  characterLevel,
  isAdmin,
  isUpdatingLevel,
  levelUpdateMessage,
  onChangeCharacterLevel,
  onNavigate,
}: DashboardProps) {
  const [showWelcome, setShowWelcome] = useState(true)
  const [levelInput, setLevelInput] = useState(String(characterLevel))

  useEffect(() => {
    setLevelInput(String(characterLevel))
  }, [characterLevel])

  const awakenedTrees = trees.filter(
    (tree) => tree.visible > 0,
  ).length

  const totalPoints = characterLevel * 3

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
            <span>ÁRVORES DESPERTAS</span>
            <span className="stat-icon teal-icon">
              <Compass size={17} />
            </span>
          </div>

          <div className="stat-value">
            {awakenedTrees}
            <small> / {trees.length}</small>
          </div>

          <div className="stat-foot">
            Com ao menos um talento ativo
          </div>
        </article>
      </section>

      <section className="section-heading">
        <div>
          <div className="eyebrow">PROGRESSÃO</div>
          <h2>Árvores de talentos</h2>
          <p>
            O estado atual de cada vertente do seu desenvolvimento.
          </p>
        </div>

        <button
          className="text-action"
          onClick={() => onNavigate('vitalidade')}
        >
          Explorar árvores
          <ArrowUpRight size={15} />
        </button>
      </section>

      <section className="tree-grid">
        {trees.map((tree) => {
          const Icon = tree.icon

          return (
            <button
              className={`tree-card ${tree.visible > 0 ? 'tree-awake' : ''}`}
              key={tree.id}
              onClick={() => onNavigate(tree.id)}
            >
              <div className={`tree-icon ${tree.color}`}>
                <Icon size={20} strokeWidth={1.7} />
              </div>

              <div className="tree-card-content">
                <div className="tree-title-row">
                  <h3>{tree.name}</h3>

                  {tree.visible > 0 && (
                    <span className="active-dot" />
                  )}
                </div>

                <p>{tree.subtitle}</p>

                <div className="tree-card-foot">
                  <span>
                    {tree.visible}{' '}
                    {tree.visible === 1
                      ? 'talento ativo'
                      : 'talentos ativos'}
                  </span>

                  <span className="tree-points">
                    {tree.points}
                    <small> pts</small>
                  </span>
                </div>
              </div>

              <ArrowUpRight className="tree-arrow" size={16} />
            </button>
          )
        })}
      </section>

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
    </>
  )
}
