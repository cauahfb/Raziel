import { Sparkles, X } from 'lucide-react'
import { trees } from '../data/trees'

export type TalentDetails = {
  id: string
  tree_key: string
  name: string
  icon_url: string | null
  description: string | null
  max_level: number
  points_per_level: number
  is_hidden: boolean
  is_supreme: boolean
  supreme_stars?: 2 | 3
  supreme_unlocked?: boolean
  requirements_met?: boolean
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
      <header className="talent-modal-header"><div><span className="eyebrow"><span className="eyebrow-line" />COMPÊNDIO DE TALENTOS</span><h2 id="dashboard-talent-detail-title">{talent.is_hidden ? (talent.is_supreme ? 'Combinação ainda não descoberta' : 'Conhecimento desconhecido') : talent.name}</h2></div>
        <button type="button" className="talent-modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
      </header>
      {talent.is_hidden ? <div style={{ textAlign: 'center', padding: 24 }}><Sparkles size={27} /><p>{talent.is_supreme ? 'Você ainda não tentou combinações o suficiente para desbloquear esta habilidade.' : 'Você não detém desse conhecimento ainda.'}</p></div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, border: talent.is_supreme ? '1px solid #705b85' : '1px solid #ece9e1', borderRadius: 8, background: talent.is_supreme ? 'linear-gradient(135deg, #211d2d, #30263c)' : '#f7f6f2' }}>
          <div className="talent-tree-icon">{talent.icon_url ? <img src={talent.icon_url} alt="" /> : <Sparkles size={25} />}</div>
          <div>{talent.is_supreme ? <><strong style={{ display: 'block', color: '#f0d7a2', fontSize: 16 }}>HABILIDADE SUPREMA · {'★'.repeat(talent.supreme_stars ?? 2)}</strong><span className="supreme-unlocked-badge">DESBLOQUEADA</span><span style={{ display: 'block', marginTop: 7, color: talent.requirements_met ? '#9ee0b4' : '#e9b0a9', fontSize: 10, fontWeight: 800 }}>{talent.requirements_met ? 'PRÉ-REQUISITOS ALCANÇADOS' : 'PRÉ-REQUISITOS NÃO ALCANÇADOS'}</span></> : <><span style={{ color: '#a08b68', fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>NÍVEL ATUAL</span><strong style={{ display: 'block', color: '#465a70', fontSize: 17 }}>{talent.current_points} / {talent.max_level}</strong><span style={{ display: 'block', color: '#8a9298', fontSize: 10, marginTop: 4 }}>CUSTO: {talent.points_per_level} {talent.points_per_level === 1 ? 'ponto' : 'pontos'} por nível · MÁXIMO: {talent.max_level * talent.points_per_level} pontos</span></>}</div>
        </div>
        <section><span style={{ color: '#a08b68', fontSize: 8, fontWeight: 700, letterSpacing: 1.2 }}>DESCRIÇÃO</span><p style={{ margin: 0, color: '#707e88', fontSize: 12, lineHeight: 1.75, whiteSpace: 'pre-line' }}>{talent.description || 'Nenhuma descrição cadastrada.'}</p></section>
        {talent.is_supreme && <p style={{ margin: 0, padding: 12, borderRadius: 8, background: talent.requirements_met ? '#e7f5eb' : '#faecea', color: talent.requirements_met ? '#287447' : '#a34b43', fontSize: 12, fontWeight: 700 }}>{talent.requirements_met ? 'Essa habilidade está ativa.' : 'Essa habilidade não está ativa.'}</p>}
        {(talent.prerequisites.length > 0 || talent.treeRequirements.length > 0) && <section className="talent-tree-prerequisites" style={{ gap: 12 }}><span>PRÉ-REQUISITOS</span><ul>
          {talent.prerequisites.map((item) => <li key={item.talent_id}><span>{item.prerequisite_is_hidden ? '???' : item.prerequisite_name ?? 'Talento desconhecido'}</span><strong>{item.required_points} {item.required_points === 1 ? 'ponto' : 'pontos'}</strong></li>)}
          {talent.treeRequirements.map((item) => <li key={item.required_tree_key}><span>{treeName(item.required_tree_key)}</span><strong>{item.required_points} {item.required_points === 1 ? 'ponto na árvore' : 'pontos na árvore'}</strong></li>)}
        </ul></section>}
      </div>}
    </section>
  </div>
}
