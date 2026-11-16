import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  BookOpen,
  Eye,
  GripVertical,
  ArrowUpDown,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Sparkles,
  Crown,
  X,
} from 'lucide-react'

import type { Tree } from '../../types/tree'
import { supabase } from '../../lib/supabase'
import { trees } from '../../data/trees'
import TalentEffectsEditor, { type TalentEffectsEditorHandle } from '../../components/TalentEffectsEditor'

type Talent = {
  id: string
  tree_key: string
  name: string
  icon_url: string | null
  description: string | null
  max_level: number
  points_per_level: number
  is_hidden: boolean
  is_supreme: boolean
  supreme_stars: 2 | 3
  supreme_unlocked: boolean
  is_manually_locked?: boolean
  requirements_met?: boolean
  sort_order: number
  analyses_required: number
  analyses_completed: number
  current_points: number
}

type PrerequisiteTalent = Pick<
  Talent,
  'id' | 'name' | 'tree_key' | 'max_level' | 'is_hidden'
>

type TalentPrerequisite = {
  talent_id: string
  required_points: number
  prerequisite: PrerequisiteTalent | null
}

type TalentTreeRequirement = {
  talent_id: string
  required_tree_key: string
  required_points: number
}

type TalentWithPrerequisites = Talent & {
  prerequisites: TalentPrerequisite[]
  treeRequirements: TalentTreeRequirement[]
}

type TalentForm = {
  tree_key: string
  name: string
  icon_url: string
  description: string
  max_level: number
  points_per_level: number
  is_hidden: boolean
  supreme_stars: 2 | 3
  supreme_unlocked: boolean
  is_manually_locked: boolean
  analyses_required: number
  analyses_completed: number
  prerequisites: Array<{
    prerequisite_talent_id: string
    required_points: number
  }>
  treeRequirements: Array<{
    required_tree_key: string
    required_points: number
  }>
}

type DependentTalent = {
  id: string
  name: string
  points: number
}

type TalentProgress = {
  talent_id: string
  points: number
}

type TreeApex = {
  tree_key: string
  name: string
  icon_url: string | null
  required_points: number
  description: string | null
  is_available: boolean
  is_revealed: boolean
  is_unlocked: boolean
  is_hidden: boolean
  is_manually_locked: boolean
  current_points: number
  unlocked_at?: string | null
}

export type ProgressChangeItem =
  | { kind: 'talent'; id: string; name: string; is_supreme: boolean; points: number }
  | { kind: 'apex'; tree_key: string }

export type DeletedTalentInfo = { id: string; name: string; is_supreme: boolean }

type TalentTreeProps = {
  tree: Tree
  isAdmin: boolean
  totalAvailable: number
  totalDistributed: number
  refreshKey?: number
  focusTalentId?: string | null
  onFocusTalentHandled?: () => void
  onProgressChanged: (
    treeId: string,
    previousPoints: number,
    updatedPoints: number,
    item?: ProgressChangeItem,
  ) => void
  onTalentDeleted: (
    treeId: string,
    removedPoints: number,
    wasActive: boolean,
    talent?: DeletedTalentInfo,
  ) => void
}

const regularTrees = trees.filter((t) => t.id !== 'supremo')

const emptyForm: TalentForm = {
  tree_key: 'vitalidade',
  name: '',
  icon_url: '',
  description: '',
  max_level: 1,
  points_per_level: 1,
  is_hidden: false,
  supreme_stars: 2,
  supreme_unlocked: false,
  is_manually_locked: false,
  analyses_required: 0,
  analyses_completed: 0,
  prerequisites: [],
  treeRequirements: [],
}

const pointButtonStyle = {
  width: '31px',
  height: '31px',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid #e4dfd4',
  borderRadius: '6px',
  background: '#fbfaf7',
  color: '#64788a',
  cursor: 'pointer',
} as const

const errorAlertStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '9px',
  margin: '12px 0',
  padding: '11px 14px',
  border: '1px solid #e7b7b3',
  borderRadius: '7px',
  background: '#fbe9e7',
  color: '#a13f39',
  fontSize: '11px',
  lineHeight: 1.55,
} as const

const dangerButtonStyle = {
  minHeight: '38px',
  padding: '0 15px',
  border: '1px solid #a9544d',
  borderRadius: '6px',
  background: '#a9544d',
  color: '#fff',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '11px',
} as const

const requirementBadgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  width: 'fit-content',
  marginTop: '6px',
  padding: '4px 7px',
  border: '1px solid #e6dcc8',
  borderRadius: '4px',
  background: '#f5f0e6',
  color: '#8b7652',
  fontSize: '8px',
  fontWeight: 700,
  letterSpacing: '.55px',
  lineHeight: 1,
} as const

function treeName(treeKey: string) {
  if (treeKey === 'supremo') return 'Talento Supremo'

  return trees.find((t) => t.id === treeKey)?.name ?? treeKey
}

const TALENTS_PER_PAGE = 10

const treeLearningGuides: Record<string, { intro: string; focus: string; examples: string[]; note: string }> = {'vitalidade': {'intro': 'Bem-vindo à árvore de Vitalidade. Aqui, Raziel desenvolve o vigor do corpo, sua capacidade de sobreviver, recuperar-se e manter suas funções mesmo diante de condições extremas.', 'focus': 'Procure sinais de resistência biológica, recuperação acelerada, regeneração de tecidos, metabolismo incomum e adaptação a necessidades físicas.', 'examples': ['Trolls e outras criaturas capazes de regenerar ferimentos.', 'Hidras e monstros cuja anatomia demonstra recuperação ou recomposição extraordinária.', 'Criaturas adaptadas a sobreviver sem alimento, água ou repouso por períodos incomuns.', 'Itens mágicos que restauram vitalidade ou concedem regeneração, como um Anel de Regeneração.'], 'note': 'Atenção especial a criaturas que recuperam partes do corpo, resistem à exaustão física ou continuam funcionando após ferimentos severos.'}, 'resistencia': {'intro': 'Bem-vindo à árvore de Resistência. Esta árvore representa a capacidade de suportar agressões, danos e condições que seriam perigosas ou fatais para outros seres.', 'focus': 'Investigue defesas naturais ou sobrenaturais: carapaças, couraças, imunidades, resistência a elementos, venenos, doenças e ambientes extremos.', 'examples': ['Golems e construtos com corpos extremamente resistentes.', 'Dragões e elementais associados a tipos específicos de dano.', 'Criaturas venenosas ou imunes a doenças e condições debilitantes.', 'Itens mágicos defensivos, como anéis, mantos ou armaduras que concedem resistência a determinados danos.', 'Poções e artefatos que protegem contra fogo, frio, veneno ou outros perigos.'], 'note': 'Uma criatura não precisa ser resistente a tudo: uma defesa muito específica também pode revelar conhecimento relevante.'}, 'movimento': {'intro': 'Bem-vindo à árvore de Movimento. Aqui, Raziel busca compreender formas extraordinárias de locomoção e domínio do espaço.', 'focus': 'Observe criaturas que correm, saltam, escalam, nadam, escavam, planam, voam ou atravessam distâncias de maneiras sobrenaturais.', 'examples': ['Grifos, águias gigantes, alguns tipos de monges... e dragões, por suas capacidades de voo.', 'Aranhas gigantes e criaturas escaladoras, por sua mobilidade em superfícies verticais.', 'Ankhegs e outros seres escavadores.', 'Criaturas aquáticas, como tritões e elementais da água.', 'Aranhas planares ou seres capazes de teleporte e deslocamento dimensional.', 'Itens mágicos como Botas Élficas, Botas de Velocidade, Botas Aladas ou itens que concedam escalada e deslocamento especial.'], 'note': 'O modo de deslocamento importa: estudar um ser que voa pode oferecer pistas diferentes de estudar um que escava ou se teleporta.'}, 'ataque': {'intro': 'Bem-vindo à árvore de Ataque. Esta árvore reúne o conhecimento necessário para transformar o corpo e suas capacidades ofensivas em instrumentos de combate.', 'focus': 'Analise anatomias especializadas em atacar(melvis): garras, presas, chifres, caudas, ferrões, venenos, sopros e outras formas naturais ou mágicas de causar dano.', 'examples': ['Lobos, ursos e grandes felinos, por suas garras e mordidas.', 'Escorpiões gigantes e mantícoras, por ferrões e ataques à distância.', 'Dragões, por seus sopros e ataques elementais.', 'Criaturas com caudas, chifres, espinhos ou armas naturais incomuns.', 'Armas mágicas e artefatos que manifestem energia elemental ou ampliem ataques físicos.'], 'note': 'Dê preferência a observar como a criatura ataca, quais partes do corpo utiliza e se seus ataques carregam propriedades especiais.'}, 'mente': {'intro': 'Bem-vindo à árvore de Mente. Aqui, Raziel investiga capacidades intelectuais, memória, concentração, raciocínio e percepção estratégica.', 'focus': 'Busque seres com inteligência extraordinária, memória incomum, poderes psíquicos, disciplina mental ou capacidade de influenciar pensamentos.', 'examples': ['Devoradores de intelecto e devoradores de mentes, por suas capacidades psíquicas.', 'Esfinges, dragões antigos e outras criaturas de intelecto excepcional.', 'Aberrações com telepatia, memória ancestral ou domínio mental.', 'Itens mágicos que aprimoram a inteligência ou preservam conhecimentos, como uma Tiara do Intelecto ou tomos de conhecimento.'], 'note': 'Nem toda criatura inteligente possui uma propriedade mental extraordinária. Procure manifestações concretas de memória, raciocínio, concentração ou poder psíquico.'}, 'magia': {'intro': 'Bem-vindo à árvore de Magia. Esta árvore representa o estudo da Trama, das auras mágicas e das formas de manipular, ampliar ou compreender efeitos arcanos.', 'focus': 'Analise fontes de magia inata, conjuração, manipulação elemental, encantamentos, abjurações e fenômenos mágicos persistentes.', 'examples': ['Magos, feiticeiros, liches e outras criaturas conjuradoras.', 'Beholders e dragões, por suas manifestações mágicas naturais.', 'Elementais e seres cuja existência esteja ligada a forças mágicas ou elementais.', 'Varinhas, cajados, grimórios, focos arcanos e outros itens que armazenem ou canalizem magia.', 'Locais de poder, fontes mágicas, portais e fenômenos ligados à Trama.'], 'note': 'A magia pode estar em uma criatura, em um objeto ou no próprio ambiente. Observe a origem e a natureza dos efeitos manifestados.'}, 'sentido': {'intro': 'Bem-vindo à árvore de Sentido. Aqui, Raziel estuda formas de percepção que ultrapassam os limites dos sentidos comuns.', 'focus': 'Investigue visão no escuro, audição e olfato aguçados, percepção de vibrações, detecção de magia, invisibilidade, ilusões e presença espiritual ou dimensional.', 'examples': ['Morcegos e criaturas que percebem o ambiente por ecos ou vibrações.', 'Lobos e outros predadores com olfato e audição extraordinários.', 'Morcegos, aranhas e monstros com percepção por vibração ou sentidos especiais.', 'Fantasmas e seres etéreos que percebem planos ou presenças invisíveis.', 'Itens mágicos como Olhos de Águia, Olhos de Visão Verdadeira ou objetos que detectem magia e invisibilidade.'], 'note': 'Considere não apenas os sentidos físicos, mas também percepções mágicas, espirituais e planares.'}, 'alma': {'intro': 'Bem-vindo à árvore de Alma. Esta árvore investiga a essência espiritual, os vínculos entre corpo e alma e as forças que ultrapassam a existência física.', 'focus': 'Procure seres ligados aos mortos, espíritos, planos além do mundo material, possessão, drenagem de energia vital e projeção espiritual.', 'examples': ['Fantasmas, espectros, aparições e wraiths, por sua natureza incorpórea e espiritual.', 'Revenants e outras criaturas cuja existência esteja ligada à persistência da alma.', 'Liches e outros seres que prendem ou preservam a própria essência.', 'Criaturas capazes de possuir corpos, drenar energia vital ou atravessar o Plano Etéreo.', 'Itens e relíquias associados a almas, espíritos, possessão ou passagem entre planos.'], 'note': 'Nem todo morto-vivo manifesta uma conexão espiritual relevante. Busque evidências de vínculo com almas, consciência após a morte ou interação com outros planos.'}}

export default function TalentTree({
  tree,
  isAdmin,
  totalAvailable,
  refreshKey = 0,
  focusTalentId,
  onFocusTalentHandled,
  onProgressChanged,
  onTalentDeleted,
}: TalentTreeProps) {
  const Icon = tree.icon
  const [currentPage, setCurrentPage] = useState(1)
  const [sortingMode, setSortingMode] = useState(false)
  const [draggedTalentId, setDraggedTalentId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [talents, setTalents] = useState<TalentWithPrerequisites[]>([])
  const [allPrerequisiteTalents, setAllPrerequisiteTalents] = useState<PrerequisiteTalent[]>([])
  const [treeDistributed, setTreeDistributed] = useState(0)
  const [selectedTalent, setSelectedTalent] =
    useState<TalentWithPrerequisites | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [updatingTalentId, setUpdatingTalentId] = useState<string | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [apex, setApex] = useState<TreeApex | null>(null)
  const [treeHelpOpen, setTreeHelpOpen] = useState(false)
  const [apexEditorOpen, setApexEditorOpen] = useState(false)
  const [apexDetailsOpen, setApexDetailsOpen] = useState(false)
  const [apexUnlockNotice, setApexUnlockNotice] = useState(false)
  const [apexSaving, setApexSaving] = useState(false)
  const hasLoadedTreeRef = useRef(false)
  const [apexForm, setApexForm] = useState({ name: '', icon_url: '', required_points: 0, description: '', is_revealed: false, is_unlocked: false, is_hidden: true, is_manually_locked: false })

  const [modalOpen, setModalOpen] = useState(false)
  const effectsEditorRef = useRef<TalentEffectsEditorHandle>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TalentForm>(emptyForm)
  const [prerequisiteSearch, setPrerequisiteSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const [deletingTalent, setDeletingTalent] = useState<Talent | null>(null)
  const [dependentTalents, setDependentTalents] = useState<DependentTalent[]>([])
  const [deletePoints, setDeletePoints] = useState(0)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<
    'all' | 'active' | 'inactive' | 'unknown'
  >('all')
  const [pointsFilter, setPointsFilter] = useState<'all' | 'with' | 'without' | 'unlocked' | 'locked'>('all')

  useEffect(() => {
    let cancelled = false

    async function loadTalents() {
      // Em atualizações silenciosas (pontos/reset), preserva a árvore visível.
      // O estado de carregamento global só aparece na primeira carga.
      if (!hasLoadedTreeRef.current) setLoading(true)
      setError(null)

      if (!supabase) {
        setError('A conexão com o banco de dados não está configurada.')
        setLoading(false)
        return
      }

      // A consulta administrativa não depende dos talentos da árvore aberta.
      // Disparamos ambas em paralelo para reduzir a primeira espera da página.
      const prerequisiteCandidatesPromise = isAdmin
        ? supabase
            .from('talents')
            .select('id, name, tree_key, max_level, is_hidden')
            .order('tree_key')
            .order('name')
        : Promise.resolve(null)

      const talentQueryPromise = supabase
        .from('talents_player_safe')
        .select(
          'id, tree_key, name, icon_url, description, max_level, points_per_level, is_hidden, is_supreme, supreme_stars, supreme_unlocked, analyses_required, analyses_completed, sort_order, created_at',
        )
        .eq('tree_key', tree.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      const [talentResult, prerequisiteCandidatesResult] = await Promise.all([
        talentQueryPromise,
        prerequisiteCandidatesPromise,
      ])
      const talentData = talentResult.data
      const talentError = talentResult.error

      if (cancelled) return

      if (talentError) {
        console.error('Erro ao carregar talentos:', talentError.message)
        setError('Não foi possível carregar os talentos desta árvore.')
        setLoading(false)
        return
      }

      const loadedTalents = (talentData ?? []) as Omit<
        Talent,
        'current_points'
      >[]

      // Pré-requisitos podem pertencer a qualquer árvore, não apenas à aberta.
      if (isAdmin) {
        if (prerequisiteCandidatesResult?.error) {
          console.error('Erro ao carregar talentos para pré-requisitos:', prerequisiteCandidatesResult.error.message)
        } else {
          setAllPrerequisiteTalents((prerequisiteCandidatesResult?.data ?? []) as PrerequisiteTalent[])
        }
      } else {
        setAllPrerequisiteTalents([])
      }

      const talentIds = loadedTalents.map((talent) => talent.id)

      const [
        prerequisiteResult,
        treeRequirementResult,
        progressResult,
        treeProgressResult,
        apexResult,
        rawApexResult,
      ] = await Promise.all([
        supabase
          .from('talent_prerequisites_safe')
          .select('talent_id, prerequisite_talent_id, required_points, prerequisite_name, prerequisite_tree_key, prerequisite_is_hidden')
          .in('talent_id', talentIds),

        supabase
          .from('talent_tree_requirements_safe')
          .select('talent_id, required_tree_key, required_points')
          .in('talent_id', talentIds),

        supabase
          .from('talent_progress_safe')
          .select('talent_id, points'),
        supabase.from('talent_tree_progress_safe').select('tree_key, total_points'),
        supabase.rpc('get_talent_tree_apex_for_player', { p_tree_key: tree.id }),
        isAdmin
          ? supabase
              .from('talent_tree_apices')
              .select('name, icon_url, description, required_points, is_hidden, is_unlocked, is_revealed, is_manually_locked, unlocked_at')
              .eq('tree_key', tree.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (cancelled) return

      if (prerequisiteResult.error) {
        console.error(
          'Erro ao carregar pré-requisitos:',
          prerequisiteResult.error.message,
        )
        setError(
          'Os talentos foram encontrados, mas não foi possível carregar seus pré-requisitos.',
        )
        setLoading(false)
        return
      }

      if (treeRequirementResult.error) {
        console.error(
          'Erro ao carregar requisitos por árvore:',
          treeRequirementResult.error.message,
        )
        setError(
          'Não foi possível carregar os requisitos de pontos por árvore.',
        )
        setLoading(false)
        return
      }

      if (treeProgressResult.error) {
        console.error('Erro ao carregar totais das árvores:', treeProgressResult.error.message)
        setError('Não foi possível verificar os pré-requisitos das habilidades supremas.')
        setLoading(false)
        return
      }

      if (apexResult.error) {
        console.error('Erro ao carregar o Ápice:', apexResult.error.message)
        setError('Não foi possível carregar o Ápice desta árvore. Execute a migração de Ápices no Supabase.')
        setLoading(false)
        return
      }

      let loadedApex = apexResult.data as TreeApex | null
      if (isAdmin && rawApexResult.error) {
        console.error('Erro ao carregar dados administrativos do Ápice:', rawApexResult.error.message)
      } else if (isAdmin && rawApexResult.data && loadedApex) {
        loadedApex = { ...loadedApex, ...rawApexResult.data } as TreeApex
      }
      setApex(loadedApex)
      if (loadedApex) {
        setApexForm({ name: loadedApex.name, icon_url: loadedApex.icon_url ?? '', required_points: Number(loadedApex.required_points ?? 0), description: loadedApex.description ?? '', is_revealed: Boolean(loadedApex.is_revealed), is_unlocked: Boolean(loadedApex.is_unlocked), is_hidden: Boolean(loadedApex.is_hidden), is_manually_locked: Boolean(loadedApex.is_manually_locked) })
      }

      if (progressResult.error) {
        console.error(
          'Erro ao carregar pontos da árvore:',
          progressResult.error.message,
        )
        setError(
          'Não foi possível carregar os pontos distribuídos nesta árvore.',
        )
        setLoading(false)
        return
      }

      const prerequisiteRows = prerequisiteResult.data ?? []
      const prerequisiteTalentIds = [
        ...new Set(prerequisiteRows.map((item) => item.prerequisite_talent_id)),
      ]

      const { data: prerequisiteTalentLevels, error: prerequisiteTalentLevelsError } =
        prerequisiteTalentIds.length > 0
          ? await supabase
              .from('talents')
              .select('id, max_level')
              .in('id', prerequisiteTalentIds)
          : { data: [], error: null }

      if (prerequisiteTalentLevelsError) {
        console.error(
          'Erro ao carregar limites dos pré-requisitos:',
          prerequisiteTalentLevelsError.message,
        )
        setError('Não foi possível carregar os limites de nível dos pré-requisitos.')
        setLoading(false)
        return
      }

      const maxLevelByPrerequisite = new Map(
        (prerequisiteTalentLevels ?? []).map((talent) => [
          talent.id,
          Number(talent.max_level ?? 1),
        ]),
      )

      const loadedPrerequisites: TalentPrerequisite[] = prerequisiteRows.map((item) => ({
        talent_id: item.talent_id,
        required_points: Number(item.required_points),
        prerequisite: {
          id: item.prerequisite_talent_id,
          name: item.prerequisite_name,
          tree_key: item.prerequisite_tree_key,
          max_level: maxLevelByPrerequisite.get(item.prerequisite_talent_id) ?? 1,
          is_hidden: item.prerequisite_is_hidden,
        },
      }))

      const loadedTreeRequirements =
        (treeRequirementResult.data ?? []) as TalentTreeRequirement[]

      const loadedProgress = (progressResult.data ?? []) as TalentProgress[]

      const progressByTalent = new Map(
        loadedProgress.map((progress) => [
          progress.talent_id,
          Number(progress.points),
        ]),
      )

      const treePointsByKey = new Map((treeProgressResult.data ?? []).map((row) => [row.tree_key, Number(row.total_points)]))
      const talentsWithPrerequisites: TalentWithPrerequisites[] =
        loadedTalents.map((talent) => {
          // supreme_unlocked é a fonte de verdade para a visibilidade das Supremas.
          const visibleTalent = talent.is_supreme && talent.supreme_unlocked
            ? { ...talent, is_hidden: false }
            : talent
          const prerequisites = loadedPrerequisites.filter((item) => item.talent_id === talent.id)
          const treeRequirements = loadedTreeRequirements.filter((item) => item.talent_id === talent.id)
          const requirementsMet = prerequisites.every((item) =>
            (progressByTalent.get(item.prerequisite?.id ?? '') ?? 0) >= Number(item.required_points)
          ) && treeRequirements.every((item) =>
            (treePointsByKey.get(item.required_tree_key) ?? 0) >= Number(item.required_points)
          )
          return {
            ...visibleTalent,
            current_points: progressByTalent.get(talent.id) ?? 0,
            prerequisites,
            treeRequirements,
            requirements_met: requirementsMet,
          }
        })

      const costByTalent = new Map(loadedTalents.map((talent) => [talent.id, talent.is_supreme ? 0 : Number(talent.points_per_level ?? 1)]))
      // O resumo desta página deve considerar somente talentos pertencentes a esta árvore.
      // Antes, progressos de outras árvores eram somados pelo fallback de custo 1.
      const distributedInTree = loadedProgress.reduce((sum, progress) => {
        const cost = costByTalent.get(progress.talent_id)
        return cost === undefined ? sum : sum + Number(progress.points) * cost
      }, 0)

      setTalents(talentsWithPrerequisites)
      setTreeDistributed(distributedInTree + Number(loadedApex?.current_points ?? 0))
      hasLoadedTreeRef.current = true
      setLoading(false)
    }

    void loadTalents()

    return () => {
      cancelled = true
    }
  }, [tree.id, reloadKey, refreshKey, isAdmin])

  useEffect(() => {
    if (!selectedTalent && !modalOpen && !deletingTalent && !treeHelpOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving && !deleteLoading) {
        setSelectedTalent(null)
        setModalOpen(false)
        setDeletingTalent(null)
        setTreeHelpOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTalent, modalOpen, deletingTalent, treeHelpOpen, saving, deleteLoading])

  function openTalent(talent: TalentWithPrerequisites) {
    if (talent.is_hidden) return
    setSelectedTalent(talent)
  }

  useEffect(() => {
    if (!focusTalentId || loading) return
    const talent = talents.find((item) => item.id === focusTalentId)
    if (talent) {
      setSelectedTalent(talent)
      onFocusTalentHandled?.()
    }
  }, [focusTalentId, loading, talents, onFocusTalentHandled])

  function notifyApexUnlockOnce(nextApex: TreeApex) {
    if (!nextApex.is_unlocked || nextApex.is_hidden || !nextApex.unlocked_at) return
    // Ápices comuns com requisito zero já nascem disponíveis e não representam
    // uma conquista de progressão a ser anunciada.
    if (tree.id !== 'supremo' && Number(nextApex.required_points) <= 0) return
    // unlocked_at identifica a transição real bloqueado -> desbloqueado.
    // Assim, um Ápice já liberado antes desta migration não gera aviso falso,
    // e um novo desbloqueio após reset gera um evento diferente em cada browser.
    const key = `raziel:seen-apex-unlock:v3:${tree.id}:${nextApex.unlocked_at}`
    try {
      if (window.localStorage.getItem(key) === '1') return
      window.localStorage.setItem(key, '1')
    } catch { /* armazenamento indisponível: evita duplicação nesta sessão */ }
    setApexUnlockNotice(true)
  }

  useEffect(() => {
    if (apex) notifyApexUnlockOnce(apex)
  }, [apex, tree.id])

  async function changeTalentPoints(
    talent: TalentWithPrerequisites,
    delta: 1 | -1,
  ) {
    if (!supabase || updatingTalentId) return

    if (delta === 1 && totalAvailable < talent.points_per_level) {
      setProgressMessage(`São necessários ${talent.points_per_level} pontos para evoluir esta habilidade.`)
      return
    }

    if (delta === 1 && talent.current_points >= talent.max_level) return
    if (delta === -1 && talent.current_points <= 0) return

    setUpdatingTalentId(talent.id)
    setProgressMessage(null)

    const { data, error } = await supabase.rpc('change_talent_points', {
      p_talent_id: talent.id,
      p_delta: delta,
    })

    if (error) {
      console.error('Erro ao alterar pontos do talento:', error.message)

      const databaseMessage = error.message || ''

      const friendlyMessage = databaseMessage.includes(
        'Não é possível remover estes pontos',
      )
        ? 'Não é possível remover estes pontos: outro talento ativo depende deles.'
        : databaseMessage.includes(
          'Os pré-requisitos deste talento não foram atendidos',
        )
          ? 'Os pré-requisitos deste talento não foram atendidos.'
          : databaseMessage ||
          'Não foi possível alterar os pontos deste talento.'

      setProgressMessage(friendlyMessage)
      setUpdatingTalentId(null)
      return
    }

    const updatedPoints = Number(data)

    if (!Number.isInteger(updatedPoints) || updatedPoints < 0) {
      setProgressMessage(
        'O banco retornou um valor de progressão inválido. Atualize a árvore.',
      )
      setUpdatingTalentId(null)
      setReloadKey((current) => current + 1)
      return
    }

    const previousPoints = talent.current_points

    setTalents((current) =>
      current.map((item) =>
        item.id === talent.id
          ? { ...item, current_points: updatedPoints }
          : item,
      ),
    )

    const previousCost = previousPoints * talent.points_per_level
    const updatedCost = updatedPoints * talent.points_per_level
    setTreeDistributed((current) => current + (updatedCost - previousCost))

    setSelectedTalent((current) =>
      current?.id === talent.id
        ? { ...current, current_points: updatedPoints }
        : current,
    )

    onProgressChanged(tree.id, previousCost, updatedCost, {
      kind: 'talent',
      id: talent.id,
      name: talent.name,
      is_supreme: talent.is_supreme,
      points: updatedPoints,
    })

    // O trigger AFTER UPDATE de talent_progress já executa a sincronização
    // dentro da mesma transação do RPC change_talent_points. Não a chamamos
    // novamente aqui: isso duplicaria trabalho no banco e aumentaria a latência.
    // Consultamos somente o Ápice desta árvore após o RPC retornar.
    if (apex) {
      const { data: refreshedApex } = await supabase.rpc(
        'get_talent_tree_apex_for_player',
        { p_tree_key: tree.id },
      )
      if (refreshedApex) {
        const nextApex = refreshedApex as TreeApex
        if (!apex.is_unlocked && nextApex.is_unlocked) notifyApexUnlockOnce(nextApex)
        setApex(nextApex)
      }
    }

    setUpdatingTalentId(null)
  }

  async function changeApexPoints(delta: 1 | -1) {
    if (!supabase || !apex || updatingTalentId) return
    if (delta === 1 && (apex.is_hidden || !apex.is_unlocked || (tree.id === 'supremo' ? !supremeApexEligible : treeDistributed - apex.current_points < apex.required_points))) { setProgressMessage('O Ápice ainda não atende às condições para receber pontos.'); return }
    if (delta === 1 && totalAvailable <= 0) { setProgressMessage('Não há pontos disponíveis para distribuir.'); return }
    setUpdatingTalentId('apex')
    const { data, error } = await supabase.rpc('change_talent_tree_apex_points', { p_tree_key: tree.id, p_delta: delta })
    if (error) { setProgressMessage(error.message || 'Não foi possível alterar os pontos do Ápice.'); setUpdatingTalentId(null); return }
    const updated = Number(data)
    setApex((current) => current ? { ...current, current_points: updated } : current)
    setTreeDistributed((current) => current + delta)
    onProgressChanged(tree.id, delta === 1 ? 0 : 1, updated, {
      kind: 'apex',
      tree_key: tree.id,
    })
    setUpdatingTalentId(null)
  }

  async function saveApex() {
    if (!supabase || !isAdmin) return
    let apexName = apexForm.name.trim()
    if (!apexName || apexName === '???') {
      const { data: originalApex, error: originalApexError } = await supabase
        .from('talent_tree_apices')
        .select('name')
        .eq('tree_key', tree.id)
        .maybeSingle()
      if (originalApexError || !originalApex?.name || originalApex.name === '???') {
        setProgressMessage('Não foi possível recuperar o nome original do Ápice. Nenhuma alteração foi salva.')
        return
      }
      apexName = originalApex.name
    }
    if (tree.id !== 'supremo' && (!Number.isInteger(apexForm.required_points) || apexForm.required_points < 0)) { setProgressMessage('A quantidade de pontos deve ser um inteiro igual ou maior que zero.'); return }
    setApexSaving(true)
    const { error } = await supabase.from('talent_tree_apices').upsert({
      tree_key: tree.id, name: apexName, icon_url: apexForm.icon_url.trim() || null,
      required_points: tree.id === 'supremo' ? 0 : apexForm.required_points,
      description: apexForm.description.trim(),
      is_revealed: !apexForm.is_hidden && apexForm.is_unlocked,
      is_unlocked: Boolean(apexForm.is_unlocked),
      // Ápices comuns são desbloqueados exclusivamente pela pontuação da árvore.
      // A trava manual continua disponível apenas para o Ápice Supremo.
      is_manually_locked: tree.id === 'supremo' && Boolean(apexForm.is_manually_locked),
      is_hidden: Boolean(apexForm.is_hidden || !apexForm.is_unlocked),
    }, { onConflict: 'tree_key' })
    if (error) { setProgressMessage(error.message || 'Não foi possível salvar o Ápice.'); setApexSaving(false); return }
    const { data, error: reloadError } = await supabase.rpc('get_talent_tree_apex_for_player', { p_tree_key: tree.id })
    if (reloadError) setProgressMessage(reloadError.message)
    const savedApex = data as TreeApex | null
    if (savedApex && !apex?.is_unlocked && savedApex.is_unlocked) notifyApexUnlockOnce(savedApex)
    setApex(savedApex ? { ...savedApex, is_manually_locked: Boolean(apexForm.is_manually_locked) } : null)
    setApexSaving(false)
    setApexEditorOpen(false)
  }

  async function openApexEditor() {
    let sourceApex = apex
    // O nome real vem sempre da tabela administrativa, nunca da view pública
    // que pode mascarar Ápices ocultos como "???".
    if (supabase && isAdmin) {
      const { data: rawApex, error: rawApexError } = await supabase
        .from('talent_tree_apices')
        .select('name, icon_url, description, required_points, is_hidden, is_unlocked, is_revealed, is_manually_locked, unlocked_at')
        .eq('tree_key', tree.id)
        .maybeSingle()
      if (rawApexError) {
        setProgressMessage(`Não foi possível carregar os dados originais do Ápice: ${rawApexError.message}`)
      } else if (rawApex) {
        sourceApex = { ...(sourceApex ?? {} as TreeApex), ...rawApex } as TreeApex
      }
    }
    setApexForm({
      name: sourceApex?.name && sourceApex.name !== '???' ? sourceApex.name : '',
      icon_url: sourceApex?.icon_url ?? '',
      required_points: Number(sourceApex?.required_points ?? 0),
      description: sourceApex?.description ?? '',
      is_revealed: Boolean(sourceApex?.is_revealed),
      is_unlocked: Boolean(sourceApex?.is_unlocked),
      is_hidden: sourceApex ? Boolean(sourceApex.is_hidden) : true,
      is_manually_locked: sourceApex ? Boolean(sourceApex.is_manually_locked) : false,
    })
    setApexEditorOpen(true)
  }

  const availablePrerequisites = allPrerequisiteTalents.filter((talent) => {
    if (talent.id === editingId) return false
    const normalizedSearch = prerequisiteSearch
      .trim()
      .toLocaleLowerCase('pt-BR')
    return (
      !normalizedSearch ||
      talent.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
    )
  })

  async function openEdit(talent: TalentWithPrerequisites) {
    if (!isAdmin || !supabase) return

    setSelectedTalent(null)
    setError('')
    setProgressMessage('')

    const [
      talentRecordResult,
      prerequisiteResult,
      treeRequirementResult,
    ] = await Promise.all([
      // A view pública mascara nomes de talentos ocultos. O editor é administrativo
      // e deve sempre carregar o nome original armazenado, nunca "???".
      supabase
        .from('talents')
        .select('id, name, icon_url, description, is_hidden, supreme_unlocked, is_manually_locked')
        .eq('id', talent.id)
        .single(),

      supabase
        .from('talent_prerequisites')
        .select('prerequisite_talent_id, required_points')
        .eq('talent_id', talent.id),

      supabase
        .from('talent_tree_requirements')
        .select('required_tree_key, required_points')
        .eq('talent_id', talent.id),
    ])

    if (talentRecordResult.error || prerequisiteResult.error || treeRequirementResult.error) {
      setError(
        `Não foi possível carregar os dados para edição: ${talentRecordResult.error?.message ?? prerequisiteResult.error?.message ??
        treeRequirementResult.error?.message
        }`,
      )
      return
    }

    if (!talent.is_supreme && talent.max_level < talent.current_points) {
      setError(
        `O nível máximo não pode ser menor que os ${talent.current_points} pontos já distribuídos neste talento.`,
      )
      return
    }

    setEditingId(talent.id)

    setForm({
      tree_key: talent.tree_key,
      name: talentRecordResult.data.name,
      icon_url: talentRecordResult.data.icon_url ?? '',
      description: talentRecordResult.data.description ?? '',
      max_level: talent.max_level,
      points_per_level: talent.points_per_level ?? 1,
      is_hidden: Boolean(talentRecordResult.data.is_hidden),
      supreme_stars: talent.supreme_stars ?? 2,
      supreme_unlocked: Boolean(talentRecordResult.data.supreme_unlocked ?? talent.supreme_unlocked),
      is_manually_locked: Boolean(talentRecordResult.data.is_manually_locked),
      analyses_required: talent.analyses_required ?? 0,
      analyses_completed: talent.analyses_completed ?? 0,

      prerequisites: (prerequisiteResult.data ?? []).map((item) => ({
        prerequisite_talent_id: item.prerequisite_talent_id,
        required_points: item.required_points,
      })),

      treeRequirements: (treeRequirementResult.data ?? []).map(
        (item) => ({
          required_tree_key: item.required_tree_key,
          required_points: item.required_points,
        }),
      ),
    })

    setPrerequisiteSearch('')
    setModalOpen(true)
  }

  function updateForm<K extends keyof TalentForm>(
    key: K,
    value: TalentForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function togglePrerequisite(
    talentId: string,
    checked: boolean,
  ) {
    setForm((current) => ({
      ...current,

      prerequisites: checked
        ? [
          ...current.prerequisites,
          {
            prerequisite_talent_id: talentId,
            required_points: 1,
          },
        ]
        : current.prerequisites.filter(
          (item) => item.prerequisite_talent_id !== talentId,
        ),
    }))
  }

  function updatePrerequisitePoints(
    talentId: string,
    points: number,
  ) {
    setForm((current) => ({
      ...current,

      prerequisites: current.prerequisites.map((item) =>
        item.prerequisite_talent_id === talentId
          ? { ...item, required_points: points }
          : item,
      ),
    }))
  }

  function addTreeRequirement() {
    const usedTrees = form.treeRequirements.map(
      (item) => item.required_tree_key,
    )

    const nextTree = regularTrees.find(
      (t) => !usedTrees.includes(t.id),
    )

    if (!nextTree) return

    setForm((current) => ({
      ...current,

      treeRequirements: [
        ...current.treeRequirements,
        {
          required_tree_key: nextTree.id,
          required_points: 1,
        },
      ],
    }))
  }

  function updateTreeRequirement(
    index: number,
    key: 'required_tree_key' | 'required_points',
    value: string | number,
  ) {
    setForm((current) => ({
      ...current,

      treeRequirements: current.treeRequirements.map(
        (item, itemIndex) =>
          itemIndex === index
            ? { ...item, [key]: value }
            : item,
      ),
    }))
  }

  function removeTreeRequirement(index: number) {
    setForm((current) => ({
      ...current,

      treeRequirements: current.treeRequirements.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }))
  }

  async function handleSave(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!supabase || saving || !editingId) return

    const name = form.name.trim()
    const isSupreme = form.tree_key === 'supremo'
    const maxLevel = isSupreme ? 1 : Number(form.max_level)
    const pointsPerLevel = isSupreme ? 1 : Number(form.points_per_level)
    const iconUrl = form.icon_url.trim()

    const currentTalent = talents.find((t) => t.id === editingId)
    if (currentTalent && !currentTalent.is_supreme && maxLevel < currentTalent.current_points) {
      setError(
        `O nível máximo não pode ser menor que os ${currentTalent.current_points} pontos já distribuídos neste talento.`,
      )
      return
    }

    if (!name) {
      setError('Informe o nome do talento.')
      return
    }

    if (!Number.isInteger(maxLevel) || maxLevel < 1) {
      setError('O nível máximo deve ser um número inteiro maior que zero.')
      return
    }
    if (!Number.isInteger(pointsPerLevel) || pointsPerLevel < 1) {
      setError('O custo por nível deve ser um número inteiro maior que zero.')
      return
    }

    const analysesRequired = Number(form.analyses_required)
    const analysesCompleted = Number(form.analyses_completed)

    if (
      !Number.isInteger(analysesRequired) ||
      analysesRequired < 0 ||
      !Number.isInteger(analysesCompleted) ||
      analysesCompleted < 0
    ) {
      setError('As quantidades de análises devem ser números inteiros iguais ou maiores que zero.')
      return
    }

    if (iconUrl && !/^https?:\/\/.+/i.test(iconUrl)) {
      setError('Informe uma URL válida para a imagem do ícone.')
      return
    }

    if (
      form.prerequisites.some(
        (item) =>
          !Number.isInteger(item.required_points) ||
          item.required_points < 1,
      )
    ) {
      setError(
        'Todos os pré-requisitos devem exigir pelo menos 1 ponto.',
      )
      return
    }

    if (
      form.treeRequirements.some(
        (item) =>
          !Number.isInteger(item.required_points) ||
          item.required_points < 1,
      )
    ) {
      setError(
        'Todos os requisitos por árvore devem exigir pelo menos 1 ponto.',
      )
      return
    }

    if (
      new Set(
        form.treeRequirements.map(
          (item) => item.required_tree_key,
        ),
      ).size !== form.treeRequirements.length
    ) {
      setError('Não é possível adicionar a mesma árvore mais de uma vez.')
      return
    }

    setSaving(true)
    setError('')
    setProgressMessage('')

    const payload = {
      tree_key: form.tree_key,
      name,
      icon_url: iconUrl,
      description: form.description.trim(),
      max_level: maxLevel,
      points_per_level: pointsPerLevel,
      is_hidden: isSupreme ? !form.supreme_unlocked : form.is_hidden,
      is_supreme: isSupreme,
      supreme_stars: isSupreme ? form.supreme_stars : 2,
      supreme_unlocked: isSupreme ? form.supreme_unlocked : false,
      is_manually_locked: isSupreme ? form.is_manually_locked : false,
      analyses_required: form.is_hidden && form.tree_key !== 'supremo' ? analysesRequired : 0,
      analyses_completed: form.is_hidden && form.tree_key !== 'supremo' ? analysesCompleted : 0,
    }

    const result = await supabase
      .from('talents')
      .update(payload)
      .eq('id', editingId)
      .select('id')
      .single()

    if (result.error || !result.data) {
      setError(
        `Não foi possível salvar o talento: ${result.error?.message ?? 'registro não retornado'
        }`,
      )
      setSaving(false)
      return
    }

    const talentId = result.data.id

    try {
      await effectsEditorRef.current?.save(talentId)
    } catch (effectError) {
      setError(`O talento foi atualizado, mas houve erro ao salvar seus efeitos: ${effectError instanceof Error ? effectError.message : 'erro desconhecido'}`)
      setSaving(false)
      setReloadKey((current) => current + 1)
      return
    }

    const {
      error: deletePrerequisitesError,
    } = await supabase
      .from('talent_prerequisites')
      .delete()
      .eq('talent_id', talentId)

    if (deletePrerequisitesError) {
      setError(
        `O talento foi salvo, mas não foi possível substituir os pré-requisitos: ${deletePrerequisitesError.message}`,
      )
      setSaving(false)
      setReloadKey((current) => current + 1)
      return
    }

    if (form.prerequisites.length > 0) {
      const {
        error: insertPrerequisitesError,
      } = await supabase
        .from('talent_prerequisites')
        .insert(
          form.prerequisites.map((item) => ({
            talent_id: talentId,
            prerequisite_talent_id:
              item.prerequisite_talent_id,
            required_points: item.required_points,
          })),
        )

      if (insertPrerequisitesError) {
        setError(
          `O talento foi salvo, mas houve erro ao registrar os pré-requisitos: ${insertPrerequisitesError.message}`,
        )
        setSaving(false)
        setReloadKey((current) => current + 1)
        return
      }
    }

    const {
      error: deleteTreeRequirementsError,
    } = await supabase
      .from('talent_tree_requirements')
      .delete()
      .eq('talent_id', talentId)

    if (deleteTreeRequirementsError) {
      setError(
        `O talento e os pré-requisitos foram salvos, mas não foi possível atualizar os requisitos por árvore: ${deleteTreeRequirementsError.message}`,
      )
      setSaving(false)
      setReloadKey((current) => current + 1)
      return
    }

    if (form.treeRequirements.length > 0) {
      const {
        error: insertTreeRequirementsError,
      } = await supabase
        .from('talent_tree_requirements')
        .insert(
          form.treeRequirements.map((item) => ({
            talent_id: talentId,
            required_tree_key: item.required_tree_key,
            required_points: item.required_points,
          })),
        )

      if (insertTreeRequirementsError) {
        setError(
          `O talento foi salvo, mas houve erro ao registrar os requisitos por árvore: ${insertTreeRequirementsError.message}`,
        )
        setSaving(false)
        setReloadKey((current) => current + 1)
        return
      }
    }

    setProgressMessage('Talento atualizado com sucesso.')
    setModalOpen(false)
    setSaving(false)
    setReloadKey((current) => current + 1)
  }

  async function openDeleteConfirmation(talent: TalentWithPrerequisites) {
    if (!supabase || !isAdmin) return

    setDeleteError('')
    setDependentTalents([])
    setDeletePoints(0)
    setDeletingTalent(talent)
    setDeleteLoading(true)

    const [
      { data: progress, error: progressError },
      { data: links, error: linksError },
    ] = await Promise.all([
      supabase
        .from('talent_progress')
        .select('points')
        .eq('talent_id', talent.id)
        .maybeSingle(),

      supabase
        .from('talent_prerequisites')
        .select('talent_id, required_points')
        .eq('prerequisite_talent_id', talent.id),
    ])

    if (progressError || linksError) {
      setDeleteError(
        `Não foi possível verificar os vínculos e pontos: ${progressError?.message ?? linksError?.message
        }`,
      )
      setDeleteLoading(false)
      return
    }

    setDeletePoints(Number(progress?.points ?? 0))

    const dependentIds = [
      ...new Set((links ?? []).map((item) => item.talent_id)),
    ]

    if (dependentIds.length > 0) {
      const [
        { data: dependentRows, error: dependentError },
        { data: progressRows, error: dependentProgressError },
      ] = await Promise.all([
        supabase
          .from('talents')
          .select('id, name, is_hidden')
          .in('id', dependentIds),

        supabase
          .from('talent_progress')
          .select('talent_id, points')
          .in('talent_id', dependentIds),
      ])

      if (dependentError || dependentProgressError) {
        setDeleteError(
          `Não foi possível verificar os talentos dependentes: ${dependentError?.message ??
          dependentProgressError?.message
          }`,
        )
        setDeleteLoading(false)
        return
      }

      const pointsById = new Map(
        (progressRows ?? []).map((row) => [
          row.talent_id,
          Number(row.points),
        ]),
      )

      setDependentTalents(
        (dependentRows ?? []).map((row) => ({
          id: row.id,
          name: row.is_hidden ? '???' : row.name,
          points: pointsById.get(row.id) ?? 0,
        })),
      )
    }

    setDeleteLoading(false)
  }

  async function confirmDeleteTalent() {
    if (
      !supabase ||
      !deletingTalent ||
      deleteLoading ||
      deleteError
    ) {
      return
    }

    setDeleteLoading(true)
    setDeleteError('')

    const target = deletingTalent
    const removedPoints = (target.current_points ?? 0) * target.points_per_level
    const wasActive = removedPoints > 0

    const { error: deleteErrorResult } = await supabase
      .from('talents')
      .delete()
      .eq('id', target.id)

    if (deleteErrorResult) {
      setDeleteError(
        `Não foi possível excluir o talento: ${deleteErrorResult.message}. Verifique se há vínculos no banco que impedem a exclusão.`,
      )
      setDeleteLoading(false)
      return
    }

    setTalents((current) => current.filter((item) => item.id !== target.id))
    setTreeDistributed((current) => Math.max(0, current - removedPoints))
    onTalentDeleted(tree.id, removedPoints, wasActive, {
      id: target.id,
      name: target.name,
      is_supreme: target.is_supreme,
    })

    setDeletingTalent(null)
    setDependentTalents([])
    setDeleteLoading(false)

    setProgressMessage(
      `“${target.is_hidden ? 'Talento oculto' : target.name}” foi excluído.`,
    )

    setReloadKey((current) => current + 1)
  }

  async function persistTalentOrder(orderedTalents: TalentWithPrerequisites[]) {
    if (!supabase || savingOrder) return
    setSavingOrder(true)
    setProgressMessage(null)

    const updates = await Promise.all(
      orderedTalents.map((talent, index) =>
        supabase!.from('talents').update({ sort_order: index + 1 }).eq('id', talent.id),
      ),
    )
    const failedUpdate = updates.find((result) => result.error)
    if (failedUpdate?.error) {
      setProgressMessage(`Não foi possível salvar a ordenação: ${failedUpdate.error.message}`)
      setSavingOrder(false)
      setReloadKey((current) => current + 1)
      return
    }

    setTalents(orderedTalents.map((talent, index) => ({ ...talent, sort_order: index + 1 })))
    setProgressMessage('Ordem dos talentos atualizada com sucesso.')
    setSavingOrder(false)
  }

  function handleTalentDrop(targetTalentId: string) {
    if (!draggedTalentId || draggedTalentId === targetTalentId || savingOrder) {
      setDraggedTalentId(null)
      return
    }
    const reordered = [...talents]
    const from = reordered.findIndex((item) => item.id === draggedTalentId)
    const to = reordered.findIndex((item) => item.id === targetTalentId)
    if (from < 0 || to < 0) { setDraggedTalentId(null); return }
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    setDraggedTalentId(null)
    void persistTalentOrder(reordered)
  }

  const normalizedSearch = searchTerm
    .trim()
    .toLocaleLowerCase('pt-BR')

  const supremeApexEligible = tree.id === 'supremo' && talents.length > 0 && talents.every((item) => item.is_supreme && item.supreme_unlocked && item.requirements_met === true)

  // O banco sincroniza os Ápices no trigger da alteração de pontos.
  // Não repetimos RPCs de escrita em um efeito React: isso criava chamadas
  // duplicadas durante a distribuição e aumentava a latência percebida.

  const filteredTalents = sortingMode ? talents : talents.filter((talent) => {
    const matchesFilter = tree.id === 'supremo'
      ? selectedFilter === 'all' ||
        (selectedFilter === 'active' && !talent.is_hidden && talent.requirements_met === true) ||
        (selectedFilter === 'inactive' && !talent.is_hidden && talent.requirements_met !== true) ||
        (selectedFilter === 'unknown' && talent.is_hidden)
      : selectedFilter === 'all' ||
        (selectedFilter === 'active' && !talent.is_hidden && talent.current_points > 0) ||
        (selectedFilter === 'inactive' && !talent.is_hidden && talent.current_points === 0) ||
        (selectedFilter === 'unknown' && talent.is_hidden)

    const matchesPoints = tree.id === 'supremo'
      ? pointsFilter === 'all' ||
        (pointsFilter === 'unlocked' && talent.supreme_unlocked && !talent.is_hidden) ||
        (pointsFilter === 'locked' && (!talent.supreme_unlocked || talent.is_hidden))
      : pointsFilter === 'all' ||
        (pointsFilter === 'with' && talent.current_points > 0) ||
        (pointsFilter === 'without' && talent.current_points === 0)

    const matchesSearch =
      normalizedSearch.length === 0 ||
      (!talent.is_hidden &&
        talent.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch))

    return matchesFilter && matchesPoints && matchesSearch
  })

  const totalPages = sortingMode ? 1 : Math.ceil(
    filteredTalents.length / TALENTS_PER_PAGE,
  )

  const safeCurrentPage = Math.min(
    currentPage,
    Math.max(totalPages, 1),
  )

  const startIndex = (safeCurrentPage - 1) * TALENTS_PER_PAGE

  const paginatedTalents = sortingMode
    ? filteredTalents
    : filteredTalents.slice(startIndex, startIndex + TALENTS_PER_PAGE)

  const firstVisibleTalent =
    filteredTalents.length > 0 ? startIndex + 1 : 0

  const lastVisibleTalent = Math.min(
    startIndex + TALENTS_PER_PAGE,
    filteredTalents.length,
  )

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage)
    }
  }, [currentPage, safeCurrentPage])

  return (
    <>
      <section className="page-heading tree-page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            ÁRVORE DE TALENTOS
          </div>

          <h1>{tree.name}</h1>
          <p>{tree.subtitle}.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isAdmin && (
            <button type="button" onClick={() => {
              setSortingMode((current) => !current)
              setSearchTerm('')
              setSelectedFilter('all')
              setPointsFilter('all')
              setCurrentPage(1)
              setDraggedTalentId(null)
            }} disabled={savingOrder || loading} aria-pressed={sortingMode}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', minHeight: '38px', padding: '0 12px', border: `1px solid ${sortingMode ? '#b9a47e' : '#e5e5e0'}`, borderRadius: '7px', background: sortingMode ? '#f2eee5' : 'rgba(255,255,255,.72)', color: sortingMode ? '#806d4c' : '#64788a', cursor: savingOrder ? 'wait' : 'pointer', font: 'inherit', fontSize: '10px', letterSpacing: '.4px', fontWeight: 700 }}>
              <ArrowUpDown size={14} />{sortingMode ? 'SAIR DA ORDENAÇÃO' : 'ORDENAÇÃO'}
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {tree.id !== 'supremo' && treeLearningGuides[tree.id] && (
              <button
                type="button"
                onClick={() => setTreeHelpOpen(true)}
                aria-label={`Ajuda sobre a árvore ${tree.name}`}
                title={`Sobre a árvore ${tree.name}`}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px solid #dfd5c2',
                  borderRadius: '50%',
                  background: '#fbf8f1',
                  color: '#927a54',
                  cursor: 'pointer',
                  transition: 'background .18s ease, border-color .18s ease, transform .18s ease',
                }}
                onMouseEnter={(event) => { event.currentTarget.style.background = '#f1eadc'; event.currentTarget.style.borderColor = '#bda77f' }}
                onMouseLeave={(event) => { event.currentTarget.style.background = '#fbf8f1'; event.currentTarget.style.borderColor = '#dfd5c2' }}
              >
                <CircleHelp size={17} strokeWidth={1.8} />
              </button>
            )}
            <div className="tree-page-icon"><Icon size={27} /></div>
          </div>
        </div>
      </section>

      {treeHelpOpen && treeLearningGuides[tree.id] && (
        <div
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setTreeHelpOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: '20px',
            background: 'rgba(25, 29, 34, .58)', backdropFilter: 'blur(4px)',
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="tree-guide-title"
            style={{
              position: 'relative', width: 'min(100%, 590px)', maxHeight: 'min(86vh, 760px)',
              overflowY: 'auto', border: '1px solid #d9c9a9', borderRadius: '16px',
              background: 'linear-gradient(155deg, #fffdf8 0%, #f7f2e8 100%)',
              boxShadow: '0 24px 80px rgba(0,0,0,.28)', color: '#39434a',
              padding: 'clamp(22px, 4vw, 34px)',
            }}
          >
            <div aria-hidden="true" style={{ position: 'absolute', top: '12px', left: '14px', color: '#b99d6e', fontSize: '19px', opacity: .8 }}>✧</div>
            <div aria-hidden="true" style={{ position: 'absolute', top: '12px', right: '14px', color: '#b99d6e', fontSize: '19px', opacity: .8 }}>✧</div>
            <button
              type="button"
              onClick={() => setTreeHelpOpen(false)}
              aria-label="Fechar ajuda"
              style={{
                position: 'absolute', top: '16px', right: '18px', width: '32px', height: '32px',
                display: 'grid', placeItems: 'center', border: '1px solid #e5dccb',
                borderRadius: '50%', background: 'rgba(255,255,255,.72)', color: '#7b817f',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '9px', padding: '3px 22px 20px' }}>
              <div style={{ width: '54px', height: '54px', display: 'grid', placeItems: 'center', border: '1px solid #d8c6a2', borderRadius: '50%', background: '#f2eadb', color: '#987b4e' }}>
                <Icon size={25} strokeWidth={1.6} />
              </div>
              <div style={{ color: '#a58a5e', fontSize: '9px', fontWeight: 800, letterSpacing: '2px' }}>GUIA DE DESCOBERTA · RAZIEL</div>
              <h2 id="tree-guide-title" style={{ margin: 0, color: '#35434a', fontFamily: 'Georgia, serif', fontSize: 'clamp(23px, 4vw, 29px)', fontWeight: 600 }}>
                Árvore de {tree.name}
              </h2>
              <div aria-hidden="true" style={{ width: '90px', height: '1px', background: 'linear-gradient(90deg, transparent, #b99d6e, transparent)' }} />
              <p style={{ margin: 0, maxWidth: '470px', color: '#59656a', fontSize: '13px', lineHeight: 1.75 }}>
                {treeLearningGuides[tree.id].intro}
              </p>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
              <div style={{ padding: '15px 17px', border: '1px solid #e7dece', borderRadius: '10px', background: 'rgba(255,255,255,.58)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', color: '#8c744f', fontSize: '10px', fontWeight: 800, letterSpacing: '1.1px' }}>
                  <Sparkles size={14} /> O QUE PROCURAR
                </div>
                <p style={{ margin: 0, color: '#536168', fontSize: '12px', lineHeight: 1.7 }}>{treeLearningGuides[tree.id].focus}</p>
              </div>

              <div style={{ padding: '15px 17px', border: '1px solid #e7dece', borderRadius: '10px', background: 'rgba(255,255,255,.58)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px', color: '#8c744f', fontSize: '10px', fontWeight: 800, letterSpacing: '1.1px' }}>
                  <BookOpen size={14} /> EXEMPLOS DE DESCOBERTA
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '7px', color: '#536168', fontSize: '12px', lineHeight: 1.65 }}>
                  {treeLearningGuides[tree.id].examples.map((example, index) => (
                    <li key={`${tree.id}-example-${index}`}>{example}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '12px 14px', borderLeft: '3px solid #b99d6e', borderRadius: '4px 8px 8px 4px', background: '#f0e9dc' }}>
                <CircleHelp size={15} style={{ flex: '0 0 auto', marginTop: '2px', color: '#987b4e' }} />
                <p style={{ margin: 0, color: '#6a655b', fontSize: '11px', lineHeight: 1.65 }}>{treeLearningGuides[tree.id].note}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '20px' }}>
              <button
                type="button"
                onClick={() => setTreeHelpOpen(false)}
                style={{ minHeight: '38px', padding: '0 24px', border: '1px solid #a88d60', borderRadius: '20px', background: '#8e7958', color: '#fffdf8', font: 'inherit', fontSize: '11px', fontWeight: 700, letterSpacing: '.4px', cursor: 'pointer' }}
              >
                ENTENDI
              </button>
            </div>
            <div aria-hidden="true" style={{ position: 'absolute', bottom: '10px', left: '14px', color: '#b99d6e', fontSize: '15px', opacity: .65 }}>❧</div>
            <div aria-hidden="true" style={{ position: 'absolute', bottom: '10px', right: '14px', color: '#b99d6e', fontSize: '15px', opacity: .65 }}>❧</div>
          </section>
        </div>
      )}

      <section className={`tree-summary${tree.id === 'supremo' ? ' supreme-tree-apex' : ''}`}>
        {tree.id === 'supremo' ? (
          <>
            <div>
              <span>HABILIDADES SUPREMAS EXISTENTES</span>
              <strong>{talents.filter((talent) => talent.is_supreme).length}</strong>
            </div>
            <div>
              <span>HABILIDADES SUPREMAS DESCOBERTAS</span>
              <strong>{talents.filter((talent) => talent.is_supreme && talent.supreme_unlocked).length}</strong>
            </div>
          </>
        ) : (
          <>
            <div><span>PONTOS DISPONÍVEIS</span><strong>{totalAvailable}</strong></div>
            <div><span>PONTOS DISTRIBUÍDOS NESTA ÁRVORE</span><strong>{treeDistributed}</strong></div>
          </>
        )}

        {(apex || isAdmin) && (
          <div className={`tree-apex-summary${tree.id === 'supremo' && apex?.is_unlocked && !apex.is_hidden ? ' tree-apex-unlocked-gold' : ''}`} style={{ marginLeft: 'auto' }}>
            {apex ? <>
              <button type="button" className="tree-apex-main" onClick={() => !apex.is_hidden ? setApexDetailsOpen(true) : undefined} disabled={apex.is_hidden}>
                <span className="tree-apex-emblem">{!apex.is_hidden && apex.icon_url ? <img src={apex.icon_url} alt="" /> : <Crown size={23} />}</span>
                <span className="tree-apex-copy">
                  <small>ÁPICE {apex.is_unlocked ? <span className="apex-gold-star">★</span> : null} {apex.is_hidden ? '· OCULTO' : ''}</small>
                  <strong>{apex.is_hidden ? '???' : apex.name}</strong>
                  <em>{tree.id === 'supremo' ? 'CONHECIMENTO PROIBIDO' : apex.is_unlocked && !apex.is_hidden ? `${Math.max(0, treeDistributed - apex.current_points)}/${apex.required_points} pontos distribuídos nesta árvore` : `Necessário distribuir ${Math.max(0, apex.required_points - (treeDistributed - apex.current_points))} pontos nesta árvore para desbloquear seu Ápice`}</em>
                </span>
              </button>
              {tree.id !== 'supremo' && apex.is_unlocked && !apex.is_hidden && (
                <div className="tree-apex-controls">
                  <button type="button" aria-label="Remover ponto do Ápice" disabled={apex.current_points <= 0 || updatingTalentId !== null} onClick={() => void changeApexPoints(-1)}><Minus size={15}/></button>
                  <button type="button" aria-label="Adicionar ponto ao Ápice" disabled={apex.current_points >= 1 || (tree.id === 'supremo' ? !supremeApexEligible : treeDistributed - apex.current_points < apex.required_points) || totalAvailable <= 0 || updatingTalentId !== null} onClick={() => void changeApexPoints(1)}><Plus size={15}/></button>
                </div>
              )}
            </> : <span className="tree-apex-copy"><small>ÁPICE</small><strong>Nenhum Ápice cadastrado</strong></span>}
            {isAdmin && <button type="button" className="tree-apex-edit" aria-label={apex ? 'Editar Ápice' : 'Criar Ápice'} onClick={openApexEditor}><Pencil size={15}/></button>}
          </div>
        )}
      </section>

      {apexUnlockNotice && apex && apex.is_unlocked && !apex.is_hidden && (
        <div className={`talent-modal-backdrop${tree.id === 'supremo' ? ' tree-apex-supreme-backdrop' : ''}`} role="presentation">
          <section className={`talent-modal tree-apex-modal${tree.id === 'supremo' ? ' tree-apex-supreme-notice' : ''}`} role="dialog" aria-modal="true" aria-labelledby="apex-unlock-notice-title" style={{ textAlign: 'center' }}>
            {tree.id === 'supremo' && (
              <div className="absolute-knowledge-aura" aria-hidden="true">
                <span className="absolute-knowledge-spark spark-1" />
                <span className="absolute-knowledge-spark spark-2" />
                <span className="absolute-knowledge-spark spark-3" />
                <span className="absolute-knowledge-spark spark-4" />
                <span className="absolute-knowledge-spark spark-5" />
                <span className="absolute-knowledge-spark spark-6" />
                <span className="absolute-knowledge-spark spark-7" />
                <span className="absolute-knowledge-spark spark-8" />
              </div>
            )}
            <div className="tree-apex-modal-icon">{apex.icon_url ? <img src={apex.icon_url} alt="" /> : <Crown size={30} />}</div>
            {tree.id === 'supremo' ? (
              <>
                <div className="eyebrow">CONHECIMENTO ABSOLUTO REVELADO</div>
                <h2 id="apex-unlock-notice-title">Você desbloqueou o conhecimento absoluto!</h2>
                <p>Tudo agora é possível, tudo. Cuidado.</p>
                <button type="button" className="talent-primary-button" onClick={() => { setApexUnlockNotice(false); setApexDetailsOpen(true) }}>EBAAA, QUERO CONFERIR</button>
              </>
            ) : (
              <>
                <div className="eyebrow">NOVO CONHECIMENTO DESBLOQUEADO</div>
                <h2 id="apex-unlock-notice-title">Você desbloqueou o ápice desta árvore.</h2>
                <p>Um novo patamar foi alcançado. Seu ápice está disponível para consulta.</p>
                <button type="button" className="talent-primary-button" onClick={() => { setApexUnlockNotice(false); setApexDetailsOpen(true) }}>Conferir Ápice</button>
              </>
            )}
          </section>
        </div>
      )}

      {apexDetailsOpen && apex && !apex.is_hidden && (
        <div className={`talent-modal-backdrop${tree.id === 'supremo' ? ' tree-apex-supreme-details-backdrop' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setApexDetailsOpen(false) }}>
          <section className={`talent-modal tree-apex-modal${tree.id === 'supremo' ? ' tree-apex-details-supreme' : ''}`} role="dialog" aria-modal="true" aria-labelledby="apex-details-title">
            <button type="button" className="talent-modal-close" onClick={() => setApexDetailsOpen(false)}><X size={18}/></button>
            <div className="tree-apex-modal-icon">{apex.icon_url ? <img src={apex.icon_url} alt=""/> : <Crown size={30}/>}</div>
            <div className="eyebrow">ÁPICE DA ÁRVORE</div>
            <h2 id="apex-details-title">{apex.name}</h2>
            <div className="talent-modal-section"><h3>Detalhes</h3><p>{apex.description || 'Nenhuma descrição foi cadastrada para este Ápice.'}</p></div>
            <div className="tree-apex-level">Nível {apex.current_points}/1</div>
          </section>
        </div>
      )}

      {apexEditorOpen && isAdmin && (
        <div className="talent-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !apexSaving) setApexEditorOpen(false) }}>
          <section className="talent-modal tree-apex-editor" role="dialog" aria-modal="true" aria-labelledby="apex-editor-title">
            <button type="button" className="talent-modal-close" onClick={() => setApexEditorOpen(false)} disabled={apexSaving}><X size={18}/></button>
            <div className="eyebrow">CONFIGURAÇÃO ADMINISTRATIVA</div>
            <h2 id="apex-editor-title">{apex ? 'Editar Ápice' : 'Criar Ápice'}</h2>
            <label>Nome<input value={apexForm.name} onChange={(e) => setApexForm(v => ({...v, name:e.target.value}))} placeholder="Nome do Ápice"/></label>
            <label>URL da imagem<input value={apexForm.icon_url} onChange={(e) => setApexForm(v => ({...v, icon_url:e.target.value}))} placeholder="https://..."/></label>
            {tree.id !== 'supremo' && <label>Pontos necessários nesta árvore<input type="number" min={0} step={1} value={apexForm.required_points} onChange={(e) => setApexForm(v => ({...v, required_points:Math.max(0, Number(e.target.value) || 0)}))}/></label>}
            <label>Descrição / detalhes<textarea rows={5} value={apexForm.description} onChange={(e) => setApexForm(v => ({...v, description:e.target.value}))} placeholder="Descreva o efeito do Ápice..."/></label>
            <label className="tree-apex-reveal-toggle"><input type="checkbox" checked={apexForm.is_unlocked} onChange={(e) => setApexForm(v => ({...v, is_unlocked:e.target.checked, is_revealed:e.target.checked, is_hidden:!e.target.checked, is_manually_locked:tree.id === 'supremo' && !e.target.checked}))}/> Desbloqueado</label>
            <label className="tree-apex-reveal-toggle"><input type="checkbox" checked={apexForm.is_hidden} onChange={(e) => setApexForm(v => ({...v, is_hidden:e.target.checked}))}/> Oculto</label>
            {tree.id === 'supremo' && <p className="apex-supreme-rule-note">O Ápice Supremo é desbloqueado automaticamente quando todas as Habilidades Supremas estiverem desbloqueadas e com os pré-requisitos alcançados. O administrador também pode bloquear ou desbloquear manualmente; um bloqueio manual impede o desbloqueio automático até ser removido.</p>}
            <div className="talent-modal-actions"><button type="button" onClick={() => setApexEditorOpen(false)} disabled={apexSaving}>Cancelar</button><button type="button" onClick={() => void saveApex()} disabled={apexSaving}>{apexSaving ? 'Salvando...' : 'Salvar Ápice'}</button></div>
          </section>
        </div>
      )}

      {progressMessage && (
        <div
          className="talent-progress-alert"
          role="status"
          style={
            progressMessage === 'Ordem dos talentos atualizada com sucesso.' ||
            progressMessage === 'Talento atualizado com sucesso.'
              ? {
                  ...errorAlertStyle,
                  border: '1px solid #bfdbfe',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                }
              : errorAlertStyle
          }
        >
          {progressMessage === 'Ordem dos talentos atualizada com sucesso.' ||
          progressMessage === 'Talento atualizado com sucesso.' ? (
            <CheckCircle2
              size={15}
              style={{ flexShrink: 0, marginTop: '1px' }}
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              size={15}
              style={{ flexShrink: 0, marginTop: '1px' }}
            />
          )}
          <span>{progressMessage}</span>
        </div>
      )}

      {loading && (
        <section className="tree-feedback">
          <span className="tree-loading-book" aria-hidden="true"><img src="/images/book-loading.gif" alt="" /></span>
          <h2>Folheando para encontrar a página correta...</h2>
          <p>Consultando os registros do Compendium.</p>
        </section>
      )}

      {!loading && error && (
        <section className="tree-feedback tree-feedback-error">
          <h2>Não foi possível carregar a árvore.</h2>
          <p>{error}</p>

          <button
            type="button"
            className="tree-retry-button"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            <RefreshCw size={15} />
            Tentar novamente
          </button>
        </section>
      )}

      {!loading && !error && talents.length === 0 && (
        <section className="empty-tree">
          <div className="empty-glyph">
            <BookOpen size={27} />
          </div>

          <h2>O conhecimento aguarda.</h2>

          <p>
            Os talentos desta árvore serão apresentados aqui conforme forem
            cadastrados no Compendium.
          </p>

          <span>ESTRUTURA DE TALENTOS EM PREPARAÇÃO</span>
        </section>
      )}

      {!loading && !error && talents.length > 0 && (
        <>
          {!sortingMode && <section
            className="talent-browser-controls"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '13px',
              margin: '25px 0 18px',
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minHeight: '44px',
                padding: '0 13px',
                border: '1px solid #e5e5e0',
                borderRadius: '8px',
                background: 'rgba(255,255,255,.72)',
                color: '#8c98a3',
              }}
            >
              <Search size={17} />

              <input
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Pesquisar talento pelo nome..."
                aria-label="Pesquisar talento pelo nome"
                style={{
                  width: '100%',
                  border: 0,
                  outline: 0,
                  background: 'transparent',
                  color: '#465565',
                  font: 'inherit',
                  fontSize: '12px',
                }}
              />

              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('')
                    setCurrentPage(1)
                  }}
                  aria-label="Limpar pesquisa"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    border: 0,
                    background: 'transparent',
                    color: '#8c98a3',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} />
                </button>
              )}
            </label>

            <div
              role="group"
              aria-label="Filtrar talentos"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {([
                { value: 'all', label: 'Todos' },
                { value: 'active', label: 'Ativo' },
                { value: 'inactive', label: 'Não ativo' },
                { value: 'unknown', label: 'Desconhecido' },
              ] as const).map((filter) => {
                const isSelected = selectedFilter === filter.value

                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedFilter(filter.value)
                      setCurrentPage(1)
                    }}
                    style={{
                      minHeight: '34px',
                      padding: '7px 13px',
                      border: `1px solid ${isSelected ? '#b9a47e' : '#e5e5e0'
                        }`,
                      borderRadius: '20px',
                      background: isSelected
                        ? '#f2eee5'
                        : 'rgba(255,255,255,.72)',
                      color: isSelected ? '#806d4c' : '#7d8993',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: '10px',
                      letterSpacing: '.2px',
                      transition: 'all .18s ease',
                    }}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>

            <div role="group" aria-label={tree.id === 'supremo' ? 'Filtrar descobertas supremas' : 'Filtrar por pontos distribuídos'} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#9aa1a6', fontSize: '9px', letterSpacing: '.5px', fontWeight: 700 }}>{tree.id === 'supremo' ? 'DESCOBERTAS:' : 'PONTOS:'}</span>
              {(tree.id === 'supremo'
                ? [
                    { value: 'all', label: 'Todas' },
                    { value: 'unlocked', label: 'Descobertas' },
                    { value: 'locked', label: 'Não descobertas' },
                  ] as const
                : [
                    { value: 'all', label: 'Qualquer quantidade' },
                    { value: 'with', label: 'Com pontos distribuídos' },
                    { value: 'without', label: 'Sem pontos distribuídos' },
                  ] as const).map((filter) => {
                const isSelected = pointsFilter === filter.value
                return <button key={filter.value} type="button" aria-pressed={isSelected} onClick={() => { setPointsFilter(filter.value); setCurrentPage(1) }} style={{ minHeight: '31px', padding: '6px 11px', border: `1px solid ${isSelected ? '#b9a47e' : '#e5e5e0'}`, borderRadius: '16px', background: isSelected ? '#f2eee5' : 'rgba(255,255,255,.72)', color: isSelected ? '#806d4c' : '#7d8993', cursor: 'pointer', font: 'inherit', fontSize: '9px', transition: 'all .18s ease' }}>{filter.label}</button>
              })}
              {(searchTerm || selectedFilter !== 'all' || pointsFilter !== 'all') && <button type="button" className="tree-retry-button" onClick={() => { setSearchTerm(''); setSelectedFilter('all'); setPointsFilter('all'); setCurrentPage(1) }}>Limpar filtros</button>}
            </div>

            <span
              style={{
                color: '#9aa1a6',
                fontSize: '10px',
                letterSpacing: '.3px',
              }}
            >
              Exibindo {firstVisibleTalent}–{lastVisibleTalent} de{' '}
              {filteredTalents.length} talentos
            </span>
          </section>}

          {sortingMode && <div style={{ margin: '18px 0', color: '#806d4c', fontSize: '11px' }}>
            {savingOrder ? 'Salvando nova ordem...' : 'Segure o ícone e arraste os talentos para definir a ordem de apresentação. Todos os talentos desta árvore estão visíveis.'}
          </div>}

          {filteredTalents.length > 0 ? (
            <section className="talent-tree-list">
              {paginatedTalents.map((talent) => {
                const isUpdating = updatingTalentId === talent.id
                const isAnyTalentUpdating = updatingTalentId !== null

                const hasRequirements =
                  talent.prerequisites.length > 0 ||
                  talent.treeRequirements.length > 0

                return (
                  <article
                    className="talent-tree-card talent-tree-card-clickable"
                    key={talent.id}
                    onDragOver={(event) => { if (sortingMode) event.preventDefault() }}
                    onDrop={(event) => { if (sortingMode) { event.preventDefault(); handleTalentDrop(talent.id) } }}
                    style={{ opacity: sortingMode && draggedTalentId === talent.id ? 0.45 : 1, outline: sortingMode ? '1px dashed #c9b58f' : undefined }}
                  >
                    <div className="talent-tree-card-header">
                      {sortingMode && <button type="button" draggable={!savingOrder}
                        aria-label={`Arrastar ${talent.is_hidden ? 'talento oculto' : talent.name}`}
                        title="Segure e arraste para reordenar"
                        onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', talent.id); setDraggedTalentId(talent.id) }}
                        onDragEnd={() => setDraggedTalentId(null)} disabled={savingOrder}
                        style={{ display: 'grid', placeItems: 'center', width: '30px', minWidth: '30px', alignSelf: 'center', border: 0, background: 'transparent', color: '#9a8765', cursor: savingOrder ? 'wait' : 'grab', touchAction: 'none' }}>
                        <GripVertical size={19} />
                      </button>}
                      <div className="talent-tree-icon">
                        {talent.icon_url && !talent.is_hidden ? (
                          <img
                            src={talent.icon_url}
                            alt=""
                            loading="lazy"
                          />
                        ) : (
                          <Sparkles size={22} />
                        )}
                      </div>

                      <div className="talent-tree-title">
                        <h2>{talent.is_hidden ? '???' : talent.name}</h2>

                        <span>
                          {talent.is_hidden
                            ? (talent.is_supreme ? 'VOCÊ AINDA NÃO TENTOU COMBINAÇÕES O SUFICIENTE PARA DESBLOQUEAR ESTA HABILIDADE' : 'CONHECIMENTO DESCONHECIDO')
                            : (talent.is_supreme ? `${talent.supreme_stars ?? 2} ESTRELAS · HABILIDADE SUPREMA` : `NÍVEL ${talent.current_points} / ${talent.max_level} · ${talent.points_per_level} PONTO(S)/NÍVEL`)}
                        </span>

                        {talent.is_supreme && !talent.is_hidden && (
                          <div className="supreme-talent-badges">
                            <span className={`supreme-stars-badge supreme-stars-${talent.supreme_stars ?? 2}`}>{'★'.repeat(talent.supreme_stars ?? 2)} {talent.supreme_stars ?? 2} ESTRELAS</span>
                            {talent.is_hidden
                              ? <span className="supreme-locked-badge">BLOQUEADA</span>
                              : <span className="supreme-unlocked-badge">DESBLOQUEADA</span>}
                            {!talent.is_hidden && talent.requirements_met === true && <span className="supreme-requirements-badge" style={{ background: '#e4f4e9', borderColor: '#a9d8b7', color: '#287447' }}>PRÉ-REQUISITOS ALCANÇADOS</span>}
                            {!talent.is_hidden && talent.requirements_met === false && <span className="supreme-requirements-badge">PRÉ-REQUISITOS NÃO ALCANÇADOS</span>}
                          </div>
                        )}
                        {!talent.is_hidden && !talent.is_supreme && hasRequirements && (
                          <span
                            className="talent-requirement-badge"
                            style={requirementBadgeStyle}
                          >
                            <AlertCircle size={10} />
                            POSSUI PRÉ-REQUISITOS
                          </span>
                        )}

                        {talent.is_hidden && !talent.is_supreme && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              width: 'min(100%, 230px)',
                              marginTop: '8px',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '10px',
                                color: '#8b795c',
                                fontSize: '10px',
                              }}
                            >
                              <span>ANÁLISES REALIZADAS</span>
                              <strong>
                                {talent.analyses_completed} / {talent.analyses_required}
                              </strong>
                            </div>
                            <div
                              role="progressbar"
                              aria-label="Progresso das análises"
                              aria-valuemin={0}
                              aria-valuemax={talent.analyses_required}
                              aria-valuenow={Math.min(talent.analyses_completed, talent.analyses_required)}
                              style={{
                                height: '5px',
                                overflow: 'hidden',
                                borderRadius: '10px',
                                background: '#e9e3d7',
                              }}
                            >
                              <div
                                style={{
                                  width: `${talent.analyses_required > 0 ? Math.min(100, (talent.analyses_completed / talent.analyses_required) * 100) : 0}%`,
                                  height: '100%',
                                  borderRadius: '10px',
                                  background: '#b49a6b',
                                  transition: 'width .2s ease',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: '7px',
                        marginTop: '12px',
                      }}
                    >
                      {!talent.is_hidden && !talent.is_supreme && (
                        <>
                          <button
                            type="button"
                            aria-label={`Remover um ponto de ${talent.name}`}
                            title="Remover um ponto"
                            disabled={
                              isAnyTalentUpdating ||
                              talent.current_points <= 0
                            }
                            onClick={() =>
                              void changeTalentPoints(talent, -1)
                            }
                            style={{
                              ...pointButtonStyle,
                              opacity:
                                isAnyTalentUpdating ||
                                  talent.current_points <= 0
                                  ? 0.45
                                  : 1,
                              cursor:
                                isAnyTalentUpdating ||
                                  talent.current_points <= 0
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                          >
                            <Minus size={14} />
                          </button>

                          <button
                            type="button"
                            aria-label={`Adicionar um ponto a ${talent.name}`}
                            title={`Evoluir nível (custa ${talent.points_per_level} pontos)`}
                            disabled={
                              isAnyTalentUpdating ||
                              totalAvailable < talent.points_per_level ||
                              talent.current_points >= talent.max_level
                            }
                            onClick={() =>
                              void changeTalentPoints(talent, 1)
                            }
                            style={{
                              ...pointButtonStyle,
                              opacity:
                                isAnyTalentUpdating ||
                                  totalAvailable <= 0 ||
                                  totalAvailable < talent.points_per_level ||
                                  talent.current_points >= talent.max_level
                                  ? 0.45
                                  : 1,
                              cursor:
                                isAnyTalentUpdating ||
                                  totalAvailable <= 0 ||
                                  totalAvailable < talent.points_per_level ||
                                  talent.current_points >= talent.max_level
                                  ? 'not-allowed'
                                  : 'pointer',
                            }}
                          >
                            {isUpdating ? (
                              <RefreshCw
                                size={14}
                                className="tree-loading-icon"
                              />
                            ) : (
                              <Plus size={14} />
                            )}
                          </button>
                        </>
                      )}

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            aria-label={`Editar ${talent.name}`}
                            title="Editar talento"
                            onClick={() => void openEdit(talent)}
                            style={{
                              ...pointButtonStyle,
                              color: '#64788a',
                            }}
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            type="button"
                            aria-label={`Excluir ${talent.name}`}
                            title="Excluir talento"
                            onClick={() =>
                              void openDeleteConfirmation(talent)
                            }
                            style={{
                              ...pointButtonStyle,
                              color: '#a34d46',
                              borderColor: '#e7c9c5',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}

                      {!talent.is_hidden && <button
                        type="button"
                        aria-label={`Ver detalhes de ${talent.name}`}
                        title="Ver detalhes"
                        onClick={() => openTalent(talent)}
                        style={{
                          ...pointButtonStyle,
                          borderColor: '#dcd2bd',
                          background: '#f5f2eb',
                          color: '#8a7652',
                        }}
                      >
                        <Eye size={15} />
                      </button>}
                    </div>
                  </article>
                )
              })}
              {!sortingMode && totalPages > 1 && (
                <nav
                  className="talent-pagination"
                  aria-label="Paginação dos talentos"
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '7px',
                    margin: '24px 0 12px',
                  }}
                >
                  <button
                    type="button"
                    disabled={safeCurrentPage === 1}
                    onClick={() => setCurrentPage((page) => page - 1)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e5e5e0',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#64788a',
                      cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: safeCurrentPage === 1 ? 0.45 : 1,
                      fontSize: '11px',
                    }}
                  >
                    Anterior
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                    (page) => {
                      const isCurrentPage = page === safeCurrentPage

                      return (
                        <button
                          key={page}
                          type="button"
                          aria-current={isCurrentPage ? 'page' : undefined}
                          onClick={() => setCurrentPage(page)}
                          style={{
                            minWidth: '34px',
                            height: '34px',
                            padding: '0 8px',
                            border: `1px solid ${isCurrentPage ? '#b9a47e' : '#e5e5e0'
                              }`,
                            borderRadius: '6px',
                            background: isCurrentPage ? '#f2eee5' : '#fff',
                            color: isCurrentPage ? '#806d4c' : '#7d8993',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: isCurrentPage ? 700 : 400,
                          }}
                        >
                          {page}
                        </button>
                      )
                    },
                  )}

                  <button
                    type="button"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => setCurrentPage((page) => page + 1)}
                    style={{
                      padding: '8px 12px',
                      border: '1px solid #e5e5e0',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#64788a',
                      cursor:
                        safeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: safeCurrentPage === totalPages ? 0.45 : 1,
                      fontSize: '11px',
                    }}
                  >
                    Próxima
                  </button>
                </nav>
              )}
            </section>


          ) : (
            <section className="tree-feedback">
              <Search size={22} />
              <h2>Nenhum talento encontrado.</h2>
              <p>
                {selectedFilter === 'unknown' && normalizedSearch
                  ? 'A pesquisa por nome não se aplica a conhecimentos desconhecidos.'
                  : 'Nenhum talento corresponde à pesquisa e ao filtro selecionados.'}
              </p>

              <button
                type="button"
                className="tree-retry-button"
                onClick={() => {
                  setSearchTerm('')
                  setSelectedFilter('all')
                }}
              >
                Limpar pesquisa e filtros
              </button>
            </section>
          )}
        </>
      )}

      {modalOpen && (
        <div className="talent-modal-backdrop">
          <section
            className="talent-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="talent-modal-title"
          >
            <header className="talent-modal-header">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-line" />
                  CATÁLOGO DE HABILIDADES
                </span>

                <h2 id="talent-modal-title">Editar talento</h2>
              </div>

              <button
                type="button"
                className="talent-modal-close"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <form onSubmit={(event) => void handleSave(event)}>
              <div className="talent-form-grid">
                <label>
                  <span>Nome do talento</span>

                  <input
                    required
                    maxLength={100}
                    value={form.name}
                    onChange={(event) =>
                      updateForm('name', event.target.value)
                    }
                    placeholder="Ex.: Corpo Imortal"
                  />
                </label>

                <label>
                  <span>Árvore</span>

                  <select
                    value={form.tree_key}
                    onChange={(event) =>
                      updateForm('tree_key', event.target.value)
                    }
                  >
                    {regularTrees.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}

                    <option value="supremo">Talento Supremo</option>
                  </select>
                </label>

                <label className="talent-form-full">
                  <span>URL da imagem do ícone</span>

                  <input
                    type="url"
                    value={form.icon_url}
                    onChange={(event) =>
                      updateForm('icon_url', event.target.value)
                    }
                    placeholder="https://exemplo.com/imagem.png"
                  />

                  <small className="talent-field-hint">
                    A imagem será exibida em um espaço padronizado de
                    34 × 34 pixels.
                  </small>

                  {form.icon_url.trim() && (
                    <div className="talent-icon-preview">
                      <img
                        src={form.icon_url}
                        alt="Pré-visualização do ícone"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                        onLoad={(event) => {
                          event.currentTarget.style.display = 'block'
                        }}
                      />

                      <span>Pré-visualização</span>
                    </div>
                  )}
                </label>

                {form.is_hidden && form.tree_key !== 'supremo' && (
                  <>
                    <label>
                      <span>Análises necessárias</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        required
                        value={form.analyses_required}
                        onChange={(event) =>
                          updateForm('analyses_required', Number(event.target.value))
                        }
                      />
                    </label>

                    <label>
                      <span>Análises realizadas</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        required
                        value={form.analyses_completed}
                        onChange={(event) =>
                          updateForm('analyses_completed', Number(event.target.value))
                        }
                      />
                    </label>
                  </>
                )}


                {form.tree_key === 'supremo' ? (
                  <>
                    <label><span>Categoria da habilidade suprema</span>
                      <select value={form.supreme_stars} onChange={(event) => updateForm('supreme_stars', Number(event.target.value) as 2 | 3)}>
                        <option value={2}>Suprema · 2 estrelas</option><option value={3}>Suprema · 3 estrelas</option>
                      </select>
                    </label>
                    <label><span>Disponibilidade</span>
                      <select value={form.supreme_unlocked ? 'unlocked' : 'locked'} onChange={(event) => { const unlocked = event.target.value === 'unlocked'; updateForm('supreme_unlocked', unlocked); updateForm('is_hidden', !unlocked); updateForm('is_manually_locked', !unlocked) }}>
                        <option value="locked">Bloqueada</option><option value="unlocked">Desbloqueada</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label><span>Nível máximo</span><input type="number" min={1} max={99} step={1} required value={form.max_level} onChange={(event) => updateForm('max_level', Number(event.target.value))} /></label>
                    <label><span>Custo por nível (pontos)</span><input type="number" min={1} step={1} required value={form.points_per_level} onChange={(event) => updateForm('points_per_level', Number(event.target.value))} /></label>
                  </>
                )}

                <label className="talent-form-full">
                  <span>Descrição mecânica</span>

                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(event) =>
                      updateForm('description', event.target.value)
                    }
                    placeholder="Descreva os efeitos e regras desta habilidade..."
                  />
                </label>
              </div>

              {form.tree_key !== 'supremo' && <div className="talent-form-flags">
                <label>
                  <input
                    type="checkbox"
                    checked={form.is_hidden}
                    onChange={(event) =>
                      updateForm('is_hidden', event.target.checked)
                    }
                  />
                  Talento oculto
                </label>
              </div>}

              <div className="talent-prerequisite-section">
                <div>
                  <h3>Pré-requisitos</h3>

                  <p>
                    Pesquise e selecione os talentos necessários para
                    desbloquear esta habilidade.
                  </p>
                </div>

                <div className="talent-prerequisite-dropdown">
                  <div className="talent-prerequisite-menu">
                    <div className="talent-prerequisite-search">
                      <Search size={16} />

                      <input
                        type="search"
                        value={prerequisiteSearch}
                        onChange={(event) =>
                          setPrerequisiteSearch(event.target.value)
                        }
                        placeholder="Digite o nome de um talento..."
                      />
                    </div>

                    <div className="talent-prerequisite-options">
                      {availablePrerequisites.map((t) => {
                        const selected = form.prerequisites.some(
                          (item) =>
                            item.prerequisite_talent_id === t.id,
                        )

                        return (
                          <label
                            className={`talent-prerequisite-option ${selected ? 'selected' : ''
                              }`}
                            key={t.id}
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={(event) =>
                                togglePrerequisite(
                                  t.id,
                                  event.target.checked,
                                )
                              }
                            />

                            <span>
                              <strong>{t.name}</strong>
                              <small>
                                {treeName(t.tree_key)}
                                {t.is_hidden ? ' • Oculto' : ''}
                              </small>
                            </span>
                          </label>
                        )
                      })}

                      {availablePrerequisites.length === 0 && (
                        <p className="talent-prerequisite-empty">
                          Nenhum talento encontrado.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {form.prerequisites.length > 0 && (
                  <div className="talent-prerequisite-selected">
                    <span className="talent-prerequisite-selected-title">
                      Talentos selecionados
                    </span>

                    {form.prerequisites.map((item) => {
                      const t = allPrerequisiteTalents.find(
                        (candidate) =>
                          candidate.id === item.prerequisite_talent_id,
                      )

                      if (!t) return null

                      return (
                        <div
                          className="talent-prerequisite-item"
                          key={t.id}
                        >
                          <div className="talent-prerequisite-name">
                            <strong>
                              {t.name}
                            </strong>

                            <small>{treeName(t.tree_key)}</small>
                          </div>

                          <label className="talent-prerequisite-points">
                            <span>Pontos exigidos</span>

                            <input
                              type="number"
                              min={1}
                              max={t.max_level}
                              value={item.required_points}
                              onChange={(event) =>
                                updatePrerequisitePoints(
                                  t.id,
                                  Math.min(
                                    t.max_level,
                                    Math.max(
                                      1,
                                      Number(event.target.value) || 1,
                                    ),
                                  ),
                                )
                              }
                            />
                          </label>

                          <button
                            type="button"
                            className="talent-prerequisite-remove"
                            onClick={() =>
                              togglePrerequisite(t.id, false)
                            }
                            aria-label="Remover pré-requisito"
                            title="Remover pré-requisito"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="talent-prerequisite-section">
                <div>
                  <h3>Requisitos por árvore</h3>

                  <p>
                    Defina quantos pontos o personagem precisa ter
                    acumulado em outras árvores para desbloquear este
                    talento.
                  </p>
                </div>

                {form.treeRequirements.map((item, index) => (
                  <div
                    className="talent-prerequisite-item"
                    key={`${item.required_tree_key}-${index}`}
                  >
                    <label className="talent-prerequisite-name">
                      <strong>Árvore exigida</strong>

                      <select
                        value={item.required_tree_key}
                        onChange={(event) =>
                          updateTreeRequirement(
                            index,
                            'required_tree_key',
                            event.target.value,
                          )
                        }
                      >
                        {regularTrees
                          .filter(
                            (t) =>
                              !form.treeRequirements.some(
                                (other, otherIndex) =>
                                  otherIndex !== index &&
                                  other.required_tree_key === t.id,
                              ),
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </label>

                    <label className="talent-prerequisite-points">
                      <span>Pontos mínimos</span>

                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.required_points}
                        onChange={(event) =>
                          updateTreeRequirement(
                            index,
                            'required_points',
                            Math.max(
                              1,
                              Number(event.target.value) || 1,
                            ),
                          )
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="talent-prerequisite-remove"
                      onClick={() => removeTreeRequirement(index)}
                      aria-label="Remover requisito por árvore"
                      title="Remover requisito"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="talent-secondary-button"
                  onClick={addTreeRequirement}
                  disabled={
                    form.treeRequirements.length >= regularTrees.length
                  }
                >
                  <Plus size={14} />
                  Adicionar requisito por árvore
                </button>
              </div>

              <TalentEffectsEditor ref={effectsEditorRef} talentId={editingId} />

              {error && (
                <div className="talent-feedback error" role="alert">
                  {error}
                </div>
              )}

              <footer className="talent-modal-footer">
                <button
                  type="button"
                  className="talent-secondary-button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="talent-primary-button"
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {deletingTalent && (
        <div className="talent-modal-backdrop">
          <section
            className="talent-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="talent-delete-title"
          >
            <header className="talent-modal-header">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-line" />
                  AÇÃO PERMANENTE
                </span>

                <h2 id="talent-delete-title">Excluir talento?</h2>
              </div>

              <button
                type="button"
                className="talent-modal-close"
                disabled={deleteLoading}
                onClick={() => setDeletingTalent(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#596b78',
                  fontSize: '13px',
                  lineHeight: 1.6,
                }}
              >
                Você está prestes a excluir{' '}
                <strong>
                  {deletingTalent.is_hidden
                    ? 'este talento oculto'
                    : deletingTalent.name}
                </strong>
                . Esta ação não poderá ser desfeita.
              </p>

              {deleteLoading ? (
                <p style={{ color: '#82909a', fontSize: '12px' }}>
                  Verificando vínculos e pontos distribuídos...
                </p>
              ) : (
                <>
                  {dependentTalents.length > 0 ? (
                    <div
                      style={{
                        padding: '13px 15px',
                        border: '1px solid #e7c9c5',
                        borderRadius: '7px',
                        background: '#fbf1ef',
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          marginBottom: '8px',
                          color: '#a04e47',
                          fontSize: '11px',
                        }}
                      >
                        Atenção: {dependentTalents.length}{' '}
                        {dependentTalents.length === 1
                          ? 'talento possui'
                          : 'talentos possuem'}{' '}
                        este talento como pré-requisito
                      </strong>

                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: '18px',
                          color: '#765e5b',
                          fontSize: '12px',
                          lineHeight: 1.8,
                        }}
                      >
                        {dependentTalents.map((dependent) => (
                          <li key={dependent.id}>
                            {dependent.name}
                            {dependent.points > 0
                              ? ` — ${dependent.points} ${dependent.points === 1
                                ? 'ponto distribuído'
                                : 'pontos distribuídos'
                              }`
                              : ' — sem pontos distribuídos'}
                          </li>
                        ))}
                      </ul>

                      <p
                        style={{
                          margin: '9px 0 0',
                          color: '#8b5a55',
                          fontSize: '10px',
                          lineHeight: 1.5,
                        }}
                      >
                        A exclusão poderá ser impedida se houver vínculos
                        que não estejam configurados para exclusão em
                        cascata.
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '11px 13px',
                        border: '1px solid #e4e5df',
                        borderRadius: '7px',
                        background: '#f7f7f3',
                        color: '#71808a',
                        fontSize: '11px',
                      }}
                    >
                      Nenhum outro talento utiliza este como
                      pré-requisito.
                    </div>
                  )}

                  <div
                    style={{
                      padding: '11px 13px',
                      border: '1px solid #e7d8bd',
                      borderRadius: '7px',
                      background: '#faf6ed',
                      color: '#806d4c',
                      fontSize: '11px',
                      lineHeight: 1.5,
                    }}
                  >
                    {(deletePoints * (deletingTalent?.points_per_level ?? 1)) > 0
                      ? `${deletePoints * (deletingTalent?.points_per_level ?? 1)} ${(deletePoints * (deletingTalent?.points_per_level ?? 1)) === 1
                        ? 'ponto distribuído será removido'
                        : 'pontos distribuídos serão removidos'
                      } da progressão global.`
                      : 'Este talento não possui pontos distribuídos.'}
                  </div>
                </>
              )}

              {deleteError && (
                <div role="alert" style={errorAlertStyle}>
                  <AlertCircle size={15} />
                  <span>{deleteError}</span>
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '9px',
                  marginTop: '4px',
                }}
              >
                <button
                  type="button"
                  className="talent-secondary-button"
                  disabled={deleteLoading}
                  onClick={() => setDeletingTalent(null)}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={deleteLoading || Boolean(deleteError)}
                  onClick={() => void confirmDeleteTalent()}
                  style={{
                    ...dangerButtonStyle,
                    opacity:
                      deleteLoading || deleteError ? 0.55 : 1,
                  }}
                >
                  {deleteLoading ? 'Aguarde...' : 'Excluir talento'}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {selectedTalent && (
        <div className="talent-modal-backdrop">
          <section
            className="talent-modal talent-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="talent-detail-title"
          >
            <header className="talent-modal-header">
              <div>
                <span className="eyebrow">
                  <span className="eyebrow-line" />
                  {selectedTalent.is_hidden
                    ? 'CONHECIMENTO RESTRITO'
                    : 'COMPÊNDIO DE TALENTOS'}
                </span>

                <h2 id="talent-detail-title">
                  {selectedTalent.is_hidden
                    ? 'Conhecimento desconhecido'
                    : selectedTalent.name}
                </h2>
              </div>

              <button
                type="button"
                className="talent-modal-close"
                onClick={() => setSelectedTalent(null)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </header>

            {selectedTalent.is_hidden ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '18px 8px 8px',
                  color: '#8b795c',
                  textAlign: 'center',
                }}
              >
                <Sparkles size={27} />

                <p
                  style={{
                    margin: 0,
                    color: '#7c8284',
                    font: 'italic 15px Playfair Display, Georgia, serif',
                  }}
                >
                  {selectedTalent.is_supreme ? 'Você ainda não tentou combinações o suficiente para desbloquear esta habilidade.' : 'Você não detém desse conhecimento ainda.'}
                </p>

                <button
                  type="button"
                  style={{
                    padding: '9px 18px',
                    border: '1px solid #e1d9c9',
                    borderRadius: '6px',
                    background: '#f5f2eb',
                    color: '#78694f',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '11px',
                  }}
                  onClick={() => setSelectedTalent(null)}
                >
                  Aah, ok
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px',
                    border: '1px solid #ece9e1',
                    borderRadius: '8px',
                    background: selectedTalent.is_supreme ? 'linear-gradient(135deg, #211d2d, #30263c)' : '#f7f6f2',
                  }}
                >
                  <div className="talent-tree-icon">
                    {selectedTalent.icon_url ? (
                      <img src={selectedTalent.icon_url} alt="" />
                    ) : (
                      <Sparkles size={25} />
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                    }}
                  >
                    <span
                      style={{
                        color: '#a08b68',
                        fontSize: '8px',
                        fontWeight: 700,
                        letterSpacing: '1px',
                      }}
                    >
                      {selectedTalent.is_supreme ? 'HABILIDADE SUPREMA' : 'NÍVEL ATUAL'}
                    </span>

                    <strong style={{ color: selectedTalent.is_supreme ? '#f0d7a2' : '#465a70', fontSize: '17px' }}>
                      {selectedTalent.is_supreme ? '★'.repeat(selectedTalent.supreme_stars ?? 2) : `${selectedTalent.current_points} / ${selectedTalent.max_level}`}
                    </strong>
                    {selectedTalent.is_supreme ? (
                      <span style={{ color: selectedTalent.requirements_met ? '#9ee0b4' : '#e9b0a9', fontSize: '10px', fontWeight: 800 }}>
                        {selectedTalent.requirements_met ? 'PRÉ-REQUISITOS ALCANÇADOS' : 'PRÉ-REQUISITOS NÃO ALCANÇADOS'}
                      </span>
                    ) : (
                      <span style={{ color: '#8a9298', fontSize: '10px' }}>
                        CUSTO: {selectedTalent.points_per_level} {selectedTalent.points_per_level === 1 ? 'ponto' : 'pontos'} por nível · MÁXIMO: {selectedTalent.max_level * selectedTalent.points_per_level} pontos
                      </span>
                    )}
                  </div>
                </div>

                <section
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '9px',
                  }}
                >
                  <span
                    style={{
                      color: '#a08b68',
                      fontSize: '8px',
                      fontWeight: 700,
                      letterSpacing: '1.2px',
                    }}
                  >
                    DESCRIÇÃO
                  </span>

                  <p
                    style={{
                      margin: 0,
                      color: '#707e88',
                      fontSize: '12px',
                      lineHeight: 1.75,
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {selectedTalent.description ||
                      'Nenhuma descrição cadastrada.'}
                  </p>
                </section>

                {selectedTalent.is_supreme && (
                  <p style={{ margin: 0, padding: '12px 14px', borderRadius: 8, background: selectedTalent.requirements_met ? '#e7f5eb' : '#faecea', color: selectedTalent.requirements_met ? '#287447' : '#a34b43', fontSize: 12, fontWeight: 700 }}>
                    {selectedTalent.requirements_met ? 'Essa habilidade está ativa.' : 'Essa habilidade não está ativa.'}
                  </p>
                )}

                {(selectedTalent.prerequisites.length > 0 ||
                  selectedTalent.treeRequirements.length > 0) && (
                    <section
                      className="talent-tree-prerequisites"
                      style={{ gap: '12px' }}
                    >
                      <span>PRÉ-REQUISITOS</span>

                      <ul>
                        {selectedTalent.prerequisites.map((prerequisite) => (
                          <li key={prerequisite.talent_id}>
                            <span>
                              {prerequisite.prerequisite?.is_hidden
                                ? '???'
                                : prerequisite.prerequisite?.name ??
                                'Talento desconhecido'}
                            </span>

                            <strong>
                              {prerequisite.required_points}{' '}
                              {prerequisite.required_points === 1
                                ? 'ponto'
                                : 'pontos'}
                            </strong>
                          </li>
                        ))}

                        {selectedTalent.treeRequirements.map((requirement) => (
                          <li key={requirement.required_tree_key}>
                            <span>
                              {treeName(requirement.required_tree_key)}
                            </span>

                            <strong>
                              {requirement.required_points}{' '}
                              {requirement.required_points === 1
                                ? 'ponto na árvore'
                                : 'pontos na árvore'}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}