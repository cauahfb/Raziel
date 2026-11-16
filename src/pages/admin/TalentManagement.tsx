import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { FormEvent } from 'react'

import {

  AlertCircle,

  ArrowLeft,

  ArrowRight,

  Pencil,

  Plus,

  Search,

  Sparkles,

  Trash2,

  X,

} from 'lucide-react'



import { supabase } from '../../lib/supabase'
import TalentEffectsEditor, { type TalentEffectsEditorHandle } from '../../components/TalentEffectsEditor'

import { trees } from '../../data/trees'



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
  is_manually_locked: boolean
  analyses_required: number
  analyses_completed: number
  current_points: number
}



type Prerequisite = {

  id: string

  talent_id: string

  prerequisite_talent_id: string

  required_points: number

}



type TreeRequirement = {

  id: string

  talent_id: string

  required_tree_key: string

  required_points: number

}



type DependentTalent = {

  id: string

  name: string

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



const PAGE_SIZE = 10



const regularTrees = trees.filter((tree) => tree.id !== 'supremo')



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



export default function TalentManagement() {

  const [talents, setTalents] = useState<Talent[]>([])

  const [prerequisites, setPrerequisites] = useState<

    Record<string, Prerequisite[]>

  >({})

  const [treeRequirements, setTreeRequirements] = useState<

    Record<string, TreeRequirement[]>

  >({})



  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')

  const [notice, setNotice] = useState('')



  const [filterTree, setFilterTree] = useState('all')

  const [pointsFilter, setPointsFilter] = useState<'all' | 'with' | 'without'>('all')

  const [search, setSearch] = useState('')

  const [page, setPage] = useState(1)



  const [modalOpen, setModalOpen] = useState(false)
  const effectsEditorRef = useRef<TalentEffectsEditorHandle>(null)

  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState<TalentForm>(emptyForm)

  const [prerequisiteSearch, setPrerequisiteSearch] = useState('')



  const [deletingTalent, setDeletingTalent] = useState<Talent | null>(null)

  const [dependentTalents, setDependentTalents] = useState<

    DependentTalent[]

  >([])

  const [deleteLoading, setDeleteLoading] = useState(false)

  const [deleteError, setDeleteError] = useState('')



  const loadTalents = useCallback(async () => {

    if (!supabase) {

      setError(

        'O Supabase não está configurado. Verifique as variáveis de ambiente.',

      )

      setLoading(false)

      return

    }



    setLoading(true)

    setError('')



    const [

      talentResult,

      prerequisiteResult,

      treeRequirementResult,

      progressResult,

    ] = await Promise.all([

      supabase

        .from('talents')

        .select(

          'id, tree_key, name, icon_url, description, max_level, points_per_level, is_hidden, is_supreme, supreme_stars, supreme_unlocked, is_manually_locked, analyses_required, analyses_completed',

        )

        .order('tree_key')

        .order('name'),



      supabase

        .from('talent_prerequisites')

        .select(

          'id, talent_id, prerequisite_talent_id, required_points',

        ),



      supabase

        .from('talent_tree_requirements')

        .select(

          'id, talent_id, required_tree_key, required_points',

        ),

      supabase
        .from('talent_progress')
        .select('talent_id, points'),

    ])



    if (talentResult.error || progressResult.error) {

      setError(

        `Não foi possível carregar os talentos: ${talentResult.error?.message ?? progressResult.error?.message}`,

      )

      setTalents([])

      setPrerequisites({})

      setTreeRequirements({})

      setLoading(false)

      return

    }



    const groupedPrerequisites: Record<string, Prerequisite[]> = {}



    for (const item of prerequisiteResult.data ?? []) {

      ;(groupedPrerequisites[item.talent_id] ??= []).push(

        item as Prerequisite,

      )

    }



    const groupedTreeRequirements: Record<

      string,

      TreeRequirement[]

    > = {}



    for (const item of treeRequirementResult.data ?? []) {

      ;(groupedTreeRequirements[item.talent_id] ??= []).push(

        item as TreeRequirement,

      )

    }



    const pointsByTalent = new Map((progressResult.data ?? []).map((row) => [row.talent_id, Number(row.points)]))
    setTalents((talentResult.data ?? []).map((talent) => ({ ...talent, current_points: pointsByTalent.get(talent.id) ?? 0 })) as Talent[])

    setPrerequisites(groupedPrerequisites)

    setTreeRequirements(groupedTreeRequirements)



    if (prerequisiteResult.error || treeRequirementResult.error) {

      setError(

        `Os talentos foram carregados, mas houve falha ao carregar requisitos: ${

          prerequisiteResult.error?.message ??

          treeRequirementResult.error?.message

        }`,

      )

    }



    setLoading(false)

  }, [])



  useEffect(() => {

    void loadTalents()

  }, [loadTalents])



  useEffect(() => {

    if (!modalOpen && !deletingTalent) return



    function handleEscape(event: KeyboardEvent) {

      if (event.key === 'Escape' && !saving && !deleteLoading) {

        setModalOpen(false)

        setDeletingTalent(null)

      }

    }



    window.addEventListener('keydown', handleEscape)



    return () => window.removeEventListener('keydown', handleEscape)

  }, [modalOpen, deletingTalent, saving, deleteLoading])



  const filteredTalents = useMemo(() => {

    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')



    return talents.filter((talent) => {

      const matchesTree =

        filterTree === 'all' || talent.tree_key === filterTree



      const matchesSearch =

        !normalizedSearch ||

        talent.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)

      const matchesPoints =
        pointsFilter === 'all' ||
        (pointsFilter === 'with' && talent.current_points > 0) ||
        (pointsFilter === 'without' && talent.current_points === 0)

      return matchesTree && matchesSearch && matchesPoints

    })

  }, [filterTree, pointsFilter, search, talents])



  const totalPages = Math.max(

    1,

    Math.ceil(filteredTalents.length / PAGE_SIZE),

  )



  const currentPage = Math.min(page, totalPages)



  const visibleTalents = filteredTalents.slice(

    (currentPage - 1) * PAGE_SIZE,

    currentPage * PAGE_SIZE,

  )



  const availablePrerequisites = useMemo(() => {

    const normalizedSearch = prerequisiteSearch

      .trim()

      .toLocaleLowerCase('pt-BR')



    return talents.filter((talent) => {

      if (talent.id === editingId) return false



      return (

        !normalizedSearch ||

        talent.name.toLocaleLowerCase('pt-BR').includes(normalizedSearch)

      )

    })

  }, [editingId, prerequisiteSearch, talents])



  function openCreate() {

    setEditingId(null)

    setForm({

      ...emptyForm,

      prerequisites: [],

      treeRequirements: [],

    })

    setPrerequisiteSearch('')

    setError('')

    setNotice('')

    setModalOpen(true)

  }



  async function openEdit(talent: Talent) {

    if (!supabase) return



    setError('')

    setNotice('')



    const [

      prerequisiteResult,

      treeRequirementResult,

    ] = await Promise.all([

      supabase

        .from('talent_prerequisites')

        .select('prerequisite_talent_id, required_points')

        .eq('talent_id', talent.id),



      supabase

        .from('talent_tree_requirements')

        .select('required_tree_key, required_points')

        .eq('talent_id', talent.id),

    ])



    if (prerequisiteResult.error || treeRequirementResult.error) {

      setError(

        `Não foi possível carregar os requisitos: ${

          prerequisiteResult.error?.message ??

          treeRequirementResult.error?.message

        }`,

      )

      return

    }



    setEditingId(talent.id)



    setForm({

      tree_key: talent.tree_key,

      name: talent.name,

      icon_url: talent.icon_url ?? '',

      description: talent.description ?? '',

      max_level: talent.max_level,
      points_per_level: talent.points_per_level ?? 1,

      is_hidden: talent.is_hidden,
      supreme_stars: talent.supreme_stars ?? 2,
      supreme_unlocked: talent.supreme_unlocked ?? false,
      is_manually_locked: talent.is_manually_locked ?? false,

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

      (tree) => !usedTrees.includes(tree.id),

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



    if (!supabase || saving) return



    const name = form.name.trim()

    const isSupreme = form.tree_key === 'supremo'
    const maxLevel = isSupreme ? 1 : Number(form.max_level)
    const pointsPerLevel = isSupreme ? 1 : Number(form.points_per_level)

    const analysesRequired = Number(form.analyses_required)

    const analysesCompleted = Number(form.analyses_completed)

    const tracksAnalyses = form.is_hidden && form.tree_key !== 'supremo'

    const iconUrl = form.icon_url.trim()



    if (!name) {

      setError('Informe o nome do talento.')

      return

    }



    if (!Number.isInteger(maxLevel) || maxLevel < 1) {

      setError(

        'O nível máximo deve ser um número inteiro maior que zero.',

      )

      return

    }



    if (
      !Number.isInteger(analysesRequired) || analysesRequired < 0 ||
      !Number.isInteger(analysesCompleted) || analysesCompleted < 0
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

    setNotice('')



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

      analyses_required: tracksAnalyses ? analysesRequired : 0,

      analyses_completed: tracksAnalyses ? analysesCompleted : 0,

    }



    const result = editingId

      ? await supabase

          .from('talents')

          .update(payload)

          .eq('id', editingId)

          .select('id')

          .single()

      : await supabase

          .from('talents')

          .insert(payload)

          .select('id')

          .single()



    if (result.error || !result.data) {

      setError(

        `Não foi possível salvar o talento: ${

          result.error?.message ?? 'registro não retornado'

        }`,

      )

      setSaving(false)

      return

    }



    const talentId = result.data.id

    try {
      await effectsEditorRef.current?.save(talentId)
    } catch (effectError) {
      setError(`O talento foi salvo, mas houve erro ao salvar seus efeitos: ${effectError instanceof Error ? effectError.message : 'erro desconhecido'}`)
      setSaving(false)
      await loadTalents()
      return
    }

    if (isSupreme) {
      const { error: refreshError } = await supabase.rpc('refresh_automatic_compendium_unlocks')
      if (refreshError) {
        console.error('Não foi possível atualizar a revelação da Habilidade Suprema:', refreshError.message)
      }
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

      await loadTalents()

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

        await loadTalents()

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

      await loadTalents()

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

        await loadTalents()

        return

      }

    }



    setNotice(

      editingId

        ? 'Talento atualizado com sucesso.'

        : 'Talento cadastrado com sucesso.',

    )



    setModalOpen(false)

    setSaving(false)

    setPage(1)



    await loadTalents()

  }



  async function openDeleteConfirmation(talent: Talent) {

    if (!supabase) return



    setDeleteError('')

    setDependentTalents([])

    setDeletingTalent(talent)

    setDeleteLoading(true)



    const { data: links, error: linksError } = await supabase

      .from('talent_prerequisites')

      .select('talent_id')

      .eq('prerequisite_talent_id', talent.id)



    if (linksError) {

      setDeleteError(

        `Não foi possível verificar os vínculos do talento: ${linksError.message}`,

      )

      setDeleteLoading(false)

      return

    }



    const dependentIds = [

      ...new Set((links ?? []).map((item) => item.talent_id)),

    ]



    if (dependentIds.length > 0) {

      const { data: dependentRows, error: dependentError } = await supabase

        .from('talents')

        .select('id, name, is_hidden')

        .in('id', dependentIds)



      if (dependentError) {

        setDeleteError(

          `Não foi possível carregar os talentos dependentes: ${dependentError.message}`,

        )

        setDeleteLoading(false)

        return

      }



      setDependentTalents(

        (dependentRows ?? []).map((row) => ({

          id: row.id,

          name: row.name,

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



    setDeletingTalent(null)

    setDependentTalents([])

    setDeleteLoading(false)



    setNotice(

      `“${target.name}” foi excluído.`,

    )



    await loadTalents()

  }



  function treeName(treeKey: string) {

    if (treeKey === 'supremo') return 'Talento Supremo'



    return trees.find((tree) => tree.id === treeKey)?.name ?? treeKey

  }



  return (

    <section className="talent-admin-page">

      <div className="talent-admin-heading">

        <div>

          <div className="eyebrow">

            <span className="eyebrow-line" />

            ÁREA ADMINISTRATIVA

          </div>



          <h1>Gerenciar talentos</h1>

          <p>Cadastre, edite e organize as habilidades do Compendium.</p>

        </div>



        <button

          type="button"

          className="talent-primary-button"

          onClick={openCreate}

        >

          <Plus size={16} />

          Novo talento

        </button>

      </div>



      {error && (

        <div className="talent-feedback error" role="alert">

          {error}

        </div>

      )}



      {notice && (

        <div className="talent-feedback success" role="status">

          {notice}

        </div>

      )}



      <div className="talent-admin-toolbar">

        <label className="talent-filter-select">

          <span>Árvore</span>



          <select

            value={filterTree}

            onChange={(event) => {

              setFilterTree(event.target.value)

              setPage(1)

            }}

          >

            <option value="all">Todas as árvores</option>



            {trees.map((tree) => (

              <option key={tree.id} value={tree.id}>

                {tree.name}

              </option>

            ))}



            <option value="supremo">Talento Supremo</option>

          </select>

        </label>



        <label className="talent-search-field">

          <Search size={16} />



          <input

            value={search}

            onChange={(event) => {

              setSearch(event.target.value)

              setPage(1)

            }}

            placeholder="Buscar talento..."

          />

        </label>



        <div className="talent-admin-points-filters" role="group" aria-label="Filtrar por pontos distribuídos">
          {([
            { value: 'all', label: 'Todos os pontos' },
            { value: 'with', label: 'Com pontos distribuídos' },
            { value: 'without', label: 'Sem pontos distribuídos' },
          ] as const).map((filter) => (
            <button key={filter.value} type="button" aria-pressed={pointsFilter === filter.value} onClick={() => { setPointsFilter(filter.value); setPage(1) }}>
              {filter.label}
            </button>
          ))}
          {(filterTree !== 'all' || search || pointsFilter !== 'all') && <button type="button" onClick={() => { setFilterTree('all'); setSearch(''); setPointsFilter('all'); setPage(1) }}>Limpar filtros</button>}
        </div>

        <span className="talent-admin-total">

          {filteredTalents.length}{' '}

          {filteredTalents.length === 1 ? 'talento' : 'talentos'}

        </span>

      </div>



      <div className="talent-admin-list">

        {loading ? (

          <div className="talent-admin-empty">

            Carregando talentos...

          </div>

        ) : visibleTalents.length === 0 ? (

          <div className="talent-admin-empty">

            Nenhum talento encontrado para este filtro.

          </div>

        ) : (

          visibleTalents.map((talent) => {

            const prerequisiteCount =

              prerequisites[talent.id]?.length ?? 0



            const treeRequirementCount =

              treeRequirements[talent.id]?.length ?? 0



            return (

              <article className="talent-admin-row" key={talent.id}>

                <div className="talent-admin-icon">

                  {talent.icon_url ? (

                    <img

                      src={talent.icon_url}

                      alt=""

                      loading="lazy"

                      onError={(event) => {

                        event.currentTarget.style.display = 'none'

                      }}

                    />

                  ) : (

                    <Sparkles size={17} />

                  )}

                </div>



                <div className="talent-admin-info">

                  <strong>

                    {talent.name}

                  </strong>



                  <span>
                    {talent.is_supreme
                      ? `Talento Supremo · ${talent.supreme_stars ?? 2} estrelas · ${talent.supreme_unlocked ? 'Desbloqueada' : 'Bloqueada'}`
                      : `${treeName(talent.tree_key)} · Máx. ${talent.max_level} ${talent.max_level === 1 ? 'nível' : 'níveis'}`} · {prerequisiteCount} pré-requisitos · {treeRequirementCount} requisitos por árvore
                  </span>



                  {talent.description && (

                    <p>{talent.description}</p>

                  )}

                </div>



                <div className="talent-admin-tags">

                  {talent.is_hidden && <span>Oculto</span>}

                  {talent.tree_key === 'supremo' && (

                    <span>Supremo</span>

                  )}

                </div>



                <div className="talent-admin-actions">

                  <button

                    type="button"

                    onClick={() => void openEdit(talent)}

                    aria-label={`Editar ${talent.name}`}

                    title="Editar"

                  >

                    <Pencil size={15} />

                  </button>



                  <button

                    type="button"

                    onClick={() => void openDeleteConfirmation(talent)}

                    aria-label={`Excluir ${talent.name}`}

                    title="Excluir"

                  >

                    <Trash2 size={15} />

                  </button>

                </div>

              </article>

            )

          })

        )}

      </div>



      <div className="talent-pagination">

        <span>

          Exibindo{' '}

          {filteredTalents.length === 0

            ? 0

            : (currentPage - 1) * PAGE_SIZE + 1}

          –

          {Math.min(

            currentPage * PAGE_SIZE,

            filteredTalents.length,

          )}{' '}

          de {filteredTalents.length}

        </span>



        <div>

          <button

            type="button"

            onClick={() =>

              setPage((current) => Math.max(1, current - 1))

            }

            disabled={currentPage <= 1}

          >

            <ArrowLeft size={15} />

            Anterior

          </button>



          <strong>

            {currentPage} de {totalPages}

          </strong>



          <button

            type="button"

            onClick={() =>

              setPage((current) =>

                Math.min(totalPages, current + 1),

              )

            }

            disabled={currentPage >= totalPages}

          >

            Próxima

            <ArrowRight size={15} />

          </button>

        </div>

      </div>



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



                <h2 id="talent-modal-title">

                  {editingId ? 'Editar talento' : 'Novo talento'}

                </h2>

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

                      setForm((current) => ({ ...current, tree_key: event.target.value, ...(event.target.value === 'supremo' ? { is_hidden: !current.supreme_unlocked } : {}) }))

                    }

                  >

                    {regularTrees.map((tree) => (

                      <option key={tree.id} value={tree.id}>

                        {tree.name}

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

                    placeholder="https\://exemplo.com/imagem.png"

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
                        value={form.analyses_required}
                        onChange={(event) =>
                          updateForm('analyses_required', Number(event.target.value) || 0)
                        }
                      />
                    </label>

                    <label>
                      <span>Análises realizadas</span>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={form.analyses_completed}
                        onChange={(event) =>
                          updateForm('analyses_completed', Number(event.target.value) || 0)
                        }
                      />
                    </label>
                  </>
                )}

                {form.tree_key === 'supremo' ? (
                  <>
                    <label>
                      <span>Categoria da habilidade suprema</span>
                      <select value={form.supreme_stars} onChange={(event) => updateForm('supreme_stars', Number(event.target.value) as 2 | 3)}>
                        <option value={2}>Suprema · 2 estrelas</option>
                        <option value={3}>Suprema · 3 estrelas</option>
                      </select>
                    </label>
                    <label>
                      <span>Disponibilidade</span>
                      <select value={form.supreme_unlocked ? 'unlocked' : 'locked'} onChange={(event) => { const unlocked = event.target.value === 'unlocked'; updateForm('supreme_unlocked', unlocked); updateForm('is_hidden', !unlocked); updateForm('is_manually_locked', !unlocked) }}>
                        <option value="locked">Bloqueada</option>
                        <option value="unlocked">Desbloqueada</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      <span>Nível máximo</span>
                      <input type="number" min={1} max={99} step={1} required value={form.max_level}
                        onChange={(event) => updateForm('max_level', Number(event.target.value))} />
                    </label>
                    <label>
                      <span>Custo por nível (pontos)</span>
                      <input type="number" min={1} step={1} required value={form.points_per_level}
                        onChange={(event) => updateForm('points_per_level', Number(event.target.value))} />
                    </label>
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

                      {availablePrerequisites.map((talent) => {

                        const selected = form.prerequisites.some(

                          (item) =>

                            item.prerequisite_talent_id === talent.id,

                        )



                        return (

                          <label

                            className={`talent-prerequisite-option ${

                              selected ? 'selected' : ''

                            }`}

                            key={talent.id}

                          >

                            <input

                              type="checkbox"

                              checked={selected}

                              onChange={(event) =>

                                togglePrerequisite(

                                  talent.id,

                                  event.target.checked,

                                )

                              }

                            />



                            <span>

                              <strong>

                                {talent.name}

                              </strong>

                              <small>{treeName(talent.tree_key)}{talent.is_hidden ? ' · Oculto' : ''}</small>

                            </span>

                          </label>

                        )

                      })}



                      {availablePrerequisites.length === 0 && (

                        <p className="talent-prerequisite-empty">

                          {talents.length <= (editingId ? 1 : 0)

                            ? 'Cadastre outros talentos para definir pré-requisitos.'

                            : 'Nenhum talento encontrado.'}

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

                      const talent = talents.find(

                        (candidate) =>

                          candidate.id === item.prerequisite_talent_id,

                      )



                      if (!talent) return null



                      return (

                        <div

                          className="talent-prerequisite-item"

                          key={talent.id}

                        >

                          <div className="talent-prerequisite-name">

                            <strong>

                              {talent.name}

                            </strong>



                            <small>{treeName(talent.tree_key)}{talent.is_hidden ? ' · Oculto' : ''}</small>

                          </div>



                          <label className="talent-prerequisite-points">

                            <span>Pontos exigidos</span>



                            <input

                              type="number"

                              min={1}

                              max={talent.max_level}

                              value={item.required_points}

                              onChange={(event) =>

                                updatePrerequisitePoints(

                                  talent.id,

                                  Math.min(

                                    talent.max_level,

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

                              togglePrerequisite(talent.id, false)

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

                            (tree) =>

                              !form.treeRequirements.some(

                                (other, otherIndex) =>

                                  otherIndex !== index &&

                                  other.required_tree_key === tree.id,

                              ),

                          )

                          .map((tree) => (

                            <option key={tree.id} value={tree.id}>

                              {tree.name}

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

                  {saving

                    ? 'Salvando...'

                    : editingId

                      ? 'Salvar alterações'

                      : 'Cadastrar talento'}

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

                  Verificando vínculos de pré-requisito...

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

                          <li key={dependent.id}>{dependent.name}</li>

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

                    A pontuação individual não é consultada nesta tela. O

                    resumo de pontos permanece disponível por árvore na

                    progressão do Compendium.

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

    </section>

  )

}