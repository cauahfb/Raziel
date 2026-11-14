import { Crown, LockKeyhole } from 'lucide-react'

export default function SupremeTalents() {
  return (
    <section className="locked-page">
      <div className="locked-emblem"><Crown size={32} /><LockKeyhole size={15} /></div>
      <div className="eyebrow">CONHECIMENTO RESTRITO</div>
      <h1>Habilidades Supremas</h1>
      <p>Tsc... você acha que consegue acessar aqui?</p>
      <span>Alguns conhecimentos permanecem além do alcance.</span>
    </section>
  )
}
