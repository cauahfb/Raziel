import { useState } from 'react'
import type { ReactNode } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import type { PageKey, Tree } from '../../types/tree'

type AppLayoutProps = {
  activePage: PageKey
  trees: Tree[]
  isAdmin: boolean
  supremeAvailableCount: number
  onNavigate: (page: PageKey) => void
  onSignOut: () => void
  children: ReactNode
}

export default function AppLayout({ activePage, trees, isAdmin, supremeAvailableCount, onNavigate, onSignOut, children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const selectedTree = trees.find((tree) => tree.id === activePage)
  const breadcrumb = selectedTree?.name.toUpperCase() ?? (activePage === 'supremas' ? 'CONHECIMENTO RESTRITO' : activePage === 'history' || activePage === 'backup' ? 'ÁREA ADMINISTRATIVA' : 'VISÃO GERAL')

  function navigate(page: PageKey) {
    onNavigate(page)
    setMobileOpen(false)
  }

  return (
    <div className={`app-shell ${activePage === 'supremas' ? 'supreme-theme' : ''}`}>
      <aside className="sidebar"><Sidebar activePage={activePage} trees={trees} isAdmin={isAdmin} supremeAvailableCount={supremeAvailableCount} onNavigate={navigate} /></aside>

      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-sidebar" onClick={(event) => event.stopPropagation()}>
            <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
            <Sidebar activePage={activePage} trees={trees} isAdmin={isAdmin} supremeAvailableCount={supremeAvailableCount} onNavigate={navigate} />
          </div>
        </div>
      )}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="breadcrumb">COMPENDIUM<span>/</span>{breadcrumb}</div>
          <div className="topbar-actions">
            <button className="logout-top-button" onClick={onSignOut}><LogOut size={15} /><span>Sair</span></button>
          </div>
        </header>
        <div className="page-content">
          {children}
          <footer className="page-footer">
            <span>RAZIEL · COMPENDIUM OF TALENTS</span>
            <span>CONHECIMENTO É EVOLUÇÃO<span className="footer-star">✧</span></span>
          </footer>
        </div>
      </main>
    </div>
  )
}
