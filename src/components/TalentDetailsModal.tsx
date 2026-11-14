import { Sparkles, X } from 'lucide-react'
import { trees } from '../data/trees'

export type TalentDetails = {
  id: string
  tree_key: string
  name: string
  icon_url: string | null
  description: string | null
  max_level: number
  is_hidden: boolean
  is_supreme: boolean
  current_points: number
  prerequisites: Array<{
    talent_id: string
    required_points: number
    prerequisite_name: string | null
    prerequisite_is_hidden: boolean | null
  }>
  treeRequirements: Array<{ required_tree_key: string; required_points: number }>
}

export default function TalentDetailsModal({ talent, onClose }: { talent: TalentDetails; onClose: () => void }) {
  const treeName = (key: string) => key === 'supremo' ? 'Talento Supremo' : trees.find((tree) => tree.id === key)?.name ?? key

  return <div className="talent-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="talent-modal talent-detail-modal" role="dialog" aria-modal="true" aria-labelledby="dashboard-talent-detail-title">
      <header className="talent-modal-header"><div><span className="eyebrow"><span className="eyebrow-line" />COMPÊNDIO DE TALENTOS</span><h2 id="dashboard-talent-detail-title">{talent.is_hidden ? 'Conhecimento desconhecido' : talent.name}</h2></div>
        <button type="button" className="talent-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </header>
      {talent.is_hidden ? <div style={{ textAlign: 'center', padding: 24 }}><Sparkles size={27} /><p>Você não detém desse conhecimento ainda.</p></div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, border: '1px solid #ece9e1', borderRadius: 8, background: '#f7f6f2' }}>
          <div className="talent-tree-icon">{talent.icon_url ? <img src={talent.icon_url} alt="" /> : <Sparkles size={25} />}</div>
          <div><span style={{ color: '#a08b68', fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>NÍVEL ATUAL</span><strong style={{ display: 'block', color: '#465a70', fontSize: 17 }}>{talent.current_points} / {talent.max_level}</strong></div>
        </div>
        <section><span style={{ color: '#a08b68', fontSize: 8, fontWeight: 700, letterSpacing: 1.2 }}>DESCRIÇÃO</span><p style={{ margin: 0, color: '#707e88', fontSize: 12, lineHeight: 1.75, whiteSpace: 'pre-line' }}>{talent.description || 'Nenhuma descrição cadastrada.'}</p></section>
        {(talent.prerequisites.length > 0 || talent.treeRequirements.length > 0) && <section className="talent-tree-prerequisites" style={{ gap: 12 }}><span>PRÉ-REQUISITOS</span><ul>
          {talent.prerequisites.map((item) => <li key={item.talent_id}><span>{item.prerequisite_is_hidden ? '???' : item.prerequisite_name ?? 'Talento desconhecido'}</span><strong>{item.required_points} {item.required_points === 1 ? 'ponto' : 'pontos'}</strong></li>)}
          {talent.treeRequirements.map((item) => <li key={item.required_tree_key}><span>{treeName(item.required_tree_key)}</span><strong>{item.required_points} {item.required_points === 1 ? 'ponto na árvore' : 'pontos na árvore'}</strong></li>)}
        </ul></section>}
      </div>}
    </section>
  </div>
}
