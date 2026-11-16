import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Aceita vírgula ou ponto como separador decimal (ex.: 1,5 m).
function parseLocalizedNumber(value: string): number {
  return Number(value.trim().replace(',', '.'))
}
function isValidLocalizedNumber(value: string): boolean {
  return value.trim() !== '' && Number.isFinite(parseLocalizedNumber(value))
}

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

type ActivityType = 'attack' | 'save' | 'damage' | 'heal' | 'utility'
type ActivityDraft = {
  id?: string
  name: string
  type: ActivityType
  activationType: string
  activationCost: string
  rangeValue: string
  rangeUnit: string
  targetType: string
  targetValue: string
  targetUnits: string
  saveAbility: string
  saveDcType: string
  saveDcValue: string
  attackType: string
  attackAbility: string
  damageFormula: string
  damageType: string
  halfOnSuccess: boolean
  description: string
  usesLimited: boolean
  usesMax: string
  recharge: 'shortRest' | 'longRest' | 'turnStart' | 'special'
  rechargeSpecial: string
  expanded: boolean
}
const activityTypes: {value:ActivityType;label:string}[] = [
  {value:'attack',label:'Ataque'}, {value:'save',label:'Salvaguarda'},
  {value:'damage',label:'Dano direto'}, {value:'heal',label:'Cura'}, {value:'utility',label:'Utilidade'}
]
const areaTypes = [
  {value:'sphere',label:'Esfera'}, {value:'cone',label:'Cone'}, {value:'line',label:'Linha'},
  {value:'cube',label:'Cubo'}, {value:'cylinder',label:'Cilindro'}
]
const damageTypes = [
  ['acid','Ácido'],['cold','Frio'],['fire','Fogo'],['force','Energia'],['lightning','Elétrico'],
  ['necrotic','Necrótico'],['poison','Veneno'],['psychic','Psíquico'],['radiant','Radiante'],
  ['thunder','Trovejante'],['bludgeoning','Contundente'],['piercing','Perfurante'],['slashing','Cortante']
]
const makeActivity = (): ActivityDraft => ({
  id:crypto.randomUUID(), name:'', type:'save', activationType:'action', activationCost:'1',
  rangeValue:'', rangeUnit:'m', targetType:'sphere', targetValue:'', targetUnits:'m',
  saveAbility:'dex', saveDcType:'ability', saveDcValue:'', attackType:'spell', attackAbility:'spellcasting',
  damageFormula:'', damageType:'fire', halfOnSuccess:true, description:'',
  usesLimited:false, usesMax:'1', recharge:'longRest', rechargeSpecial:'', expanded:true
})
function parseActivity(row:any): ActivityDraft {
  const d=row.activity_data??{}
  return {
    id:row.id, name:row.name??'', type:d.type??'utility',
    activationType:d.activation?.type??'action', activationCost:String(d.activation?.cost??1),
    rangeValue:d.range?.value==null?'':String(d.range.value), rangeUnit:d.range?.unit??'m',
    targetType:d.target?.type??'sphere', targetValue:d.target?.value==null?'':String(d.target.value),
    targetUnits:d.target?.units??'m', saveAbility:d.save?.ability??'dex',
    saveDcType:d.save?.dc?.type??'ability', saveDcValue:d.save?.dc?.value==null?'':String(d.save.dc.value),
    attackType:d.attack?.type??'spell', attackAbility:d.attack?.ability??'spellcasting',
    damageFormula:d.damage?.formula??d.healing?.formula??'',
    damageType:d.damage?.type??'fire', halfOnSuccess:Boolean(d.damage?.halfOnSuccess),
    description:d.description??'', usesLimited:Boolean(d.uses?.limited ?? (d.uses?.max != null)),
    usesMax:String(d.uses?.max ?? '1'), recharge:d.uses?.recharge??'longRest',
    rechargeSpecial:d.uses?.special??'', expanded:false
  }
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
  const [activities,setActivities]=useState<ActivityDraft[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setItems([]);setActivities([]);setError('')
      if(!talentId||!supabase)return
      setLoading(true)
      const [ownerResult,activityResult]=await Promise.all([
        supabase.from('compendium_effect_owners').select('id').eq('talent_id',talentId).maybeSingle(),
        supabase.from('compendium_talent_activities').select('*').eq('talent_id',talentId).order('sort_order')
      ])
      if(ownerResult.error||activityResult.error){if(!cancelled)setError(ownerResult.error?.message??activityResult.error?.message??'Falha ao carregar dados.');setLoading(false);return}
      let effectRows:any[]=[]
      if(ownerResult.data){
        const {data,error:queryError}=await supabase.from('compendium_effects').select('*').eq('owner_id',ownerResult.data.id).order('sort_order')
        if(queryError){if(!cancelled)setError(queryError.message);setLoading(false);return}
        effectRows=data??[]
      }
      if(cancelled)return
      setItems(effectRows.map(parseRecord))
      setActivities((activityResult.data??[]).map(parseActivity))
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
      if(item.amount.trim()&&!isValidLocalizedNumber(item.amount))throw new Error(`A quantidade de "${item.name}" deve ser numérica.`)
      if(item.scales&&(!item.perLevel.trim()||!isValidLocalizedNumber(item.perLevel)))throw new Error(`Informe o aumento numérico por nível de "${item.name}".`)
    }
    const payload=active.map((item,index)=>{
      const option=targets[item.group].find(x=>x.value===item.target)
      const params:Record<string,unknown>={target:item.target}
      if(item.amount.trim())params.value=parseLocalizedNumber(item.amount)
      if(item.unit.trim())params.unit=item.unit.trim()
      if(item.group==='movement')params.movement_type=item.target.replace(/_speed$/,'').replace('_distance','')
      return {name:item.name.trim(),effect_type:option?.effectType??'special_ability',display_section:option?.section??'special_abilities',summary_description:item.description.trim(),description:item.details.trim()||null,parameters:params,scaling:item.scales?{basis:'acquired_levels',value_per_level:parseLocalizedNumber(item.perLevel)}:null,formula:null,stacking_rule:item.stacking,sort_order:index,is_enabled:true}
    })
    const {data:owner,error:ownerError}=await supabase.from('compendium_effect_owners').select('id').eq('talent_id',id).maybeSingle()
    if(ownerError)throw ownerError
    let ownerId=owner?.id
    if(!ownerId&&payload.length){const {data,error}=await supabase.from('compendium_effect_owners').insert({talent_id:id}).select('id').single();if(error)throw error;ownerId=data.id}
    if(ownerId){
      const {error:deleteError}=await supabase.from('compendium_effects').delete().eq('owner_id',ownerId)
      if(deleteError)throw deleteError
      if(payload.length){const {error}=await supabase.from('compendium_effects').insert(payload.map(x=>({...x,owner_id:ownerId})));if(error)throw error}
    }

    const activityPayload=activities.filter(x=>x.name.trim()).map((a,index)=>{
      if(a.usesLimited){
        const max=Number(a.usesMax)
        if(!Number.isInteger(max)||max<1)throw new Error(`A quantidade máxima de usos de "${a.name}" deve ser um inteiro maior que zero.`)
        if(a.recharge==='special'&&!a.rechargeSpecial.trim())throw new Error(`Descreva a condição de recarga especial de "${a.name}".`)
      }
      const numeric=(value:string,label:string)=>{if(!value.trim())return null;const n=parseLocalizedNumber(value);if(!Number.isFinite(n)||n<0)throw new Error(`${label} deve ser um número válido.`);return n}
      const data:any={type:a.type,description:a.description.trim()||null,activation:{type:a.activationType,cost:numeric(a.activationCost,'Custo de ativação')??1}}
      const range=numeric(a.rangeValue,'Alcance');if(range!==null)data.range={value:range,unit:a.rangeUnit}
      const area=numeric(a.targetValue,'Tamanho da área');if(area!==null)data.target={type:a.targetType,value:area,units:a.targetUnits}
      if(a.type==='save')data.save={ability:a.saveAbility,dc:{type:a.saveDcType,...(a.saveDcType==='fixed'?{value:numeric(a.saveDcValue,'CD')??0}:{})}}
      if(a.type==='attack')data.attack={type:a.attackType,ability:a.attackAbility}
      if(a.type==='damage'||a.type==='save'||a.type==='attack'){
        if(a.damageFormula.trim())data.damage={formula:a.damageFormula.trim(),type:a.damageType,halfOnSuccess:a.type==='save'&&a.halfOnSuccess}
      }
      if(a.type==='heal'&&a.damageFormula.trim())data.healing={formula:a.damageFormula.trim()}
      if(a.usesLimited)data.uses={limited:true,max:Number(a.usesMax),recharge:a.recharge,...(a.recharge==='special'?{special:a.rechargeSpecial.trim()}: {})}
      return {id:a.id??crypto.randomUUID(),talent_id:id,name:a.name.trim(),activity_data:data,sort_order:index,is_enabled:true}
    })
    // Upsert first: if persistence fails, do not delete the previously saved activities.
    if(activityPayload.length){const {error}=await supabase.from('compendium_talent_activities').upsert(activityPayload,{onConflict:'id'});if(error)throw error}
    const retainedIds=activityPayload.map(x=>x.id)
    let deleteQuery=supabase.from('compendium_talent_activities').delete().eq('talent_id',id)
    if(retainedIds.length)deleteQuery=deleteQuery.not('id','in',`(${retainedIds.join(',')})`)
    const {error:deleteActivitiesError}=await deleteQuery
    if(deleteActivitiesError)throw deleteActivitiesError
  }}),[items,activities,loading])

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
          {numeric&&<div className="raziel-effect-two-col"><label>Quantidade<input type="text" inputMode="decimal" value={item.amount} onChange={e=>patch(i,{amount:e.target.value})} placeholder="Ex.: 3"/></label><label>Unidade<input value={item.unit} onChange={e=>patch(i,{unit:e.target.value})} placeholder={option.unit}/></label></div>}
          <label>Descrição curta <small className="raziel-field-help">Será exibida no statblock.</small><input required value={item.description} onChange={e=>patch(i,{description:e.target.value})} placeholder="Ex.: Recebe +3 m de deslocamento terrestre."/></label>
          <label>Detalhes adicionais <small className="raziel-field-help">Opcional. Use para condições, limites e exceções.</small><textarea rows={2} value={item.details} onChange={e=>patch(i,{details:e.target.value})} placeholder="Detalhes que o jogador precisa conhecer…"/></label>
          {numeric&&<div className="raziel-effect-scaling"><label className="raziel-effect-check"><input type="checkbox" checked={item.scales} onChange={e=>patch(i,{scales:e.target.checked})}/> A quantidade aumenta a cada nível deste talento</label>{item.scales&&<label>Quantidade adicional por nível<input type="text" inputMode="decimal" value={item.perLevel} onChange={e=>patch(i,{perLevel:e.target.value})} placeholder="Ex.: 5"/></label>}</div>}
          <details className="raziel-effect-advanced"><summary>Regra de acúmulo (opcional)</summary><label>Como este benefício se combina com outros?<select value={item.stacking} onChange={e=>patch(i,{stacking:e.target.value})}><option value="additive">Somar aos demais bônus</option><option value="highest">Considerar apenas o maior</option><option value="override">Substituir o valor anterior</option><option value="independent">Funciona independentemente</option></select></label></details>
        </div>}
      </article>
    })}
    <div className="raziel-activities-editor">
      <div className="raziel-effects-heading">
        <div><h3><Sparkles size={16}/> Ações e atividades no Foundry</h3><p>Cadastre ações executáveis da habilidade. Elas serão exportadas para virar Activities nativas da Feature no D&amp;D 5e.</p></div>
        <button type="button" onClick={()=>setActivities(current=>[...current,makeActivity()])}><Plus size={15}/> Adicionar atividade</button>
      </div>
      {!activities.length&&<div className="raziel-effects-empty"><strong>Nenhuma atividade cadastrada.</strong><span>Use esta área quando o talento permitir executar um ataque, causar dano, exigir salvaguarda, curar ou realizar outra ação.</span></div>}
      {activities.map((a,i)=><article className="raziel-effect-card" key={a.id??`activity-${i}`}>
        <header className="raziel-effect-card-head"><div><span className="raziel-effect-kicker">ATIVIDADE {i+1}</span><strong>{a.name||'Nova atividade'}</strong><small>{activityTypes.find(x=>x.value===a.type)?.label} · {a.activationType==='bonus'?'Ação bônus':a.activationType==='reaction'?'Reação':a.activationType==='minute'?'Minuto':'Ação'}</small></div><div className="raziel-effect-actions"><button type="button" aria-label="Expandir ou recolher" onClick={()=>setActivities(current=>current.map((x,n)=>n===i?{...x,expanded:!x.expanded}:x))}>{a.expanded?<ChevronUp size={17}/>:<ChevronDown size={17}/>}</button><button type="button" className="danger" aria-label="Remover atividade" onClick={()=>setActivities(current=>current.filter((_,n)=>n!==i))}><Trash2 size={16}/></button></div></header>
        {a.expanded&&<div className="raziel-effect-form">
          <label>Nome da atividade<input value={a.name} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,name:e.target.value}:x))} placeholder="Ex.: Sopro dracônico"/></label>
          <div className="raziel-effect-two-col">
            <label>Tipo<select value={a.type} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,type:e.target.value as ActivityType}:x))}>{activityTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            <label>Ativação<select value={a.activationType} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,activationType:e.target.value}:x))}><option value="action">Ação</option><option value="bonus">Ação bônus</option><option value="reaction">Reação</option><option value="minute">Minuto</option><option value="special">Especial</option></select></label>
          </div>
          <div className="raziel-effect-two-col">
            <label>Alcance<input type="text" inputMode="decimal" value={a.rangeValue} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,rangeValue:e.target.value}:x))} placeholder="Opcional"/></label>
            <label>Unidade<select value={a.rangeUnit} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,rangeUnit:e.target.value}:x))}><option value="m">Metros</option><option value="self">Pessoal</option><option value="touch">Toque</option><option value="unlimited">Ilimitado</option></select></label>
          </div>
          <fieldset className="raziel-activity-fieldset"><legend>Área de efeito (opcional)</legend>
            <div className="raziel-effect-two-col">
              <label>Formato<select value={a.targetType} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,targetType:e.target.value}:x))}>{areaTypes.map(t=><option value={t.value} key={t.value}>{t.label}</option>)}</select></label>
              <label>Tamanho<input type="text" inputMode="decimal" value={a.targetValue} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,targetValue:e.target.value}:x))} placeholder="Ex.: 6"/></label>
            </div>
            <label>Unidade<select value={a.targetUnits} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,targetUnits:e.target.value}:x))}><option value="m">Metros</option><option value="ft">Pés</option></select></label>
          </fieldset>
          {a.type==='save'&&<fieldset className="raziel-activity-fieldset"><legend>Salvaguarda</legend>
            <div className="raziel-effect-two-col"><label>Atributo<select value={a.saveAbility} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,saveAbility:e.target.value}:x))}>{[['str','Força'],['dex','Destreza'],['con','Constituição'],['int','Inteligência'],['wis','Sabedoria'],['cha','Carisma']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label><label>CD<select value={a.saveDcType} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,saveDcType:e.target.value}:x))}><option value="ability">CD baseada na ficha</option><option value="fixed">CD fixa</option></select></label></div>
            {a.saveDcType==='fixed'&&<label>Valor da CD<input type="text" inputMode="decimal" value={a.saveDcValue} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,saveDcValue:e.target.value}:x))}/></label>}
            <label className="raziel-effect-check"><input type="checkbox" checked={a.halfOnSuccess} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,halfOnSuccess:e.target.checked}:x))}/> Metade do dano em caso de sucesso</label>
          </fieldset>}
          {a.type==='attack'&&<fieldset className="raziel-activity-fieldset"><legend>Configuração do ataque</legend><div className="raziel-effect-two-col"><label>Categoria<select value={a.attackType} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,attackType:e.target.value}:x))}><option value="spell">Ataque mágico</option><option value="weapon">Ataque com arma</option><option value="unarmed">Ataque desarmado</option></select></label><label>Atributo<select value={a.attackAbility} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,attackAbility:e.target.value}:x))}><option value="spellcasting">Conjuração</option><option value="str">Força</option><option value="dex">Destreza</option><option value="none">Sem atributo</option></select></label></div></fieldset>}
          {['attack','save','damage','heal'].includes(a.type)&&<fieldset className="raziel-activity-fieldset"><legend>{a.type==='heal'?'Cura':'Dano'}</legend><label>Fórmula<input value={a.damageFormula} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,damageFormula:e.target.value}:x))} placeholder="Ex.: 8d6 + modificador"/></label>{a.type!=='heal'&&<label>Tipo de dano<select value={a.damageType} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,damageType:e.target.value}:x))}>{damageTypes.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>}</fieldset>}
          <fieldset className="raziel-activity-fieldset"><legend>Usos e recarga</legend>
            <label className="raziel-effect-check"><input type="checkbox" checked={a.usesLimited} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,usesLimited:e.target.checked}:x))}/> Esta atividade possui limite de usos</label>
            {a.usesLimited&&<>
              <label>Quantidade máxima de usos<input type="number" min="1" step="1" inputMode="numeric" value={a.usesMax} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,usesMax:e.target.value}:x))} placeholder="Ex.: 2"/></label>
              <label>Recuperação dos usos<select value={a.recharge} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,recharge:e.target.value as ActivityDraft['recharge']}:x))}><option value="shortRest">Descanso curto</option><option value="longRest">Descanso longo</option><option value="turnStart">Início do seu turno</option><option value="special">Condição especial</option></select></label>
              {a.recharge==='special'&&<label>Condição de recarga<textarea rows={2} value={a.rechargeSpecial} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,rechargeSpecial:e.target.value}:x))} placeholder="Ex.: Ao amanhecer, após completar um ritual…"/></label>}
            </>}
            <small className="raziel-field-help">Sem limite de usos: a atividade permanece ilimitada. A recarga especial será registrada como regra descritiva; não será automatizada pelo Foundry.</small>
          </fieldset>
          <label>Descrição / instruções<textarea rows={2} value={a.description} onChange={e=>setActivities(c=>c.map((x,n)=>n===i?{...x,description:e.target.value}:x))} placeholder="Regras adicionais, limitações ou observações…"/></label>
        </div>}
      </article>)}
    </div>
  </section>
})
export default TalentEffectsEditor
