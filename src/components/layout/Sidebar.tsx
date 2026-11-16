
import { useState } from 'react'
import {
  BookOpen,
  ChevronDown,
  ClipboardList,
  Crown,
  Database,
  History,
  LayoutDashboard,
  ScrollText,
  LockKeyhole,
  RotateCcw,
  Shield,
} from 'lucide-react'

import type { PageKey, Tree } from '../../types/tree'

type SidebarProps = {
  activePage: PageKey
  trees: Tree[]
  isAdmin: boolean
  onNavigate: (page: PageKey) => void
  supremeAvailableCount: number
}

const adminPages: PageKey[] = ['talents', 'history', 'backup', 'reset']

export default function Sidebar({
  activePage,
  trees,
  isAdmin,
  onNavigate,
  supremeAvailableCount,
}: SidebarProps) {
  const [adminExpanded, setAdminExpanded] = useState(false)

  const isAdminPage = adminPages.includes(activePage)
  const showAdminLinks = adminExpanded || isAdminPage

  function navigate(page: PageKey) {
    if (adminPages.includes(page)) {
      setAdminExpanded(true)
    }

    onNavigate(page)
  }

  return (
    <>
      {/* Identidade visual */}
      <div className="brand-lockup">
        <div className="brand-mark">
          <BookOpen size={22} strokeWidth={1.5} />
        </div>

        <div>
          <div className="brand-name">RAZIEL</div>
          <div className="brand-caption">COMPENDIUM OF TALENTS</div>
        </div>
      </div>

      {/* Visão geral e resumo da ficha */}
      <div className="nav-label">COMPENDIUM</div>

      <button
        type="button"
        className={`nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
        onClick={() => navigate('dashboard')}
        aria-current={activePage === 'dashboard' ? 'page' : undefined}
      >
        <LayoutDashboard size={17} />
        <span>Visão geral</span>
      </button>

      <button
        type="button"
        className={`nav-item ${activePage === 'summary' ? 'active' : ''}`}
        onClick={() => navigate('summary')}
        aria-current={activePage === 'summary' ? 'page' : undefined}
      >
        <ScrollText size={17} />
        <span>Resumo da Ficha</span>
      </button>

      {/* Árvores de talentos */}
      <div className="nav-label nav-label-spaced">
        ÁRVORES DE TALENTOS
      </div>

      {trees.map((tree) => {
        const Icon = tree.icon
        const isActive = activePage === tree.id

        return (
          <button
            key={tree.id}
            type="button"
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => navigate(tree.id)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={17} />

            <span>{tree.name}</span>

            {tree.points > 0 && (
              <span className="nav-count">{tree.points}</span>
            )}
          </button>
        )
      })}

      {/* Conhecimento restrito */}
      <div className="nav-label nav-label-spaced">
        CONHECIMENTO RESTRITO
      </div>

      <button
        type="button"
        className={`nav-item supreme-nav ${
          activePage === 'supremas' ? 'active' : ''
        }`}
        onClick={() => navigate('supremas')}
        aria-current={activePage === 'supremas' ? 'page' : undefined}
      >
        <Crown size={17} />
        <span>Habilidades Supremas</span>
        {supremeAvailableCount > 0 ? (
          <span className="supreme-nav-count" aria-label={`${supremeAvailableCount} talentos supremos disponíveis`}>
            {supremeAvailableCount}
          </span>
        ) : (
          <LockKeyhole size={13} className="lock-icon" />
        )}
      </button>

      {supremeAvailableCount > 0 && (
        <div className="supreme-potential-alert" role="status" aria-live="polite">
          <span className="supreme-potential-alert-mark" aria-hidden="true">✧</span>
          <span>Você tem um potencial supremo não utilizado.</span>
        </div>
      )}

      {/* Área administrativa */}
      {isAdmin && (
        <div className="sidebar-admin">
          <button
            type="button"
            className={`admin-heading ${
              showAdminLinks ? 'expanded' : ''
            }`}
            onClick={() =>
              setAdminExpanded((expanded) => !expanded)
            }
            aria-expanded={showAdminLinks}
            aria-controls="admin-navigation"
          >
            <span className="admin-shield">
              <Shield size={18} strokeWidth={1.6} />
            </span>

            <span className="admin-heading-copy">
              <strong>Área administrativa</strong>
              <small>Acesso restrito</small>
            </span>

            <ChevronDown
              className="admin-chevron"
              size={15}
            />
          </button>

          {showAdminLinks && (
            <div
              className="admin-links"
              id="admin-navigation"
            >
              <button
                type="button"
                className={`admin-link ${
                  activePage === 'talents' ? 'active' : ''
                }`}
                onClick={() => navigate('talents')}
                aria-current={
                  activePage === 'talents' ? 'page' : undefined
                }
              >
                <ClipboardList size={15} />
                <span>Gerenciar talentos</span>
              </button>

              <button
                type="button"
                className={`admin-link ${
                  activePage === 'history' ? 'active' : ''
                }`}
                onClick={() => navigate('history')}
                aria-current={
                  activePage === 'history' ? 'page' : undefined
                }
              >
                <History size={15} />
                <span>Histórico Administrativo</span>
              </button>

              <button
                type="button"
                className={`admin-link ${
                  activePage === 'backup' ? 'active' : ''
                }`}
                onClick={() => navigate('backup')}
                aria-current={
                  activePage === 'backup' ? 'page' : undefined
                }
              >
                <Database size={15} />
                <span>Backup</span>
              </button>

              <button type="button" className={`admin-link ${activePage === 'reset' ? 'active' : ''}`} onClick={() => navigate('reset')} aria-current={activePage === 'reset' ? 'page' : undefined}>
                <RotateCcw size={15} />
                <span>Resetar progressão</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
