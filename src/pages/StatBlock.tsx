import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Shield, Heart, Eye, Footprints, Wind, Waves, Mountain, MoveUpRight, Sparkles, Download, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'

type EffectRow = {
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
  return `${prefix}${value}${unit?` ${unit}`:''}`
}

export default function StatBlock(){
  const [effects,setEffects]=useState<EffectRow[]>([])
  const [level,setLevel]=useState<number|null>(null)
  const [points,setPoints]=useState(0)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')

  async function load(){
    if(!supabase){setError('A conexão com o Compêndio não está configurada.');setLoading(false);return}
    setLoading(true);setError('')
    const [effectResult,progressResult,levelResult]=await Promise.all([
      supabase.from('compendium_effects_player_safe').select('*'),
      supabase.from('talent_progress_safe').select('points'),
      supabase.from('compendium_progress').select('character_level').eq('id',1).maybeSingle(),
    ])
    if(effectResult.error||progressResult.error||levelResult.error)setError(effectResult.error?.message??progressResult.error?.message??levelResult.error?.message??'Não foi possível carregar o Resumo.')
    else{
      setEffects((effectResult.data??[]) as EffectRow[])
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



  if(loading)return <main className="statblock-page"><p className="statblock-feedback">Consultando os registros de Raziel…</p></main>
  return <main className="statblock-page">
    <header className="statblock-header"><div><span className="eyebrow"><span className="eyebrow-line"/>COMPÊNDIO DE RAZIEL</span><h1>Resumo da Ficha</h1><p>Suas capacidades adquiridas, organizadas em formato de ficha.</p></div><div className="statblock-header-actions">
      <button type="button" onClick={()=>void load()} aria-label="Atualizar resumo"><RefreshCw size={16}/> Atualizar</button>
      <button type="button" className="statblock-save-button" onClick={saveAsPdf}><Download size={16}/> Salvar PDF</button>
    </div></header>
    {error&&<p className="statblock-error" role="alert">{error}</p>}
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
      <div className="statblock-meta"><span><small>NÍVEL GLOBAL</small><strong>{level??'—'}</strong></span><span><small>PONTOS INVESTIDOS</small><strong>{points}</strong></span><span><small>BENEFÍCIOS</small><strong>{effects.length}</strong></span></div>
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
    </article>
  </main>
}
