# ✦ Raziel Compendium
Parte do Projeto campanharpg.com.br
**Um compêndio digital para explorar, organizar e acompanhar a progressão de talentos.**

O **Raziel Compendium** é uma aplicação web desenvolvida para centralizar o conhecimento e a progressão de talentos de um sistema próprio, oferecendo uma experiência interativa para consultar habilidades, explorar árvores de talentos e acompanhar a evolução coletiva.

O projeto combina uma interface temática com um sistema de gerenciamento de dados, permitindo que jogadores acompanhem a progressão disponível enquanto administradores mantêm e organizam o conteúdo do compêndio.

## ✧ Funcionalidades

- **Árvores de talentos:** organização das habilidades em diferentes categorias, permitindo explorar os talentos disponíveis.
- **Progressão compartilhada:** uma única progressão global, cujas alterações são refletidas para todos os usuários.
- **Distribuição de pontos:** gerenciamento dos pontos disponíveis e distribuídos entre os talentos.
- **Pré-requisitos:** talentos podem exigir níveis específicos em outras habilidades para serem desbloqueados.
- **Requisitos entre árvores:** possibilidade de estabelecer quantidades mínimas de pontos em outras árvores.
- **Talentos ocultos:** suporte a conhecimentos que não devem ser revelados imediatamente aos jogadores.
- **Gerenciamento administrativo:** cadastro, edição e exclusão de talentos e configuração de seus requisitos.
- **Controle de acesso:** autenticação de usuários e permissões administrativas protegidas por políticas de segurança.

## ⚙️ Tecnologias

| Tecnologia | Aplicação |
|---|---|
| React 19 | Construção da interface |
| TypeScript | Tipagem e segurança do código |
| Vite | Ambiente de desenvolvimento e build |
| Tailwind CSS | Estilização da interface |
| Lucide React | Ícones |
| Supabase | Backend, autenticação e acesso aos dados |
| PostgreSQL | Banco de dados relacional |
| Row Level Security (RLS) | Controle de acesso aos dados |
| Cloudflare Pages | Hospedagem da aplicação |

## 🏛️ Arquitetura e dados

O projeto utiliza o Supabase como infraestrutura de backend, com PostgreSQL para persistência dos dados e políticas de Row Level Security (RLS) para controlar o acesso às informações.

A progressão é compartilhada entre os usuários: não existem fichas ou progressões individuais por personagem. Dessa forma, as alterações realizadas na progressão global são refletidas para todos.

As operações administrativas são protegidas por permissões específicas, separando a experiência de consulta e utilização do compêndio das operações de gerenciamento do conteúdo.

## 🗺️ Em desenvolvimento

O projeto continua evoluindo com novas funcionalidades, incluindo:

- **Análises de progressão:** visualização de dados e indicadores relacionados aos talentos.
- **Quantidade realizada versus necessária:** acompanhamento do progresso em relação às quantidades e requisitos definidos.
- **Gerenciamento de conhecimentos ocultos:** controles administrativos para configurar e acompanhar conteúdos não revelados.
- **Painel administrativo ampliado:** edição e gerenciamento dos indicadores e parâmetros de análise.

## 🚀 Objetivo

O objetivo do Raziel Compendium é oferecer um ambiente centralizado, intuitivo e seguro para administrar e acompanhar a progressão de talentos, mantendo as informações organizadas e acessíveis aos participantes.

---

<sub>Raziel Compendium · Projeto independente · Desenvolvido com React, TypeScript e Supabase.</sub>

## Atualização: regras de desbloqueio dos Ápices e Habilidades Supremas

Depois de aplicar as migrations anteriores do projeto, execute no SQL Editor do Supabase o arquivo `supabase_migration_apices_supremas_v2.sql`. Ele cria os estados independentes `is_unlocked` e `is_hidden` dos Ápices, disponibiliza a view segura `talent_tree_apices_safe_v2`, corrige a validação do Ápice da aba Suprema e atualiza a função de distribuição de pontos para validar as condições também no banco.

A atualização do frontend utiliza essa nova view para os Ápices. Não remova a view antiga `talent_tree_apices_safe`, pois ela ainda é utilizada pelo carregamento geral de progressão.

## Correções pós-testes de Supremas e Ápices

Esta versão inclui `supabase_migration_correcao_apices_supremas.sql`. Execute esse arquivo no SQL Editor do Supabase **depois** das migrations anteriores de custo por nível, Habilidades Supremas e Ápices v2. A migration corrige o cálculo ponderado e isolado por árvore, sincroniza a revelação das Habilidades Supremas, desbloqueia automaticamente Ápices comuns ao atingir os pontos exigidos e reserva o alerta narrativo ao Ápice Supremo.
