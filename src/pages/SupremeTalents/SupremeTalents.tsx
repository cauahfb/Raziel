import { useEffect, useState } from 'react'
import { Crown, LockKeyhole } from 'lucide-react'
import type { Tree } from '../../types/tree'
import { supabase } from '../../lib/supabase'
import TalentTree from '../TalentTrees/TalentTree'

type Props = {
  isAdmin: boolean
  totalAvailable: number
  totalDistributed: number
  refreshKey: number
  focusTalentId?: string | null
  onFocusTalentHandled?: () => void
  onProgressChanged: (treeId: string, previousPoints: number, updatedPoints: number) => void
  onTalentDeleted: (treeId: string, removedPoints: number, wasActive: boolean) => void
}

const supremeTree: Tree = {
  id: 'supremo',
  name: 'Árvore Suprema',
  subtitle: 'Conhecimentos que transcendem os limites conhecidos',
  icon: Crown,
  points: 0,
  color: 'violet',
  visible: 0,
}

export default function SupremeTalents({ isAdmin, totalAvailable, totalDistributed, refreshKey, focusTalentId, onFocusTalentHandled, onProgressChanged, onTalentDeleted }: Props) {
  const [loading, setLoading] = useState(true)
  const [hasUnlockedTalents, setHasUnlockedTalents] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function checkSupremeAccess() {
      setLoading(true)
      if (!supabase) {
        setHasUnlockedTalents(false)
        setLoading(false)
        return
      }

      let query = supabase
        .from('talents_safe')
        .select('id')
        .eq('tree_key', 'supremo')
        .eq('is_supreme', true)

      // A existência de um registro não significa que ele foi desbloqueado.
      // Para usuários comuns, somente talentos revelados (is_hidden = false)
      // podem liberar a entrada na Árvore Suprema. Administradores continuam
      // podendo visualizar e gerenciar a árvore inteira.
      if (!isAdmin) {
        query = query.eq('is_hidden', false)
      }

      const { data, error } = await query

      if (cancelled) return
      if (error) {
        console.error('Erro ao verificar conhecimentos supremos:', error.message)
        setHasUnlockedTalents(false)
      } else {
        setHasUnlockedTalents((data ?? []).length > 0)
      }
      setLoading(false)
    }

    void checkSupremeAccess()
    return () => { cancelled = true }
  }, [reloadKey, refreshKey, isAdmin])

  if (loading) {
    return (
      <section className="tree-feedback supreme-feedback">
        <Crown size={24} className="supreme-loading-icon" />
        <h2>Os selos estão sendo examinados...</h2>
        <p>Raziel decide o que pode ser revelado.</p>
      </section>
    )
  }

  if (!hasUnlockedTalents && !isAdmin) {
    return (
      <section className="locked-page supreme-locked-page">
        <div className="locked-emblem"><Crown size={32} /><LockKeyhole size={15} /></div>
        <div className="eyebrow">CONHECIMENTO SELADO</div>
        <h1>Árvore Suprema</h1>
        <p>Tsc... você acha que consegue acessar aqui?</p>
        <span>Alguns conhecimentos permanecem além do alcance.</span>
      </section>
    )
  }

  return (
    <TalentTree
      key={reloadKey}
      tree={supremeTree}
      isAdmin={isAdmin}
      totalAvailable={totalAvailable}
      totalDistributed={totalDistributed}
      focusTalentId={focusTalentId}
      onFocusTalentHandled={onFocusTalentHandled}
      onProgressChanged={(treeId, previousPoints, updatedPoints) => {
        onProgressChanged(treeId, previousPoints, updatedPoints)
        setReloadKey((value) => value + 1)
      }}
      onTalentDeleted={(treeId, removedPoints, wasActive) => {
        onTalentDeleted(treeId, removedPoints, wasActive)
        setReloadKey((value) => value + 1)
      }}
    />
  )
}
