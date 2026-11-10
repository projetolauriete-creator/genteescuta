// =============================================================
// MODELO DE DADOS DE PERMISSÕES (etapa 2 do controle de acesso)
//
// Este arquivo é só DEFINIÇÃO e CÁLCULO: não impõe nada sozinho.
// A trava de verdade acontece em dois lugares (etapa 4):
//   1) nas telas (esconder/bloquear o que o usuário não pode);
//   2) nas Regras do Firestore (segurança real, já que o site é estático).
//
// Conceitos:
//   • TELAS: cada área do painel e as AÇÕES possíveis nela.
//   • PERFIS: "papéis" nomeados (Colaborador, ADM, Financeiro…), cada um
//               com um conjunto PADRÃO de permissões (um preset).
//   • Permissoes: o mapa efetivo { telaId: [ações] } de um usuário, vindo
//               do perfil e, opcionalmente, de ajustes finos por usuário.
// =============================================================

/** Ações que podem ser liberadas dentro de uma tela. */
export type Acao = 'ver' | 'adicionar' | 'editar' | 'aprovar' | 'excluir'

export const ACAO_LABEL: Record<Acao, string> = {
  ver: 'Visualizar',
  adicionar: 'Adicionar',
  editar: 'Editar',
  aprovar: 'Aprovar / tratar',
  excluir: 'Excluir',
}

/** Grupos usados para organizar as telas (no menu e na tela de permissões). */
export type GrupoTela = 'gerencial' | 'comunicacao' | 'bem-estar' | 'pessoas' | 'conteudo' | 'sistema'

export const GRUPO_LABEL: Record<GrupoTela, string> = {
  gerencial: 'Gerencial',
  comunicacao: 'Comunicação',
  'bem-estar': 'Bem-estar',
  pessoas: 'Pessoas',
  conteudo: 'Conteúdo do site',
  sistema: 'Sistema',
}

export interface Tela {
  /** Identificador estável (chave no mapa de permissões). NÃO renomear depois. */
  id: string
  rotulo: string
  href: string
  grupo: GrupoTela
  /** Ações que fazem sentido nesta tela (sempre inclui 'ver'). */
  acoes: Acao[]
  /** true = a visibilidade pode ser limitada ao centro de custo (área) do usuário. */
  porArea?: boolean
  /** Só o dono do sistema (Super/ADM Principal) mexe: nunca aparece para outros perfis. */
  sensivel?: boolean
}

// Registro central das telas do painel. Ordem = ordem sugerida no menu.
export const TELAS: Tela[] = [
  // ---- Gerencial (novo grupo que centraliza gestão) ----
  { id: 'visao',        rotulo: 'Visão geral',      href: '/admin',                    grupo: 'gerencial', acoes: ['ver'] },
  { id: 'usuarios',     rotulo: 'Usuários e acessos', href: '/admin/usuarios',         grupo: 'gerencial', acoes: ['ver', 'adicionar', 'editar', 'excluir'], sensivel: true },
  { id: 'logs',         rotulo: 'Login e Logs',     href: '/admin/logs',               grupo: 'gerencial', acoes: ['ver'], sensivel: true },

  // ---- Comunicação ----
  { id: 'canal',        rotulo: 'Canal',            href: '/admin/canal',              grupo: 'comunicacao', acoes: ['ver', 'aprovar', 'excluir'] },
  { id: 'mural',        rotulo: 'Mural',            href: '/admin/mural',              grupo: 'comunicacao', acoes: ['ver', 'adicionar', 'editar', 'excluir'] },
  { id: 'moderacao',    rotulo: 'Moderação',        href: '/admin/mural/moderacao',    grupo: 'comunicacao', acoes: ['ver', 'aprovar', 'excluir'] },

  // ---- Bem-estar ----
  { id: 'clima',        rotulo: 'Clima',            href: '/admin/clima',              grupo: 'bem-estar', acoes: ['ver'] },
  { id: 'humor',        rotulo: 'Humor',            href: '/admin/humor',              grupo: 'bem-estar', acoes: ['ver', 'adicionar'] },
  { id: 'pesquisas',    rotulo: 'Pesquisas',        href: '/admin/pesquisas',          grupo: 'bem-estar', acoes: ['ver', 'adicionar', 'editar'] },

  // ---- Pessoas ----
  { id: 'funcionarios', rotulo: 'Funcionários',     href: '/admin/funcionarios',       grupo: 'pessoas', acoes: ['ver', 'adicionar', 'editar', 'excluir'] },
  { id: 'banco_horas',  rotulo: 'Banco de Horas',   href: '/banco-horas',              grupo: 'pessoas', acoes: ['ver', 'adicionar'], porArea: true },
  { id: 'reembolsos',   rotulo: 'Reembolsos',       href: '/reembolso',                grupo: 'pessoas', acoes: ['ver', 'aprovar'], porArea: true },
  { id: 'inconsistencias', rotulo: 'Inconsistências', href: '/admin/inconsistencias',  grupo: 'pessoas', acoes: ['ver', 'adicionar'], sensivel: true },

  // ---- Conteúdo do site ----
  { id: 'carrossel',    rotulo: 'Carrossel da home', href: '/admin/carrossel',         grupo: 'conteudo', acoes: ['ver', 'adicionar', 'editar', 'excluir'] },
  { id: 'informacoes',  rotulo: 'Informações Adm.', href: '/admin/informacoes',        grupo: 'conteudo', acoes: ['ver', 'adicionar', 'editar', 'excluir'] },
  { id: 'treinamento',  rotulo: 'Central de Conhecimento', href: '/admin/treinamento',   grupo: 'conteudo', acoes: ['ver', 'adicionar', 'editar', 'excluir'] },
  { id: 'contato',      rotulo: 'Contato',          href: '/admin/contato',            grupo: 'conteudo', acoes: ['ver', 'editar'] },
  { id: 'institucional',rotulo: 'Sobre / Missão',   href: '/admin/institucional',      grupo: 'conteudo', acoes: ['ver', 'editar'] },

  // ---- Sistema ----
  { id: 'configuracoes',rotulo: 'Configurações',    href: '/admin/configuracoes',      grupo: 'sistema', acoes: ['ver', 'editar'], sensivel: true },
]

/** Índice rápido por id. */
export const TELA_POR_ID: Record<string, Tela> = Object.fromEntries(TELAS.map((t) => [t.id, t]))

// -------------------------------------------------------------
// Mapa de permissões efetivas de um usuário: { telaId: [ações liberadas] }.
// -------------------------------------------------------------
export type Permissoes = Record<string, Acao[]>

// -------------------------------------------------------------
// PERFIS nomeados (presets). Cada um define o que libera por padrão.
// `tudo: true` = acesso completo a todas as telas e ações (dono do sistema).
// -------------------------------------------------------------
export type PerfilId =
  | 'colaborador'
  | 'gestor'
  | 'financeiro'
  | 'adm_principal'
  | 'adm_master'

export interface Perfil {
  id: PerfilId
  nome: string
  desc: string
  /** Acesso total (ignora o mapa; libera tudo). Usado pelos "faz tudo". */
  tudo?: boolean
  /** Permissões padrão por tela (quando não é `tudo`). */
  base?: Permissoes
}

// Atalho: todas as ações de uma tela (para montar presets sem repetir).
function todas(telaId: string): Acao[] {
  return [...(TELA_POR_ID[telaId]?.acoes ?? [])]
}

export const PERFIS: Perfil[] = [
  {
    id: 'colaborador',
    nome: 'Colaborador',
    desc: 'Acesso padrão de todos: site, mural, pesquisas, reembolso próprio. Sem painel.',
    base: {}, // nenhuma tela do painel
  },
  {
    id: 'gestor',
    nome: 'Gestor Aprovador',
    desc: 'Aprova reembolsos do seu centro de custo e acompanha (ver + exportar) Humor, Banco de Horas e Inconsistências da mesma área. Não edita, importa nem exclui.',
    base: {
      reembolsos: ['ver', 'aprovar'],
      banco_horas: ['ver'],
      humor: ['ver'],
      inconsistencias: ['ver'],
    },
  },
  {
    id: 'financeiro',
    nome: 'Financeiro',
    desc: 'Cuida da etapa financeira dos reembolsos (registrar pagamento).',
    base: {
      reembolsos: ['ver', 'aprovar'],
    },
  },
  {
    id: 'adm_principal',
    nome: 'ADM Principal',
    desc: 'Gente e Cultura: faz tudo, inclusive gerenciar usuários e permissões.',
    tudo: true,
  },
  {
    id: 'adm_master',
    nome: 'ADM Master',
    desc: 'Diretoria: faz tudo, inclusive gerenciar usuários e permissões.',
    tudo: true,
  },
]

export const PERFIL_POR_ID: Record<PerfilId, Perfil> = Object.fromEntries(
  PERFIS.map((p) => [p.id, p]),
) as Record<PerfilId, Perfil>

// -------------------------------------------------------------
// Cálculo das permissões efetivas.
//   resolverPermissoes(perfil, override?)
//     • perfil "tudo"  → todas as ações de todas as telas;
//     • senão          → base do perfil, com o override do usuário por cima
//                        (o override SUBSTITUI a lista de ações da tela).
// -------------------------------------------------------------
export function resolverPermissoes(perfilId: PerfilId | undefined, override?: Permissoes): Permissoes {
  const perfil = perfilId ? PERFIL_POR_ID[perfilId] : undefined
  if (perfil?.tudo) {
    return Object.fromEntries(TELAS.map((t) => [t.id, [...t.acoes]]))
  }
  const efetivo: Permissoes = {}
  for (const [tela, acoes] of Object.entries(perfil?.base ?? {})) {
    efetivo[tela] = [...acoes]
  }
  if (override) {
    for (const [tela, acoes] of Object.entries(override)) {
      // Só aceita telas/ações que existem de verdade (higieniza a entrada).
      const def = TELA_POR_ID[tela]
      if (!def) continue
      const validas = acoes.filter((a) => def.acoes.includes(a))
      if (validas.length) efetivo[tela] = validas
      else delete efetivo[tela]
    }
  }
  return efetivo
}

/** O usuário pode fazer `acao` na tela `telaId`? */
export function pode(permissoes: Permissoes | undefined, telaId: string, acao: Acao = 'ver'): boolean {
  return !!permissoes && Array.isArray(permissoes[telaId]) && permissoes[telaId].includes(acao)
}

/** O usuário enxerga a tela (tem ao menos 'ver')? */
export function podeVer(permissoes: Permissoes | undefined, telaId: string): boolean {
  return pode(permissoes, telaId, 'ver')
}

/**
 * Deriva um perfil a partir do modelo ANTIGO (nivel de /admins e papéis de
 * /funcionarios), para os usuários cadastrados antes das permissões existirem.
 * Assim o comportamento atual é preservado quando a trava entrar (etapa 4).
 */
export function perfilPadrao(entrada: {
  nivel?: string | null
  papeis?: string[] | null
}): PerfilId {
  const papeis = Array.isArray(entrada.papeis) ? entrada.papeis : []
  if (entrada.nivel === 'super') return 'adm_principal'
  if (entrada.nivel === 'master' || papeis.includes('master')) return 'adm_principal'
  // O papel "administrador" foi removido: vira Master Administrador (acesso total).
  if (papeis.includes('administrador')) return 'adm_principal'
  if (entrada.nivel === 'comum') return 'adm_principal'
  if (papeis.includes('financeiro')) return 'financeiro'
  if (papeis.includes('gestor')) return 'gestor'
  return 'colaborador'
}
