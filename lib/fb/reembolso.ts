'use client'

// =============================================================
// Solicitação de Reembolso: operações no Firestore.
//
// SEM Firebase Storage (o projeto é Spark, sem cartão): o comprovante
// é comprimido no navegador e guardado como data URL num documento
// SEPARADO (`reembolso_anexos/{id}`), para não pesar as listas. O
// documento principal (`reembolsos/{id}`) fica leve e é o que as telas
// consultam. A segurança de verdade está nas Regras do Firestore.
// =============================================================
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, deleteField, query, where,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import {
  statusInicial, proximoStatus, papelDaEtapa, mesmoCentro, centroAbrangeTudo, statusDoPagamento,
  estaPendente, editavelPeloSolicitante, formatBRL, formatData,
  ehCategoriaKm, valorKm, TAXA_KM_PADRAO, type StatusReembolso,
} from '../reembolso'
import type { Perfil } from './funcionarios'
import { registrarLog } from './usuarios'
import { avisarNovaSolicitacao, avisarDecisao, avisarPagamento, avisarPendencia, avisarEdicao, avisarCancelamento } from './notificacoes'

// Limite do data URL do anexo. O documento do Firestore tem teto de ~1 MB;
// base64 infla ~33%, então seguramos o conteúdo bem abaixo disso.
const MAX_ANEXO_CHARS = 950_000

// -------------------------------------------------------------
// Taxa de KM (R$/km), configurável no admin (config/reembolso.taxa_km).
// Fonte única: o formulário e o cálculo leem daqui.
// -------------------------------------------------------------
export async function getTaxaKm(): Promise<number> {
  try {
    const snap = await getDoc(doc(db(), 'config', 'reembolso'))
    const t = snap.exists() ? Number(snap.data().taxa_km) : NaN
    return t > 0 ? t : TAXA_KM_PADRAO
  } catch {
    return TAXA_KM_PADRAO
  }
}

/** Salva a taxa de KM (só Super Admin, pelas Regras do Firestore). */
export async function salvarTaxaKm(taxa: number): Promise<void> {
  const t = Number(taxa)
  if (!(t > 0)) throw new Error('Informe uma taxa por km maior que zero.')
  await setDoc(
    doc(db(), 'config', 'reembolso'),
    { taxa_km: t, atualizado_em: new Date().toISOString() },
    { merge: true },
  )
  await registrarLog('reembolso_taxa_km', `R$ ${t.toFixed(2)} por km`)
}

// Decide valor e campos de km a partir da categoria. Em KM o valor é sempre
// calculado (km x taxa); nas demais, usa o valor digitado. Lança se inválido.
function valorEKm(
  dados: { categoria: string; valor: number; km?: number; km_taxa?: number },
): { valor: number; km: number | null; km_taxa: number | null } {
  if (ehCategoriaKm(dados.categoria)) {
    const km = Number(dados.km)
    const taxa = Number(dados.km_taxa) > 0 ? Number(dados.km_taxa) : TAXA_KM_PADRAO
    if (!(km > 0)) throw new Error('Informe os quilômetros rodados (maior que zero).')
    return { valor: valorKm(km, taxa), km, km_taxa: taxa }
  }
  const valor = Number(dados.valor)
  if (!(valor > 0)) throw new Error('Informe um valor maior que zero.')
  return { valor, km: null, km_taxa: null }
}

export interface Anexo {
  tipo: 'image' | 'pdf'
  nome: string
  dados: string // data URL
  tamanho: number
}

export interface EventoHistorico {
  status_novo: StatusReembolso
  por_uid: string
  por_nome: string
  papel: string
  em: string
  motivo?: string
  data_pagamento?: string
  /** 'edicao' = o solicitante ajustou e reenviou o pedido após recusa. */
  tipo?: 'edicao'
  /** Resumo legível do que mudou nesta edição (ex.: "Valor: R$100,00 → R$120,00"). */
  alteracoes?: string
}

export interface Reembolso {
  id: string
  solicitante_uid: string
  solicitante_nome: string
  solicitante_email: string
  centro_custo: string
  data_despesa: string
  categoria: string
  descricao: string
  valor: number
  status: StatusReembolso
  /** Quilometragem informada (só nas despesas de KM). */
  km?: number | null
  /** Taxa (R$/km) aplicada no cálculo, guardada para conferência. */
  km_taxa?: number | null
  tem_anexo: boolean
  anexo_tipo: 'image' | 'pdf' | null
  anexo_nome: string | null
  historico: EventoHistorico[]
  /** Preenchidos quando o Financeiro registra o pagamento. */
  data_pagamento?: string | null
  pago_por_nome?: string | null
  pago_em?: string | null
  criado_em: string
  atualizado_em: string
}

// -------------------------------------------------------------
// Anexo: comprime imagem no cliente; PDF entra como está (com teto).
// -------------------------------------------------------------
function lerComoDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Não consegui ler o arquivo.'))
    r.readAsDataURL(file)
  })
}

async function comprimirImagem(file: File): Promise<string> {
  const url = await lerComoDataURL(file)
  const img = document.createElement('img')
  await new Promise<void>((res, rej) => {
    img.onload = () => res()
    img.onerror = () => rej(new Error('Imagem inválida.'))
    img.src = url
  })
  // Reduz a maior dimensão e a qualidade até caber no limite.
  for (const maxDim of [1600, 1280, 1024, 800, 640]) {
    const escala = Math.min(1, maxDim / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * escala))
    const h = Math.max(1, Math.round(img.height * escala))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) break
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    for (const q of [0.82, 0.7, 0.6, 0.5, 0.4]) {
      const out = canvas.toDataURL('image/jpeg', q)
      if (out.length <= MAX_ANEXO_CHARS) return out
    }
  }
  throw new Error('A imagem ficou grande demais mesmo após a compressão. Tente uma foto menor.')
}

/** Prepara o comprovante (foto ou PDF) para gravar. Lança erro se inválido. */
export async function prepararAnexo(file: File): Promise<Anexo> {
  const nome = file.name || 'comprovante'
  const ehPdf = file.type === 'application/pdf' || /\.pdf$/i.test(nome)
  const ehImg = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic)$/i.test(nome)
  if (!ehPdf && !ehImg) throw new Error('O comprovante precisa ser uma imagem (foto) ou um PDF.')

  if (ehPdf) {
    const dados = await lerComoDataURL(file)
    if (dados.length > MAX_ANEXO_CHARS) {
      throw new Error('Este PDF é muito grande. Reduza para cerca de 700 KB (ou envie uma foto do comprovante).')
    }
    return { tipo: 'pdf', nome, dados, tamanho: dados.length }
  }
  const dados = await comprimirImagem(file)
  return { tipo: 'image', nome, dados, tamanho: dados.length }
}

// -------------------------------------------------------------
// Criar solicitação
// -------------------------------------------------------------
export async function criarReembolso(
  dados: {
    centro_custo: string
    data_despesa: string
    categoria: string
    descricao: string
    valor: number
    /** Só nas despesas de KM: km rodados e a taxa aplicada. */
    km?: number
    km_taxa?: number
  },
  anexo: Anexo,
  perfil: Perfil,
) {
  const u = auth().currentUser
  if (!u) throw new Error('Entre para solicitar um reembolso.')
  if (!dados.centro_custo) throw new Error('Selecione o centro de custo.')
  if (!dados.data_despesa) throw new Error('Informe a data da despesa.')
  if (!dados.categoria) throw new Error('Escolha a categoria da despesa.')
  if (String(dados.descricao ?? '').trim().length < 3) throw new Error('Descreva o motivo da despesa.')
  if (!anexo) throw new Error('Anexe o comprovante (foto ou PDF).')

  // KM: o valor é calculado (km x taxa), nunca digitado à mão, para garantir o
  // cálculo. Guarda km e a taxa aplicada para conferência posterior.
  const campos = valorEKm(dados)

  const agora = new Date().toISOString()
  const status = statusInicial(perfil.papeis)

  const ref = await addDoc(collection(db(), 'reembolsos'), {
    solicitante_uid: u.uid,
    solicitante_nome: perfil.nome || u.email || '',
    solicitante_email: perfil.email || u.email || '',
    centro_custo: dados.centro_custo,
    data_despesa: dados.data_despesa,
    categoria: dados.categoria,
    descricao: String(dados.descricao).trim(),
    valor: campos.valor,
    ...(campos.km != null ? { km: campos.km, km_taxa: campos.km_taxa } : {}),
    status,
    tem_anexo: true,
    anexo_tipo: anexo.tipo,
    anexo_nome: anexo.nome,
    historico: [
      { status_novo: status, por_uid: u.uid, por_nome: perfil.nome || '', papel: 'solicitante', em: agora },
    ],
    criado_em: agora,
    atualizado_em: agora,
  })

  // Anexo num doc separado, com o MESMO id do reembolso.
  await setDoc(doc(db(), 'reembolso_anexos', ref.id), {
    solicitante_uid: u.uid,
    tipo: anexo.tipo,
    nome: anexo.nome,
    dados: anexo.dados,
    tamanho: anexo.tamanho,
    criado_em: agora,
  })

  await registrarLog('reembolso_solicitado', `${dados.categoria} · ${campos.valor}`)
  // Notifica (sino) o gestor da área / master e o financeiro. Best-effort.
  await avisarNovaSolicitacao({
    reembolsoId: ref.id,
    status,
    centro: dados.centro_custo,
    solicitante: perfil.nome || u.email || 'Colaborador',
    resumo: `${dados.categoria} · ${formatBRL(campos.valor)}`,
  })
  return { id: ref.id, status }
}

// -------------------------------------------------------------
// Leitura
// -------------------------------------------------------------
function mapear(d: any): Reembolso {
  return { id: d.id, ...(d.data ? d.data() : d) } as Reembolso
}

/** As solicitações do próprio usuário logado. */
export async function listarMinhas(): Promise<Reembolso[]> {
  const u = auth().currentUser
  if (!u) return []
  const snap = await getDocs(query(collection(db(), 'reembolsos'), where('solicitante_uid', '==', u.uid)))
  return snap.docs.map(mapear).sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''))
}

/**
 * Reembolsos que este perfil PODE VER, para aprovação/painel:
 *  - master/financeiro: todos;
 *  - gestor: só os do próprio centro de custo.
 * (Colaborador puro usa listarMinhas.)
 */
export async function listarParaGestao(perfil: Perfil): Promise<Reembolso[]> {
  const veTodos =
    perfil.papeis.includes('master') ||
    perfil.papeis.includes('financeiro') ||
    (perfil.papeis.includes('gestor') && centroAbrangeTudo(perfil.centro_custo))
  let snap
  if (veTodos) {
    snap = await getDocs(collection(db(), 'reembolsos'))
  } else if (perfil.papeis.includes('gestor') && perfil.centro_custo) {
    snap = await getDocs(query(collection(db(), 'reembolsos'), where('centro_custo', '==', perfil.centro_custo)))
  } else {
    return []
  }
  return snap.docs.map(mapear).sort((a, b) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''))
}

/** Baixa o anexo (data URL) sob demanda, só quando alguém abre o detalhe. */
export async function getAnexo(id: string): Promise<Anexo | null> {
  const snap = await getDoc(doc(db(), 'reembolso_anexos', id)).catch(() => null)
  if (!snap || !snap.exists()) return null
  const d = snap.data() as any
  return { tipo: d.tipo, nome: d.nome, dados: d.dados, tamanho: d.tamanho ?? 0 }
}

// -------------------------------------------------------------
// Aprovar / Recusar
// -------------------------------------------------------------
async function decidir(id: string, perfil: Perfil, aprovar: boolean, motivo?: string) {
  const u = auth().currentUser
  if (!u) throw new Error('Sua sessão expirou. Entre novamente.')
  const ref = doc(db(), 'reembolsos', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Solicitação não encontrada.')
  const r = mapear(snap)

  if (r.solicitante_uid === u.uid && !perfil.papeis.includes('master')) {
    throw new Error('Você não pode aprovar a sua própria solicitação.')
  }
  const papelEtapa = papelDaEtapa(r.status)
  if (!papelEtapa) throw new Error('Esta solicitação já foi finalizada.')

  // A etapa do Financeiro é PAGAMENTO, não "aprovação": aprovar aqui não faz
  // sentido (recusar, sim). Direciona ao fluxo certo.
  if (aprovar && r.status === 'pendente_financeiro') {
    throw new Error('Nesta etapa, o Financeiro registra o pagamento (não "aprovar").')
  }

  // Confere se este perfil responde por esta etapa.
  const ehMaster = perfil.papeis.includes('master')
  const podeGestor = r.status === 'pendente_gestor'
    && perfil.papeis.includes('gestor')
    && (centroAbrangeTudo(perfil.centro_custo) || mesmoCentro(perfil.centro_custo, r.centro_custo))
  const podeMasterEtapa = r.status === 'pendente_master' && ehMaster
  const podeFin = r.status === 'pendente_financeiro' && perfil.papeis.includes('financeiro')
  if (!(ehMaster || podeGestor || podeMasterEtapa || podeFin)) {
    throw new Error('Você não tem permissão para decidir nesta etapa.')
  }

  const agora = new Date().toISOString()
  const novoStatus: StatusReembolso = aprovar ? proximoStatus(r.status) : 'recusado'
  const evento: EventoHistorico = {
    status_novo: novoStatus,
    por_uid: u.uid,
    por_nome: perfil.nome || u.email || '',
    papel: papelEtapa,
    em: agora,
    ...(motivo ? { motivo: String(motivo).trim() } : {}),
  }

  await updateDoc(ref, {
    status: novoStatus,
    historico: [...(r.historico ?? []), evento],
    atualizado_em: agora,
  })
  await registrarLog(aprovar ? 'reembolso_aprovado' : 'reembolso_recusado', `${id} → ${novoStatus}`)
  // Notifica (sino) o colaborador que fez o pedido.
  await avisarDecisao({
    solicitanteUid: r.solicitante_uid,
    aprovado: aprovar,
    reembolsoId: id,
    porNome: perfil.nome || u.email || '',
    motivo,
  })
  // Se avançou para outra etapa pendente (ex.: Gestor → Financeiro), avisa
  // quem passa a ser o responsável por decidir.
  if (aprovar && estaPendente(novoStatus)) {
    await avisarPendencia({
      reembolsoId: id,
      status: novoStatus,
      centro: r.centro_custo,
      solicitante: r.solicitante_nome || r.solicitante_email || 'Colaborador',
      resumo: `${r.categoria} · ${formatBRL(r.valor)}`,
    })
  }
  return { status: novoStatus }
}

export function aprovarReembolso(id: string, perfil: Perfil) {
  return decidir(id, perfil, true)
}

export function recusarReembolso(id: string, perfil: Perfil, motivo: string) {
  const m = String(motivo ?? '').trim()
  if (m.length < 3) throw new Error('Escreva o motivo da recusa.')
  return decidir(id, perfil, false, m)
}

// -------------------------------------------------------------
// Financeiro: registrar pagamento (data futura = Agendado; hoje/passado = Pago)
// -------------------------------------------------------------
export async function registrarPagamento(id: string, perfil: Perfil, dataPagamento: string) {
  const u = auth().currentUser
  if (!u) throw new Error('Sua sessão expirou. Entre novamente.')
  const data = String(dataPagamento ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Informe a data do pagamento.')

  const podeFinanceiro = perfil.papeis.includes('financeiro') || perfil.papeis.includes('master')
  if (!podeFinanceiro) throw new Error('Só o Financeiro (ou Master) registra pagamento.')

  const ref = doc(db(), 'reembolsos', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Solicitação não encontrada.')
  const r = mapear(snap)
  if (r.status !== 'pendente_financeiro') {
    throw new Error('Este reembolso não está aguardando pagamento.')
  }

  const agora = new Date().toISOString()
  const novoStatus: StatusReembolso = statusDoPagamento(data)
  const evento: EventoHistorico = {
    status_novo: novoStatus,
    por_uid: u.uid,
    por_nome: perfil.nome || u.email || '',
    papel: 'financeiro',
    em: agora,
    data_pagamento: data,
  }

  await updateDoc(ref, {
    status: novoStatus,
    data_pagamento: data,
    pago_por_nome: perfil.nome || u.email || '',
    pago_em: agora,
    historico: [...(r.historico ?? []), evento],
    atualizado_em: agora,
  })
  await registrarLog('reembolso_pago', `${id} → ${novoStatus} (${data})`)
  // Notifica (sino) o colaborador.
  await avisarPagamento({
    solicitanteUid: r.solicitante_uid,
    reembolsoId: id,
    porNome: perfil.nome || u.email || '',
    agendado: novoStatus === 'agendado',
    data,
  })
  return { status: novoStatus }
}

// -------------------------------------------------------------
// Editar após recusa: o próprio solicitante ajusta o pedido existente
// (sem criar outro do zero). O pedido volta ao início do fluxo e o
// histórico registra QUEM editou, O QUÊ mudou e QUANDO.
// -------------------------------------------------------------
/** Monta um resumo legível das mudanças entre o pedido atual e o ajuste. */
function resumirAlteracoes(
  antigo: Reembolso,
  novo: { data_despesa: string; categoria: string; descricao: string; valor: number },
  trocouAnexo: boolean,
): string {
  const partes: string[] = []
  if (antigo.valor !== novo.valor) partes.push(`Valor: ${formatBRL(antigo.valor)} → ${formatBRL(novo.valor)}`)
  if (antigo.categoria !== novo.categoria) partes.push(`Categoria: ${antigo.categoria} → ${novo.categoria}`)
  if (String(antigo.data_despesa).slice(0, 10) !== String(novo.data_despesa).slice(0, 10)) {
    partes.push(`Data: ${formatData(antigo.data_despesa)} → ${formatData(novo.data_despesa)}`)
  }
  if ((antigo.descricao ?? '').trim() !== novo.descricao.trim()) partes.push('Descrição atualizada')
  if (trocouAnexo) partes.push('Novo comprovante')
  return partes.join(' · ') || 'Reenviado sem alterações de conteúdo'
}

export async function editarReembolso(
  id: string,
  dados: { data_despesa: string; categoria: string; descricao: string; valor: number; km?: number; km_taxa?: number },
  perfil: Perfil,
  anexo?: Anexo | null,
) {
  const u = auth().currentUser
  if (!u) throw new Error('Sua sessão expirou. Entre novamente.')

  if (!dados.data_despesa) throw new Error('Informe a data da despesa.')
  if (!dados.categoria) throw new Error('Escolha a categoria da despesa.')
  if (String(dados.descricao ?? '').trim().length < 3) throw new Error('Descreva o motivo da despesa.')
  const campos = valorEKm(dados)
  const valor = campos.valor

  const ref = doc(db(), 'reembolsos', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Solicitação não encontrada.')
  const r = mapear(snap)

  if (r.solicitante_uid !== u.uid) throw new Error('Você só pode editar as suas próprias solicitações.')
  if (!editavelPeloSolicitante(r.status)) {
    throw new Error('Este pedido já foi aprovado e não pode mais ser ajustado.')
  }

  const agora = new Date().toISOString()
  // Volta ao início do fluxo, conforme os papéis de quem pede (igual à criação).
  const novoStatus = statusInicial(perfil.papeis)
  const trocouAnexo = !!anexo
  const alteracoes = resumirAlteracoes(r, { ...dados, valor }, trocouAnexo)

  const evento: EventoHistorico = {
    status_novo: novoStatus,
    por_uid: u.uid,
    por_nome: perfil.nome || u.email || '',
    papel: 'solicitante',
    em: agora,
    tipo: 'edicao',
    alteracoes,
  }

  // Substitui o comprovante (doc separado) ANTES de mudar o status: a Regra
  // do anexo autoriza a troca enquanto o pedido ainda está "recusado".
  if (anexo) {
    await setDoc(doc(db(), 'reembolso_anexos', id), {
      solicitante_uid: u.uid,
      tipo: anexo.tipo,
      nome: anexo.nome,
      dados: anexo.dados,
      tamanho: anexo.tamanho,
      criado_em: agora,
    }, { merge: true })
  }

  const patch: Record<string, unknown> = {
    status: novoStatus,
    data_despesa: dados.data_despesa,
    categoria: dados.categoria,
    descricao: String(dados.descricao).trim(),
    valor,
    // KM: guarda km + taxa; trocando para outra categoria, limpa os dois.
    km: campos.km != null ? campos.km : deleteField(),
    km_taxa: campos.km != null ? campos.km_taxa : deleteField(),
    historico: [...(r.historico ?? []), evento],
    atualizado_em: agora,
  }
  if (anexo) {
    patch.tem_anexo = true
    patch.anexo_tipo = anexo.tipo
    patch.anexo_nome = anexo.nome
  }
  await updateDoc(ref, patch)

  await registrarLog('reembolso_editado', `${id}: ${alteracoes}`)
  // Avisos: confirma para o solicitante e chama o responsável pela nova etapa.
  await avisarEdicao({
    solicitanteUid: r.solicitante_uid,
    reembolsoId: id,
    solicitante: perfil.nome || u.email || 'Você',
    resumo: `${dados.categoria} · ${formatBRL(valor)}`,
  })
  await avisarPendencia({
    reembolsoId: id,
    status: novoStatus,
    centro: r.centro_custo,
    solicitante: perfil.nome || u.email || 'Colaborador',
    resumo: `${dados.categoria} · ${formatBRL(valor)}`,
    reenvio: true,
  })
  return { status: novoStatus }
}

// -------------------------------------------------------------
// Excluir: o solicitante cancela o próprio pedido enquanto NÃO foi aprovado.
// Remove o comprovante ANTES do pedido (a Regra do anexo confere o status do
// pai). Avisa quem estava com a pendência, quando fazia sentido.
// -------------------------------------------------------------
export async function excluirReembolso(id: string, perfil: Perfil) {
  const u = auth().currentUser
  if (!u) throw new Error('Sua sessão expirou. Entre novamente.')

  const ref = doc(db(), 'reembolsos', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Solicitação não encontrada.')
  const r = mapear(snap)

  if (r.solicitante_uid !== u.uid) throw new Error('Você só pode excluir as suas próprias solicitações.')
  if (!editavelPeloSolicitante(r.status)) {
    throw new Error('Este pedido já foi aprovado e não pode mais ser excluído.')
  }

  // Anexo primeiro (enquanto o pedido ainda existe e está no status permitido).
  await deleteDoc(doc(db(), 'reembolso_anexos', id)).catch(() => {})
  await deleteDoc(ref)

  await registrarLog('reembolso_excluido', `${id} · ${r.categoria} · ${formatBRL(r.valor)}`)
  // Se estava aguardando alguém decidir, avisa que foi cancelado.
  if (estaPendente(r.status)) {
    await avisarCancelamento({
      reembolsoId: id,
      status: r.status,
      centro: r.centro_custo,
      solicitante: perfil.nome || u.email || 'Colaborador',
      resumo: `${r.categoria} · ${formatBRL(r.valor)}`,
    })
  }
  return { ok: true }
}

/**
 * Exclusão pelo MASTER a qualquer momento (correções / limpeza de testes).
 * Remove o comprovante e o pedido. Registra no log.
 */
export async function excluirReembolsoMaster(id: string, perfil: Perfil) {
  const u = auth().currentUser
  if (!u) throw new Error('Sua sessão expirou. Entre novamente.')
  if (!perfil.papeis.includes('master')) throw new Error('Só o Master pode excluir solicitações já em andamento.')

  const snap = await getDoc(doc(db(), 'reembolsos', id))
  const r = snap.exists() ? mapear(snap) : null

  await deleteDoc(doc(db(), 'reembolso_anexos', id)).catch(() => {})
  await deleteDoc(doc(db(), 'reembolsos', id))

  await registrarLog('reembolso_excluido_master', r ? `${r.solicitante_nome} · ${r.categoria} · ${formatBRL(r.valor)}` : id)
  return { ok: true }
}
