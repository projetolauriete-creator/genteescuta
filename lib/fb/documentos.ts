'use client'

// =============================================================
// Sala de documentos por área (dentro da Central de Conhecimento).
//
// Hierarquia: Área (centro de custo) > Módulo (tema) > Documento.
//   - Área: nome canônico do centro de custo (lista única de setores).
//   - Módulo: um tema dentro da área (ex.: Integração, Políticas). Tem
//     título e ordem; pode ser criado, editado, reordenado e removido.
//   - Documento: título, tipo (link/PDF/planilha/vídeo), link e uma
//     descrição em texto livre. Pertence a um módulo.
//
// O colaborador lê só os módulos e documentos da PRÓPRIA área; Admin/RH
// gerencia e vê todas. O recorte por área é imposto nas Regras do Firestore
// (não dá para acessar outra área por URL/API) e também na consulta aqui
// (where area == a área da pessoa). Tanto o módulo quanto o documento
// carregam o campo `area`, para que a regra por área valha nas duas coleções.
// =============================================================
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { registrarLog } from './usuarios'

export type TipoDoc = 'pdf' | 'link' | 'planilha' | 'video'

export const TIPOS_DOC: TipoDoc[] = ['pdf', 'link', 'planilha', 'video']

export const TIPO_DOC_LABEL: Record<TipoDoc, string> = {
  pdf: 'PDF',
  link: 'Link',
  planilha: 'Planilha',
  video: 'Vídeo',
}

// -------------------------------------------------------------
// Módulo (tema dentro da área)
// -------------------------------------------------------------
export interface AreaModulo {
  id: string
  area: string // nome canônico do centro de custo
  titulo: string
  ordem: number
  criado_em?: string
  atualizado_em?: string
}

// -------------------------------------------------------------
// Documento (dentro de um módulo)
// -------------------------------------------------------------
export interface AreaDocumento {
  id: string
  area: string // nome canônico do centro de custo (denormalizado, para a regra)
  modulo_id: string // módulo ao qual o documento pertence
  titulo: string
  tipo: TipoDoc
  url: string
  descricao: string // texto livre explicando o que é o material
  ordem: number
  criado_em?: string
  atualizado_em?: string
}

export function tipoValido(t: string): t is TipoDoc {
  return (TIPOS_DOC as string[]).includes(t)
}

/** Garante http/https. Lança erro se o link estiver vazio ou inválido. */
export function normalizarUrl(raw: string): string {
  let u = String(raw ?? '').trim()
  if (!u) throw new Error('Cole o link do material.')
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try {
    new URL(u)
  } catch {
    throw new Error('O link não parece válido. Confira e cole de novo.')
  }
  return u
}

// =============================================================
// Módulos
// =============================================================

function limparModulo(d: Partial<AreaModulo>) {
  const titulo = String(d.titulo ?? '').trim()
  if (!titulo) throw new Error('Dê um título ao módulo.')
  const area = String(d.area ?? '').trim()
  if (!area) throw new Error('Escolha a área do módulo.')
  return { area, titulo }
}

/** Colaborador: só os módulos da PRÓPRIA área. */
export async function listarModulosDaArea(area: string): Promise<AreaModulo[]> {
  const alvo = String(area ?? '').trim()
  if (!alvo) return []
  const snap = await getDocs(query(collection(db(), 'area_modulos'), where('area', '==', alvo)))
  return snap.docs
    .map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }) as AreaModulo)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

/** Admin/RH: todos os módulos (as Regras liberam a leitura total ao admin). */
export async function listarTodosModulos(): Promise<AreaModulo[]> {
  const snap = await getDocs(collection(db(), 'area_modulos'))
  return snap.docs
    .map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }) as AreaModulo)
    .sort((a, b) => (a.area || '').localeCompare(b.area || '') || (a.ordem ?? 0) - (b.ordem ?? 0))
}

export async function criarModulo(d: Partial<AreaModulo>): Promise<string> {
  const dados = limparModulo(d)
  const ref = await addDoc(collection(db(), 'area_modulos'), {
    ...dados,
    ordem: Date.now(),
    criado_em: new Date().toISOString(),
  })
  await registrarLog('modulo_criar', `${dados.area}: ${dados.titulo}`)
  return ref.id
}

export async function atualizarModulo(id: string, d: Partial<AreaModulo>): Promise<void> {
  const dados = limparModulo(d)
  await updateDoc(doc(db(), 'area_modulos', id), { ...dados, atualizado_em: new Date().toISOString() })
  await registrarLog('modulo_editar', `${dados.area}: ${dados.titulo}`)
}

/** Remove o módulo e TODOS os documentos dentro dele. */
export async function excluirModulo(id: string): Promise<void> {
  const snap = await getDocs(query(collection(db(), 'area_documentos'), where('modulo_id', '==', id)))
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(db(), 'area_documentos', d.id))))
  await deleteDoc(doc(db(), 'area_modulos', id))
  await registrarLog('modulo_excluir', `${id} (+${snap.size} documentos)`)
}

/** Troca a ordem de dois módulos da MESMA área (botões subir/descer). */
export async function trocarOrdemModulos(a: AreaModulo, b: AreaModulo): Promise<void> {
  await Promise.all([
    updateDoc(doc(db(), 'area_modulos', a.id), { ordem: b.ordem ?? 0 }),
    updateDoc(doc(db(), 'area_modulos', b.id), { ordem: a.ordem ?? 0 }),
  ])
}

// =============================================================
// Documentos
// =============================================================

function limparDocumento(d: Partial<AreaDocumento>) {
  const titulo = String(d.titulo ?? '').trim()
  if (!titulo) throw new Error('Dê um título ao documento.')
  const area = String(d.area ?? '').trim()
  if (!area) throw new Error('Escolha a área do documento.')
  const modulo_id = String(d.modulo_id ?? '').trim()
  if (!modulo_id) throw new Error('Escolha o módulo do documento.')
  const tipo: TipoDoc = tipoValido(String(d.tipo)) ? (d.tipo as TipoDoc) : 'link'
  const descricao = String(d.descricao ?? '').trim().slice(0, 1000)
  return { area, modulo_id, titulo, tipo, descricao, url: normalizarUrl(d.url ?? '') }
}

/**
 * Colaborador: só os documentos da PRÓPRIA área. A consulta filtra por área e
 * as Regras só liberam a leitura quando a área do documento é o centro de custo
 * de quem consulta (leitura de outra área falha na própria regra).
 */
export async function listarDocumentosDaArea(area: string): Promise<AreaDocumento[]> {
  const alvo = String(area ?? '').trim()
  if (!alvo) return []
  const snap = await getDocs(query(collection(db(), 'area_documentos'), where('area', '==', alvo)))
  return snap.docs
    .map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }) as AreaDocumento)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
}

/** Admin/RH: todos os documentos (as Regras liberam a leitura total ao admin). */
export async function listarTodosDocumentos(): Promise<AreaDocumento[]> {
  const snap = await getDocs(collection(db(), 'area_documentos'))
  return snap.docs
    .map((d) => ({ ...(d.data() as Record<string, unknown>), id: d.id }) as AreaDocumento)
    .sort((a, b) => (a.area || '').localeCompare(b.area || '') || (a.ordem ?? 0) - (b.ordem ?? 0))
}

export async function criarDocumento(d: Partial<AreaDocumento>): Promise<string> {
  const dados = limparDocumento(d)
  const ref = await addDoc(collection(db(), 'area_documentos'), {
    ...dados,
    ordem: Date.now(),
    criado_em: new Date().toISOString(),
  })
  await registrarLog('documento_criar', `${dados.area}: ${dados.titulo}`)
  return ref.id
}

export async function atualizarDocumento(id: string, d: Partial<AreaDocumento>): Promise<void> {
  const dados = limparDocumento(d)
  await updateDoc(doc(db(), 'area_documentos', id), { ...dados, atualizado_em: new Date().toISOString() })
  await registrarLog('documento_editar', `${dados.area}: ${dados.titulo}`)
}

export async function excluirDocumento(id: string): Promise<void> {
  await deleteDoc(doc(db(), 'area_documentos', id))
  await registrarLog('documento_excluir', id)
}

/** Troca a ordem de dois documentos do MESMO módulo (botões subir/descer). */
export async function trocarOrdemDocumentos(a: AreaDocumento, b: AreaDocumento): Promise<void> {
  await Promise.all([
    updateDoc(doc(db(), 'area_documentos', a.id), { ordem: b.ordem ?? 0 }),
    updateDoc(doc(db(), 'area_documentos', b.id), { ordem: a.ordem ?? 0 }),
  ])
}
