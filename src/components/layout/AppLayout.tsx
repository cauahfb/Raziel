import { useState } from 'react'
import type { ReactNode } from 'react'
import { CircleHelp, LogOut, Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import type { PageKey, Tree } from '../../types/tree'

type AppLayoutProps = {
  activePage: PageKey
  trees: Tree[]
  isAdmin: boolean
  supremeAvailableCount: number
  onNavigate: (page: PageKey) => void
  onSignOut: () => void
  children: ReactNode
}

export default function AppLayout({ activePage, trees, isAdmin, supremeAvailableCount, onNavigate, onSignOut, children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const selectedTree = trees.find((tree) => tree.id === activePage)
  const breadcrumb = selectedTree?.name.toUpperCase() ?? (activePage === 'summary' ? 'RESUMO' : activePage === 'supremas' ? 'CONHECIMENTO RESTRITO' : activePage === 'history' || activePage === 'backup' ? 'ÁREA ADMINISTRATIVA' : 'VISÃO GERAL')

  function navigate(page: PageKey) {
    onNavigate(page)
    setMobileOpen(false)
  }

  return (
    <div className={`app-shell ${activePage === 'supremas' ? 'supreme-theme' : ''}`}>
      <aside className="sidebar"><Sidebar activePage={activePage} trees={trees} isAdmin={isAdmin} supremeAvailableCount={supremeAvailableCount} onNavigate={navigate} /></aside>

      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-sidebar" onClick={(event) => event.stopPropagation()}>
            <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
            <Sidebar activePage={activePage} trees={trees} isAdmin={isAdmin} supremeAvailableCount={supremeAvailableCount} onNavigate={navigate} />
          </div>
        </div>
      )}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
          <div className="breadcrumb">COMPENDIUM<span>/</span>{breadcrumb}</div>
          <div className="topbar-actions">
            <button
              type="button"
              className="help-top-button"
              onClick={() => setHelpOpen(true)}
              aria-label="Ajuda"
              title="Ajuda"
            >
              <CircleHelp size={17} />
            </button>
            <button className="logout-top-button" onClick={onSignOut}>
              <LogOut size={15} />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {helpOpen && (
          <div
            className="help-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setHelpOpen(false)
            }}
          >
            <section
              className="help-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="help-modal-title"
            >
              <header className="help-modal-header">
                <div>
                  <span className="eyebrow">
                    <span className="eyebrow-line" />
                    GUIA DO COMPENDIUM
                  </span>
                  <h2 id="help-modal-title">Ajuda</h2>
                  <p>Raziel - Árvore de Talentos</p>
                </div>
                <button
                  type="button"
                  className="help-modal-close"
                  onClick={() => setHelpOpen(false)}
                  aria-label="Fechar ajuda"
                >
                  <X size={19} />
                </button>
              </header>

              <div className="help-modal-content">
                <section>
                  <h3>1. RAZIEL — AÇÃO DE ANALISAR</h3>
                  <p>
                    Raziel possui a capacidade de analisar criaturas, objetos mágicos
                    e manifestações sobrenaturais, permitindo ao personagem descobrir
                    informações que normalmente não seriam evidentes.
                  </p>
                  <p>
                    A análise representa a capacidade de Raziel de interpretar
                    características, propriedades, habilidades e aspectos fundamentais
                    daquilo que observa.
                  </p>

                  <h4>1.1. Utilização</h4>
                  <p><strong>Ação — Analisar</strong></p>
                  <p>O jogador pode gastar uma ação para ordenar que Raziel analise:</p>
                  <ul>
                    <li>Uma criatura;</li>
                    <li>Um objeto mágico;</li>
                    <li>Uma manifestação sobrenatural;</li>
                    <li>Outro elemento que o Mestre considere apropriado.</li>
                  </ul>
                  <p>Após a utilização da ação, o jogador realiza um teste de <strong>Arcanismo ou Religião.</strong></p>
                  <ul>
                    <li><strong>Arcanismo:</strong> magia, criaturas mágicas, objetos encantados, efeitos arcanos e fenômenos sobrenaturais.</li>
                    <li><strong>Religião:</strong> criaturas divinas, infernais, celestiais, mortos-vivos, poderes sagrados e manifestações religiosas.</li>
                  </ul>

                  <h4>1.2. Classe de Dificuldade</h4>
                  <p>A CD padrão da análise é <strong>10</strong>. O resultado total do teste determina a quantidade de informações que Raziel consegue obter.</p>
                  <p>O Mestre pode ajustar a dificuldade conforme a natureza do alvo, caso exista uma justificativa específica.</p>

                  <h4>1.3. Resultados da Análise</h4>
                  <div className="help-table-wrap">
                    <table className="help-table">
                      <thead><tr><th>Resultado do Teste</th><th>Informação Obtida</th></tr></thead>
                      <tbody>
                        <tr><td><strong>1 Natural</strong></td><td>Raziel não consegue obter nenhuma informação sobre o alvo. A criatura não poderá ser analisada novamente por Raziel.</td></tr>
                        <tr><td><strong>9 ou menos</strong></td><td>Raziel não descobre nenhuma informação relevante. Entretanto, poderá tentar analisar a mesma criatura novamente em outra oportunidade.</td></tr>
                        <tr><td><strong>10 ou mais</strong></td><td>Raziel descobre uma habilidade da árvore correspondente à natureza do alvo. Caso não seja possível descobrir uma habilidade naquele momento, o personagem avança no progresso de análise.</td></tr>
                        <tr><td><strong>20 ou mais</strong></td><td>Além do benefício anterior, o jogador pode escolher uma característica da criatura para descobrir completamente.</td></tr>
                        <tr><td><strong>30 ou mais</strong></td><td>Além dos benefícios anteriores, Raziel revela todas as características listadas na seção de informações analisáveis.</td></tr>
                      </tbody>
                    </table>
                  </div>

                  <h4>1.4. Características Analisáveis</h4>
                  <p>Ao alcançar um resultado igual ou superior a 20, o jogador pode escolher uma das seguintes características:</p>
                  <ul>
                    <li><strong>Vida Atual:</strong> revela os Pontos de Vida atuais da criatura.</li>
                    <li><strong>Resistências:</strong> revela todos os tipos de dano aos quais a criatura possui resistência.</li>
                    <li><strong>Imunidades:</strong> revela todos os tipos de dano e efeitos aos quais a criatura é imune.</li>
                    <li><strong>Fraquezas:</strong> revela as vulnerabilidades da criatura.</li>
                    <li><strong>Classe de Armadura:</strong> revela a CA atual da criatura.</li>
                    <li><strong>Tipo da Criatura:</strong> identifica a classificação da criatura, como Aberração, Besta, Celestial, Constructo, Dragão, Elemental, Fada, Corruptor, Gigante, Humanoide, Monstruosidade, Gosma, Planta ou Morto-vivo.</li>
                  </ul>
                  <p>Ao alcançar um resultado igual ou superior a 30, todas as características acima são reveladas simultaneamente.</p>
                  <p>Para objetos mágicos e outras manifestações sobrenaturais, o Mestre determina quais informações equivalentes podem ser descobertas.</p>

                  <h4>1.5. Limitações da Análise</h4>
                  <ul>
                    <li>Cada utilização de Analisar consome 1 ação.</li>
                    <li>Uma criatura pode ser analisada novamente enquanto Raziel ainda possuir tentativas disponíveis, exceto quando o resultado determinar que ela não pode mais ser analisada.</li>
                    <li>Cada análise revela apenas as informações correspondentes ao resultado obtido.</li>
                    <li>Um resultado de 1 natural impede permanentemente novas tentativas de análise daquele mesmo alvo.</li>
                  </ul>
                </section>

                <section>
                  <h3>2. ÁRVORE DE TALENTOS</h3>
                  <p>A Árvore de Talentos representa o desenvolvimento, a evolução e a especialização do personagem.</p>
                  <p>Por meio dela, o personagem pode aprimorar suas capacidades físicas, mentais, mágicas e sobrenaturais, construindo sua própria combinação de habilidades.</p>

                  <h4>2.1. Pontos de Talento</h4>
                  <p>O personagem recebe Pontos de Talento conforme seu nível.</p>
                  <div className="help-table-wrap">
                    <table className="help-table">
                      <thead><tr><th>Progressão</th><th>Pontos Recebidos por Nível</th></tr></thead>
                      <tbody>
                        <tr><td>Níveis 1 a 20</td><td>3 pontos</td></tr>
                        <tr><td>Níveis 21 em diante</td><td>5 pontos</td></tr>
                      </tbody>
                    </table>
                  </div>
                  <p>Exemplos de progressão:</p>
                  <div className="help-table-wrap">
                    <table className="help-table">
                      <thead><tr><th>Nível do Personagem</th><th>Total de Pontos de Talento</th></tr></thead>
                      <tbody>
                        {[[10,40],[15,60],[20,80],[21,93],[25,145],[30,210],[40,340],[50,470]].map(([level, points]) => (
                          <tr key={level}><td>{level}</td><td>{points}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>Os Pontos de Talento podem ser distribuídos livremente entre as diferentes árvores disponíveis, respeitando os custos e pré-requisitos de cada habilidade.</p>

                  <h4>2.2. Skills</h4>
                  <p>As habilidades individuais das árvores são denominadas Skills. Cada Skill possui:</p>
                  <ul>
                    <li><strong>Nível Máximo:</strong> determina quantas vezes pode ser aprimorada.</li>
                    <li><strong>Custo:</strong> quantidade de Pontos de Talento necessária para adquirir cada nível.</li>
                    <li><strong>Pré-requisitos:</strong> habilidades ou condições necessárias para desbloquear a Skill.</li>
                    <li><strong>Descrição Mecânica:</strong> apresenta os efeitos concedidos pela habilidade.</li>
                  </ul>
                  <p>Cada nível de uma Skill custa a quantidade de Pontos de Talento indicada em sua descrição.</p>
                  <p>O custo padrão é de 1 ponto por nível, salvo quando a própria Skill indicar um valor diferente.</p>
                </section>

                <section>
                  <h3>3. ÁPICES</h3>
                  <p>Os Ápices representam o estágio máximo de desenvolvimento de cada árvore de talentos.</p>
                  <p>Cada árvore possui um Ápice próprio, que simboliza o domínio extraordinário sobre seu respectivo fundamento.</p>
                  <p>Ao alcançar o investimento necessário na árvore, o personagem poderá desbloquear seu Ápice.</p>
                </section>

                <section>
                  <h3>4. HABILIDADES SUPREMAS</h3>
                  <p>As Habilidades Supremas representam capacidades extraordinárias obtidas por meio da combinação de diferentes Skills e, em alguns casos, dos Ápices das árvores.</p>
                  <p>Elas não são habilidades convencionais: representam a convergência de diferentes especializações em um único poder.</p>

                  <h4>4.1. Regras das Habilidades Supremas</h4>
                  <ul>
                    <li>Cada Suprema possui uma combinação específica de pré-requisitos.</li>
                    <li>Não possuem custo adicional em Pontos de Talento.</li>
                    <li>Uma vez cumpridos todos os pré-requisitos, a Suprema é desbloqueada automaticamente.</li>
                    <li>Seus efeitos permanecem disponíveis conforme as condições descritas em sua própria mecânica.</li>
                  </ul>
                </section>

                <section>
                  <h3>5. REDISTRIBUIÇÃO DA ÁRVORE</h3>
                  <p>O personagem pode modificar a distribuição de seus Pontos de Talento, respeitando as limitações de redistribuição.</p>
                  <p>A redistribuição permite adaptar a especialização do personagem conforme suas experiências, necessidades e escolhas.</p>

                  <h4>5.1. Adição de Pontos</h4>
                  <p>O personagem pode adicionar Pontos de Talento a qualquer momento, desde que:</p>
                  <ul>
                    <li>Possua Pontos de Talento disponíveis.</li>
                    <li>A habilidade escolhida esteja elegível para receber novos pontos.</li>
                  </ul>
                  <p>A adição de pontos não exige Descanso Longo ou ritual.</p>

                  <h4>5.2. Remoção de Pontos</h4>
                  <p>Para remover pontos de habilidades já adquiridas, o personagem deve respeitar o limite de redistribuição parcial.</p>
                  <p>Após um Descanso Longo, o jogador pode:</p>
                  <p><strong>Remover e redistribuir até 4 Pontos de Talento.</strong></p>
                  <p>A redistribuição parcial permite:</p>
                  <ul>
                    <li>Remover pontos de Skills adquiridas.</li>
                    <li>Redistribuir os pontos removidos em outras Skills elegíveis.</li>
                    <li>Alterar parcialmente a especialização do personagem.</li>
                  </ul>
                  <p>Todos os novos pré-requisitos devem ser respeitados.</p>
                  <p>O limite de 4 pontos é renovado após cada Descanso Longo.</p>

                  <h4>5.3. Redefinição Completa</h4>
                  <p>Para redefinir completamente a Árvore de Talentos, o personagem deve realizar um:</p>
                  <p><strong>Ritual de 8 horas.</strong></p>
                  <p>Ao concluir o ritual:</p>
                  <ul>
                    <li>Todos os pontos investidos nas árvores são removidos.</li>
                    <li>Todos os Pontos de Talento disponíveis são recuperados.</li>
                    <li>O jogador pode redistribuir livremente todos os pontos.</li>
                    <li>Não existe limite de pontos para a nova distribuição.</li>
                    <li>Todos os pré-requisitos das novas habilidades devem ser respeitados.</li>
                  </ul>
                  <p>A redefinição completa permite reconstruir integralmente a especialização do personagem.</p>
                </section>

                <section>
                  <h3>6. REGRAS GERAIS</h3>
                  <h4>6.1. Pré-requisitos</h4>
                  <p>Uma habilidade só pode ser adquirida quando todos os seus pré-requisitos forem cumpridos.</p>
                  <p>Os pré-requisitos podem envolver:</p>
                  <ul>
                    <li>Investimento mínimo em uma árvore.</li>
                    <li>Níveis específicos de outras Skills.</li>
                    <li>Aquisição de habilidades de outras árvores.</li>
                    <li>Aquisição de um ou mais Ápices.</li>
                    <li>Outras condições indicadas na descrição da habilidade.</li>
                  </ul>

                  <h4>6.2. Custos</h4>
                  <p>Cada Skill possui seu próprio custo de aquisição.</p>
                  <p>O custo de cada nível deve ser respeitado individualmente.</p>
                </section>
              </div>

              <footer className="help-modal-footer">
                <span>RAZIEL · COMPENDIUM OF TALENTS</span>
                <button type="button" onClick={() => setHelpOpen(false)}>Entendi</button>
              </footer>
            </section>
          </div>
        )}

        <div className="page-content">
          {children}
          <footer className="page-footer">
            <span>RAZIEL · COMPENDIUM OF TALENTS</span>
            <span>CONHECIMENTO É EVOLUÇÃO<span className="footer-star">✧</span></span>
          </footer>
        </div>
      </main>
    </div>
  )
}
