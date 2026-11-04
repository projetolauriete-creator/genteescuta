'use client'

// =============================================================
// Operações públicas no Firestore (colaborador, sem login).
// =============================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  increment,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import { AREAS_SUGESTAO } from '../types'

export const REACOES = [
  { chave: 'curtir', emoji: '👍', rotulo: 'Curtir' },
  { chave: 'amei', emoji: '❤️', rotulo: 'Amei' },
  { chave: 'parabens', emoji: '👏', rotulo: 'Parabéns' },
  { chave: 'apoio', emoji: '🙌', rotulo: 'Apoio' },
] as const
const CHAVES_REACAO = REACOES.map((r) => r.chave) as readonly string[]

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const CONFIG_PADRAO = {
  empresa_nome: 'Soulan Recursos Humanos',
  canal_mensagem:
    'Este é um canal seguro. Sua manifestação será analisada pela equipe de Gente & Cultura e você receberá um retorno.',
  min_grupo: 5,
}

export async function getConfig() {
  const snap = await getDoc(doc(db(), 'config', 'geral'))
  return snap.exists() ? { ...CONFIG_PADRAO, ...snap.data() } : CONFIG_PADRAO
}

/** Áreas/setores da Soulan: usadas quando nenhuma área foi cadastrada
 *  em Configurações. Também alimentam os recortes por área no painel ADM. */
export const AREAS_PADRAO = [
  'Comercial Soulan',
  'Marketing',
  'Administrativo/Financeiro',
  'Suporte e Dados',
  'Thomas',
  'Atração & Seleção',
  'Diretoria',
  'Gente & Cultura/Cadastro e Suprimentos',
]

export async function getAreas(): Promise<string[]> {
  try {
    // Só filtro de igualdade (sem orderBy) para não exigir índice composto;
    // a ordenação é feita no cliente.
    const snap = await getDocs(query(collection(db(), 'areas'), where('ativa', '==', true)))
    const nomes = snap.docs
      .map((d) => d.data() as { nome?: string; ordem?: number })
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((d) => d.nome ?? '')
      .filter(Boolean)
    return nomes.length > 0 ? nomes : AREAS_PADRAO
  } catch {
    // Qualquer falha (ex.: índice ausente, offline) → usa a lista padrão.
    return AREAS_PADRAO
  }
}

/** Itens publicados no mural. */
export async function getMural(qtd = 100) {
  const q = query(
    collection(db(), 'mural'),
    where('publicado', '==', true),
    orderBy('data', 'desc'),
    limit(qtd),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as any)
}

/** Pesquisas abertas (para a home). */
export async function getPesquisasAbertas() {
  const q = query(collection(db(), 'pesquisas'), where('status', '==', 'aberta'))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''))
}

/** Pesquisa pelo slug (seções e perguntas vêm embutidas no documento). */
export async function getPesquisaPorSlug(slug: string) {
  const q = query(collection(db(), 'pesquisas'), where('slug', '==', slug), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as any
}

// -------------------------------------------------------------
// Envio de manifestação (canal)
// -------------------------------------------------------------
export async function enviarManifestacao(p: {
  tipo: string
  titulo?: string
  descricao?: string
  nome: string
  email?: string
  area?: string
  anonima: boolean
  // -------- contribuição estruturada --------
  categoria?: string
  departamento?: string
  problema?: string
  sugestao?: string
  impactos?: string[]
  impacto_outro?: string
  // -------- reconhecimento --------
  reconhecer?: string             // rótulo legível (nome da área/pessoa)
  reconhecer_tipo?: 'area' | 'pessoa'
  reconhecer_id?: string          // centro de custo (área) OU uid (pessoa)
  reconhecer_nome?: string        // nome exibido do alvo
  tipos?: string[]                // tipo de manifestação (seleção múltipla)
  centro_custo?: string           // centro de custo do perfil (obrigatório)
}) {
  const tipo = String(p.tipo ?? '')
  const nome = String(p.nome ?? '').trim()
  const email = String(p.email ?? '').trim().toLowerCase()
  const anonima = p.anonima === true
  const agora = new Date().toISOString()

  const TIPOS = ['contribuicao', 'sugestao', 'ideia', 'melhoria', 'reconhecimento']
  if (!TIPOS.includes(tipo)) throw new Error('Escolha o tipo da sua manifestação.')

  const eventoInicial = {
    status_novo: 'recebida',
    mensagem: 'Manifestação recebida. Ela entrou na fila de análise da equipe de Gente & Cultura.',
    autor: 'Sistema',
    visivel_ao_colaborador: true,
    criado_em: agora,
  }

  // ---------------- Contribuição = Programa de Melhoria Contínua ----------------
  if (tipo === 'contribuicao') {
    const categoria = String(p.categoria ?? '').trim()
    const departamento = String(p.departamento ?? '').trim()
    const problema = String(p.problema ?? '').trim()
    const sugestao = String(p.sugestao ?? '').trim()
    const impactos = Array.isArray(p.impactos) ? p.impactos.map((x) => String(x).trim()).filter(Boolean) : []
    const impactoOutro = String(p.impacto_outro ?? '').trim()

    if (!anonima && (nome.length < 3 || !nome.includes(' '))) throw new Error('Informe o nome completo, com sobrenome.')
    if (!anonima && !EMAIL_RE.test(email)) throw new Error('Informe um e-mail válido.')
    if (!AREAS_SUGESTAO.includes(categoria as (typeof AREAS_SUGESTAO)[number])) throw new Error('Escolha a área da sugestão.')
    if (problema.length < 10 || problema.length > 5000) throw new Error('Descreva o problema ou a oportunidade (de 10 a 5.000 caracteres).')
    if (sugestao.length < 10 || sugestao.length > 5000) throw new Error('Descreva a sua sugestão prática (de 10 a 5.000 caracteres).')
    if (impactos.length === 0) throw new Error('Marque ao menos um impacto principal.')
    if (impactos.includes('Outro') && !impactoOutro) throw new Error('Descreva o "Outro" impacto que você marcou.')

    const titulo = problema.length > 120 ? `${problema.slice(0, 117)}…` : problema
    const descricao = `Problema/oportunidade:\n${problema}\n\nSugestão de melhoria:\n${sugestao}`

    await addDoc(collection(db(), 'manifestacoes'), {
      tipo,
      titulo,
      descricao,
      area: categoria,                 // Área da Sugestão alimenta os indicadores
      categoria,
      departamento: anonima ? null : (departamento || null),
      problema,
      sugestao,
      impactos,
      impacto_outro: impactos.includes('Outro') ? impactoOutro : null,
      nome: anonima ? null : nome,
      email: anonima ? null : (email || null),
      anonima,
      autor_uid: anonima ? null : (auth().currentUser?.uid ?? null),
      status: 'recebida',
      triagem: 'pendente',
      resposta_privada: null,
      triado_por: null,
      triado_em: null,
      prioridade: 'media',
      responsavel: null,
      resposta_publica: null,
      publicar_no_mural: false,
      criado_em: agora,
      atualizado_em: agora,
      analisada_em: null,
      implementada_em: null,
      updates: [eventoInicial],
    })
    return { anonima }
  }

  // ---------------- Reconhecimento (identificado: captura o perfil logado) ----------------
  const comentario = String(p.descricao ?? '').trim()
  const centro = String(p.centro_custo ?? p.area ?? '').trim()
  const tiposR = Array.isArray(p.tipos) ? p.tipos.map((x) => String(x).trim()).filter(Boolean) : []
  // Alvo ESTRUTURADO: tipo (área/pessoa) + id (centro de custo ou uid) + nome.
  const alvoTipo = p.reconhecer_tipo === 'area' || p.reconhecer_tipo === 'pessoa' ? p.reconhecer_tipo : null
  const alvoId = String(p.reconhecer_id ?? '').trim()
  const alvoNome = String(p.reconhecer_nome ?? p.reconhecer ?? '').trim()

  // Não é anônimo: nome, e-mail e centro de custo do perfil são obrigatórios.
  if (nome.length < 3) throw new Error('Não consegui identificar o seu nome. Entre novamente.')
  if (!EMAIL_RE.test(email)) throw new Error('Não consegui identificar o seu e-mail. Entre novamente.')
  if (!centro) throw new Error('Seu centro de custo não está definido no cadastro. Peça à equipe de Gente & Cultura para configurar.')
  if (!alvoTipo) throw new Error('Escolha se você vai reconhecer uma área/time ou uma pessoa.')
  if (!alvoId || alvoNome.length < 2) throw new Error(alvoTipo === 'area' ? 'Selecione a área/time.' : 'Selecione a pessoa.')
  if (comentario.length < 10 || comentario.length > 5000) throw new Error('Comente com as suas palavras (de 10 a 5.000 caracteres).')

  await addDoc(collection(db(), 'manifestacoes'), {
    tipo,
    titulo: alvoNome,
    reconhecer: alvoNome,
    reconhecer_tipo: alvoTipo,
    reconhecer_id: alvoId,
    reconhecer_nome: alvoNome,
    tipos_reconhecimento: tiposR,
    descricao: comentario,
    area: centro,
    centro_custo: centro,
    nome,
    email,
    anonima: false,
    autor_uid: auth().currentUser?.uid ?? null,
    status: 'recebida',
    triagem: 'pendente',
    resposta_privada: null,
    triado_por: null,
    triado_em: null,
    prioridade: 'media',
    responsavel: null,
    resposta_publica: null,
    publicar_no_mural: false,
    criado_em: agora,
    atualizado_em: agora,
    analisada_em: null,
    implementada_em: null,
    updates: [eventoInicial],
  })
  return { anonima: false }
}

// -------------------------------------------------------------
// Minhas manifestações (para o colaborador logado acompanhar e excluir).
// Só aparecem as que foram enviadas IDENTIFICADAS por ele (têm autor_uid).
// Anônimas não são rastreadas de propósito.
// -------------------------------------------------------------
export async function listarMinhasManifestacoes(): Promise<any[]> {
  const u = auth().currentUser
  if (!u) return []
  const snap = await getDocs(
    query(collection(db(), 'manifestacoes'), where('autor_uid', '==', u.uid)),
  ).catch(() => null)
  if (!snap) return []
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as any)
    .sort((a, b) => String(b.criado_em ?? '').localeCompare(String(a.criado_em ?? '')))
}

// O autor avalia a RESPOSTA recebida (0 a 5 estrelas + observação opcional).
// É sobre a resposta de Gente e Cultura, não sobre o assunto original.
// Pode reenviar para editar. As regras do Firestore só deixam o autor mexer
// nos campos de avaliação.
export async function avaliarManifestacao(
  id: string,
  nota: number,
  observacao?: string,
): Promise<{ ok: true }> {
  const u = auth().currentUser
  if (!u) throw new Error('Entre para avaliar a resposta.')
  const n = Math.round(Number(nota))
  if (!(n >= 1 && n <= 5)) throw new Error('Escolha de 1 a 5 estrelas.')
  const obs = (observacao ?? '').trim()
  await updateDoc(doc(db(), 'manifestacoes', id), {
    avaliacao: n,
    avaliacao_obs: obs || null,
    avaliacao_em: new Date().toISOString(),
  })
  return { ok: true }
}

export async function excluirMinhaManifestacao(id: string): Promise<{ ok: true }> {
  const u = auth().currentUser
  if (!u) throw new Error('Entre para excluir a sua manifestação.')
  await deleteDoc(doc(db(), 'manifestacoes', id))
  return { ok: true }
}

// -------------------------------------------------------------
// Envio de resposta de pesquisa
// -------------------------------------------------------------
async function hashEmail(email: string, pesquisaId: string): Promise<string> {
  const dados = new TextEncoder().encode(`${pesquisaId}:${email.trim().toLowerCase()}`)
  const buf = await crypto.subtle.digest('SHA-256', dados)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function enviarResposta(p: {
  slug: string
  pesquisaId: string
  identificacao: string
  email: string
  respostas: Record<string, unknown>
  perguntas: any[]
}) {
  const email = String(p.email ?? '').trim().toLowerCase()
  const respostas = p.respostas ?? {}
  const lista = p.perguntas ?? []

  const precisaEmail = p.identificacao !== 'anonima'
  if (precisaEmail && !EMAIL_RE.test(email)) throw new Error('Informe um e-mail válido.')

  for (const q of lista) {
    if (!q.obrigatoria) continue
    const v = respostas[q.id]
    const vazio = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    if (vazio) throw new Error('Ainda faltam perguntas obrigatórias sem resposta.')
  }

  // Trava de duplicata: cria um doc cujo ID é o hash. A regra só permite
  // criar uma vez: a segunda tentativa é recusada (já respondeu).
  if (precisaEmail) {
    const h = await hashEmail(email, p.pesquisaId)
    try {
      await setDoc(doc(db(), 'pesquisas', p.pesquisaId, 'dedup', h), {
        criado_em: new Date().toISOString(),
      })
    } catch {
      throw new Error('Este e-mail já respondeu esta pesquisa. Cada pessoa responde uma vez só.')
    }
  }

  const porSeg = (chave: string) => {
    const q = lista.find((x) => x.segmentacao === chave)
    const v = q ? respostas[q.id] : null
    return typeof v === 'string' && v ? v : null
  }

  // As respostas ficam embutidas (mapa perguntaId -> valor) num doc só.
  const valores: Record<string, unknown> = {}
  for (const q of lista) {
    const v = respostas[q.id]
    if (v === undefined || v === null || v === '') continue
    if (['likert5', 'enps', 'nota10'].includes(q.tipo)) {
      const n = Number(v)
      if (Number.isFinite(n)) valores[q.id] = n
    } else {
      valores[q.id] = v
    }
  }

  await addDoc(collection(db(), 'pesquisas', p.pesquisaId, 'respostas'), {
    area: porSeg('area'),
    cargo: porSeg('cargo'),
    tempo_casa: porSeg('tempo_casa'),
    modelo_trabalho: porSeg('modelo_trabalho'),
    valores,
    enviada_em: new Date().toISOString(),
  })
  return { ok: true }
}

// -------------------------------------------------------------
// Mural (posts): reconhecimentos aprovados + "Gente Informa"
// -------------------------------------------------------------
/** Posts publicados, ordenados do mais novo ao mais antigo. */
export async function getPostsMural() {
  const q = query(collection(db(), 'posts'), where('publicado', '==', true))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
}

/**
 * Reação por emoji: exige estar logado (funcionário/admin). Uma reação por
 * pessoa: clicar de novo no mesmo emoji desfaz; clicar em outro, troca.
 * O total fica no contador do post; a identidade fica na subcoleção `reacoes`.
 */
export async function reagir(postId: string, chave: string, autor: { nome: string; email: string }) {
  if (!CHAVES_REACAO.includes(chave)) throw new Error('Reação inválida.')
  const u = auth().currentUser
  if (!u) throw new Error('Entre como funcionário para reagir.')
  const refDoc = doc(db(), 'posts', postId, 'reacoes', u.uid)
  const snap = await getDoc(refDoc)
  const anterior = snap.exists() ? ((snap.data().emoji as string) ?? null) : null
  const postRef = doc(db(), 'posts', postId)

  if (anterior === chave) {
    await deleteDoc(refDoc)
    await updateDoc(postRef, { [`reacoes.${chave}`]: increment(-1) })
    return { atual: null as string | null }
  }

  await setDoc(refDoc, {
    emoji: chave,
    nome: autor.nome ?? '',
    email: autor.email ?? u.email ?? '',
    em: new Date().toISOString(),
  })
  const updates: Record<string, unknown> = { [`reacoes.${chave}`]: increment(1) }
  if (anterior) updates[`reacoes.${anterior}`] = increment(-1)
  await updateDoc(postRef, updates)
  return { atual: chave as string | null }
}

/** Reação atual do usuário logado neste post (para destacar), ou null. */
export async function getMinhaReacao(postId: string): Promise<string | null> {
  const u = auth().currentUser
  if (!u) return null
  const snap = await getDoc(doc(db(), 'posts', postId, 'reacoes', u.uid)).catch(() => null)
  return snap && snap.exists() ? ((snap.data().emoji as string) ?? null) : null
}

/** Comentários já aprovados de um post. */
export async function getComentarios(postId: string) {
  const q = query(collection(db(), 'posts', postId, 'comentarios'), where('aprovado', '==', true))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .sort((a, b) => (a.criado_em ?? '').localeCompare(b.criado_em ?? ''))
}

/** Envia um comentário IDENTIFICADO: entra pendente de aprovação do admin. */
export async function enviarComentario(postId: string, texto: string, autor: { nome: string; email: string }) {
  const t = String(texto ?? '').trim()
  if (t.length < 2) throw new Error('Escreva o seu comentário.')
  if (t.length > 800) throw new Error('Comentário muito longo (máximo 800 caracteres).')
  const u = auth().currentUser
  if (!u) throw new Error('Entre como funcionário para comentar.')
  await addDoc(collection(db(), 'posts', postId, 'comentarios'), {
    texto: t,
    nome: autor.nome ?? '',
    email: autor.email ?? u.email ?? '',
    uid: u.uid,
    aprovado: false,
    criado_em: new Date().toISOString(),
  })
  return { ok: true }
}

/** Edita o próprio comentário (só o texto), marcando como editado. */
export async function editarComentario(postId: string, cid: string, texto: string) {
  const t = String(texto ?? '').trim()
  if (t.length < 2) throw new Error('Escreva o seu comentário.')
  if (t.length > 800) throw new Error('Comentário muito longo (máximo 800 caracteres).')
  const u = auth().currentUser
  if (!u) throw new Error('Entre para editar o seu comentário.')
  await updateDoc(doc(db(), 'posts', postId, 'comentarios', cid), {
    texto: t,
    editado: true,
    editado_em: new Date().toISOString(),
    aprovado: false, // toda edição volta para a fila de moderação
  })
  return { ok: true }
}

/** Exclui o próprio comentário (as Regras garantem que só o autor ou admin). */
export async function excluirComentario(postId: string, cid: string) {
  const u = auth().currentUser
  if (!u) throw new Error('Entre para excluir o seu comentário.')
  await deleteDoc(doc(db(), 'posts', postId, 'comentarios', cid))
  return { ok: true }
}
