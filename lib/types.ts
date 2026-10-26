export type PesquisaStatus = 'rascunho' | 'aberta' | 'encerrada'
export type Identificacao = 'identificada' | 'confidencial' | 'anonima'
export type PerguntaTipo =
  | 'likert5'
  | 'enps'
  | 'nota10'
  | 'escolha_unica'
  | 'escolha_multipla'
  | 'texto'
  | 'texto_longo'
  | 'sim_nao'

export type ManifestacaoTipo =
  | 'contribuicao'
  | 'sugestao'
  | 'reclamacao'
  | 'ideia'
  | 'melhoria'
  | 'reconhecimento'

export type ManifestacaoStatus =
  | 'recebida'
  | 'respondida'
  | 'concluida'
  | 'em_analise'
  | 'analisada'
  | 'em_implementacao'
  | 'implementada'
  | 'nao_aplicavel'
  | 'arquivada'

/** Fluxo principal da moderação (andamento da resposta). */
export const STATUS_FLUXO: ManifestacaoStatus[] = ['recebida', 'respondida', 'concluida']

export type Prioridade = 'baixa' | 'media' | 'alta'
export type FaixaRisco = 'baixo' | 'moderado' | 'alto' | 'critico'

// -------- Programa de Melhoria Contínua (contribuições estruturadas) --------
/** Triagem de aprovação da manifestação (separada do funil de status). */
export type Triagem = 'pendente' | 'aprovada' | 'reprovada'

/** Áreas da sugestão (Item 4). Fácil de expandir: acrescente aqui. */
export const AREAS_SUGESTAO = [
  'Cultura, Clima e Benefícios',
  'Processos Internos e Produtividade',
  'Ferramentas, Tecnologia e Infraestrutura',
  'Atendimento e Sucesso do Cliente',
  'Vendas, Marketing e Presença Digital',
  'Sustentabilidade, Inovação e Treinamento',
] as const
export type AreaSugestao = (typeof AREAS_SUGESTAO)[number]

// Tipos de manifestação do Reconhecimento (seleção múltipla).
export const TIPOS_RECONHECIMENTO = [
  'Elogio / Reconhecimento',
  'Agradecimento',
  'Sugestão de Melhoria',
  'Ponto de Atenção',
  'Feedback',
] as const
export const AREA_SUGESTAO_AJUDA: Record<string, string> = {
  'Cultura, Clima e Benefícios': 'Bem-estar, integração, ergonomia',
  'Processos Internos e Produtividade': 'Burocracia, reuniões, fluxos',
  'Ferramentas, Tecnologia e Infraestrutura': 'Computadores, softwares, TI',
  'Atendimento e Sucesso do Cliente': 'Canais de suporte, pós-venda',
  'Vendas, Marketing e Presença Digital': 'Propostas, redes sociais, site',
  'Sustentabilidade, Inovação e Treinamento': 'Reciclagem, cursos, IA',
}

/** Impacto principal esperado (Item 7: múltipla escolha). */
export const IMPACTOS = [
  'Economia de tempo / Agilidade no dia a dia',
  'Redução de custos financeiros para a empresa',
  'Melhoria no bem-estar e no clima da equipe',
  'Aumento da satisfação ou retenção de clientes',
  'Redução de erros, retrabalho ou burocracia',
  'Outro',
] as const

export interface Opcao {
  valor: number | string
  rotulo: string
}

export interface Pesquisa {
  id: string
  slug: string
  titulo: string
  descricao: string | null
  mensagem_abertura: string | null
  tipo: 'nr1' | 'clima' | 'personalizada'
  status: PesquisaStatus
  identificacao: Identificacao
  min_grupo: number
  publico_alvo: number | null
  abre_em: string | null
  fecha_em: string | null
  criado_em: string
  atualizado_em: string
}

export interface Secao {
  id: string
  pesquisa_id: string
  titulo: string
  descricao: string | null
  dimensao: string | null
  ordem: number
}

export interface Pergunta {
  id: string
  pesquisa_id: string
  secao_id: string | null
  enunciado: string
  ajuda: string | null
  tipo: PerguntaTipo
  opcoes: Opcao[] | null
  obrigatoria: boolean
  invertida: boolean
  critica: boolean
  peso: number
  segmentacao: string | null
  ordem: number
}

export interface Resposta {
  id: string
  pesquisa_id: string
  email: string | null
  email_hash: string | null
  area: string | null
  cargo: string | null
  tempo_casa: string | null
  modelo_trabalho: string | null
  enviada_em: string
}

export interface ItemResposta {
  id: string
  resposta_id: string
  pergunta_id: string
  valor_num: number | null
  valor_texto: string | null
  valor_json: unknown | null
}

export interface Manifestacao {
  id: string
  tipo: ManifestacaoTipo
  titulo: string
  descricao: string
  nome: string | null
  email: string | null
  area: string
  anonima: boolean
  status: ManifestacaoStatus
  prioridade: Prioridade
  responsavel: string | null
  resposta_publica: string | null
  publicar_no_mural: boolean
  criado_em: string
  atualizado_em: string
  analisada_em: string | null
  implementada_em: string | null
  // -------- Contribuição estruturada (Programa de Melhoria Contínua) --------
  categoria?: string | null       // Área da Sugestão (Item 4)
  departamento?: string | null    // Setor de quem enviou (Item 3, só se identificado)
  problema?: string | null        // Item 5
  sugestao?: string | null        // Item 6
  impactos?: string[]             // Item 7
  impacto_outro?: string | null   // texto livre quando marca "Outro"
  // -------- Triagem (aprovar/reprovar) --------
  triagem?: Triagem               // 'pendente' por padrão
  resposta_privada?: string | null // resposta ao autor na reprovação
  triado_por?: string | null
  triado_em?: string | null
  // -------- Análise (foi vista/tratada pelo RH?) --------
  analise?: AnaliseStatus         // 'nao_analisada' por padrão
  analise_por?: string | null
  analise_em?: string | null
}

export const TRIAGEM_LABEL: Record<Triagem, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  reprovada: 'Reprovada',
}

/** Análise: a manifestação já foi vista/tratada pelo RH? (padrão: não analisada) */
export type AnaliseStatus = 'nao_analisada' | 'analisada'
export const ANALISE_LABEL: Record<AnaliseStatus, string> = {
  nao_analisada: 'Não analisada',
  analisada: 'Analisada',
}

export interface ManifestacaoUpdate {
  id: string
  manifestacao_id: string
  status_anterior: ManifestacaoStatus | null
  status_novo: ManifestacaoStatus | null
  mensagem: string | null
  autor: string | null
  visivel_ao_colaborador: boolean
  criado_em: string
}

export interface Admin {
  id: string
  email: string
  nome: string
  ativo: boolean
  criado_em: string
}

export interface Config {
  id: number
  empresa_nome: string
  canal_mensagem: string
  min_grupo: number
  atualizado_em: string
}

// ---------------------------------------------------------------
// Rótulos em português usados na interface inteira
// ---------------------------------------------------------------
export const TIPO_MANIFESTACAO_LABEL: Record<ManifestacaoTipo, string> = {
  contribuicao: 'Contribuição',
  sugestao: 'Sugestão',
  reclamacao: 'Reclamação',
  ideia: 'Ideia',
  melhoria: 'Melhoria',
  reconhecimento: 'Reconhecimento',
}

export const TIPO_MANIFESTACAO_DESC: Record<ManifestacaoTipo, string> = {
  contribuicao: 'Uma ideia, sugestão ou melhoria. A classificação é feita pela equipe depois',
  sugestao: 'Algo que você propõe para a empresa considerar',
  reclamacao: 'Algo que está errado ou te incomoda no dia a dia',
  ideia: 'Uma proposta nova, ainda em formato de ideia',
  melhoria: 'Um processo que existe e pode funcionar melhor',
  reconhecimento: 'Alguém ou algum time que merece ser reconhecido',
}

export const STATUS_MANIFESTACAO_LABEL: Record<ManifestacaoStatus, string> = {
  recebida: 'Recebida',
  respondida: 'Respondida',
  concluida: 'Concluída',
  em_analise: 'Em análise',
  analisada: 'Analisada',
  em_implementacao: 'Em implementação',
  implementada: 'Implementada',
  nao_aplicavel: 'Não aplicável',
  arquivada: 'Arquivada',
}

/** Ordem do funil mostrado no painel. */
export const FUNIL_STATUS: ManifestacaoStatus[] = [
  'recebida',
  'em_analise',
  'analisada',
  'em_implementacao',
  'implementada',
]

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export const FAIXA_LABEL: Record<FaixaRisco, string> = {
  baixo: 'Risco baixo',
  moderado: 'Risco moderado',
  alto: 'Risco alto',
  critico: 'Risco crítico',
}
