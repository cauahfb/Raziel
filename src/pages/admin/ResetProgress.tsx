import { useState } from 'react'
import { AlertTriangle, BellRing, Crown, RotateCcw, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Props = { onResetComplete: () => void }

export default function ResetProgress({ onResetComplete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [confirmingApexReset, setConfirmingApexReset] = useState(false)
  const [loadingApexReset, setLoadingApexReset] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function clearApexNoticeStorage() {
    const resetApexNoticeStorage = (storage: Storage) => {
      const keysToRemove: string[] = []
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index)
        if (key?.startsWith('raziel:seen-apex-unlock:')) keysToRemove.push(key)
      }
      keysToRemove.forEach((key) => storage.removeItem(key))
    }
    try { resetApexNoticeStorage(window.localStorage) } catch { /* armazenamento local indisponível */ }
    try { resetApexNoticeStorage(window.sessionStorage) } catch { /* armazenamento de sessão indisponível */ }
  }

  function resetApexAlerts() {
    clearApexNoticeStorage()
    setMessage('Os alertas de todos os Ápices foram resetados neste navegador. Cada mensagem poderá aparecer novamente quando sua respectiva árvore for aberta.')
    setError(null)
    onResetComplete()
  }

  async function resetApexProgress() {
    if (!supabase || loading || loadingApexReset) return

    setLoadingApexReset(true)
    setError(null)
    setMessage(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('reset_talent_tree_apices_progress')

      if (rpcError) {
        setError(`Não foi possível resetar o progresso dos Ápices: ${rpcError.message}. Verifique se a migration de recalibração dos Ápices foi aplicada no Supabase.`)
        return
      }

      clearApexNoticeStorage()
      setMessage(`${Number(data) || 0} Ápices foram reinicializados e reavaliados. Os pontos distribuídos nos talentos foram preservados; os Ápices que já atendem aos requisitos foram desbloqueados novamente.`)
      setConfirmingApexReset(false)
      onResetComplete()
    } catch (unexpectedError) {
      const reason = unexpectedError instanceof Error ? unexpectedError.message : 'Erro inesperado.'
      setError(`Falha inesperada ao resetar os Ápices: ${reason}`)
    } finally {
      setLoadingApexReset(false)
    }
  }

  async function resetAll() {
    if (!supabase || loading || loadingApexReset) return

    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('reset_all_talent_progress')
      if (rpcError) {
        setError(`Não foi possível resetar a progressão: ${rpcError.message}. Verifique se a migration de reset foi aplicada no Supabase.`)
        return
      }

      // Reutiliza a rotina administrativa única para zerar pontos próprios dos
      // Ápices, limpar travas obsoletas e recalcular elegibilidade após o reset.
      const { error: apexResetError } = await supabase.rpc('reset_talent_tree_apices_progress')
      if (apexResetError) {
        setError(`A progressão dos talentos foi resetada, mas a recalibração dos Ápices falhou: ${apexResetError.message}. Execute novamente "Resetar progresso de Ápices" após corrigir a migration.`)
        onResetComplete()
        return
      }

      clearApexNoticeStorage()
      setMessage(`Progressão global resetada. ${Number(data) || 0} registros de progresso foram removidos, incluindo os pontos distribuídos nos Ápices.`)
      setConfirming(false)
      onResetComplete()
    } catch (unexpectedError) {
      const reason = unexpectedError instanceof Error ? unexpectedError.message : 'Erro inesperado.'
      setError(`Falha inesperada ao resetar a progressão: ${reason}`)
    } finally {
      setLoading(false)
    }
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
        <div className="admin-reset-icon"><Crown size={23} /></div>
        <div className="admin-reset-copy">
          <span className="admin-reset-kicker">RECALIBRAÇÃO DOS ÁPICES</span>
          <h2>Resetar progresso de Ápices</h2>
          <p>Reinicializa o estado de desbloqueio de todos os Ápices, zera os pontos investidos diretamente neles e remove bloqueios manuais antigos. Em seguida, recalcula automaticamente a elegibilidade: Ápices comuns consideram somente os pontos efetivos distribuídos em sua própria árvore; o Ápice Supremo mantém os requisitos das Habilidades Supremas.</p>
          <p className="admin-reset-warning"><AlertTriangle size={15} /> Os pontos distribuídos nos talentos não serão apagados. A ação afeta todos os usuários e os estados dos Ápices serão recalculados imediatamente.</p>
          {!confirmingApexReset ? (
            <button type="button" className="admin-reset-button" disabled={loading || loadingApexReset} onClick={() => { setMessage(null); setError(null); setConfirmingApexReset(true) }}><Crown size={15} /> Resetar progresso de Ápices</button>
          ) : (
            <div className="admin-reset-confirm">
              <strong>Confirma a reinicialização de todos os Ápices?</strong>
              <span>Os pontos dos talentos serão preservados. Os pontos próprios dos Ápices e os estados de desbloqueio serão reinicializados e reavaliados.</span>
              <div>
                <button type="button" className="admin-reset-cancel" disabled={loading || loadingApexReset} onClick={() => setConfirmingApexReset(false)}>Cancelar</button>
                <button type="button" className="admin-reset-button" disabled={loading || loadingApexReset} onClick={() => void resetApexProgress()}>{loadingApexReset ? 'Reinicializando...' : 'Confirmar reset dos Ápices'}</button>
              </div>
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
