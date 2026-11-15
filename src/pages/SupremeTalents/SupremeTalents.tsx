import { useEffect, useRef, useState } from 'react'
import { Crown, LockKeyhole } from 'lucide-react'
import type { Tree } from '../../types/tree'
import TalentTree, { type DeletedTalentInfo, type ProgressChangeItem } from '../TalentTrees/TalentTree'

type Props = {
  isAdmin: boolean
  totalAvailable: number
  totalDistributed: number
  unlockedSupremeTalentIds: string[]
  accessReady: boolean
  focusTalentId?: string | null
  onFocusTalentHandled?: () => void
  onProgressChanged: (treeId: string, previousPoints: number, updatedPoints: number, item?: ProgressChangeItem) => void
  onTalentDeleted: (treeId: string, removedPoints: number, wasActive: boolean, talent?: DeletedTalentInfo) => void
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

export default function SupremeTalents({
  isAdmin,
  totalAvailable,
  totalDistributed,
  unlockedSupremeTalentIds,
  accessReady,
  focusTalentId,
  onFocusTalentHandled,
  onProgressChanged,
  onTalentDeleted,
}: Props) {
  const [treeRefreshKey, setTreeRefreshKey] = useState(0)
  const previousUnlockedIds = useRef<string[] | null>(null)

  useEffect(() => {
    if (!accessReady) return

    const nextIds = [...new Set(unlockedSupremeTalentIds)].sort()
    const previousIds = previousUnlockedIds.current

    if (
      previousIds !== null
      && (
        previousIds.length !== nextIds.length
        || previousIds.some((id, index) => id !== nextIds[index])
      )
    ) {
      // Recarrega a árvore somente quando uma Suprema é revelada/ocultada.
      // A distribuição normal de pontos não desmonta a tela nem mostra loading.
      setTreeRefreshKey((current) => current + 1)
    }

    previousUnlockedIds.current = nextIds
  }, [unlockedSupremeTalentIds, accessReady])

  if (!accessReady) {
    return (
      <section className="tree-feedback supreme-feedback">
        <Crown size={24} className="supreme-loading-icon" />
        <h2>Os selos estão sendo examinados...</h2>
        <p>Raziel decide o que pode ser revelado.</p>
      </section>
    )
  }

  const hasUnlockedTalents = unlockedSupremeTalentIds.length > 0

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
      tree={supremeTree}
      refreshKey={treeRefreshKey}
      isAdmin={isAdmin}
      totalAvailable={totalAvailable}
      totalDistributed={totalDistributed}
      focusTalentId={focusTalentId}
      onFocusTalentHandled={onFocusTalentHandled}
      onProgressChanged={(treeId, previousPoints, updatedPoints, item) => {
        onProgressChanged(treeId, previousPoints, updatedPoints, item)
      }}
      onTalentDeleted={(treeId, removedPoints, wasActive, talent) => {
        onTalentDeleted(treeId, removedPoints, wasActive, talent)
        setTreeRefreshKey((value) => value + 1)
      }}
    />
  )
}
