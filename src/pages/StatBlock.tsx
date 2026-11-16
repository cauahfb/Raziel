import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, Shield, Heart, Eye, Footprints, Wind, Waves, Mountain, MoveUpRight, Sparkles, Download, ChevronDown, Swords, Target, Flame, Cross, Zap, Link2, Wifi, WifiOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

type EffectRow = {
  effect_id?:string
  talent_id?:string|null
  source_type?:string|null
  id:string
  name:string
  effect_type:string
  display_section:string
  summary_description:string
  description?:string|null
  parameters?:Record<string,any>|null
  scaling?:Record<string,any>|null
  stacking_rule?:string
  owner_name?:string
  talent_name?:string
  source_name?:string
  acquired_levels?:number
  talent_level?:number
  activation_definition?:Record<string,any>|null
  trigger_definition?:Record<string,any>|null
  frequency_definition?:Record<string,any>|null
  duration_definition?:Record<string,any>|null
  target_definition?:Record<string,any>|null
  condition_definition?:Record<string,any>|null
}

type ActivityRow = {
  id:string
  talent_id:string
  name:string
  activity_data:Record<string,any>
  sort_order?:number
  talent_name?:string
}

const movementMeta:Record<string,{label:string;icon:typeof Footprints}> = {
  walking_speed:{label:'Terrestre',icon:Footprints}, walking:{label:'Terrestre',icon:Footprints},
  flying_speed:{label:'Voo',icon:Wind}, flying:{label:'Voo',icon:Wind},
  climbing_speed:{label:'Escalada',icon:Mountain}, climbing:{label:'Escalada',icon:Mountain},
  swimming_speed:{label:'Natação',icon:Waves}, swimming:{label:'Natação',icon:Waves},
  burrowing_speed:{label:'Escavação',icon:Mountain}, burrowing:{label:'Escavação',icon:Mountain},
  gliding_speed:{label:'Planagem',icon:Wind}, gliding:{label:'Planagem',icon:Wind},
  teleport_distance:{label:'Teleporte',icon:MoveUpRight}, teleport:{label:'Teleporte',icon:MoveUpRight},
}
const sections = [
  {key:'combat',title:'Atributos e combate'},
  {key:'vitality',title:'Vitalidade'},
  {key:'resistance',title:'Defesas e resistências'},
  {key:'displacement',title:'Deslocamento e sentidos'},
  {key:'special',title:'Habilidades especiais'},
]
const targetNames:Record<string,string> = {
  armor_class:'Classe de Armadura',perception:'Percepção',initiative:'Iniciativa',attack_roll:'Jogadas de ataque',
  damage_roll:'Rolagens de dano',saving_throws:'Testes de resistência',ability_checks:'Testes de atributo',
  spell_save_dc:'CD de magia',maximum_hit_points:'Pontos de vida máximos',hit_points:'Recuperação de PV',
  temporary_hit_points:'PV temporários',regeneration:'Regeneração',acid:'Ácido',cold:'Frio',fire:'Fogo',
  force:'Energia',lightning:'Elétrico',necrotic:'Necrótico',poison:'Veneno',psychic:'Psíquico',radiant:'Radiante',
  thunder:'Trovejante',bludgeoning:'Contundente',piercing:'Perfurante',slashing:'Cortante',conditions:'Condições',
  darkvision:'Visão no escuro',blindsight:'Percepção às cegas',truesight:'Visão verdadeira',tremorsense:'Sentido sísmico',
  special_ability:'Habilidade especial',advantage:'Vantagem',disadvantage:'Desvantagem',damage:'Modificação de dano',
}

function amountFor(effect:EffectRow):number|null {
  const raw=effect.parameters?.value
  if(raw===undefined||raw===null||raw==='')return null
  const base=Number(raw)
  if(!Number.isFinite(base))return null
  const perLevel=Number(effect.scaling?.value_per_level)
  const levels=Number(effect.acquired_levels??effect.talent_level??1)
  return effect.scaling?.basis==='acquired_levels'&&Number.isFinite(perLevel)?base+perLevel*Math.max(0,levels-1):base
}
function movementKey(effect:EffectRow):string {
  const target=String(effect.parameters?.target??'')
  const mode=String(effect.parameters?.movement_type??'')
  return movementMeta[target]?target:mode==='teleport'?'teleport_distance':mode?`${mode}_speed`:target
}
function metricValue(rows:EffectRow[],target:string):number|null {
  const matching=rows.filter(x=>x.parameters?.target===target)
  if(!matching.length)return null
  return matching.reduce((sum,x)=>sum+(amountFor(x)??0),0)
}
function formatAmount(value:number|null,unit:string) {
  if(value===null)return '—'
  const prefix=value>0?'+':''
  return `${prefix}${value.toLocaleString('pt-BR',{maximumFractionDigits:2})}${unit?` ${unit}`:''}`
}


const activityTypeLabel:Record<string,string>={attack:'Ataque',save:'Salvaguarda',damage:'Dano direto',heal:'Cura',utility:'Utilidade'}
const activationLabel:Record<string,string>={action:'Ação',bonus:'Ação bônus',reaction:'Reação',minute:'Minuto',hour:'Hora',special:'Especial'}
const areaLabel:Record<string,string>={sphere:'Esfera',cone:'Cone',line:'Linha',cube:'Cubo',cylinder:'Cilindro'}
const abilityLabel:Record<string,string>={str:'Força',dex:'Destreza',con:'Constituição',int:'Inteligência',wis:'Sabedoria',cha:'Carisma'}
const damageLabel:Record<string,string>={acid:'ácido',cold:'frio',fire:'fogo',force:'energia',lightning:'elétrico',necrotic:'necrótico',poison:'veneno',psychic:'psíquico',radiant:'radiante',thunder:'trovejante',bludgeoning:'contundente',piercing:'perfurante',slashing:'cortante'}
const attackTypeLabel:Record<string,string>={spell:'mágico',weapon:'com arma',unarmed:'desarmado'}
function activityDetails(activity:ActivityRow):string[] {
  const d=activity.activity_data??{}, rows:string[]=[]
  const activation=d.activation
  if(activation?.type)rows.push(`Ativação: ${activationLabel[activation.type]??activation.type}${activation.cost&&activation.cost!==1?` (${activation.cost})`:''}`)
  if(d.range?.value!=null)rows.push(`Alcance: ${d.range.value} ${d.range.unit??'m'}`)
  if(d.target?.type&&d.target?.value!=null)rows.push(`Área: ${areaLabel[d.target.type]??d.target.type} de ${d.target.value} ${d.target.units??'m'}`)
  if(d.save?.ability)rows.push(`Salvaguarda: ${abilityLabel[d.save.ability]??d.save.ability}${d.save.dc?.type==='fixed'?` · CD ${d.save.dc.value}`:' · CD baseada na ficha'}`)
  if(d.attack?.type)rows.push(`Ataque: ${attackTypeLabel[String(d.attack.type)]??String(d.attack.type)}`)
  if(d.damage?.formula)rows.push(`Dano: ${d.damage.formula}${d.damage.type?` ${damageLabel[d.damage.type]??d.damage.type}`:''}${d.damage.halfOnSuccess?' · metade em caso de sucesso':''}`)
  if(d.healing?.formula)rows.push(`Cura: ${d.healing.formula}`)
  return rows
}
function ActivityIcon({type}:{type:string}){
  const Icon=type==='attack'?Swords:type==='save'?Target:type==='damage'?Flame:type==='heal'?Cross:Zap
  return <Icon size={17}/>
}

type StatBlockProps = { isAdmin?: boolean }

export default function StatBlock({isAdmin=false}:StatBlockProps){
  const exportMenuRef=useRef<HTMLDetailsElement|null>(null)

  useEffect(()=>{
    function closeExportMenuOnOutsideClick(event:PointerEvent){
      const menu=exportMenuRef.current
      if(menu?.open && event.target instanceof Node && !menu.contains(event.target)){
        menu.open=false
      }
    }
    function closeExportMenuOnEscape(event:KeyboardEvent){
      if(event.key==='Escape'&&exportMenuRef.current?.open){
        exportMenuRef.current.open=false
      }
    }
    document.addEventListener('pointerdown',closeExportMenuOnOutsideClick)
    document.addEventListener('keydown',closeExportMenuOnEscape)
    return ()=>{
      document.removeEventListener('pointerdown',closeExportMenuOnOutsideClick)
      document.removeEventListener('keydown',closeExportMenuOnEscape)
    }
  },[])
  const [effects,setEffects]=useState<EffectRow[]>([])
  const [activities,setActivities]=useState<ActivityRow[]>([])
  const [level,setLevel]=useState<number|null>(null)
  const [points,setPoints]=useState(0)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [exporting,setExporting]=useState(false)
  const [foundryConnected,setFoundryConnected]=useState(false)
  const [foundryIntegration,setFoundryIntegration]=useState<{id:string;installation_name:string;world_id:string|null;actor_uuid:string}|null>(null)
  const [pairingCode,setPairingCode]=useState('')
  const [syncMessage,setSyncMessage]=useState('')
  const [syncMessageType,setSyncMessageType]=useState<'info'|'success'|'error'>('info')
  const [manualExportMessage,setManualExportMessage]=useState('')

  async function load(){
    if(!supabase){setError('A conexão com o Compêndio não está configurada.');setLoading(false);return}
    setLoading(true);setError('')
    const [effectResult,progressResult,levelResult,activityResult,talentNamesResult]=await Promise.all([
      supabase.from('compendium_effects_player_safe').select('*'),
      supabase.from('talent_progress_safe').select('talent_id,points'),
      supabase.from('compendium_progress').select('character_level').eq('id',1).maybeSingle(),
      supabase.from('compendium_talent_activities').select('id,talent_id,name,activity_data,sort_order').eq('is_enabled',true).order('sort_order'),
      supabase.from('talents_player_safe').select('id,name'),
    ])
    if(effectResult.error||progressResult.error||levelResult.error||activityResult.error||talentNamesResult.error)setError(effectResult.error?.message??progressResult.error?.message??levelResult.error?.message??activityResult.error?.message??talentNamesResult.error?.message??'Não foi possível carregar o Resumo.')
    else{
      setEffects((effectResult.data??[]) as EffectRow[])
      const acquiredIds=new Set((progressResult.data??[]).filter((row:any)=>Number(row.points)>0).map((row:any)=>String(row.talent_id)))
      const talentNames=new Map((talentNamesResult.data??[]).map((row:any)=>[String(row.id),String(row.name)]))
      setActivities(((activityResult.data??[]) as ActivityRow[]).filter(row=>acquiredIds.has(String(row.talent_id))).map(row=>({...row,talent_name:talentNames.get(String(row.talent_id))})))
      setPoints((progressResult.data??[]).reduce((sum,row)=>sum+Number(row.points||0),0))
      setLevel(levelResult.data?Number(levelResult.data.character_level):null)
    }
    setLoading(false)
  }
  useEffect(()=>{void load()},[])

  const metrics=useMemo(()=>{
    const ac=metricValue(effects,'armor_class')
    const hp=metricValue(effects,'maximum_hit_points')
    const perception=metricValue(effects,'perception')
    const movement=effects.filter(e=>movementMeta[movementKey(e)]&&amountFor(e)!==null)
    return {ac,hp,perception,movement}
  },[effects])

  const grouped=useMemo(()=>{
    const getSection=(effect:EffectRow)=>{
      if(effect.display_section==='vitality')return 'vitality'
      if(effect.display_section==='resistance')return 'resistance'
      if(effect.display_section==='displacement'||effect.display_section==='sense')return 'displacement'
      if(['combat','attack','mind','magic'].includes(effect.display_section))return 'combat'
      return 'special'
    }
    const map=new Map<string,EffectRow[]>()
    effects.forEach(effect=>{
      const key=getSection(effect)
      // Deslocamentos já aparecem no bloco próprio, com ícone e quantidade.
      if(key==='displacement' && movementMeta[movementKey(effect)])return
      map.set(key,[...(map.get(key)??[]),effect])
    })
    return sections.map(section=>({...section,rows:map.get(section.key)??[]})).filter(section=>section.rows.length)
  },[effects])

  function saveAsPdf(){
    // A impressão do navegador permite salvar em PDF sem adicionar bibliotecas ao projeto.
    window.setTimeout(()=>window.print(),100)
  }

  async function buildFoundryPayload(){
    if(!supabase)throw new Error('A conexão com o Compêndio não está configurada.')
    const [talentResult,progressResult,effectResult,activityResult]=await Promise.all([
      supabase.from('talents_player_safe').select('id, tree_key, name, icon_url, description, max_level, points_per_level, is_supreme'),
      supabase.from('talent_progress_safe').select('talent_id, points'),
      supabase.from('compendium_effects_player_safe').select('*'),
      supabase.from('compendium_talent_activities').select('id,talent_id,name,activity_data,sort_order').eq('is_enabled',true).order('sort_order'),
    ])
    const failure=talentResult.error??progressResult.error??effectResult.error??activityResult.error
    if(failure)throw failure
    const progress=new Map((progressResult.data??[]).map((row:any)=>[String(row.talent_id),Number(row.points??0)]))
    const effectsByTalent=new Map<string,any[]>()
    for(const row of effectResult.data??[]){
      if(row.source_type!=='talent'||!row.talent_id)continue
      const key=String(row.talent_id)
      effectsByTalent.set(key,[...(effectsByTalent.get(key)??[]),row])
    }
    const activitiesByTalent=new Map<string,any[]>()
    for(const row of activityResult.data??[]){
      const key=String(row.talent_id)
      activitiesByTalent.set(key,[...(activitiesByTalent.get(key)??[]),{id:String(row.id),name:String(row.name),...((row.activity_data??{}) as Record<string,unknown>)}])
    }
    const talents=(talentResult.data??[])
      .filter((talent:any)=>!talent.is_supreme&&Number(progress.get(String(talent.id))??0)>0)
      .map((talent:any)=>({
        id:String(talent.id),name:String(talent.name),tree:String(talent.tree_key),
        level:Number(progress.get(String(talent.id))??0),maxLevel:Number(talent.max_level??0),
        pointsPerLevel:Number(talent.points_per_level??1),image:talent.icon_url??null,
        description:talent.description??'',activities:activitiesByTalent.get(String(talent.id))??[],
        effects:(effectsByTalent.get(String(talent.id))??[]).map((effect:any)=>({
          id:String(effect.effect_id??effect.id),name:String(effect.effect_name??effect.name??talent.name),
          type:String(effect.effect_type),section:String(effect.display_section),
          summary:String(effect.summary_description??''),description:effect.description??null,
          parameters:effect.parameters??{},scaling:effect.scaling??null,
          stackingRule:effect.stacking_rule??'independent',activation:effect.activation_definition??null,
          trigger:effect.trigger_definition??null,frequency:effect.frequency_definition??null,
          duration:effect.duration_definition??null,target:effect.target_definition??null,
          condition:effect.condition_definition??null,
        }))
      }))
    return {
      schemaVersion:1,source:'raziel',exportedAt:new Date().toISOString(),completeSnapshot:true,
      character:{name:'Novrik',actorUuid:'Actor.3lDZrLkfuk0vOw5e'},
      system:{foundry:'14',gameSystem:'dnd5e',gameSystemVersion:'5.3.3'},talents
    }
  }

  async function exportManualJson(){
    setExporting(true)
    setManualExportMessage('')
    setError('')
    try{
      const payload=await buildFoundryPayload()
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})
      const url=URL.createObjectURL(blob)
      const anchor=document.createElement('a')
      anchor.href=url
      anchor.download=`raziel-resumo-${new Date().toISOString().replace(/[:.]/g,'-')}.json`
      anchor.click()
      window.setTimeout(()=>URL.revokeObjectURL(url),1000)
      setManualExportMessage('Resumo exportado em JSON para importação manual no Foundry.')
    }catch(err){
      setError(err instanceof Error?err.message:'Não foi possível exportar o resumo.')
    }finally{setExporting(false)}
  }

  async function refreshFoundryStatus(){
    if(!supabase||!isAdmin)return
    const {data,error}=await supabase.functions.invoke('raziel-foundry-bridge',{body:{action:'status'}})
    if(error||data?.error){
      setFoundryConnected(false)
      if(data?.error)setSyncMessage(data.error)
      return
    }
    setFoundryConnected(Boolean(data?.connected))
    setFoundryIntegration(data?.integration??null)
  }

  useEffect(()=>{
    if(!isAdmin)return
    void refreshFoundryStatus()
    const timer=window.setInterval(()=>void refreshFoundryStatus(),30000)
    return ()=>window.clearInterval(timer)
  },[isAdmin])

  async function startPairing(){
    if(!supabase||!isAdmin)return
    setExporting(true);setSyncMessage('Gerando código de pareamento…');setSyncMessageType('info')
    try{
      const {data,error}=await supabase.functions.invoke('raziel-foundry-bridge',{body:{action:'create_pairing'}})
      if(error)throw error
      if(data?.error)throw new Error(data.error)
      setPairingCode(String(data.code))
      setSyncMessage('Código gerado. Informe-o no painel Raziel Integration do Foundry. Ele expira em 5 minutos.')
      setSyncMessageType('success')
    }catch(err){
      setSyncMessage(err instanceof Error?err.message:'Não foi possível gerar o código.')
      setSyncMessageType('error')
    }finally{setExporting(false)}
  }

  async function syncWithFoundry(){
    if(!supabase||!isAdmin)return
    setExporting(true);setSyncMessage('Verificando conexão com o Foundry…');setSyncMessageType('info')
    try{
      const status=await supabase.functions.invoke('raziel-foundry-bridge',{body:{action:'status'}})
      if(status.error)throw status.error
      if(status.data?.error)throw new Error(status.data.error)
      if(!status.data?.connected||!status.data?.integration)throw new Error('O Foundry está desconectado. Abra o Foundry e aguarde a conexão do módulo.')
      const payload=await buildFoundryPayload()
      const sent=await supabase.functions.invoke('raziel-foundry-bridge',{
        body:{action:'request_sync',integrationId:status.data.integration.id,payload}
      })
      if(sent.error)throw sent.error
      if(sent.data?.error)throw new Error(sent.data.error)
      const requestId=String(sent.data.request.id)
      setSyncMessage('Solicitação enviada. Aguardando confirmação no Foundry…')
      setSyncMessageType('info')

      const deadline=Date.now()+600000
      while(Date.now()<deadline){
        await new Promise(resolve=>window.setTimeout(resolve,1800))
        const {data,error}=await supabase.from('foundry_sync_requests')
          .select('status,preview,result,error_message')
          .eq('id',requestId).maybeSingle()
        if(error)throw error
        if(!data)throw new Error('A solicitação não está mais disponível.')
        if(data.status==='awaiting_confirmation'){
          setSyncMessage('Aguardando você confirmar ou cancelar a operação na janela do Foundry…')
        }
        if(data.status==='completed'){
          const report=data.result??{}
          setSyncMessage(`Sincronização concluída: ${report.created??0} criada(s), ${report.updated??0} atualizada(s), ${report.deleted??0} removida(s).`)
          setSyncMessageType('success')
          return
        }
        if(data.status==='cancelled'){
          setSyncMessage('Sincronização cancelada pelo GM no Foundry.')
          setSyncMessageType('info')
          return
        }
        if(data.status==='failed'||data.status==='expired'){
          throw new Error(data.error_message||'A sincronização falhou ou expirou.')
        }
      }
      throw new Error('O Foundry não respondeu dentro do prazo. Verifique se o mundo continua aberto.')
    }catch(err){
      setSyncMessage(err instanceof Error?err.message:'Não foi possível sincronizar com o Foundry.')
      setSyncMessageType('error')
      await refreshFoundryStatus()
    }finally{setExporting(false)}
  }


  if(loading)return <main className="statblock-page"><p className="statblock-feedback">Consultando os registros de Raziel…</p></main>
  return <main className="statblock-page">
    <header className="statblock-header"><div><span className="eyebrow"><span className="eyebrow-line"/>COMPÊNDIO DE RAZIEL</span><h1>Resumo da Ficha</h1><p>Suas capacidades adquiridas, organizadas em formato de ficha.</p></div><div className="statblock-header-actions">
      <button type="button" onClick={()=>void load()} aria-label="Atualizar resumo"><RefreshCw size={16}/> Atualizar</button>
      {isAdmin&&<button type="button" onClick={()=>void (foundryConnected?syncWithFoundry():startPairing())} disabled={exporting||(!foundryConnected&&(Boolean(foundryIntegration)||Boolean(pairingCode)))}>
        {foundryConnected?<Link2 size={16}/>:<WifiOff size={16}/>} {exporting?'Processando…':foundryConnected?'Sincronizar com Foundry':foundryIntegration?'Foundry desconectado':pairingCode?'Aguardando pareamento':'Conectar Foundry'}
      </button>}
      <details ref={exportMenuRef} className="statblock-export-menu">
        <summary><Download size={16}/> Exportar <ChevronDown size={15}/></summary>
        <div className="statblock-export-menu-items">
          <button type="button" onClick={()=>{exportMenuRef.current&&(exportMenuRef.current.open=false);void exportManualJson()}} disabled={exporting}>
            <Download size={15}/> {exporting?'Exportando JSON…':'Exportar JSON'}
          </button>
          <button type="button" onClick={()=>{exportMenuRef.current&&(exportMenuRef.current.open=false);saveAsPdf()}}>
            <Download size={15}/> Exportar PDF
          </button>
        </div>
      </details>
    </div></header>
    {isAdmin&&<div className={`foundry-sync-status ${syncMessageType}`}>
      <span className="foundry-sync-indicator">{foundryConnected?<Wifi size={15}/>:<WifiOff size={15}/>}</span>
      <span>{syncMessage|| (foundryConnected?`Foundry conectado${foundryIntegration?.installation_name?` · ${foundryIntegration.installation_name}`:''}`:foundryIntegration?'Foundry desconectado. Abra o mundo no Foundry para habilitar a sincronização.':'Conecte sua instalação do Foundry para habilitar a sincronização.')}</span>
      {pairingCode&&<><strong className="foundry-pairing-code">{pairingCode}</strong><button type="button" onClick={()=>{setPairingCode('');void startPairing()}} disabled={exporting}>Gerar outro código</button></>}
    </div>}
    {error&&<p className="statblock-error" role="alert">{error}</p>}
    {manualExportMessage&&<p className="statblock-export-feedback" role="status">{manualExportMessage}</p>}
    <article className="statblock-sheet">
      <div className="statblock-title"><Sparkles size={22}/><div><span>REGISTRO DE CAPACIDADES</span><h2>Estatísticas e características</h2></div></div>
      <div className="statblock-primary">
        <div><Shield/><span>CA</span><strong>{formatAmount(metrics.ac,'')}</strong></div>
        <div><Heart/><span>VIDA</span><strong>{formatAmount(metrics.hp,'PV')}</strong></div>
        <div><Eye/><span>PERCEPÇÃO</span><strong>{formatAmount(metrics.perception,'')}</strong></div>
      </div>
      <section className="statblock-movement"><h3><Footprints size={16}/> DESLOCAMENTO</h3>
        {metrics.movement.length? <div className="statblock-movement-list">{metrics.movement.map((effect,index)=>{
          const key=movementKey(effect),meta=movementMeta[key],Icon=meta.icon
          return <div className="statblock-movement-item" key={effect.id??index}><Icon size={18}/><span>{meta.label}</span><strong>{formatAmount(amountFor(effect),effect.parameters?.unit??'m')}</strong></div>
        })}</div>:<p className="statblock-empty">Nenhum deslocamento adicional registrado.</p>}
      </section>
      <div className="statblock-meta"><span><small>NÍVEL GLOBAL</small><strong>{level??'—'}</strong></span><span><small>PONTOS INVESTIDOS</small><strong>{points}</strong></span><span><small>BENEFÍCIOS</small><strong>{effects.length}</strong></span><span><small>ATIVIDADES</small><strong>{activities.length}</strong></span></div>
      {grouped.length===0&&<p className="statblock-empty">Nenhum benefício estruturado foi adquirido ou está disponível para exibição.</p>}
      {grouped.map(section=><section className="statblock-section" key={section.key}><h3>{section.title}</h3>
        {section.rows.map((effect,index)=>{
          const target=String(effect.parameters?.target??'')
          const amount=amountFor(effect)
          const unit=String(effect.parameters?.unit??'')
          const movement=movementMeta[movementKey(effect)]
          const displayAmount=movement?formatAmount(amount,unit||'m'):amount!==null?formatAmount(amount,unit):''
          return <div className="statblock-effect" key={effect.id??`${section.key}-${index}`}>
            <p><strong>{effect.name??targetNames[target]??'Benefício'}.</strong> {effect.summary_description??effect.description??'Sem descrição mecânica.'}{displayAmount&&<em>{displayAmount}</em>}</p>
            {effect.description&&effect.description!==effect.summary_description&&<details><summary>Detalhes e origem</summary><p>{effect.description}</p><small>Origem: {effect.owner_name??effect.talent_name??effect.source_name??'Talento adquirido'}</small></details>}
          </div>
        })}
      </section>)}
      <section className="statblock-activities">
        <div className="statblock-activities-heading">
          <h3><Swords size={17}/> Ações e atividades</h3>
          <span>{activities.length} {activities.length===1?'atividade':'atividades'}</span>
        </div>
        {activities.length ? activities.map((activity,index)=>{
          const data=activity.activity_data??{}
          const details=activityDetails(activity)
          return <article className="statblock-activity" key={activity.id??index}>
            <div className="statblock-activity-icon"><ActivityIcon type={data.type??'utility'}/></div>
            <div className="statblock-activity-content">
              <div className="statblock-activity-title"><strong>{activity.name}</strong><span>{activityTypeLabel[data.type]??'Atividade'}</span></div>
              {details.length>0&&<ul>{details.map((detail,i)=><li key={i}>{detail}</li>)}</ul>}
              {data.description&&<p>{data.description}</p>}
              <small>Origem: {activity.talent_name??'Talento adquirido'}</small>
            </div>
          </article>
        }):<p className="statblock-empty">Nenhuma atividade executável foi cadastrada nos talentos adquiridos.</p>}
      </section>
    </article>
  </main>
}
