import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

export type TalentEffectsEditorHandle = { save: (talentId: string) => Promise<void> }

type Group = 'combat' | 'vitality' | 'defense' | 'movement' | 'special'
type Draft = {
  id?: string
  group: Group
  name: string
  target: string
  amount: string
  unit: string
  description: string
  details: string
  scales: boolean
  perLevel: string
  stacking: string
  expanded: boolean
}

const groups: { value: Group; label: string; help: string }[] = [
  { value:'combat', label:'Bônus e atributos', help:'CA, percepção, ataques, testes e outros bônus.' },
  { value:'vitality', label:'Vida e recuperação', help:'PV máximos, cura e regeneração.' },
  { value:'defense', label:'Defesas e resistências', help:'Resistência a dano, imunidades e condições.' },
  { value:'movement', label:'Deslocamento e sentidos', help:'Caminhada, voo, escalada, natação, teleporte e sentidos especiais.' },
  { value:'special', label:'Habilidade especial', help:'Capacidades que precisam de uma descrição própria.' },
]

const targets: Record<Group,{value:string;label:string;unit:string;effectType:string;section:string}[]> = {
  combat: [
    {value:'armor_class',label:'Classe de Armadura (CA)',unit:'pontos',effectType:'numeric_bonus',section:'combat'},
    {value:'perception',label:'Percepção',unit:'pontos',effectType:'numeric_bonus',section:'sense'},
    {value:'initiative',label:'Iniciativa',unit:'pontos',effectType:'numeric_bonus',section:'combat'},
    {value:'attack_roll',label:'Jogadas de ataque',unit:'pontos',effectType:'numeric_bonus',section:'attack'},
    {value:'damage_roll',label:'Rolagens de dano',unit:'pontos',effectType:'numeric_bonus',section:'attack'},
    {value:'saving_throws',label:'Testes de resistência',unit:'pontos',effectType:'numeric_bonus',section:'combat'},
    {value:'ability_checks',label:'Testes de atributo',unit:'pontos',effectType:'numeric_bonus',section:'mind'},
    {value:'spell_save_dc',label:'CD de magia',unit:'pontos',effectType:'numeric_bonus',section:'magic'},
  ],
  vitality: [
    {value:'maximum_hit_points',label:'Pontos de vida máximos',unit:'PV',effectType:'numeric_bonus',section:'vitality'},
    {value:'hit_points',label:'Recuperação de pontos de vida',unit:'PV',effectType:'recovery',section:'vitality'},
    {value:'temporary_hit_points',label:'Pontos de vida temporários',unit:'PV',effectType:'recovery',section:'vitality'},
    {value:'regeneration',label:'Regeneração de vida',unit:'PV por turno',effectType:'regeneration',section:'vitality'},
  ],
  defense: [
    ...['acid','cold','fire','force','lightning','necrotic','poison','psychic','radiant','thunder','bludgeoning','piercing','slashing'].map(v=>({value:v,label:({acid:'Ácido',cold:'Frio',fire:'Fogo',force:'Energia',lightning:'Elétrico',necrotic:'Necrótico',poison:'Veneno',psychic:'Psíquico',radiant:'Radiante',thunder:'Trovejante',bludgeoning:'Contundente',piercing:'Perfurante',slashing:'Cortante'} as Record<string,string>)[v],unit:'',effectType:'resistance',section:'resistance'})),
    {value:'conditions',label:'Condições',unit:'',effectType:'condition_modifier',section:'resistance'},
  ],
  movement: [
    {value:'walking_speed',label:'Deslocamento terrestre',unit:'m',effectType:'movement',section:'displacement'},
    {value:'flying_speed',label:'Deslocamento de voo',unit:'m',effectType:'movement',section:'displacement'},
    {value:'climbing_speed',label:'Deslocamento de escalada',unit:'m',effectType:'movement',section:'displacement'},
    {value:'swimming_speed',label:'Deslocamento de natação',unit:'m',effectType:'movement',section:'displacement'},
    {value:'burrowing_speed',label:'Deslocamento de escavação',unit:'m',effectType:'movement',section:'displacement'},
    {value:'gliding_speed',label:'Deslocamento de planagem',unit:'m',effectType:'movement',section:'displacement'},
    {value:'teleport_distance',label:'Distância de teleporte',unit:'m',effectType:'movement',section:'displacement'},
    {value:'darkvision',label:'Visão no escuro',unit:'m',effectType:'sense',section:'sense'},
    {value:'blindsight',label:'Percepção às cegas',unit:'m',effectType:'sense',section:'sense'},
    {value:'truesight',label:'Visão verdadeira',unit:'m',effectType:'sense',section:'sense'},
    {value:'tremorsense',label:'Sentido sísmico',unit:'m',effectType:'sense',section:'sense'},
  ],
  special: [
    {value:'special_ability',label:'Capacidade especial',unit:'',effectType:'special_ability',section:'special_abilities'},
    {value:'advantage',label:'Vantagem em uma situação',unit:'',effectType:'advantage',section:'special_abilities'},
    {value:'disadvantage',label:'Desvantagem imposta a um alvo',unit:'',effectType:'disadvantage',section:'special_abilities'},
    {value:'damage_modifier',label:'Modificação de dano',unit:'pontos',effectType:'damage_modifier',section:'attack'},
    {value:'rule_suppression',label:'Anulação de uma regra',unit:'',effectType:'rule_suppression',section:'special_abilities'},
    {value:'conditional',label:'Efeito condicional',unit:'',effectType:'conditional',section:'special_abilities'},
  ],
}

const makeDraft = (): Draft => ({group:'combat',name:'',target:'armor_class',amount:'',unit:'pontos',description:'',details:'',scales:false,perLevel:'',stacking:'additive',expanded:true})

function parseRecord(row:any): Draft {
  const p=row.parameters??{}, scaling=row.scaling??{}
  let group:Group='special'
  if(row.display_section==='vitality')group='vitality'
  else if(row.display_section==='resistance')group='defense'
  else if(row.display_section==='displacement'||row.display_section==='sense')group='movement'
  else if(['combat','attack','mind','magic'].includes(row.display_section))group='combat'
  const target=String(p.target??'special_ability')
  const option=targets[group].find(x=>x.value===target)
  return {id:row.id,group,name:row.name??'',target,amount:p.value==null?'':String(p.value),unit:String(p.unit??option?.unit??''),description:row.summary_description??'',details:row.description??'',scales:scaling.basis==='acquired_levels'||scaling.value_per_level!=null,perLevel:scaling.value_per_level==null?'':String(scaling.value_per_level),stacking:row.stacking_rule??'independent',expanded:false}
}

const TalentEffectsEditor=forwardRef<TalentEffectsEditorHandle,{talentId?:string|null}>(function TalentEffectsEditor({talentId},ref){
  const [items,setItems]=useState<Draft[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setItems([]);setError('')
      if(!talentId||!supabase)return
      setLoading(true)
      const {data:owner,error:ownerError}=await supabase.from('compendium_effect_owners').select('id').eq('talent_id',talentId).maybeSingle()
      if(ownerError){if(!cancelled)setError(ownerError.message);setLoading(false);return}
      if(!owner){setLoading(false);return}
      const {data,error:queryError}=await supabase.from('compendium_effects').select('*').eq('owner_id',owner.id).order('sort_order')
      if(cancelled)return
      if(queryError)setError(queryError.message);else setItems((data??[]).map(parseRecord))
      setLoading(false)
    }
    void load()
    return()=>{cancelled=true}
  },[talentId])

  useImperativeHandle(ref,()=>({async save(id:string){
    if(loading)throw new Error('Aguarde o carregamento dos efeitos.')
    if(!supabase)throw new Error('Supabase não está configurado.')
    const active=items.filter(x=>x.name.trim()||x.description.trim()||x.amount.trim())
    for(const item of active){
      if(!item.name.trim())throw new Error('Dê um nome ao efeito adicionado.')
      if(!item.description.trim())throw new Error(`A descrição curta de "${item.name}" é obrigatória.`)
      if(item.amount.trim()&&!Number.isFinite(Number(item.amount)))throw new Error(`A quantidade de "${item.name}" deve ser numérica.`)
      if(item.scales&&(!item.perLevel.trim()||!Number.isFinite(Number(item.perLevel))))throw new Error(`Informe o aumento numérico por nível de "${item.name}".`)
    }
    const payload=active.map((item,index)=>{
      const option=targets[item.group].find(x=>x.value===item.target)
      const params:Record<string,unknown>={target:item.target}
      if(item.amount.trim())params.value=Number(item.amount)
      if(item.unit.trim())params.unit=item.unit.trim()
      if(item.group==='movement')params.movement_type=item.target.replace(/_speed$/,'').replace('_distance','')
      return {name:item.name.trim(),effect_type:option?.effectType??'special_ability',display_section:option?.section??'special_abilities',summary_description:item.description.trim(),description:item.details.trim()||null,parameters:params,scaling:item.scales?{basis:'acquired_levels',value_per_level:Number(item.perLevel)}:null,formula:null,stacking_rule:item.stacking,sort_order:index,is_enabled:true}
    })
    const {data:owner,error:ownerError}=await supabase.from('compendium_effect_owners').select('id').eq('talent_id',id).maybeSingle()
    if(ownerError)throw ownerError
    let ownerId=owner?.id
    if(!ownerId&&payload.length){const {data,error}=await supabase.from('compendium_effect_owners').insert({talent_id:id}).select('id').single();if(error)throw error;ownerId=data.id}
    if(!ownerId)return
    const {error:deleteError}=await supabase.from('compendium_effects').delete().eq('owner_id',ownerId)
    if(deleteError)throw deleteError
    if(payload.length){const {error}=await supabase.from('compendium_effects').insert(payload.map(x=>({...x,owner_id:ownerId})));if(error)throw error}
  }}),[items,loading])

  function patch(i:number,change:Partial<Draft>){setItems(current=>current.map((x,index)=>index===i?{...x,...change}:x))}
  function changeGroup(i:number,group:Group){
    const first=targets[group][0]
    patch(i,{group,target:first.value,unit:first.unit})
  }

  return <section className="raziel-effects-editor">
    <div className="raziel-effects-heading"><div><h3><Sparkles size={16}/> O que esta habilidade concede?</h3><p>Escolha uma categoria simples e descreva o benefício. Os detalhes técnicos são organizados automaticamente.</p></div><button type="button" onClick={()=>setItems(current=>[...current,makeDraft()])}><Plus size={15}/> Adicionar benefício</button></div>
    {loading&&<p className="raziel-effects-empty">Carregando benefícios…</p>}
    {error&&<p className="raziel-effects-error" role="alert">{error}</p>}
    {!items.length&&!loading&&<div className="raziel-effects-empty"><strong>Nenhum benefício cadastrado.</strong><span>Se o talento concede alguma vantagem mecânica, adicione-a aqui. Se for apenas narrativo, não precisa adicionar nada.</span></div>}
    {items.map((item,i)=>{
      const options=targets[item.group]
      const option=options.find(x=>x.value===item.target)??options[0]
      const numeric=Boolean(option.unit)
      return <article className="raziel-effect-card" key={item.id??i}>
        <header className="raziel-effect-card-head"><div><span className="raziel-effect-kicker">BENEFÍCIO {i+1}</span><strong>{item.name||'Novo benefício'}</strong><small>{groups.find(x=>x.value===item.group)?.label} · {option.label}</small></div><div className="raziel-effect-actions"><button type="button" aria-label="Expandir ou recolher" onClick={()=>patch(i,{expanded:!item.expanded})}>{item.expanded?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button><button type="button" className="danger" aria-label="Remover benefício" onClick={()=>setItems(current=>current.filter((_,n)=>n!==i))}><Trash2 size={16}/></button></div></header>
        {item.expanded&&<div className="raziel-effect-form">
          <label>Nome<input value={item.name} onChange={e=>patch(i,{name:e.target.value})} placeholder="Ex.: Vitalidade Aprimorada"/></label>
          <label>Categoria<select value={item.group} onChange={e=>changeGroup(i,e.target.value as Group)}>{groups.map(g=><option value={g.value} key={g.value}>{g.label}</option>)}</select><small className="raziel-field-help">{groups.find(g=>g.value===item.group)?.help}</small></label>
          <label>Benefício<select value={item.target} onChange={e=>{const next=options.find(x=>x.value===e.target.value)!;patch(i,{target:next.value,unit:next.unit})}}>{options.map(x=><option value={x.value} key={x.value}>{x.label}</option>)}</select></label>
          {numeric&&<div className="raziel-effect-two-col"><label>Quantidade<input type="number" value={item.amount} onChange={e=>patch(i,{amount:e.target.value})} placeholder="Ex.: 3"/></label><label>Unidade<input value={item.unit} onChange={e=>patch(i,{unit:e.target.value})} placeholder={option.unit}/></label></div>}
          <label>Descrição curta <small className="raziel-field-help">Será exibida no statblock.</small><input required value={item.description} onChange={e=>patch(i,{description:e.target.value})} placeholder="Ex.: Recebe +3 m de deslocamento terrestre."/></label>
          <label>Detalhes adicionais <small className="raziel-field-help">Opcional. Use para condições, limites e exceções.</small><textarea rows={2} value={item.details} onChange={e=>patch(i,{details:e.target.value})} placeholder="Detalhes que o jogador precisa conhecer…"/></label>
          {numeric&&<div className="raziel-effect-scaling"><label className="raziel-effect-check"><input type="checkbox" checked={item.scales} onChange={e=>patch(i,{scales:e.target.checked})}/> A quantidade aumenta a cada nível deste talento</label>{item.scales&&<label>Quantidade adicional por nível<input type="number" value={item.perLevel} onChange={e=>patch(i,{perLevel:e.target.value})} placeholder="Ex.: 5"/></label>}</div>}
          <details className="raziel-effect-advanced"><summary>Regra de acúmulo (opcional)</summary><label>Como este benefício se combina com outros?<select value={item.stacking} onChange={e=>patch(i,{stacking:e.target.value})}><option value="additive">Somar aos demais bônus</option><option value="highest">Considerar apenas o maior</option><option value="override">Substituir o valor anterior</option><option value="independent">Funciona independentemente</option></select></label></details>
        </div>}
      </article>
    })}
  </section>
})
export default TalentEffectsEditor
