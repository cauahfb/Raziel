import { useEffect, useRef, useState } from 'react'
import {
  Archive,
  Download,
  FileUp,
  RotateCcw,
  Camera,
  Clock3,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Snapshot = {
  id: string
  label: string
  created_at: string
  created_by: string | null
}

type BackupPayload = {
  format: string
  version: number
  created_at: string
  talents: unknown[]
  talent_prerequisites: unknown[]
  talent_tree_requirements: unknown[]
  talent_progress: unknown[]
  talent_tree_apices?: unknown[]
  compendium_progress?: unknown[]
  compendium_special_contents?: unknown[]
  compendium_effect_owners?: unknown[]
  compendium_effects?: unknown[]
  compendium_effect_interactions?: unknown[]
  compendium_talent_activities?: unknown[]
}

type RestoreDiagnostic = {
  stage: string
  message: string
  details?: string
  hint?: string
  code?: string
}

type BackupCounts = {
  talents: number
  talent_prerequisites: number
  talent_tree_requirements: number
  talent_progress: number
  talent_tree_apices: number
  compendium_special_contents: number
  compendium_effect_owners: number
  compendium_effects: number
  compendium_effect_interactions: number
  compendium_talent_activities: number
  character_level: number | null
}

type SnapshotPreview = BackupCounts & {
  id: string
  label: string | null
  created_at: string
  version?: number
}

type PendingRestore =
  | {
      kind: 'backup'
      title: string
      payload: BackupPayload
      incoming: BackupCounts
      current: BackupCounts
    }
  | {
      kind: 'snapshot'
      title: string
      snapshotId: string
      version: number
      incoming: BackupCounts
      current: BackupCounts
    }

function getErrorDetails(error: unknown) {
  if (typeof error === 'string') {
    return { message: error }
  }

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>

    return {
      message: String(err.message || 'Erro desconhecido.'),
      code: err.code ? String(err.code) : undefined,
      details: err.details ? String(err.details) : undefined,
      hint: err.hint ? String(err.hint) : undefined,
    }
  }

  return { message: 'Erro desconhecido.' }
}

function findDuplicateProgress(payload: BackupPayload) {
  const occurrences = new Map<string, number[]>()

  payload.talent_progress.forEach((item, index) => {
    const progress = item as Record<string, unknown>
    const talentId = String(progress?.talent_id ?? '')

    if (!talentId) return

    const positions = occurrences.get(talentId) ?? []
    positions.push(index + 1)
    occurrences.set(talentId, positions)
  })

  return Array.from(occurrences.entries())
    .filter(([, positions]) => positions.length > 1)
    .map(([talentId, positions]) => ({
      talentId,
      positions,
      quantity: positions.length,
    }))
}

function getPayloadCounts(payload: BackupPayload): BackupCounts {
  const levelRows = Array.isArray(payload.compendium_progress)
    ? payload.compendium_progress as Array<Record<string, unknown>>
    : []

  return {
    talents: payload.talents.length,
    talent_prerequisites: payload.talent_prerequisites.length,
    talent_tree_requirements: payload.talent_tree_requirements.length,
    talent_progress: payload.talent_progress.length,
    talent_tree_apices: Array.isArray(payload.talent_tree_apices) ? payload.talent_tree_apices.length : 0,
    compendium_special_contents: Array.isArray(payload.compendium_special_contents) ? payload.compendium_special_contents.length : 0,
    compendium_effect_owners: Array.isArray(payload.compendium_effect_owners) ? payload.compendium_effect_owners.length : 0,
    compendium_effects: Array.isArray(payload.compendium_effects) ? payload.compendium_effects.length : 0,
    compendium_effect_interactions: Array.isArray(payload.compendium_effect_interactions) ? payload.compendium_effect_interactions.length : 0,
    compendium_talent_activities: Array.isArray(payload.compendium_talent_activities) ? payload.compendium_talent_activities.length : 0,
    character_level: typeof levelRows[0]?.character_level === 'number'
      ? levelRows[0].character_level as number
      : null,
  }
}

function isValidSnapshotPreview(value: unknown): value is SnapshotPreview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const preview = value as Record<string, unknown>

  return (
    typeof preview.id === 'string' &&
    typeof preview.talents === 'number' &&
    typeof preview.talent_prerequisites === 'number' &&
    typeof preview.talent_tree_requirements === 'number' &&
    typeof preview.talent_progress === 'number' &&
    typeof preview.talent_tree_apices === 'number' &&
    (preview.character_level === null || typeof preview.character_level === 'number')
  )
}

async function fetchAllRows(table: string, orderColumns: string[] = []) {
  if (!supabase) throw new Error('Conexão com o Supabase indisponível.')
  const pageSize = 1000
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += pageSize) {
    let query = supabase.from(table).select('*')
    for (const column of orderColumns) query = query.order(column, { ascending: true })
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...((data ?? []) as Record<string, unknown>[]))
    if (!data || data.length < pageSize) break
  }
  return rows
}

export default function AdminBackup() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [label, setLabel] = useState('')

  const [restoreDiagnostic, setRestoreDiagnostic] =
    useState<RestoreDiagnostic | null>(null)

  const [pendingRestore, setPendingRestore] =
    useState<PendingRestore | null>(null)

  async function loadSnapshots() {
    if (!supabase) return

    setLoading(true)

    const { data, error: queryError } = await supabase.rpc(
      'list_progression_snapshots'
    )

    if (queryError) {
      const details = getErrorDetails(queryError)

      setError(
        `Não foi possível carregar os snapshots:\n${details.message}`
      )
    } else {
      setSnapshots((data ?? []) as Snapshot[])
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadSnapshots()
  }, [])

  async function getCurrentCounts(): Promise<BackupCounts> {
    if (!supabase) throw new Error('Conexão com o Supabase indisponível.')
    // Captura a instância após a guarda: o TypeScript não preserva o narrowing
    // da variável global dentro do callback passado ao map().
    const client = supabase
    const tables = [
      'talents', 'talent_prerequisites', 'talent_tree_requirements', 'talent_progress',
      'talent_tree_apices', 'compendium_special_contents', 'compendium_effect_owners',
      'compendium_effects', 'compendium_effect_interactions', 'compendium_talent_activities',
    ] as const
    const results = await Promise.all(tables.map((table) =>
      client.from(table).select('*', { count: 'exact', head: true })
    ))
    const failed = results.find((result) => result.error)
    if (failed?.error) throw failed.error
    const globalProgress = await client.from('compendium_progress')
      .select('character_level').eq('id', 1).maybeSingle()
    if (globalProgress.error) throw globalProgress.error
    const counts = results.map((result) => result.count ?? 0)
    return {
      talents: counts[0], talent_prerequisites: counts[1], talent_tree_requirements: counts[2],
      talent_progress: counts[3], talent_tree_apices: counts[4],
      compendium_special_contents: counts[5], compendium_effect_owners: counts[6],
      compendium_effects: counts[7], compendium_effect_interactions: counts[8],
      compendium_talent_activities: counts[9], character_level: globalProgress.data?.character_level ?? null,
    }
  }

  async function exportBackup() {
    if (!supabase) return
    setBusy(true); setError(''); setMessage(''); setRestoreDiagnostic(null); setPendingRestore(null)
    try {
      const [talents, prerequisites, treeRequirements, progress, apices, globalProgress,
        specialContents, effectOwners, effects, interactions, activities] = await Promise.all([
        fetchAllRows('talents', ['tree_key', 'sort_order', 'id']),
        fetchAllRows('talent_prerequisites', ['talent_id', 'prerequisite_talent_id']),
        fetchAllRows('talent_tree_requirements', ['talent_id', 'required_tree_key']),
        fetchAllRows('talent_progress', ['talent_id']),
        fetchAllRows('talent_tree_apices', ['tree_key']),
        fetchAllRows('compendium_progress', ['id']),
        fetchAllRows('compendium_special_contents', ['sort_order', 'content_key']),
        fetchAllRows('compendium_effect_owners', ['created_at', 'id']),
        fetchAllRows('compendium_effects', ['sort_order', 'id']),
        fetchAllRows('compendium_effect_interactions', ['created_at', 'id']),
        fetchAllRows('compendium_talent_activities', ['sort_order', 'id']),
      ])

      const payload: BackupPayload = {
        format: 'raziel-compendium-backup', version: 2, created_at: new Date().toISOString(),
        talents: talents, talent_prerequisites: prerequisites,
        talent_tree_requirements: treeRequirements, talent_progress: progress,
        talent_tree_apices: apices, compendium_progress: globalProgress,
        compendium_special_contents: specialContents, compendium_effect_owners: effectOwners,
        compendium_effects: effects, compendium_effect_interactions: interactions,
        compendium_talent_activities: activities,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `raziel-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Backup completo v2 gerado com sucesso.')
    } catch (e) {
      const details = getErrorDetails(e)
      setError(`Falha ao gerar backup:\n${details.message}` +
        (details.code ? `\nCódigo: ${details.code}` : '') +
        (details.details ? `\nDetalhes: ${details.details}` : '') +
        (details.hint ? `\nDica: ${details.hint}` : ''))
    } finally { setBusy(false) }
  }

  async function restoreFile(file: File) {
    if (!supabase) return

    setBusy(true)
    setError('')
    setMessage('')
    setRestoreDiagnostic(null)
    setPendingRestore(null)

    let stage = 'Leitura do arquivo'

    try {
      const fileContent = await file.text()

      if (!fileContent.trim()) {
        throw new Error('O arquivo selecionado está vazio.')
      }

      stage = 'Interpretação do JSON'

      let payload: BackupPayload

      try {
        payload = JSON.parse(fileContent) as BackupPayload
      } catch {
        throw new Error(
          'O arquivo não contém um JSON válido. Verifique se ele não foi alterado ou corrompido.'
        )
      }

      stage = 'Validação do backup'

      if (
        !payload ||
        typeof payload !== 'object' ||
        Array.isArray(payload)
      ) {
        throw new Error('O conteúdo do arquivo não é um objeto JSON válido.')
      }

      if (payload.format !== 'raziel-compendium-backup') {
        throw new Error(
          `Formato incompatível: "${payload.format}". Esperado: "raziel-compendium-backup".`
        )
      }

      if (payload.version !== 1 && payload.version !== 2) {
        throw new Error(`Versão incompatível: ${payload.version}. Esperadas: 1 ou 2.`)
      }

      const collections = [
        'talents',
        'talent_prerequisites',
        'talent_tree_requirements',
        'talent_progress',
      ] as const

      for (const collection of collections) {
        if (!Array.isArray(payload[collection])) {
          throw new Error(
            `A coleção "${collection}" não existe ou não é um array.`
          )
        }
      }

      // Backups anteriores à inclusão dos Ápices e do nível continuam válidos.
      if (payload.talent_tree_apices !== undefined && !Array.isArray(payload.talent_tree_apices)) {
        throw new Error('A coleção "talent_tree_apices" existe, mas não é um array.')
      }
      if (payload.compendium_progress !== undefined && !Array.isArray(payload.compendium_progress)) {
        throw new Error('A coleção "compendium_progress" existe, mas não é um array.')
      }
      if (Array.isArray(payload.compendium_progress) && payload.compendium_progress.length > 0) {
        const global = payload.compendium_progress[0] as Record<string, unknown>
        if (global.id !== 1 || !Number.isInteger(global.character_level) || Number(global.character_level) < 1) {
          throw new Error('O nível global do backup é inválido.')
        }
      }

      const v2Collections = [
        'compendium_special_contents', 'compendium_effect_owners', 'compendium_effects',
        'compendium_effect_interactions', 'compendium_talent_activities',
      ] as const
      if (payload.version === 2) {
        for (const collection of v2Collections) {
          if (!Array.isArray(payload[collection])) throw new Error(`A coleção "${collection}" é obrigatória em backups v2.`)
        }
      }

      if (payload.talents.length === 0) {
        throw new Error(
          'O backup não possui talentos. A restauração foi cancelada para evitar apagar os dados atuais.'
        )
      }

      stage = 'Verificação dos registros de progresso'

      const missingIds = payload.talent_progress
        .map((item, index) => {
          const progress = item as Record<string, unknown>
          return progress?.talent_id ? null : index + 1
        })
        .filter((index): index is number => index !== null)

      if (missingIds.length > 0) {
        throw new Error(
          `Existem registros sem talent_id nas seguintes posições do JSON: ${missingIds.join(', ')}.`
        )
      }

      const duplicates = findDuplicateProgress(payload)

      if (duplicates.length > 0) {
        const duplicateDescription = duplicates
          .map(
            (item) =>
              `• ${item.talentId}\n  Posições: ${item.positions.join(', ')}\n  Ocorrências: ${item.quantity}`
          )
          .join('\n\n')

        throw new Error(
          `O backup possui registros duplicados em talent_progress:\n${duplicateDescription}`
        )
      }

      stage = 'Consulta dos dados atuais'

      const current = await getCurrentCounts()

      setPendingRestore({
        kind: 'backup',
        title: file.name,
        payload,
        incoming: getPayloadCounts(payload),
        current,
      })
    } catch (e) {
      const details = getErrorDetails(e)

      setRestoreDiagnostic({
        stage,
        message: details.message,
        code: details.code,
        details: details.details,
        hint: details.hint,
      })
    } finally {
      setBusy(false)

      if (fileRef.current) {
        fileRef.current.value = ''
      }
    }
  }

  async function prepareSnapshotRestore(snapshot: Snapshot) {
    if (!supabase) return

    setBusy(true)
    setError('')
    setMessage('')
    setRestoreDiagnostic(null)
    setPendingRestore(null)

    try {
      // Consulta o conteúdo do snapshot sem restaurá-lo.
      const { data, error: previewError } = await supabase.rpc(
        'get_progression_snapshot_preview',
        {
          p_snapshot_id: snapshot.id,
        }
      )

      if (previewError) throw previewError

      if (!isValidSnapshotPreview(data)) {
        throw new Error(
          'O Supabase retornou uma prévia inválida para este snapshot.'
        )
      }

      // Consulta o estado atual para comparar com o snapshot.
      const current = await getCurrentCounts()

      setPendingRestore({
        kind: 'snapshot',
        title: snapshot.label || 'Snapshot da progressão',
        snapshotId: snapshot.id,
        version: Number(data.version ?? 1),
        incoming: {
          talents: data.talents,
          talent_prerequisites: data.talent_prerequisites,
          talent_tree_requirements: data.talent_tree_requirements,
          talent_progress: data.talent_progress,
          talent_tree_apices: data.talent_tree_apices,
          compendium_special_contents: Number(data.compendium_special_contents ?? 0),
          compendium_effect_owners: Number(data.compendium_effect_owners ?? 0),
          compendium_effects: Number(data.compendium_effects ?? 0),
          compendium_effect_interactions: Number(data.compendium_effect_interactions ?? 0),
          compendium_talent_activities: Number(data.compendium_talent_activities ?? 0),
          character_level: data.character_level,
        },
        current,
      })
    } catch (e) {
      const details = getErrorDetails(e)

      setRestoreDiagnostic({
        stage: 'Preparação da restauração do snapshot',
        message: details.message,
        code: details.code,
        details: details.details,
        hint: details.hint,
      })
    } finally {
      setBusy(false)
    }
  }

  async function confirmRestore() {
    if (!supabase || !pendingRestore) return

    const selectedRestore = pendingRestore

    setBusy(true)
    setError('')
    setMessage('')
    setRestoreDiagnostic(null)

    try {
      if (selectedRestore.kind === 'backup') {
        const { error: restoreError } = await supabase.rpc(
          'restore_compendium_backup',
          {
            p_payload: selectedRestore.payload,
          }
        )

        if (restoreError) throw restoreError
      } else {
        const { error: restoreError } = await supabase.rpc(
          'restore_progression_snapshot',
          {
            p_snapshot_id: selectedRestore.snapshotId,
          }
        )

        if (restoreError) throw restoreError
      }

      setPendingRestore(null)

      setMessage(
        selectedRestore.kind === 'backup'
          ? 'Backup restaurado com sucesso. O compêndio e sua progressão foram atualizados.'
          : 'Snapshot restaurado com sucesso. O compêndio e sua progressão foram atualizados.'
      )

      await loadSnapshots()
    } catch (e) {
      const details = getErrorDetails(e)

      setRestoreDiagnostic({
        stage:
          selectedRestore.kind === 'backup'
            ? 'Restauração do backup'
            : 'Restauração do snapshot',
        message: details.message,
        code: details.code,
        details: details.details,
        hint: details.hint,
      })
    } finally {
      setBusy(false)
    }
  }

  async function createSnapshot() {
    if (!supabase) return

    setBusy(true)
    setError('')
    setMessage('')
    setRestoreDiagnostic(null)
    setPendingRestore(null)

    try {
      const { error: rpcError } = await supabase.rpc(
        'create_progression_snapshot',
        {
          p_label: label.trim() || null,
        }
      )

      if (rpcError) throw rpcError

      setMessage(
        'Snapshot criado. Serão mantidas somente as 5 versões mais recentes.'
      )

      setLabel('')
      await loadSnapshots()
    } catch (e) {
      const details = getErrorDetails(e)

      setError(
        `Não foi possível criar snapshot:\n${details.message}` +
          (details.code ? `\nCódigo: ${details.code}` : '') +
          (details.details ? `\nDetalhes: ${details.details}` : '') +
          (details.hint ? `\nDica: ${details.hint}` : '')
      )
    } finally {
      setBusy(false)
    }
  }

  const confirmationRows = pendingRestore
    ? [
        {
          name: 'Talentos',
          current: pendingRestore.current.talents,
          incoming: pendingRestore.incoming.talents,
        },
        {
          name: 'Pré-requisitos',
          current: pendingRestore.current.talent_prerequisites,
          incoming: pendingRestore.incoming.talent_prerequisites,
        },
        {
          name: 'Requisitos entre árvores',
          current: pendingRestore.current.talent_tree_requirements,
          incoming: pendingRestore.incoming.talent_tree_requirements,
        },
        {
          name: 'Registros de progresso',
          current: pendingRestore.current.talent_progress,
          incoming: pendingRestore.incoming.talent_progress,
        },
        { name: 'Ápices das árvores', current: pendingRestore.current.talent_tree_apices, incoming: pendingRestore.incoming.talent_tree_apices },
        { name: 'Conteúdos especiais', current: pendingRestore.current.compendium_special_contents, incoming: pendingRestore.incoming.compendium_special_contents },
        { name: 'Proprietários de efeitos', current: pendingRestore.current.compendium_effect_owners, incoming: pendingRestore.incoming.compendium_effect_owners },
        { name: 'Efeitos', current: pendingRestore.current.compendium_effects, incoming: pendingRestore.incoming.compendium_effects },
        { name: 'Interações entre efeitos', current: pendingRestore.current.compendium_effect_interactions, incoming: pendingRestore.incoming.compendium_effect_interactions },
        { name: 'Atividades de talentos', current: pendingRestore.current.compendium_talent_activities, incoming: pendingRestore.incoming.compendium_talent_activities },
      ]
    : []

  return (
    <section className="admin-backup-page">
      <div className="eyebrow">
        <span className="eyebrow-line" />
        SEGURANÇA E PRESERVAÇÃO
      </div>

      <div className="admin-backup-heading">
        <div>
          <h1>Backup e snapshots</h1>
          <p>
            Exporte, restaure e preserve versões da progressão do Compendium.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="admin-backup-feedback error"
          role="alert"
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {error}
        </div>
      )}

      {message && (
        <p className="admin-backup-feedback success" role="status">
          {message}
        </p>
      )}

      {restoreDiagnostic && (
        <div
          className="admin-backup-feedback error"
          role="alert"
          style={{
            whiteSpace: 'pre-wrap',
            textAlign: 'left',
            padding: '20px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '14px',
              fontWeight: 700,
            }}
          >
            <AlertTriangle size={20} />
            Falha na operação
          </div>

          <div style={{ marginBottom: '12px' }}>
            <strong>Etapa:</strong> {restoreDiagnostic.stage}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <strong>Mensagem:</strong>
            <p style={{ margin: '5px 0 0' }}>
              {restoreDiagnostic.message}
            </p>
          </div>

          {restoreDiagnostic.code && (
            <div style={{ marginBottom: '12px' }}>
              <strong>Código do erro:</strong> {restoreDiagnostic.code}
            </div>
          )}

          {restoreDiagnostic.details && (
            <div style={{ marginBottom: '12px' }}>
              <strong>Detalhes:</strong>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  font: 'inherit',
                  margin: '5px 0 0',
                }}
              >
                {restoreDiagnostic.details}
              </pre>
            </div>
          )}

          {restoreDiagnostic.hint && (
            <div style={{ marginBottom: '12px' }}>
              <strong>Sugestão do banco:</strong>
              <p style={{ margin: '5px 0 0' }}>
                {restoreDiagnostic.hint}
              </p>
            </div>
          )}

          <div
            style={{
              borderTop: '1px solid currentColor',
              paddingTop: '12px',
              marginTop: '14px',
              fontSize: '0.9em',
            }}
          >
            Consulte os detalhes antes de tentar novamente.
          </div>
        </div>
      )}

      <div className="admin-backup-grid">
        <article className="admin-backup-card">
          <div className="admin-backup-card-icon">
            <Download size={20} />
          </div>

          <h2>Gerar backup</h2>

          <p>
            Baixe um JSON v2 com talentos, progressão, Ápices, conteúdos especiais, efeitos, interações e atividades.
          </p>

          <button
            type="button"
            onClick={() => void exportBackup()}
            disabled={busy}
          >
            <Download size={16} /> Gerar backup JSON
          </button>
        </article>

        <article className="admin-backup-card">
          <div className="admin-backup-card-icon">
            <FileUp size={20} />
          </div>

          <h2>Restaurar backup</h2>

          <p>
            Importe um JSON gerado pelo Raziel. Antes da restauração,
            você poderá revisar todas as alterações.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void restoreFile(file)
            }}
          />

          <button
            type="button"
            className="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <FileUp size={16} /> Selecionar arquivo JSON
          </button>
        </article>
      </div>

      <div className="admin-snapshots-section">
        <div className="admin-snapshots-heading">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-line" />
              VERSÕES DA PROGRESSÃO
            </div>

            <h2>Snapshots</h2>

            <p>
              Preserve até 5 versões para poder retornar a um estado anterior.
            </p>
          </div>

          <span className="admin-snapshot-count">
            {snapshots.length} / 5
          </span>
        </div>

        <div className="admin-snapshot-create">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome opcional desta versão"
            maxLength={80}
          />

          <button
            type="button"
            onClick={() => void createSnapshot()}
            disabled={busy}
          >
            <Camera size={16} /> Criar snapshot
          </button>
        </div>

        {loading ? (
          <p className="admin-snapshot-empty">
            Carregando snapshots...
          </p>
        ) : snapshots.length === 0 ? (
          <div className="admin-snapshot-empty">
            <Archive size={22} />
            <strong>Nenhum snapshot salvo</strong>
            <span>
              Crie uma versão para preservar a progressão atual.
            </span>
          </div>
        ) : (
          <div className="admin-snapshot-list">
            {snapshots.map((item) => (
              <article className="admin-snapshot-row" key={item.id}>
                <div className="admin-snapshot-icon">
                  <Clock3 size={17} />
                </div>

                <div className="admin-snapshot-copy">
                  <strong>
                    {item.label || 'Snapshot da progressão'}
                  </strong>

                  <span>
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>

                <button
                  type="button"
                  className="secondary"
                  onClick={() => void prepareSnapshotRestore(item)}
                  disabled={busy}
                >
                  <RotateCcw size={15} />
                  Restaurar
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="admin-backup-note">
          <ShieldCheck size={16} />
          A criação de um sexto snapshot remove automaticamente o mais
          antigo. Restaurar um snapshot não o remove da lista.
        </div>
      </div>

      {/* Confirmação de restauração de backup ou snapshot */}
      {pendingRestore && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setPendingRestore(null)
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(8, 10, 16, 0.78)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            overflowY: 'auto',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-confirm-title"
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--admin-card-bg, #fff)',
              color: 'var(--admin-text, #242424)',
              borderRadius: '14px',
              padding: '26px',
              boxShadow: '0 20px 80px rgba(0,0,0,.35)',
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}
            >
              <AlertTriangle size={25} color="#c58a36" />

              <div>
                <h2 id="restore-confirm-title" style={{ margin: 0 }}>
                  Confirmar restauração
                </h2>

                <p style={{ margin: '5px 0 0', opacity: 0.7 }}>
                  Revise o impacto antes de continuar.
                </p>
              </div>
            </div>

            <div
              style={{
                marginTop: '22px',
                padding: '13px',
                borderRadius: '8px',
                background: 'rgba(128,128,128,.09)',
                overflowWrap: 'anywhere',
              }}
            >
              <strong>
                {pendingRestore.kind === 'backup'
                  ? 'Arquivo selecionado'
                  : 'Snapshot selecionado'}
              </strong>

              <p style={{ margin: '5px 0 0' }}>
                {pendingRestore.title}
              </p>
            </div>

            <h3 style={{ marginTop: '24px' }}>
              Dados atuais que serão substituídos
            </h3>

            <p style={{ fontSize: '13px', opacity: 0.7 }}>
              A restauração substitui os dados apresentados acima. Backups v1 não contêm efeitos, atividades ou conteúdos especiais; se esses dados já existirem no banco, o Supabase bloqueará a restauração antiga para impedir perda silenciosa.
            </p>

            {(pendingRestore.kind === 'backup' ? pendingRestore.payload.version : pendingRestore.version) === 1 &&
              (pendingRestore.current.compendium_special_contents +
                pendingRestore.current.compendium_effect_owners +
                pendingRestore.current.compendium_effects +
                pendingRestore.current.compendium_effect_interactions +
                pendingRestore.current.compendium_talent_activities) > 0 && (
                <div role="alert" style={{ margin: '12px 0', padding: '13px', borderRadius: '8px', background: 'rgba(190, 125, 40, .12)', border: '1px solid rgba(190, 125, 40, .35)', color: 'var(--admin-text, #242424)' }}>
                  <strong>Backup legado incompleto.</strong>
                  <p style={{ margin: '5px 0 0', fontSize: '13px' }}>Este arquivo não contém as novas estruturas do compêndio. A restauração será recusada pelo banco enquanto existirem efeitos, atividades ou conteúdos especiais atuais. Gere um backup v2 antes de restaurar.</p>
                </div>
              )}

            <div style={{ display: 'grid', gap: '10px' }}>
              {confirmationRows.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    border: '1px solid rgba(128,128,128,.2)',
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <strong>{item.name}</strong>

                    <div style={{ fontSize: '12px', opacity: 0.7 }}>
                      Atual: {item.current} → Origem: {item.incoming}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700 }}>
                      {item.incoming}
                    </div>

                    <div style={{ fontSize: '11px', opacity: 0.7 }}>
                      registros na origem
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '14px', padding: '12px', border: '1px solid rgba(128,128,128,.2)', borderRadius: '8px' }}>
              <strong>Nível global</strong>
              <div style={{ fontSize: '13px', opacity: 0.8, marginTop: '5px' }}>
                Atual: {pendingRestore.current.character_level ?? 'Não definido'} → Origem: {pendingRestore.incoming.character_level ?? 'Não incluído'}
              </div>
              {pendingRestore.incoming.character_level === null && (
                <div style={{ fontSize: '12px', marginTop: '5px', color: '#b7791f' }}>
                  A origem não contém o nível global. O valor atual será preservado.
                </div>
              )}
            </div>

            <h3 style={{ marginTop: '24px' }}>
              Dados que serão recriados
            </h3>

            <div
              style={{
                padding: '14px',
                borderRadius: '8px',
                background: 'rgba(65, 145, 105, .09)',
                border: '1px solid rgba(65, 145, 105, .25)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <CheckCircle2 size={17} color="#39966b" />
                <strong>Nova estrutura da progressão</strong>
              </div>

              <ul style={{ paddingLeft: '20px', marginBottom: 0 }}>
                <li>
                  {pendingRestore.incoming.talents} talentos serão recriados.
                </li>

                <li>
                  {pendingRestore.incoming.talent_prerequisites} pré-requisitos
                  serão recriados.
                </li>

                <li>
                  {pendingRestore.incoming.talent_tree_requirements} requisitos
                  entre árvores serão recriados.
                </li>

                <li>
                  O trigger criará automaticamente um registro de progresso
                  para cada um dos {pendingRestore.incoming.talents} talentos.
                </li>

                <li>
                  Os {pendingRestore.incoming.talent_progress} registros de progresso da origem serão aplicados sobre os registros automáticos.
                </li>
                <li>
                  {pendingRestore.incoming.talent_tree_apices} Ápices serão restaurados quando a coleção estiver presente na origem.
                </li>
                <li>
                  O nível global será restaurado quando estiver presente na origem; backups antigos preservarão o nível atual.
                </li>
              </ul>
            </div>

            <div
              style={{
                marginTop: '16px',
                padding: '13px',
                borderRadius: '8px',
                background: 'rgba(197, 138, 54, .10)',
                fontSize: '13px',
                lineHeight: 1.6,
              }}
            >
              <strong>Atenção:</strong>

              <ul style={{ paddingLeft: '18px', margin: '7px 0 0' }}>
                <li>
                  A operação substitui a progressão global, não apenas a
                  progressão de um usuário.
                </li>

                <li>
                  Talentos sem registro de pontos na origem receberão zero
                  pontos.
                </li>

                <li>
                  O histórico administrativo poderá receber novos registros
                  referentes à operação.
                </li>

                <li>
                  O snapshot selecionado não será excluído pela restauração.
                </li>
              </ul>
            </div>

            {/* Botões do modal */}
            <footer
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '24px',
                paddingTop: '18px',
                borderTop: '1px solid #e8e1d5',
              }}
            >
              <button
                type="button"
                onClick={() => setPendingRestore(null)}
                disabled={busy}
                style={{
                  minWidth: '112px',
                  height: '42px',
                  padding: '0 18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #d8d0c2',
                  borderRadius: '7px',
                  background: '#fff',
                  color: '#596b78',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void confirmRestore()}
                disabled={busy}
                style={{
                  minWidth: '210px',
                  height: '42px',
                  padding: '0 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '9px',
                  border: '1px solid #315d7a',
                  borderRadius: '7px',
                  background: busy ? '#6f91a8' : '#315d7a',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.85 : 1,
                  whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 5px rgba(49, 93, 122, 0.18)'
                }}
              >
                <RotateCcw
                  size={15}
                  style={{
                    flexShrink: 0,
                    animation: busy ? 'spin 1s linear infinite' : 'none',
                  }}
                />

                <span>
                  {busy ? 'Restaurando...' : 'Confirmar e restaurar'}
                </span>
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  )
}