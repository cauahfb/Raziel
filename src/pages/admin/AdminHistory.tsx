import { useEffect, useState } from 'react'
import { History, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type HistoryRow = {
  id: number
  event_type: string
  action: string
  entity_name: string | null
  details: Record<string, unknown> | null
  actor_id: string | null
  occurred_at: string
}

const PAGE_SIZE = 20
const labels: Record<string, string> = {
  points: 'Distribuição de pontos',
  talent_created: 'Criação de talento',
  talent_updated: 'Edição de talento',
  talent_deleted: 'Exclusão de talento',
  requirements_updated: 'Alteração de pré-requisito',
  effect_owner: 'Vínculo de efeito',
  effect: 'Efeito',
  effect_interaction: 'Interação entre efeitos',
  talent_activity: 'Atividade de talento',
  special_content: 'Conteúdo especial',
  apex: 'Ápice de árvore',
  compendium_progress: 'Progressão global',
  backup_restored: 'Restauração de backup',
  snapshot_created: 'Criação de snapshot',
}

const filters = [
  ['all', 'Todas as alterações'],
  ['points', 'Distribuição de pontos'],
  ['talent_created', 'Criação de talento'],
  ['talent_updated', 'Edição de talento'],
  ['talent_deleted', 'Exclusão de talento'],
  ['requirements_updated', 'Pré-requisitos'],
  ['effect', 'Efeitos'],
  ['effect_owner', 'Vínculos de efeitos'],
  ['effect_interaction', 'Interações entre efeitos'],
  ['talent_activity', 'Atividades de talentos'],
  ['special_content', 'Conteúdos especiais'],
  ['apex', 'Ápices'],
  ['compendium_progress', 'Progressão global'],
  ['backup_restored', 'Restaurações'],
  ['snapshot_created', 'Snapshots'],
]

export default function AdminHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadHistory(selectedFilter = filter, selectedPage = page) {
    if (!supabase) {
      setError('A conexão com o Compêndio não está configurada.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    let query = supabase
      .from('admin_activity_history')
      .select('id, event_type, action, entity_name, details, actor_id, occurred_at', { count: 'exact' })
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })

    if (selectedFilter !== 'all') query = query.eq('event_type', selectedFilter)
    const from = selectedPage * PAGE_SIZE
    const { data, error: queryError, count } = await query.range(from, from + PAGE_SIZE - 1)

    if (queryError) {
      setError(`Não foi possível carregar o histórico: ${queryError.message}`)
    } else {
      setRows((data ?? []) as HistoryRow[])
      setTotalRows(count ?? 0)
    }
    setLoading(false)
  }

  useEffect(() => { void loadHistory(filter, page) }, [filter, page])

  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))

  function describe(row: HistoryRow) {
    const d = row.details ?? {}
    if (row.event_type === 'points') return `${String(d.previous_points ?? 0)} → ${String(d.new_points ?? 0)} ponto(s)${d.tree_name ? ` · ${String(d.tree_name)}` : ''}`
    if (row.event_type === 'talent_created') return 'Novo talento cadastrado'
    if (row.event_type === 'talent_deleted') return 'Talento removido do compêndio'
    if (row.event_type === 'requirements_updated') return 'Configuração de pré-requisito modificada'
    if (row.event_type === 'talent_updated') return 'Informações do talento atualizadas'
    if (row.event_type === 'effect') return 'Definição mecânica de efeito criada, alterada ou removida'
    if (row.event_type === 'effect_owner') return 'Origem de um conjunto de efeitos vinculada ou desvinculada'
    if (row.event_type === 'effect_interaction') return 'Regra de interação entre dois efeitos modificada'
    if (row.event_type === 'talent_activity') return 'Atividade e seus parâmetros foram modificados'
    if (row.event_type === 'special_content') return 'Conteúdo especial do compêndio foi modificado'
    if (row.event_type === 'apex') return 'Configuração do ápice da árvore foi modificada'
    if (row.event_type === 'compendium_progress') return 'Nível global do personagem foi modificado'
    if (row.event_type === 'backup_restored') return `Backup v${String(d.version ?? '?')} restaurado`
    if (row.event_type === 'snapshot_created') return 'Uma nova versão de segurança foi preservada'
    return row.action
  }

  return <section className="admin-history-page">
    <div className="eyebrow"><span className="eyebrow-line" />AUDITORIA DO COMPÊNDIO</div>
    <div className="admin-history-heading">
      <div><h1>Histórico Administrativo</h1><p>Registro paginado das alterações realizadas no Compendium.</p></div>
      <button type="button" className="admin-history-refresh" onClick={() => void loadHistory(filter, page)} disabled={loading}><RefreshCw size={15} /> Atualizar</button>
    </div>
    <div className="admin-history-toolbar">
      <label htmlFor="history-filter">Tipo de alteração</label>
      <select id="history-filter" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }}>
        {filters.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
      <span>{totalRows} registro(s)</span>
    </div>
    {error && <p className="admin-history-error" role="alert">{error}</p>}
    {loading ? <div className="admin-history-empty">Carregando histórico...</div> :
      rows.length === 0 ? <div className="admin-history-empty"><History size={22}/><strong>Nenhuma alteração encontrada</strong><span>Quando houver novas operações, elas aparecerão aqui.</span></div> :
      <div className="admin-history-list">{rows.map((row) => <article className="admin-history-row" key={row.id}>
        <div className="admin-history-icon"><History size={16}/></div>
        <div className="admin-history-copy">
          <div className="admin-history-meta"><span>{labels[row.event_type] ?? row.event_type}</span><time dateTime={row.occurred_at}>{new Date(row.occurred_at).toLocaleString('pt-BR')}</time></div>
          <strong>{row.entity_name || row.action}</strong><p>{describe(row)}</p>
        </div>
      </article>)}</div>}
    <footer className="admin-history-pagination">
      <span>Página {page + 1} de {pageCount} · {PAGE_SIZE} por página</span>
      <div>
        <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0 || loading}><ChevronLeft size={16}/> Anterior</button>
        <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1 || loading}>Próxima <ChevronRight size={16}/></button>
      </div>
    </footer>
  </section>
}
