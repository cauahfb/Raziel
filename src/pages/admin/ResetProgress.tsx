import { useState } from 'react'
import { AlertTriangle, BellRing, RotateCcw, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Props = { onResetComplete: () => void }

export default function ResetProgress({ onResetComplete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function resetApexAlerts() {
    const resetApexNoticeStorage = (storage: Storage) => {
      const keysToRemove: string[] = []
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key?.startsWith('raziel:seen-apex-unlock:')) keysToRemove.push(key)
      }
      keysToRemove.forEach((key) => storage.removeItem(key))
    }
    resetApexNoticeStorage(window.localStorage)
    resetApexNoticeStorage(window.sessionStorage)
    setMessage('Os alertas de todos os Ápices foram resetados neste navegador. Cada mensagem poderá aparecer novamente quando sua respectiva árvore for aberta.')
    setError(null)
  }

  async function resetAll() {
    if (!supabase || loading) return
    setLoading(true)
    setError(null)
    setMessage(null)
    const { data, error: rpcError } = await supabase.rpc('reset_all_talent_progress')
    if (rpcError) {
      setError(`Não foi possível resetar a progressão: ${rpcError.message}. Verifique se a migration de reset foi aplicada no Supabase.`)
      setLoading(false)
      return
    }
    const { error: apexResetError } = await supabase.from('talent_tree_apices').update({ current_points: 0 }).gt('current_points', 0)
    if (apexResetError) {
      setError(`Os talentos foram resetados, mas não foi possível zerar os pontos dos Ápices: ${apexResetError.message}. Execute novamente a ação após corrigir a permissão.`)
      setLoading(false)
      onResetComplete()
      return
    }
    setMessage(`Progressão global resetada. ${Number(data) || 0} registros de progresso foram removidos, incluindo os pontos distribuídos nos Ápices.`)
    setConfirming(false)
    setLoading(false)
    onResetComplete()
  }

  return (
    <section className="admin-reset-page">
      <div className="eyebrow"><span className="eyebrow-line" />ÁREA ADMINISTRATIVA</div>
      <h1>Resetar progressão</h1>
      <p className="admin-reset-intro">Gerencie a distribuição global de pontos do Compendium.</p>
      <article className="admin-reset-card">
        <div className="admin-reset-icon"><RotateCcw size={23} /></div>
        <div className="admin-reset-copy">
          <span className="admin-reset-kicker">AÇÃO IRREVERSÍVEL</span>
          <h2>Resetar todos os talentos</h2>
          <p>Remove todos os pontos distribuídos em todas as árvores, incluindo a Árvore Suprema. Os talentos cadastrados, descrições, ícones, níveis máximos e pré-requisitos serão preservados.</p>
          <p className="admin-reset-warning"><AlertTriangle size={15} /> A progressão é compartilhada: esta ação afeta todos os usuários e não pode ser desfeita.</p>
          {!confirming ? (
            <button type="button" className="admin-reset-button" onClick={() => { setMessage(null); setError(null); setConfirming(true) }}><RotateCcw size={15} /> Resetar todos os talentos</button>
          ) : (
            <div className="admin-reset-confirm">
              <strong>Tem certeza de que deseja zerar toda a progressão global?</strong>
              <span>Confirme somente se todos os pontos distribuídos devem ser apagados.</span>
              <div><button type="button" className="admin-reset-cancel" disabled={loading} onClick={() => setConfirming(false)}>Cancelar</button><button type="button" className="admin-reset-button" disabled={loading} onClick={() => void resetAll()}>{loading ? 'Resetando...' : 'Confirmar reset global'}</button></div>
            </div>
          )}
        </div>
      </article>
      <article className="admin-reset-card">
        <div className="admin-reset-icon"><BellRing size={23} /></div>
        <div className="admin-reset-copy">
          <span className="admin-reset-kicker">PREFERÊNCIAS DE NOTIFICAÇÃO</span>
          <h2>Resetar alertas de todos os Ápices</h2>
          <p>Limpa neste navegador o registro das mensagens de desbloqueio já apresentadas. Assim, cada alerta poderá aparecer novamente quando a árvore correspondente for aberta.</p>
          <button type="button" className="admin-reset-button" onClick={resetApexAlerts}><BellRing size={15} /> Resetar alertas de todos os Ápices</button>
        </div>
      </article>
      {message && <p className="admin-reset-success"><ShieldCheck size={15} /> {message}</p>}
      {error && <p className="admin-reset-error"><AlertTriangle size={15} /> {error}</p>}
    </section>
  )
}
