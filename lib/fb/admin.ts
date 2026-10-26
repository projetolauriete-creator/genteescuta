'use client'

// =============================================================
// Operações da administração no Firestore (exigem login).
// A análise NR-1 e a supressão de grupos pequenos rodam aqui,
// no navegador do admin: as respostas já são de-identificadas.
// =============================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  getCountFromServer,
} from 'firebase/firestore'
import { db } from '../firebase'
import { getAreas } from './publico'
import { analisar } from '../scoring'
import {
  montarTemplateNR1,
  montarTemplatePulso,
  montarTemplateClima,
  montarTemplateSoulan,
  ESCALA_CONCORDANCIA,
  ESCALA_FREQUENCIA,
} from '../nr1-template'
import { gerarSlug } from '../format'
import { sanitizeRich, richVazio } from '../sanitizeHtml'

const TIPO_LABEL: Record<string, string> = {
  contribuicao: 'Contribuição',
  sugestao: 'Sugestão',
  reclamacao: 'Reclamação',
  ideia: 'Ideia',
  melhoria: 'Melhoria',
  reconhecimento: 'Reconhecimento',
}
const ANALISADAS = ['analisada', 'em_implementacao', 'implementada', 'nao_aplicavel']
const EM_IMPLEMENTACAO = ['em_implementacao', 'implementada']

function diasEntre(inicio: string, fim: string): number {
  return Math.max(0, (new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000)
}

// -------------------------------------------------------------
// Canal
// -------------------------------------------------------------
export async function listarManifestacoes() {
  const snap = await getDocs(collection(db(), 'manifestacoes'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''))
}

export async function getManifestacao(id: string) {
  const snap = await getDoc(doc(db(), 'manifestacoes', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as any
}

export async function atualizarManifestacao(
  id: string,
  p: { status: string; prioridade: string; responsavel: string | null; mensagem: string; visivel: boolean; tipo?: string },
  autor: string,
) {
  const ref = doc(db(), 'manifestacoes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Manifestação não encontrada.')
  const atual = snap.data() as any
  const agora = new Date().toISOString()

  const campos: Record<string, unknown> = {
    status: p.status,
    prioridade: p.prioridade,
    responsavel: p.responsavel,
    atualizado_em: agora,
  }
  // Classificação feita pela equipe (ex.: uma "Contribuição" vira Sugestão/Ideia/Melhoria).
  if (p.tipo) campos.tipo = p.tipo
  if (['analisada', 'em_implementacao', 'implementada'].includes(p.status) && !atual.analisada_em)
    campos.analisada_em = agora
  if (p.status === 'implementada' && !atual.implementada_em) campos.implementada_em = agora

  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  if (atual.status !== p.status || p.mensagem) {
    updates.push({
      status_anterior: atual.status,
      status_novo: p.status,
      mensagem: p.mensagem || null,
      autor,
      visivel_ao_colaborador: p.visivel,
      criado_em: agora,
    })
  }
  campos.updates = updates
  await updateDoc(ref, campos)
  return { ok: true }
}

/**
 * Triagem: aprova ou reprova a manifestação. Na reprovação, registra a
 * resposta particular ao autor. Guarda o status e o histórico. A triagem é
 * separada do funil de status.
 */
export async function triarManifestacao(
  id: string,
  p: { triagem: 'aprovada' | 'reprovada'; resposta_privada?: string; autor: string },
) {
  const ref = doc(db(), 'manifestacoes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Manifestação não encontrada.')
  const atual = snap.data() as any
  const agora = new Date().toISOString()
  const resposta = String(p.resposta_privada ?? '').trim()
  if (p.triagem === 'reprovada' && resposta.length < 5) {
    throw new Error('Escreva a resposta ao autor (mínimo 5 caracteres).')
  }

  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  updates.push({
    tipo: 'triagem',
    triagem: p.triagem,
    mensagem: p.triagem === 'aprovada'
      ? 'Manifestação aprovada na triagem.'
      : `Manifestação reprovada na triagem.${resposta ? ' Resposta ao autor registrada.' : ''}`,
    resposta_privada: p.triagem === 'reprovada' ? resposta : null,
    autor: p.autor,
    visivel_ao_colaborador: false, // triagem é interna
    criado_em: agora,
  })

  await updateDoc(ref, {
    triagem: p.triagem,
    resposta_privada: p.triagem === 'reprovada' ? resposta : (atual.resposta_privada ?? null),
    triado_por: p.autor,
    triado_em: agora,
    atualizado_em: agora,
    updates,
  })
  return { ok: true }
}

/** Marca a manifestação como analisada (vista/tratada pelo RH) ou não. */
export async function marcarAnalise(id: string, analisada: boolean, autor: string) {
  const ref = doc(db(), 'manifestacoes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Manifestação não encontrada.')
  const atual = snap.data() as any
  const agora = new Date().toISOString()
  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  updates.push({
    tipo: 'analise',
    mensagem: analisada ? 'Marcada como analisada.' : 'Marcada como não analisada.',
    autor,
    visivel_ao_colaborador: false,
    criado_em: agora,
  })
  await updateDoc(ref, {
    analise: analisada ? 'analisada' : 'nao_analisada',
    analise_por: analisada ? autor : null,
    analise_em: analisada ? agora : null,
    atualizado_em: agora,
    updates,
  })
  return { ok: true }
}

/**
 * Responder pelo portal: escreve uma mensagem que o colaborador IDENTIFICADO lê
 * no portal (seção "Minhas manifestações"), registrada no histórico. Marca como
 * analisada. Não funciona para anônimas (não há autor para receber).
 */
export async function responderPeloPortal(id: string, mensagem: string, autor: string) {
  const texto = String(mensagem ?? '').trim()
  if (texto.length < 3) throw new Error('Escreva a resposta ao colaborador.')
  const ref = doc(db(), 'manifestacoes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Manifestação não encontrada.')
  const atual = snap.data() as any
  if (atual.anonima || !atual.autor_uid) throw new Error('Manifestação anônima: não há para quem responder.')
  const agora = new Date().toISOString()
  // Ao responder, o status vira "Respondida" (sem rebaixar uma já "Concluída").
  const novoStatus = atual.status === 'concluida' ? 'concluida' : 'respondida'
  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  updates.push({
    tipo: 'resposta',
    status_anterior: atual.status ?? null,
    status_novo: novoStatus,
    mensagem: texto,
    autor,
    visivel_ao_colaborador: true, // aparece no portal, em "Minhas manifestações"
    criado_em: agora,
  })
  await updateDoc(ref, {
    status: novoStatus,
    respondida_em: atual.respondida_em ?? agora,
    analise: 'analisada',
    analise_por: autor,
    analise_em: atual.analise_em ?? agora,
    atualizado_em: agora,
    updates,
  })
  return { ok: true }
}

/** Marca a manifestação como Concluída (encerra o assunto). Registra no histórico. */
export async function concluirManifestacao(id: string, autor: string) {
  const ref = doc(db(), 'manifestacoes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Manifestação não encontrada.')
  const atual = snap.data() as any
  const agora = new Date().toISOString()
  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  updates.push({
    status_anterior: atual.status ?? null,
    status_novo: 'concluida',
    mensagem: 'Assunto concluído.',
    autor,
    visivel_ao_colaborador: true,
    criado_em: agora,
  })
  await updateDoc(ref, { status: 'concluida', concluida_em: agora, atualizado_em: agora, updates })
  return { ok: true }
}

/** Reabre uma manifestação concluída (volta para Respondida ou Recebida). */
export async function reabrirManifestacao(id: string, autor: string) {
  const ref = doc(db(), 'manifestacoes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Manifestação não encontrada.')
  const atual = snap.data() as any
  const destino = atual.respondida_em ? 'respondida' : 'recebida'
  const agora = new Date().toISOString()
  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  updates.push({
    status_anterior: atual.status ?? null,
    status_novo: destino,
    mensagem: 'Assunto reaberto.',
    autor,
    visivel_ao_colaborador: true,
    criado_em: agora,
  })
  await updateDoc(ref, { status: destino, concluida_em: null, atualizado_em: agora, updates })
  return { ok: true }
}

/** Exclui a manifestação (só admin pelas Regras). */
export async function excluirManifestacao(id: string) {
  await deleteDoc(doc(db(), 'manifestacoes', id))
  return { ok: true }
}

/** Aprova um RECONHECIMENTO direto da lista: publica no mural e marca a triagem. */
export async function aprovarReconhecimentoNaLista(m: any, autor: string) {
  const titulo = String(m.titulo || m.reconhecer_nome || 'Reconhecimento').trim()
  let corpo = String(m.descricao || m.reconhecer || '').trim()
  if (corpo.length < 5) corpo = titulo // fallback para não bloquear a publicação
  await aprovarReconhecimento(m.id, { titulo, corpo, area: m.area ?? null })
  const ref = doc(db(), 'manifestacoes', m.id)
  const atual = (await getDoc(ref)).data() as any ?? {}
  const agora = new Date().toISOString()
  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  updates.push({ tipo: 'triagem', triagem: 'aprovada', mensagem: 'Reconhecimento aprovado e publicado no mural.', autor, visivel_ao_colaborador: false, criado_em: agora })
  await updateDoc(ref, { triagem: 'aprovada', analise: 'analisada', analise_por: autor, analise_em: atual.analise_em ?? agora, triado_por: autor, triado_em: agora, atualizado_em: agora, updates })
  return { ok: true }
}

/** Reprova um RECONHECIMENTO direto da lista: não publica e marca a triagem. */
export async function reprovarReconhecimentoNaLista(id: string, autor: string) {
  await recusarReconhecimento(id) // mural_recusado = true
  const ref = doc(db(), 'manifestacoes', id)
  const atual = (await getDoc(ref)).data() as any ?? {}
  const agora = new Date().toISOString()
  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  updates.push({ tipo: 'triagem', triagem: 'reprovada', mensagem: 'Reconhecimento reprovado (não publicado no mural).', autor, visivel_ao_colaborador: false, criado_em: agora })
  await updateDoc(ref, { triagem: 'reprovada', analise: 'analisada', analise_por: autor, analise_em: atual.analise_em ?? agora, triado_por: autor, triado_em: agora, atualizado_em: agora, updates })
  return { ok: true }
}

/**
 * Muda rapidamente o status de uma manifestação (inativar = arquivar,
 * ativar = reabrir, repostar = voltar para nova análise) e registra no histórico.
 */
export async function mudarStatusManifestacao(id: string, status: string, autor: string, mensagem?: string) {
  const ref = doc(db(), 'manifestacoes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Manifestação não encontrada.')
  const atual = snap.data() as any
  const agora = new Date().toISOString()
  const campos: Record<string, unknown> = { status, atualizado_em: agora }
  if (['analisada', 'em_implementacao', 'implementada'].includes(status) && !atual.analisada_em) campos.analisada_em = agora
  const updates = Array.isArray(atual.updates) ? [...atual.updates] : []
  updates.push({
    status_anterior: atual.status,
    status_novo: status,
    mensagem: mensagem || null,
    autor,
    visivel_ao_colaborador: true,
    criado_em: agora,
  })
  campos.updates = updates
  await updateDoc(ref, campos)
  return { ok: true }
}

/** Publica (ou tira) no mural. Copia só campos seguros para a coleção pública. */
export async function publicarMural(
  id: string,
  respostaPublica: string,
  publicar: boolean,
) {
  const resposta = respostaPublica.trim()
  if (publicar && resposta.length < 20)
    throw new Error('Escreva o que foi feito com pelo menos 20 caracteres antes de publicar.')

  const ref = doc(db(), 'manifestacoes', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Manifestação não encontrada.')
  const m = snap.data() as any

  await updateDoc(ref, { resposta_publica: resposta || null, publicar_no_mural: publicar })

  // Espelho público (sem nome/e-mail/descrição original)
  await setDoc(doc(db(), 'mural', id), {
    publicado: publicar && resposta.length >= 20,
    titulo: m.titulo,
    tipo: m.tipo,
    area: m.area,
    resposta_publica: resposta || null,
    data: m.implementada_em ?? m.atualizado_em ?? new Date().toISOString(),
  })
  return { ok: true }
}

// -------------------------------------------------------------
// Indicadores do canal
// -------------------------------------------------------------
export function indicadoresCanal(todas: any[]) {
  const total = todas.length
  const tipos = ['contribuicao', 'sugestao', 'reclamacao', 'ideia', 'melhoria', 'reconhecimento']
  const porTipo = tipos.map((t) => ({ rotulo: TIPO_LABEL[t], valor: todas.filter((m) => m.tipo === t).length }))

  const areasMap = new Map<string, { valor: number; anonimas: number }>()
  for (const m of todas) {
    const chave = m.area || 'Não informada'
    const a = areasMap.get(chave) ?? { valor: 0, anonimas: 0 }
    a.valor += 1
    if (m.anonima) a.anonimas += 1
    areasMap.set(chave, a)
  }
  const porArea = [...areasMap.entries()].map(([rotulo, v]) => ({ rotulo, ...v })).sort((a, b) => b.valor - a.valor)

  const analisadas = todas.filter((m) => ANALISADAS.includes(m.status)).length
  const emImpl = todas.filter((m) => EM_IMPLEMENTACAO.includes(m.status)).length
  const implementadas = todas.filter((m) => m.status === 'implementada').length
  const funil = [
    { rotulo: 'Recebidas', valor: total, ajuda: 'Tudo o que chegou pelo canal' },
    { rotulo: 'Em análise', valor: todas.filter((m) => m.status !== 'recebida' && m.status !== 'arquivada').length, ajuda: 'Saíram da fila e alguém assumiu' },
    { rotulo: 'Analisadas', valor: analisadas, ajuda: 'Receberam uma conclusão' },
    { rotulo: 'Em implementação', valor: emImpl, ajuda: 'Viraram ação concreta' },
    { rotulo: 'Implementadas', valor: implementadas, ajuda: 'Concluídas de ponta a ponta' },
  ]
  const mediaDias = (pares: { de: string; ate: string | null }[]) => {
    const v = pares.filter((p) => p.ate).map((p) => diasEntre(p.de, p.ate!))
    return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null
  }
  return {
    total,
    porTipo,
    porArea,
    funil,
    taxaImplementacao: total > 0 ? Math.round((implementadas / total) * 100) : 0,
    aguardando: todas.filter((m) => m.status === 'recebida').length,
    publicadasNoMural: todas.filter((m) => m.publicar_no_mural && m.resposta_publica).length,
    tempoMedioAnalise: mediaDias(todas.map((m) => ({ de: m.criado_em, ate: m.analisada_em }))),
    tempoMedioImplementacao: mediaDias(todas.map((m) => ({ de: m.criado_em, ate: m.implementada_em }))),
    recentes: todas.slice(0, 8),
  }
}

// -------------------------------------------------------------
// Pesquisas
// -------------------------------------------------------------
export async function listarPesquisas() {
  const snap = await getDocs(collection(db(), 'pesquisas'))
  const pesquisas = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''))
  const contagem: Record<string, number> = {}
  for (const p of pesquisas) {
    const c = await getCountFromServer(collection(db(), 'pesquisas', p.id, 'respostas'))
    contagem[p.id] = c.data().count
  }
  return { pesquisas, contagem }
}

export async function getPesquisa(id: string) {
  const snap = await getDoc(doc(db(), 'pesquisas', id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as any
}

export async function contarRespostas(id: string): Promise<number> {
  const c = await getCountFromServer(collection(db(), 'pesquisas', id, 'respostas'))
  return c.data().count
}

/** Lê as respostas e monta a estrutura que o cálculo espera. */
async function carregarRespostas(pesquisaId: string) {
  const snap = await getDocs(collection(db(), 'pesquisas', pesquisaId, 'respostas'))
  const respostas: any[] = []
  const itens: any[] = []
  for (const d of snap.docs) {
    const r = d.data() as any
    respostas.push({ id: d.id, area: r.area, cargo: r.cargo, tempo_casa: r.tempo_casa, modelo_trabalho: r.modelo_trabalho })
    const valores = r.valores ?? {}
    for (const [pid, v] of Object.entries(valores)) {
      if (typeof v === 'number') itens.push({ resposta_id: d.id, pergunta_id: pid, valor_num: v, valor_texto: null, valor_json: null })
      else if (Array.isArray(v)) itens.push({ resposta_id: d.id, pergunta_id: pid, valor_num: null, valor_texto: null, valor_json: v })
      else itens.push({ resposta_id: d.id, pergunta_id: pid, valor_num: null, valor_texto: String(v), valor_json: null })
    }
  }
  return { respostas, itens }
}

export async function painelPesquisa(id: string) {
  const pesquisa = await getPesquisa(id)
  if (!pesquisa) throw new Error('Pesquisa não encontrada.')
  const { respostas, itens } = await carregarRespostas(id)
  const analise = analisar({ pesquisa, secoes: pesquisa.secoes ?? [], perguntas: pesquisa.perguntas ?? [], respostas, itens })
  return { pesquisa, analise }
}

export async function indicadoresClima() {
  const snap = await getDocs(collection(db(), 'pesquisas'))
  const pesquisas = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .filter((p) => p.status === 'aberta' || p.status === 'encerrada')
    .sort((a, b) => (a.criado_em ?? '').localeCompare(b.criado_em ?? ''))
  const medicoes: any[] = []
  for (const pesquisa of pesquisas) {
    const { respostas, itens } = await carregarRespostas(pesquisa.id)
    if (respostas.length === 0) continue
    medicoes.push({ pesquisa, analise: analisar({ pesquisa, secoes: pesquisa.secoes ?? [], perguntas: pesquisa.perguntas ?? [], respostas, itens }) })
  }
  const atual = medicoes.length ? medicoes[medicoes.length - 1] : null
  const anterior = medicoes.length > 1 ? medicoes[medicoes.length - 2] : null
  const variacaoENPS = atual?.analise.enps && anterior?.analise.enps ? atual.analise.enps.enps - anterior.analise.enps.enps : null
  const variacaoSatisfacao =
    atual?.analise.satisfacao != null && anterior?.analise.satisfacao != null
      ? Math.round((atual.analise.satisfacao - anterior.analise.satisfacao) * 10) / 10
      : null
  const comDim = [...medicoes].reverse().find((m) => m.analise.dimensoes.some((d: any) => d.respondentes > 0))
  return {
    medicoes,
    atual,
    anterior,
    variacaoENPS,
    variacaoSatisfacao,
    pontosPositivos: comDim?.analise.pontosPositivos ?? [],
    pontosAtencao: comDim?.analise.pontosAtencao ?? [],
  }
}

// -------------------------------------------------------------
// Criar / editar pesquisa
// -------------------------------------------------------------
async function slugLivre(base: string): Promise<string> {
  const raiz = base || 'pesquisa'
  for (let t = 0; t < 50; t++) {
    const cand = t === 0 ? raiz : `${raiz}-${t + 1}`
    const q = query(collection(db(), 'pesquisas'), where('slug', '==', cand))
    const snap = await getDocs(q)
    if (snap.empty) return cand
  }
  return `${raiz}-${Date.now()}`
}

export async function criarPesquisa(p: any) {
  const titulo = String(p.titulo ?? '').trim()
  const modelo = String(p.modelo ?? 'nr1')
  const identificacao = String(p.identificacao ?? 'confidencial')
  if (titulo.length < 4) throw new Error('Dê um título com pelo menos 4 caracteres.')

  const secoesTpl =
    modelo === 'pulso'
      ? montarTemplatePulso()
      : modelo === 'clima'
        ? montarTemplateClima()
        : modelo === 'soulan'
          ? montarTemplateSoulan()
          : montarTemplateNR1()
  const tipo = modelo === 'clima' ? 'clima' : 'nr1'
  const slug = await slugLivre(gerarSlug(titulo))
  const opcoesArea = (await getAreas()).map((n) => ({ valor: n, rotulo: n }))

  // Seções e perguntas ficam embutidas no documento da pesquisa.
  const secoes: any[] = []
  const perguntas: any[] = []
  let ordem = 0
  secoesTpl.forEach((secao, i) => {
    const sid = `s${i}`
    secoes.push({ id: sid, titulo: secao.titulo, descricao: secao.descricao ?? null, dimensao: secao.dimensao ?? null, ordem: i })
    for (const q of secao.perguntas) {
      const tipoQ = q.tipo ?? 'likert5'
      let opcoes = q.opcoes ?? null
      if (tipoQ === 'likert5' && !opcoes) opcoes = (q as any).escala === 'concordancia' ? ESCALA_CONCORDANCIA : ESCALA_FREQUENCIA
      if ((q as any).segmentacao === 'area' && !q.opcoes) opcoes = opcoesArea
      perguntas.push({
        id: `q${ordem}`,
        secao_id: sid,
        enunciado: q.enunciado,
        ajuda: q.ajuda ?? null,
        tipo: tipoQ,
        opcoes,
        obrigatoria: q.obrigatoria ?? true,
        invertida: q.invertida ?? false,
        critica: q.critica ?? false,
        segmentacao: (q as any).segmentacao ?? null,
        ordem: ordem,
      })
      ordem++
    }
  })

  const publicoAlvo = p.publico_alvo ? Number(p.publico_alvo) : null
  const minGrupo = Number(p.min_grupo ?? 5)
  const fechaEm = String(p.fecha_em ?? '').trim()
  const ref = await addDoc(collection(db(), 'pesquisas'), {
    slug,
    titulo,
    descricao: String(p.descricao ?? '').trim() || null,
    tipo,
    identificacao,
    status: 'rascunho',
    min_grupo: Number.isFinite(minGrupo) && minGrupo >= 1 ? Math.floor(minGrupo) : 5,
    publico_alvo: publicoAlvo,
    fecha_em: fechaEm ? new Date(`${fechaEm}T23:59:59`).toISOString() : null,
    criado_em: new Date().toISOString(),
    secoes,
    perguntas,
  })
  return { id: ref.id }
}

export async function salvarPesquisa(id: string, p: any) {
  const titulo = String(p.titulo ?? '').trim()
  if (titulo.length < 4) throw new Error('O título precisa ter pelo menos 4 caracteres.')
  const minGrupo = Number(p.min_grupo ?? 5)
  const fechaEm = String(p.fecha_em ?? '').trim()
  await updateDoc(doc(db(), 'pesquisas', id), {
    titulo,
    descricao: String(p.descricao ?? '').trim() || null,
    identificacao: String(p.identificacao ?? 'confidencial'),
    publico_alvo: p.publico_alvo ? Number(p.publico_alvo) : null,
    min_grupo: Number.isFinite(minGrupo) && minGrupo >= 1 ? Math.floor(minGrupo) : 5,
    fecha_em: fechaEm ? new Date(`${fechaEm}T23:59:59`).toISOString() : null,
  })
}

export async function mudarStatusPesquisa(id: string, status: string) {
  const campos: Record<string, unknown> = { status }
  if (status === 'aberta') campos.abre_em = new Date().toISOString()
  await updateDoc(doc(db(), 'pesquisas', id), campos)
}

export async function excluirPesquisa(id: string) {
  await deleteDoc(doc(db(), 'pesquisas', id))
}

/** Salva o array inteiro de seções/perguntas (o editor manda tudo de uma vez). */
export async function salvarEstrutura(id: string, secoes: any[], perguntas: any[]) {
  await updateDoc(doc(db(), 'pesquisas', id), { secoes, perguntas })
}

// -------------------------------------------------------------
// Mural (posts): Gente Informa + reconhecimentos + moderação
// -------------------------------------------------------------
const REACOES_ZERO = { curtir: 0, amei: 0, parabens: 0, apoio: 0 }

export async function listarPosts() {
  const snap = await getDocs(collection(db(), 'posts'))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as any)
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
}

/** Cria ou edita um aviso do "Gente Informa". */
export async function salvarPostInforma(p: {
  id?: string
  titulo: string
  corpo: string
  autor: string
  publicado: boolean
}) {
  const titulo = String(p.titulo ?? '').trim()
  // O corpo agora é rico (permite links); sanitiza e valida se não está vazio.
  const corpo = sanitizeRich(String(p.corpo ?? ''))
  const autor = String(p.autor ?? '').trim() || 'Gente & Cultura'
  if (titulo.length < 3) throw new Error('Dê um título ao aviso.')
  if (richVazio(corpo)) throw new Error('Escreva o conteúdo do aviso.')
  const agora = new Date().toISOString()
  if (p.id) {
    await updateDoc(doc(db(), 'posts', p.id), { titulo, corpo, autor, publicado: p.publicado, atualizado_em: agora })
    return { id: p.id }
  }
  const ref = await addDoc(collection(db(), 'posts'), {
    categoria: 'informa',
    titulo,
    corpo,
    autor,
    area: null,
    origem_id: null,
    publicado: p.publicado,
    reacoes: { ...REACOES_ZERO },
    data: agora,
    criado_em: agora,
    atualizado_em: agora,
  })
  return { id: ref.id }
}

export async function definirPublicadoPost(id: string, publicado: boolean) {
  await updateDoc(doc(db(), 'posts', id), { publicado })
}

/** Repostar: joga o post para o topo do mural (data de agora) e publica. */
export async function repostarPost(id: string) {
  const agora = new Date().toISOString()
  await updateDoc(doc(db(), 'posts', id), { data: agora, publicado: true, atualizado_em: agora })
}

export async function excluirPost(id: string) {
  await deleteDoc(doc(db(), 'posts', id))
}

/** Reconhecimentos (manifestações) ainda não publicados nem recusados. */
export async function reconhecimentosPendentes() {
  const [ms, posts] = await Promise.all([listarManifestacoes(), listarPosts()])
  const origens = new Set(posts.filter((p) => p.origem_id).map((p) => p.origem_id))
  return ms.filter((m) => m.tipo === 'reconhecimento' && !m.mural_recusado && !origens.has(m.id))
}

/** Aprova um reconhecimento: cria o post publicado no mural (sem nome/e-mail de quem enviou). */
export async function aprovarReconhecimento(manifId: string, p: { titulo: string; corpo: string; area: string | null }) {
  const titulo = String(p.titulo ?? '').trim()
  const corpo = String(p.corpo ?? '').trim()
  if (titulo.length < 3) throw new Error('O título ficou curto demais.')
  if (corpo.length < 5) throw new Error('O texto do reconhecimento ficou curto demais.')
  const agora = new Date().toISOString()
  await addDoc(collection(db(), 'posts'), {
    categoria: 'reconhecimento',
    titulo,
    corpo,
    autor: null,
    area: p.area ?? null,
    origem_id: manifId,
    publicado: true,
    reacoes: { ...REACOES_ZERO },
    data: agora,
    criado_em: agora,
    atualizado_em: agora,
  })
}

export async function recusarReconhecimento(manifId: string) {
  await updateDoc(doc(db(), 'manifestacoes', manifId), { mural_recusado: true })
}

/** Comentários pendentes de aprovação, de todos os posts. */
export async function comentariosPendentes() {
  const posts = await listarPosts()
  const pendentes: any[] = []
  for (const p of posts) {
    const snap = await getDocs(query(collection(db(), 'posts', p.id, 'comentarios'), where('aprovado', '==', false)))
    for (const d of snap.docs) pendentes.push({ id: d.id, postId: p.id, postTitulo: p.titulo, ...d.data() })
  }
  return pendentes.sort((a, b) => (a.criado_em ?? '').localeCompare(b.criado_em ?? ''))
}

export async function aprovarComentario(postId: string, cid: string) {
  await updateDoc(doc(db(), 'posts', postId, 'comentarios', cid), { aprovado: true })
}

export async function excluirComentario(postId: string, cid: string) {
  await deleteDoc(doc(db(), 'posts', postId, 'comentarios', cid))
}

// -------------------------------------------------------------
// Configurações
// -------------------------------------------------------------
export async function configCompleta() {
  const [cfgSnap, areasSnap] = await Promise.all([
    getDoc(doc(db(), 'config', 'geral')),
    getDocs(collection(db(), 'areas')),
  ])
  const config = cfgSnap.exists() ? cfgSnap.data() : { empresa_nome: 'Soulan Recursos Humanos', min_grupo: 5 }
  const areas = areasSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as any).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  return { config, areas }
}

export async function salvarConfig(p: any) {
  const empresa = String(p.empresa_nome ?? '').trim()
  const mensagem = String(p.canal_mensagem ?? '').trim()
  const minGrupo = Number(p.min_grupo ?? 5)
  if (empresa.length < 2) throw new Error('Informe o nome da empresa.')
  if (mensagem.length < 10) throw new Error('A mensagem do canal está curta demais.')
  await setDoc(doc(db(), 'config', 'geral'), {
    empresa_nome: empresa,
    canal_mensagem: mensagem,
    min_grupo: Number.isFinite(minGrupo) && minGrupo >= 1 ? Math.floor(minGrupo) : 5,
  }, { merge: true })
}

export async function adicionarArea(nome: string) {
  const n = nome.trim()
  if (n.length < 2) throw new Error('Escreva o nome da área.')
  await addDoc(collection(db(), 'areas'), { nome: n, ativa: true, ordem: 99 })
}

export async function definirAreaAtiva(id: string, ativa: boolean) {
  await updateDoc(doc(db(), 'areas', id), { ativa })
}

// -------------------------------------------------------------
// Exportar CSV (gerado no navegador)
// -------------------------------------------------------------
export async function exportarCsv(id: string): Promise<{ csv: string; arquivo: string }> {
  const pesquisa = await getPesquisa(id)
  if (!pesquisa) throw new Error('Pesquisa não encontrada.')
  const perguntas = (pesquisa.perguntas ?? []).slice().sort((a: any, b: any) => a.ordem - b.ordem)
  const snap = await getDocs(collection(db(), 'pesquisas', id, 'respostas'))
  const respostas = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as any)

  const identificada = pesquisa.identificacao === 'identificada'
  const cab = [
    'resposta_id', 'enviada_em',
    ...(identificada ? ['email'] : []),
    'area', 'cargo', 'tempo_casa', 'modelo_trabalho',
    ...perguntas.map((q: any) => q.enunciado),
  ]
  const esc = (v: unknown) => {
    const t = v == null ? '' : String(v)
    const seguro = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t
    return `"${seguro.replace(/"/g, '""')}"`
  }
  const linhas = respostas
    .sort((a, b) => (a.enviada_em ?? '').localeCompare(b.enviada_em ?? ''))
    .map((r) =>
      [
        r.id, new Date(r.enviada_em).toLocaleString('pt-BR'),
        ...(identificada ? [r.email ?? ''] : []),
        r.area ?? '', r.cargo ?? '', r.tempo_casa ?? '', r.modelo_trabalho ?? '',
        ...perguntas.map((q: any) => {
          const v = (r.valores ?? {})[q.id]
          return v == null ? '' : Array.isArray(v) ? v.join(' | ') : String(v)
        }),
      ].map(esc).join(';'),
    )
  return { csv: ['﻿' + cab.map(esc).join(';'), ...linhas].join('\r\n'), arquivo: `${gerarSlug(pesquisa.titulo) || 'pesquisa'}-respostas.csv` }
}
