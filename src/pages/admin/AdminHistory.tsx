import { useEffect, useMemo, useState } from 'react'
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

const PAGE_SIZE = 10
const labels: Record<string, string> = {
  points: 'Distribuição de pontos',
  talent_created: 'Criação de talento',
  talent_updated: 'Edição de talento',
  talent_deleted: 'Exclusão de talento',
  requirements_updated: 'Alteração de pré-requisito',
}

export default function AdminHistory() {
  const [rows, setRows] = useState<HistoryRow[]>([])
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadHistory() {
    if (!supabase) return
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('admin_activity_history')
      .select('id, event_type, action, entity_name, details, actor_id, occurred_at')
      .order('occurred_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(30)
    if (queryError) setError(`Não foi possível carregar o histórico: ${queryError.message}`)
    else setRows((data ?? []) as HistoryRow[])
    setLoading(false)
  }

  useEffect(() => { void loadHistory() }, [])

  const filtered = useMemo(() => filter === 'all' ? rows : rows.filter((row) => row.event_type === filter), [rows, filter])
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function changeFilter(value: string) { setFilter(value); setPage(0) }
  function describe(row: HistoryRow) {
    const d = row.details ?? {}
    if (row.event_type === 'points') return `${String(d.previous_points ?? 0)} → ${String(d.new_points ?? 0)} ponto(s)${d.tree_name ? ` · ${String(d.tree_name)}` : ''}`
    if (row.event_type === 'talent_created') return 'Novo talento cadastrado'
    if (row.event_type === 'talent_deleted') return 'Talento removido do compêndio'
    if (row.event_type === 'requirements_updated') return 'Configuração de pré-requisito modificada'
    if (row.event_type === 'talent_updated') return 'Informações do talento atualizadas'
    return row.action
  }

  return <section className="admin-history-page">
    <div className="eyebrow"><span className="eyebrow-line" />AUDITORIA DO COMPÊNDIO</div>
    <div className="admin-history-heading"><div><h1>Histórico Administrativo</h1><p>Últimas 30 alterações registradas no Compendium.</p></div><button type="button" className="admin-history-refresh" onClick={() => void loadHistory()} disabled={loading}><RefreshCw size={15} /> Atualizar</button></div>
    <div className="admin-history-toolbar"><label htmlFor="history-filter">Tipo de alteração</label><select id="history-filter" value={filter} onChange={(e) => changeFilter(e.target.value)}><option value="all">Todas as alterações</option><option value="points">Distribuição de pontos</option><option value="talent_created">Criação de talento</option><option value="talent_updated">Edição de talento</option><option value="talent_deleted">Exclusão de talento</option><option value="requirements_updated">Alteração de pré-requisito</option></select><span>{filtered.length} registro(s)</span></div>
    {error && <p className="admin-history-error" role="alert">{error}</p>}
    {loading ? <div className="admin-history-empty">Carregando histórico...</div> : visibleRows.length === 0 ? <div className="admin-history-empty"><History size={22}/><strong>Nenhuma alteração encontrada</strong><span>Quando houver novas operações, elas aparecerão aqui.</span></div> : <div className="admin-history-list">{visibleRows.map((row) => <article className="admin-history-row" key={row.id}><div className="admin-history-icon"><History size={16}/></div><div className="admin-history-copy"><div className="admin-history-meta"><span>{labels[row.event_type] ?? row.event_type}</span><time dateTime={row.occurred_at}>{new Date(row.occurred_at).toLocaleString('pt-BR')}</time></div><strong>{row.entity_name || row.action}</strong><p>{describe(row)}</p></div></article>)}</div>}
    <footer className="admin-history-pagination"><span>Página {page + 1} de {pageCount} · máximo de 30 registros</span><div><button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}><ChevronLeft size={16}/> Anterior</button><button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}>Próxima <ChevronRight size={16}/></button></div></footer>
  </section>
}
