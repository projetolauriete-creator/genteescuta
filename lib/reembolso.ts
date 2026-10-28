// =============================================================
// Solicitação de Reembolso: domínio (papéis, centros de custo,
// categorias, status e regras de fluxo). Funções PURAS, sem Firestore
// nem React, para ficarem fáceis de testar e reusar na interface.
// =============================================================

// -------- Papéis de acesso (uma pessoa pode ter VÁRIOS) --------
export type Papel = 'master' | 'gestor' | 'financeiro' | 'gente_cultura' | 'colaborador'

export const PAPEIS: Papel[] = ['master', 'gestor', 'financeiro', 'gente_cultura', 'colaborador']

export const PAPEL_LABEL: Record<Papel, string> = {
  master: 'Master Administrador',
  gestor: 'Gestor Aprovador',
  financeiro: 'Financeiro',
  gente_cultura: 'Gente e Cultura (Assédio)',
  colaborador: 'Colaborador',
}

export const PAPEL_DESC: Record<Papel, string> = {
  master: 'Faz tudo, igual à equipe de Gente & Cultura (inclusive usuários, configurações e logs).',
  gestor: 'Aprova reembolsos e baixa as planilhas do próprio centro de custo (área).',
  financeiro: 'Cuida da etapa financeira (pagamento) dos reembolsos.',
  gente_cultura: 'Lê e trata os relatos do Protocolo de Assédio (canal restrito). Não libera o restante do painel.',
  colaborador: 'Base de todos: solicita reembolsos, faz manifestações e treinamentos.',
}

// -------- Centros de custo (= áreas da Soulan) --------
// Mantém a MESMA lista oficial usada nos dashboards (lib/fb/publico.ts).
export const CENTROS_CUSTO = [
  'Comercial Soulan',
  'Marketing',
  'Administrativo/Financeiro',
  'Suporte e Dados',
  'Thomas',
  'Atração & Seleção',
  'Diretoria',
  'Gente & Cultura/Cadastro e Suprimentos',
] as const

// Valor especial de centro de custo: um Gestor Aprovador com "Todos os centros
// de custo" enxerga e aprova reembolsos de QUALQUER área.
export const TODOS_CENTROS = 'Todos os centros de custo'

/** O centro do usuário abrange todas as áreas? (Gestor global.) */
export function centroAbrangeTudo(centro?: string | null): boolean {
  return (centro ?? '').trim() === TODOS_CENTROS
}

// -------- Categorias de despesa (lista controlada) --------
export const CATEGORIAS = [
  'Almoço/Coffee Cliente',
  'Almoço/Coffee Interno',
  'Auxílio Instrução',
  'Brinde Cliente',
  'Brinde Interno',
  'Copa e Higiene',
  'Deslocamento',
  'Equipamentos de TI - descrever nas observações',
  'Estacionamento',
  'Feiras e Eventos - descrever',
  'KM',
  'Manutenção e Reparos',
  'Material de escritório',
  'Material de limpeza e copa',
  'Pedágio',
  'Reembolso Correios',
  'Sistemas - descreva qual sistema e finalidade',
  'Sistemas - descrever nas observações',
] as const

// -------- Status do reembolso --------
// Fluxo: pendente_gestor → (gestor aprova) → pendente_financeiro →
// (financeiro registra pagamento) → agendado (data futura) ou pago (na data).
// 'pendente_master' cobre o caso do próprio gestor pedir (não aprova o próprio).
// 'aprovado' é legado (pedidos antigos): tratado como equivalente a 'pago'.
export type StatusReembolso =
  | 'pendente_gestor'
  | 'pendente_master'
  | 'pendente_financeiro'
  | 'agendado'
  | 'pago'
  | 'aprovado'
  | 'recusado'

export const STATUS_LABEL: Record<StatusReembolso, string> = {
  pendente_gestor: 'Aguardando gestor',
  pendente_master: 'Aguardando Master',
  pendente_financeiro: 'Aguardando Financeiro',
  agendado: 'Pagamento agendado',
  pago: 'Pago',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
}

/** Faixa de cor para o Chip (reaproveita a paleta de risco da marca). */
export type FaixaChip = 'baixo' | 'moderado' | 'alto' | 'critico' | 'neutro'
export const STATUS_FAIXA: Record<StatusReembolso, FaixaChip> = {
  pendente_gestor: 'moderado',
  pendente_master: 'moderado',
  pendente_financeiro: 'alto',
  agendado: 'moderado',
  pago: 'baixo',
  aprovado: 'baixo',
  recusado: 'critico',
}

// -------- Regras de fluxo --------
/**
 * Status inicial de uma solicitação, conforme QUEM está pedindo:
 *  - Gestor pedindo para si → vai direto ao Master (não aprova o próprio).
 *  - Master pedindo para si → vai direto ao Financeiro.
 *  - Colaborador (qualquer outro) → começa no gestor da área.
 */
export function statusInicial(papeis: string[]): StatusReembolso {
  if (papeis.includes('gestor')) return 'pendente_master'
  if (papeis.includes('master')) return 'pendente_financeiro'
  return 'pendente_gestor'
}

/**
 * Para onde o pedido vai quando a etapa de APROVAÇÃO (gestor/master) libera.
 * A etapa do Financeiro NÃO usa isto: o Financeiro registra pagamento
 * (agendado/pago) por uma função própria.
 */
export function proximoStatus(atual: StatusReembolso): StatusReembolso {
  if (atual === 'pendente_gestor') return 'pendente_financeiro'
  if (atual === 'pendente_master') return 'pendente_financeiro'
  return atual
}

/** Status resultante de um pagamento conforme a data informada. */
export function statusDoPagamento(dataPagamentoISO: string): StatusReembolso {
  const hoje = new Date().toISOString().slice(0, 10)
  const d = String(dataPagamentoISO || '').slice(0, 10)
  return d > hoje ? 'agendado' : 'pago'
}

/**
 * Status "efetivo" para exibição: um pagamento AGENDADO cuja data já chegou
 * é mostrado como PAGO (não há servidor para virar o status sozinho).
 */
export function statusEfetivo(status: StatusReembolso, dataPagamento?: string | null): StatusReembolso {
  if (status === 'agendado' && dataPagamento) {
    const hoje = new Date().toISOString().slice(0, 10)
    if (String(dataPagamento).slice(0, 10) <= hoje) return 'pago'
  }
  return status
}

/** A etapa atual é a do Financeiro (registrar pagamento)? */
export function ehEtapaFinanceiro(status: StatusReembolso): boolean {
  return status === 'pendente_financeiro'
}

/** Quem aprova a etapa atual (papel responsável). */
export function papelDaEtapa(atual: StatusReembolso): Papel | null {
  if (atual === 'pendente_gestor') return 'gestor'
  if (atual === 'pendente_master') return 'master'
  if (atual === 'pendente_financeiro') return 'financeiro'
  return null
}

export function estaPendente(s: StatusReembolso): boolean {
  return s === 'pendente_gestor' || s === 'pendente_master' || s === 'pendente_financeiro'
}

/**
 * O próprio solicitante ainda pode AJUSTAR ou EXCLUIR o pedido?
 * Sim enquanto NÃO foi aprovado: aguardando a 1ª aprovação (gestor/master)
 * ou recusado. Depois de aprovado (segue para o Financeiro), pago/agendado,
 * o colaborador não mexe mais.
 */
export function editavelPeloSolicitante(s: StatusReembolso): boolean {
  return s === 'pendente_gestor' || s === 'pendente_master' || s === 'recusado'
}

/**
 * Uma pessoa (com seus papéis e centro de custo) pode agir na etapa atual
 * de um reembolso? Master age em tudo; gestor só no próprio centro; financeiro
 * na etapa financeira. Nunca no próprio pedido (checado à parte pela tela).
 */
export function podeAprovar(
  status: StatusReembolso,
  papeis: string[],
  meuCentro: string,
  centroDoPedido: string,
): boolean {
  if (!estaPendente(status)) return false
  if (papeis.includes('master')) return true
  if (status === 'pendente_gestor') {
    // Gestor da área do pedido: ou Gestor com "Todos os centros de custo".
    return papeis.includes('gestor') && (centroAbrangeTudo(meuCentro) || mesmoCentro(meuCentro, centroDoPedido))
  }
  if (status === 'pendente_master') return false // só master, tratado acima
  if (status === 'pendente_financeiro') return papeis.includes('financeiro')
  return false
}

/** Compara centros de custo ignorando acentos, caixa e "&" vs "e". */
export function mesmoCentro(a?: string | null, b?: string | null): boolean {
  return chaveCentro(a) === chaveCentro(b) && chaveCentro(a) !== ''
}
function chaveCentro(s?: string | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' e ')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase()
}

export function formatBRL(v: number): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatData(iso?: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleDateString('pt-BR')
}
