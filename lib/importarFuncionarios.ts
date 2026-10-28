'use client'

// =============================================================
// Importação de funcionários por planilha (.xlsx/.csv): leitura e
// validação PURAS (sem Firestore). Usa SheetJS. A gravação fica em
// lib/fb/funcionarios.ts (importarFuncionarios).
//
// Colunas aceitas (cabeçalho, sem acento/caixa): Nome, E-mail
// institucional, Centro de custo, Data de aniversário, Data de admissão,
// Matrícula e (opcional) Papéis. Datas em DD/MM/AAAA.
// =============================================================
import * as XLSX from 'xlsx'
import { CENTROS_CUSTO, TODOS_CENTROS } from './reembolso'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PAPEIS_VALIDOS = ['master', 'gestor', 'financeiro', 'gente_cultura', 'colaborador']

export interface LinhaImport {
  linha: number
  nome: string
  email: string
  centro_custo: string
  matricula: string
  aniversario: string | null // 'DD/MM' para exibição
  aniv_dia: number | null
  aniv_mes: number | null
  admissao: string | null // 'DD/MM/AAAA' para exibição
  adm_dia: number | null
  adm_mes: number | null
  adm_ano: number | null
  papeis: string[]
  erros: string[]
  avisos: string[]
  acao: 'criar' | 'atualizar' | 'ignorar'
}

function chave(s: string): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' e ').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()
}

const CENTROS_CHAVE = new Map(CENTROS_CUSTO.map((c) => [chave(c), c]))

/** Mapeia um cabeçalho da planilha para o nome canônico do campo. */
function campoDoCabecalho(h: string): string | null {
  const k = chave(h)
  if (k === 'nome') return 'nome'
  if (['email institucional', 'e mail institucional', 'email', 'e mail'].includes(k)) return 'email'
  if (['centro de custo', 'centro', 'area', 'setor'].includes(k)) return 'centro_custo'
  if (['data de aniversario', 'aniversario', 'nascimento', 'data de nascimento'].includes(k)) return 'aniversario'
  if (['data de admissao', 'admissao'].includes(k)) return 'admissao'
  if (['matricula', 'matricula do funcionario'].includes(k)) return 'matricula'
  if (['papeis', 'papel', 'funcao', 'perfil'].includes(k)) return 'papeis'
  return null
}

function parseData(v: unknown): { dia: number; mes: number; ano: number | null } | null | 'invalido' {
  if (v == null || v === '') return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return { dia: v.getDate(), mes: v.getMonth() + 1, ano: v.getFullYear() }
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/)
  if (!m) return 'invalido'
  const dia = Number(m[1]); const mes = Number(m[2])
  let ano: number | null = m[3] ? Number(m[3]) : null
  if (ano != null && ano < 100) ano += ano >= 70 ? 1900 : 2000
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return 'invalido'
  return { dia, mes, ano }
}

/** Analisa uma data digitada (DD/MM ou DD/MM/AAAA). Exposto para os formulários. */
export function analisarDataBR(s: string): { dia: number; mes: number; ano: number | null } | null | 'invalido' {
  return parseData(s)
}

function parsePapeis(v: unknown): string[] {
  return String(v ?? '')
    .split(/[;,/]/)
    .map((p) => chave(p))
    .map((p) => (p === 'gestor aprovador' ? 'gestor' : p))
    .filter((p) => PAPEIS_VALIDOS.includes(p))
}

/** Divide uma linha de CSV respeitando aspas. */
function dividirCSV(linha: string, sep: string): string[] {
  const out: string[] = []
  let atual = '', aspas = false
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++ }
      else aspas = !aspas
    } else if (c === sep && !aspas) { out.push(atual); atual = '' }
    else atual += c
  }
  out.push(atual)
  return out.map((s) => s.trim())
}

/** Lê a planilha como matriz de linhas. CSV: detecta o separador (; , ou tab). */
async function lerMatriz(file: File): Promise<unknown[][]> {
  const nome = (file.name || '').toLowerCase()
  const ehCSV = nome.endsWith('.csv') || nome.endsWith('.txt') || (file.type || '').includes('csv')
  if (ehCSV) {
    const texto = (await file.text()).replace(/^﻿/, '')
    const linhas = texto.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '')
    if (linhas.length === 0) return []
    const primeira = linhas[0]
    const conta = (ch: string) => primeira.split(ch).length - 1
    const cand: Array<[string, number]> = [[';', conta(';')], [',', conta(',')], ['\t', conta('\t')]]
    cand.sort((a, b) => b[1] - a[1])
    const sep = cand[0][1] > 0 ? cand[0][0] : ';'
    return linhas.map((l) => dividirCSV(l, sep))
  }
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false, defval: '' })
}

/**
 * Lê a planilha e valida cada linha. `emailsExistentes` (minúsculos) define
 * quem é atualização vs. criação. Não grava nada.
 */
export async function lerEValidar(file: File, emailsExistentes: Set<string>): Promise<LinhaImport[]> {
  const matriz = await lerMatriz(file)
  if (matriz.length < 2) return []

  const cabec = (matriz[0] as unknown[]).map((h) => campoDoCabecalho(String(h ?? '')))
  const vistos = new Set<string>()
  const linhas: LinhaImport[] = []

  for (let r = 1; r < matriz.length; r++) {
    const cols = matriz[r] as unknown[]
    if (!cols || cols.every((c) => String(c ?? '').trim() === '')) continue
    const get = (campo: string): unknown => {
      const idx = cabec.indexOf(campo)
      return idx >= 0 ? cols[idx] : ''
    }

    const nome = String(get('nome') ?? '').trim()
    const email = String(get('email') ?? '').trim().toLowerCase()
    const centroBruto = String(get('centro_custo') ?? '').trim()
    const matricula = String(get('matricula') ?? '').trim()
    const papeis = parsePapeis(get('papeis'))
    const erros: string[] = []
    const avisos: string[] = []

    if (nome.length < 2) erros.push('Nome vazio ou muito curto.')
    if (!EMAIL_RE.test(email)) erros.push('E-mail inválido.')
    else if (vistos.has(email)) erros.push('E-mail duplicado na planilha.')
    vistos.add(email)

    // Centro de custo: precisa bater com as áreas existentes (senão, avisa).
    let centro_custo = centroBruto
    if (centroBruto) {
      const canon = CENTROS_CHAVE.get(chave(centroBruto))
      if (canon) centro_custo = canon
      else if (chave(centroBruto) === chave(TODOS_CENTROS)) centro_custo = TODOS_CENTROS
      else avisos.push(`Centro de custo "${centroBruto}" não existe nas áreas cadastradas.`)
    }

    const aniv = parseData(get('aniversario'))
    let aniv_dia: number | null = null, aniv_mes: number | null = null, aniversario: string | null = null
    if (aniv === 'invalido') erros.push('Data de aniversário inválida (use DD/MM/AAAA).')
    else if (aniv) { aniv_dia = aniv.dia; aniv_mes = aniv.mes; aniversario = `${pad(aniv.dia)}/${pad(aniv.mes)}` }

    const adm = parseData(get('admissao'))
    let adm_dia: number | null = null, adm_mes: number | null = null, adm_ano: number | null = null, admissao: string | null = null
    if (adm === 'invalido') erros.push('Data de admissão inválida (use DD/MM/AAAA).')
    else if (adm) {
      adm_dia = adm.dia; adm_mes = adm.mes; adm_ano = adm.ano
      admissao = adm.ano ? `${pad(adm.dia)}/${pad(adm.mes)}/${adm.ano}` : `${pad(adm.dia)}/${pad(adm.mes)}`
      if (!adm.ano) avisos.push('Admissão sem ano: não dá para calcular o tempo de Soulan.')
    }

    linhas.push({
      linha: r + 1, nome, email, centro_custo, matricula,
      aniversario, aniv_dia, aniv_mes,
      admissao, adm_dia, adm_mes, adm_ano,
      papeis,
      erros, avisos,
      acao: erros.length ? 'ignorar' : (emailsExistentes.has(email) ? 'atualizar' : 'criar'),
    })
  }
  return linhas
}

function pad(n: number): string { return String(n).padStart(2, '0') }

/** Gera um modelo CSV (abre no Excel) com o cabeçalho e uma linha de exemplo. */
export function modeloCSV(): string {
  const cab = ['Nome', 'E-mail institucional', 'Centro de custo', 'Data de aniversário', 'Data de admissão', 'Matrícula', 'Papéis']
  const ex = ['João Pereira', 'joao@soulan.com.br', 'Marketing', '25/12/1990', '10/03/2022', '00123', 'gestor']
  return '﻿' + [cab.join(';'), ex.join(';')].join('\r\n')
}
