'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { UploadCloud, ShieldCheck, Users, CalendarRange, Hash, Trash2, Printer, Download, ChevronRight, ChevronLeft, Search, FileSpreadsheet, Loader2 } from 'lucide-react'
import { CabecalhoPagina, Cartao, Vazio } from '@/components/ui'
import { exportarXlsx } from '@/lib/exportar'
import { CabecalhoImpressao } from '@/components/CabecalhoImpressao'
import {
  listarRegistrosHumor,
  listarRegistrosHumorCentro,
  salvarRegistrosHumor,
  limparRegistrosHumorMes,
  limparDuplicadosHumor,
  getClassificacaoHumor,
} from '@/lib/fb/humor'
import { minhaConta, type Conta } from '@/lib/fb/usuarios'
import {
  decodificar,
  parseHumorCsv,
  resumo,
  distribuicao,
  termometro,
  porSetor,
  mesesDisponiveis,
  rotuloMes,
  CLASSIFICACAO_PADRAO,
  COR_HUMOR,
  COR_CATEGORIA,
  HUMORES,
  contarDuplicadosHumor,
  type Categoria,
  type Humor,
  type RegistroHumor,
} from '@/lib/humor'

function fmtData(ts: number | null): string {
  if (ts === null) return '-'
  return new Date(ts).toLocaleDateString('pt-BR')
}

/** Data e hora da marcação (para a visão detalhada e a planilha). */
function fmtDataHora(ts: number | null): string {
  if (ts === null) return '-'
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Texto em minúsculas e sem acentos, para busca tolerante. */
function normalizar(s: string): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  positivo: 'Positivo',
  neutro: 'Neutro',
  negativo: 'Negativo',
}

/** Resumo do humor predominante de uma pessoa no período filtrado. */
interface PessoaResumo {
  chave: string
  nome: string
  setor: string
  total: number
  /** Quantas vezes marcou o humor predominante (= maior contagem). */
  vezes: number
  /** Humor(es) predominante(s): mais de um quando há empate. */
  predominantes: { humor: Humor; n: number }[]
  empate: boolean
  /** Todas as marcações da pessoa (mais recentes primeiro). */
  historico: { ts: number; humor: Humor }[]
}
export default function HumorEquipe() {
  const [registros, setRegistros] = useState<RegistroHumor[]>([])
  const [classif, setClassif] = useState<Record<Humor, Categoria>>({ ...CLASSIFICACAO_PADRAO })
  const [carregando, setCarregando] = useState(true)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [limpando, setLimpando] = useState(false)
  const [limpandoDup, setLimpandoDup] = useState(false)
  const [periodo, setPeriodo] = useState('geral')
  const [conta, setConta] = useState<Conta | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Master Administrador (Master/Super) edita e vê tudo. O Gestor Aprovador
  // só ACOMPANHA (ver + exportar) os dados do seu centro de custo.
  const ehAdminTotal = !!conta && conta.ativo && (conta.nivel === 'master' || conta.nivel === 'super' || ['adm_principal', 'adm_master'].includes(conta.perfil))
  const ehGestorSo = !!conta && conta.ativo && !ehAdminTotal && conta.perfil === 'gestor'
  const podeEditar = ehAdminTotal
  // Só o Master apaga em massa (as Regras também exigem). Super/adm_* contam como Master do painel.
  const ehMaster = !!conta && conta.ativo && (conta.nivel === 'master' || conta.nivel === 'super')
  // Duplicados no banco (mesma pessoa + data/hora), calculado sobre TODOS os registros carregados.
  const duplicados = useMemo(() => contarDuplicadosHumor(registros), [registros])

  useEffect(() => {
    async function carregar() {
      try {
        const c = await minhaConta().catch(() => null)
        setConta(c)
        const admin = !!c && c.ativo && (c.nivel === 'master' || c.nivel === 'super' || ['adm_principal', 'adm_master'].includes(c.perfil))
        const gestor = !!c && c.ativo && !admin && c.perfil === 'gestor'
        const [regs, cls] = await Promise.all([
          gestor ? listarRegistrosHumorCentro(c!.centro_custo ?? '') : listarRegistrosHumor(),
          getClassificacaoHumor(),
        ])
        setRegistros(regs)
        setClassif(cls)
      } catch {
        setErro('Não consegui carregar os dados de humor do banco.')
      } finally {
        setCarregando(false)
      }
    }
    carregar()
  }, [])

  async function importar(file: File) {
    setErro(null)
    setAviso(null)
    setImportando(true)
    try {
      const buf = await file.arrayBuffer()
      const texto = decodificar(buf)
      const { registros: lidos, lidas, ignoradas, setoresDesconhecidos } = parseHumorCsv(texto)
      if (lidos.length === 0) {
        throw new Error('Nenhum registro válido encontrado. Confira se o arquivo é o CSV de humor.')
      }
      const existentes = new Set(registros.map((r) => r.id))
      const novos = lidos.filter((r) => !existentes.has(r.id))
      const gravados = await salvarRegistrosHumor(novos)
      setRegistros((atual) => {
        const mapa = new Map(atual.map((r) => [r.id, r]))
        for (const r of novos) mapa.set(r.id, r)
        return Array.from(mapa.values())
      })
      const dupli = lidos.length - novos.length
      setAviso(
        `Importados ${gravados} novos registros de ${file.name}. ` +
          `${dupli > 0 ? `${dupli} já existiam (não duplicados). ` : ''}` +
          `${ignoradas > 0 ? `${ignoradas} linhas ignoradas. ` : ''}` +
          `(${lidas} linhas com data lidas no total.)` +
          (setoresDesconhecidos.length > 0
            ? ` ⚠️ Setores não reconhecidos (agrupados em "Outros"): ${setoresDesconhecidos.join(', ')}.`
            : ''),
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler este arquivo.')
    }
    setImportando(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  // Apaga o MÊS selecionado no filtro Período (não o mês atual do calendário).
  // Só faz sentido com um mês escolhido; em "Geral" o botão fica desabilitado.
  async function limparMesSelecionado() {
    if (periodoAtual === 'geral') return
    const mes = periodoAtual
    const rotulo = rotuloMes(mes)
    const noMes = registros.filter((r) => String(r.dia || '').startsWith(mes)).length

    if (noMes === 0) {
      setErro(null)
      setAviso(`Não há registros de humor de ${rotulo} para apagar. Os outros meses foram mantidos.`)
      return
    }
    const plural = noMes === 1 ? 'registro' : 'registros'
    if (!confirm(`Isso vai apagar os ${noMes} ${plural} de ${rotulo}. Os outros meses serão mantidos. Continuar?`)) return

    setErro(null)
    setAviso(null)
    setLimpando(true)
    try {
      const n = await limparRegistrosHumorMes(mes)
      setRegistros((prev) => prev.filter((r) => !String(r.dia || '').startsWith(mes)))
      setPeriodo('geral') // o mês apagado deixa de existir; volta para a visão geral
      setAviso(`Pronto: ${n} ${n === 1 ? 'registro apagado' : 'registros apagados'} de ${rotulo}. Os outros meses foram mantidos.`)
    } catch {
      setErro('Não consegui limpar os registros do mês.')
    }
    setLimpando(false)
  }

  async function limparDuplicados() {
    if (duplicados === 0) return
    if (!confirm(`Encontrei ${duplicados} marcação(ões) duplicada(s) (mesma pessoa e data/hora). Vou manter uma de cada e apagar as cópias, priorizando a que tem o setor preenchido. Deseja continuar?`)) return
    setErro(null)
    setAviso(null)
    setLimpandoDup(true)
    try {
      const { removidos } = await limparDuplicadosHumor()
      // Recarrega do banco para refletir o que ficou.
      const regs = await listarRegistrosHumor()
      setRegistros(regs)
      setAviso(removidos > 0
        ? `Pronto: ${removidos} cópia(s) duplicada(s) removida(s). Mantive uma marcação por pessoa e data/hora.`
        : 'Nada a remover: não há marcações duplicadas.')
    } catch {
      setErro('Não consegui limpar os duplicados.')
    }
    setLimpandoDup(false)
  }

  const meses = useMemo(() => mesesDisponiveis(registros), [registros])
  const periodoAtual = periodo === 'geral' || meses.includes(periodo) ? periodo : 'geral'
  const rotuloPeriodo = periodoAtual === 'geral' ? 'Geral' : rotuloMes(periodoAtual)

  const regsP = useMemo(
    () => (periodoAtual === 'geral' ? registros : registros.filter((x) => x.dia.startsWith(periodoAtual))),
    [registros, periodoAtual],
  )

  const r = useMemo(() => resumo(regsP), [regsP])
  const term = useMemo(() => termometro(regsP, classif), [regsP, classif])
  const dist = useMemo(() => distribuicao(regsP), [regsP])
  const setores = useMemo(() => porSetor(regsP, classif), [regsP, classif])

  const participacao = useMemo(() => [...setores].sort((a, b) => b.total - a.total), [setores])

  // Clima por setor com drill-down: contagem por humor dentro de cada setor
  // (agregado, nunca por pessoa). Positivo/Neutro/Negativo seguem a
  // classificação FIXA (CLASSIFICACAO_PADRAO).
  const setorHumores = useMemo(() => {
    const mapa = new Map<string, { setor: string; total: number; humores: Record<Humor, number> }>()
    for (const reg of regsP) {
      const setor = reg.setor || 'Outros'
      let e = mapa.get(setor)
      if (!e) {
        e = { setor, total: 0, humores: Object.fromEntries(HUMORES.map((h) => [h, 0])) as Record<Humor, number> }
        mapa.set(setor, e)
      }
      e.total++
      e.humores[reg.humor] = (e.humores[reg.humor] ?? 0) + 1
    }
    return Array.from(mapa.values())
      .map((e) => {
        let pos = 0, neu = 0, neg = 0
        for (const h of HUMORES) {
          const c = CLASSIFICACAO_PADRAO[h]
          const n = e.humores[h]
          if (c === 'positivo') pos += n
          else if (c === 'neutro') neu += n
          else neg += n
        }
        return { ...e, pos, neu, neg }
      })
      .sort((a, b) => b.total - a.total)
  }, [regsP])

  function baixar(conteudo: string, arquivo: string, tipo: string) {
    const blob = new Blob([conteudo], { type: tipo })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = arquivo
    a.click()
    URL.revokeObjectURL(url)
  }

  function baixarPdf() {
    window.print()
  }

  const [gerandoXlsx, setGerandoXlsx] = useState(false)
  // Escopo do recorte (gestor = só o seu centro de custo) para o cabeçalho.
  const escopoTexto = ehGestorSo && conta?.centro_custo && conta.centro_custo !== 'Todos os centros de custo'
    ? `Centro de custo: ${conta.centro_custo}` : 'Todos os centros de custo'
  // Marcações detalhadas do período, mais recentes primeiro (já recortadas por papel).
  const marcacoes = useMemo(() => [...regsP].sort((a, b) => b.ts - a.ts), [regsP])

  // Humor predominante por pessoa no período (nome, humor que mais marcou,
  // quantas vezes e total). Em caso de empate, lista os humores empatados
  // (ordenados do mais recente para o mais antigo) e marca "empate".
  const porPessoa = useMemo<PessoaResumo[]>(() => {
    const mapa = new Map<string, { nome: string; setor: string; setorTs: number; regs: RegistroHumor[] }>()
    for (const reg of regsP) {
      const chave = (reg.matricula && String(reg.matricula).trim()) || reg.funcionario || 'Não informado'
      let e = mapa.get(chave)
      if (!e) {
        e = { nome: reg.funcionario || 'Não informado', setor: reg.setor || 'Não informado', setorTs: reg.ts, regs: [] }
        mapa.set(chave, e)
      }
      e.regs.push(reg)
      // setor mais recente (uma pessoa pode mudar de área ao longo do período)
      if (reg.ts >= e.setorTs) { e.setor = reg.setor || 'Não informado'; e.setorTs = reg.ts }
    }
    return Array.from(mapa.entries())
      .map(([chave, e]) => {
        const cont = Object.fromEntries(HUMORES.map((h) => [h, 0])) as Record<Humor, number>
        for (const rg of e.regs) cont[rg.humor] = (cont[rg.humor] ?? 0) + 1
        const max = Math.max(0, ...HUMORES.map((h) => cont[h]))
        const ultimo = (h: Humor) => Math.max(...e.regs.filter((rg) => rg.humor === h).map((rg) => rg.ts))
        const predominantes = HUMORES.filter((h) => cont[h] === max && max > 0)
          .map((h) => ({ humor: h, n: cont[h] }))
          .sort((a, b) => ultimo(b.humor) - ultimo(a.humor))
        const historico = [...e.regs].sort((a, b) => b.ts - a.ts).map((rg) => ({ ts: rg.ts, humor: rg.humor }))
        return {
          chave,
          nome: e.nome,
          setor: e.setor,
          total: e.regs.length,
          vezes: max,
          predominantes,
          empate: predominantes.length > 1,
          historico,
        }
      })
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [regsP])

  // Planilha .xlsx com logo: as marcações detalhadas (quem marcou, qual humor e quando).
  async function baixarXlsx() {
    setGerandoXlsx(true)
    try {
      await exportarXlsx({
        nomeArquivo: `humor-marcacoes-${periodoAtual === 'geral' ? 'geral' : periodoAtual}`,
        titulo: `Humor da equipe (marcações): ${rotuloPeriodo}`,
        filtros: `${escopoTexto} · ${marcacoes.length} marcação(ões)`,
        colunas: ['Data e hora', 'Funcionário', 'Setor', 'Humor'],
        linhas: marcacoes.map((m) => [fmtDataHora(m.ts), m.funcionario || 'Não informado', m.setor, m.humor]),
        larguras: [20, 32, 28, 16],
        nomeAba: 'Marcações',
      })
    } finally {
      setGerandoXlsx(false)
    }
  }

  function baixarCsv() {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const linha = (arr: unknown[]) => arr.map(esc).join(';')
    const pctHumor = (n: number) => `${Math.round((n / (r.total || 1)) * 100)}%`
    const L: string[] = []
    L.push(esc(`Relatório de Humor: ${rotuloPeriodo}`))
    L.push('')
    L.push(esc('Resumo'))
    L.push(linha(['Registros', r.total]))
    L.push(linha(['Pessoas participantes', r.pessoas]))
    L.push(linha(['Período coberto', `${fmtData(r.inicio)} a ${fmtData(r.fim)}`]))
    L.push('')
    L.push(esc('Termômetro (categoria; quantidade; percentual)'))
    L.push(linha(['Positivos', term.pos, `${term.pctPos}%`]))
    L.push(linha(['Neutros', term.neu, `${term.pctNeu}%`]))
    L.push(linha(['Negativos', term.neg, `${term.pctNeg}%`]))
    L.push('')
    L.push(esc('Por humor (humor; quantidade; percentual)'))
    for (const d of dist) L.push(linha([d.humor, d.n, pctHumor(d.n)]))
    L.push('')
    L.push(esc('Por setor (setor; registros; participação; positivos; neutros; negativos; índice de clima)'))
    for (const s of participacao) L.push(linha([s.setor, s.total, `${s.pct}%`, s.pos, s.neu, s.neg, s.indice]))
    const csv = '﻿' + L.join('\r\n')
    baixar(csv, `humor-${periodoAtual === 'geral' ? 'geral' : periodoAtual}.csv`, 'text/csv;charset=utf-8')
  }

  const botaoImportar = (
    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3.5 py-2 text-sm font-medium text-tinta transition-colors hover:bg-superficie-2">
      <UploadCloud size={15} aria-hidden />
      {importando ? 'Importando…' : 'Importar humor (CSV)'}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importar(f)
        }}
      />
    </label>
  )

  return (
    <>
      <CabecalhoPagina
        titulo="Humor da equipe (clima)"
        descricao={ehGestorSo
          ? `Acompanhe (ver e exportar) o humor do seu centro de custo${conta?.centro_custo && conta.centro_custo !== 'Todos os centros de custo' ? `: ${conta.centro_custo}` : ''}. O humor não é anônimo: você vê quem marcou e qual humor.`
          : 'Importe o CSV de humor e veja os indicadores agregados e as marcações por pessoa. O humor não é anônimo.'}
        acoes={
          podeEditar && registros.length > 0 ? (
            <>
              {botaoImportar}
              <button
                type="button"
                onClick={limparMesSelecionado}
                disabled={limpando || periodoAtual === 'geral'}
                title={periodoAtual === 'geral'
                  ? 'Escolha um mês no filtro Período para poder limpar.'
                  : `Apaga só os registros de ${rotuloMes(periodoAtual)}; os outros meses são mantidos.`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3.5 py-2 text-sm font-medium text-tinta transition-colors hover:border-[#e2b4b4] hover:bg-plano hover:text-critico disabled:opacity-60 disabled:hover:border-borda-forte disabled:hover:bg-white disabled:hover:text-tinta"
              >
                <Trash2 size={15} aria-hidden /> {limpando
                  ? 'Limpando…'
                  : periodoAtual === 'geral' ? 'Limpar mês selecionado' : `Limpar ${rotuloMes(periodoAtual)}`}
              </button>
            </>
          ) : undefined
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {aviso && (
          <p className="rounded-lg border border-[#bfe3bf] bg-[#eff8ef] px-4 py-3 text-sm text-[#0b5d0b]">
            {aviso}
          </p>
        )}
        {erro && (
          <p className="rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-4 py-3 text-sm text-[#8a1f1f]">
            {erro}
          </p>
        )}

        {ehMaster && duplicados > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e7cf98] bg-[#fdf6e6] px-4 py-3">
            <p className="text-sm text-[#7a5c12]">
              <strong className="font-semibold">{duplicados} marcação(ões) duplicada(s)</strong> no banco (mesma pessoa e data/hora, provavelmente de importações com o nome em caixa diferente).
            </p>
            <button
              type="button"
              onClick={limparDuplicados}
              disabled={limpandoDup}
              title="Mantém uma marcação por pessoa e data/hora, priorizando a que tem o setor preenchido."
              className="inline-flex flex-none items-center gap-1.5 rounded-lg border border-[#e7cf98] bg-white px-3.5 py-2 text-sm font-semibold text-[#7a5c12] transition-colors hover:bg-[#fbeecb] disabled:opacity-60"
            >
              {limpandoDup ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}
              {limpandoDup ? 'Limpando…' : 'Limpar duplicados'}
            </button>
          </div>
        )}

        {carregando ? (
          <p className="p-2 text-sm text-tinta-3">Carregando…</p>
        ) : registros.length === 0 ? (
          !podeEditar ? (
            <Vazio titulo="Sem dados de humor" descricao="Ainda não há registros de humor do seu centro de custo para acompanhar." />
          ) : (
          <>
            <label
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-borda-forte bg-white px-6 py-16 text-center transition-colors hover:bg-superficie-2"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-clara text-marca">
                <UploadCloud size={26} aria-hidden />
              </span>
              <span className="mt-4 text-[0.9375rem] font-semibold text-tinta">
                {importando ? 'Importando…' : 'Importar humor (CSV)'}
              </span>
              <span className="mt-1 text-xs text-tinta-3">
                Arquivo separado por ponto-e-vírgula, no formato padrão de humor.
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importar(f)
                }}
              />
            </label>
            <NotaTransparencia />
          </>
          )
        ) : (
          <>
            {/* Barra de período + downloads (não sai no PDF) */}
            <div className="sem-impressao flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="font-medium text-tinta-2">Período:</span>
                <select
                  value={periodoAtual}
                  onChange={(e) => setPeriodo(e.target.value)}
                  className="rounded-lg border border-borda-forte bg-white px-3 py-1.5 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
                >
                  <option value="geral">Geral (todos os meses)</option>
                  {meses.map((m) => (
                    <option key={m} value={m}>
                      {rotuloMes(m)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={baixarPdf}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3.5 py-2 text-sm font-medium text-tinta hover:bg-superficie-2"
                >
                  <Printer size={15} aria-hidden /> Baixar PDF
                </button>
                <button
                  type="button"
                  onClick={baixarXlsx}
                  disabled={gerandoXlsx}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3.5 py-2 text-sm font-medium text-tinta hover:bg-superficie-2 disabled:opacity-60"
                >
                  {gerandoXlsx ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <FileSpreadsheet size={15} aria-hidden />} Planilha
                </button>
                <button
                  type="button"
                  onClick={baixarCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3.5 py-2 text-sm font-medium text-tinta hover:bg-superficie-2"
                >
                  <Download size={15} aria-hidden /> CSV
                </button>
              </div>
            </div>

            {/* Cabeçalho do relatório (com logo; aparece no PDF/impressão) */}
            <CabecalhoImpressao
              titulo={`Relatório de Humor da equipe: ${rotuloPeriodo}`}
              filtros={`${r.total} registros · ${r.pessoas} pessoas · ${fmtData(r.inicio)} a ${fmtData(r.fim)}`}
            />

            {/* 1) Resumo geral */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat icone={<Hash size={16} aria-hidden />} rotulo="Registros" valor={String(r.total)} />
              <Stat icone={<Users size={16} aria-hidden />} rotulo="Pessoas participantes" valor={String(r.pessoas)} />
              <Stat
                icone={<CalendarRange size={16} aria-hidden />}
                rotulo="Período coberto"
                valor={`${fmtData(r.inicio)} a ${fmtData(r.fim)}`}
                pequeno
              />
            </div>

            {/* 5) Termômetro geral + classificação (somente leitura) */}
            <Cartao titulo="Termômetro geral do clima">
              <Termometro term={term} />

              <div className="mt-5 border-t border-borda pt-4">
                <p className="text-xs font-semibold text-tinta-2">Classificação dos humores</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {HUMORES.map((h) => (
                    <div key={h} className="flex items-center justify-between gap-2 rounded-lg border border-borda bg-white px-3 py-2">
                      <span className="flex items-center gap-2 text-sm text-tinta">
                        <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COR_HUMOR[h] }} aria-hidden />
                        {h}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-semibold"
                        style={{ background: `${COR_CATEGORIA[classif[h]]}1a`, color: COR_CATEGORIA[classif[h]] }}
                      >
                        {CATEGORIA_LABEL[classif[h]]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Cartao>

            {/* 2) Distribuição dos humores */}
            <Cartao titulo="Distribuição dos humores" apoio="Quantos registros de cada humor no período.">
              <BarrasHumor dados={dist} total={r.total} />
            </Cartao>

            {/* 3) Participação por setor (rosca ou barras) */}
            <Cartao titulo="Participação por setor" apoio="Percentual de registros de humor por setor (quais setores mais participam).">
              <ParticipacaoSetor dados={participacao} />
            </Cartao>

            {/* 4) Clima por setor: barras empilhadas (%) com drill-down por humor */}
            <Cartao titulo="Clima por setor" apoio="Positivo / Neutro / Negativo por setor, em % dos registros. Clique num setor para ver os 8 humores.">
              <ClimaSetorBarras dados={setorHumores} />
            </Cartao>

            {/* 5) Marcações detalhadas (quem marcou, qual humor e quando) */}
            <Cartao
              titulo="Marcações (quem marcou)"
              apoio={`Data, funcionário, setor e humor${ehGestorSo && conta?.centro_custo && conta.centro_custo !== 'Todos os centros de custo' ? ` do centro ${conta.centro_custo}` : ''}. Os nomes aparecem aqui e na planilha; o humor não é anônimo.`}
              padding={false}
            >
              <TabelaMarcacoes marcacoes={marcacoes} />
            </Cartao>

            {/* 6) Humor predominante por pessoa (com histórico ao clicar) */}
            <Cartao
              titulo="Humor predominante por pessoa"
              apoio={`Para cada funcionário${ehGestorSo && conta?.centro_custo && conta.centro_custo !== 'Todos os centros de custo' ? ` do centro ${conta.centro_custo}` : ''}, o humor que mais marcou no período. Clique na linha para ver o histórico completo.`}
              padding={false}
            >
              <TabelaPredominante pessoas={porPessoa} />
            </Cartao>

            {/* Explicação do cálculo dos gráficos */}
            <div className="rounded-xl border border-borda bg-superficie-2 px-4 py-3.5 text-xs leading-5 text-tinta-2">
              <p className="font-semibold text-tinta">Como os gráficos são calculados</p>
              <ul className="mt-1.5 space-y-1">
                <li>
                  <strong className="font-semibold text-tinta">Participação (%)</strong>: fatia de cada setor sobre o total de
                  registros do período: (registros do setor ÷ total de registros) × 100. <em>n</em> = quantidade de registros do setor.
                </li>
                <li>
                  <strong className="font-semibold text-tinta">Clima por setor</strong>: cada barra soma 100% dos registros do
                  setor em três faixas: Positivo (Feliz, Animado, Satisfeito), Neutro (Tranquilo) e Negativo (Entediado, Aflito,
                  Triste, Irritado). Clique no setor para abrir os 8 humores individuais.
                </li>
                <li>Os gráficos acima são <strong className="font-semibold text-tinta">agregados por setor</strong>. A tabela <strong className="font-semibold text-tinta">Marcações</strong> mostra cada registro por pessoa.</li>
              </ul>
            </div>

            <NotaTransparencia />
          </>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------
function NotaTransparencia() {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-[#e2b4b4] bg-[#fdeaea] px-4 py-3">
      <ShieldCheck size={16} className="mt-0.5 flex-none text-critico" aria-hidden />
      <p className="text-xs leading-5 text-[#7a2f2f]">
        <strong className="font-semibold">O humor não é anônimo.</strong> A equipe de Gente &amp; Cultura (RH)
        e o Gestor Aprovador da área conseguem ver quem marcou, qual humor e quando (nesta tela e na planilha
        exportada). O gestor enxerga só o próprio centro de custo; o RH vê todos. A matrícula fica guardada,
        mas não é exibida.
      </p>
    </div>
  )
}

const POR_PAGINA = 10

// Tabela detalhada das marcações (data, funcionário, setor, humor),
// com busca por nome e paginação (10 por página). A busca e as páginas
// trabalham sobre o que já chega recortado por mês e centro de custo.
function TabelaMarcacoes({ marcacoes }: { marcacoes: RegistroHumor[] }) {
  const [busca, setBusca] = useState('')
  const [fHumor, setFHumor] = useState('')
  const [fSetor, setFSetor] = useState('')
  const [fDe, setFDe] = useState('')
  const [fAte, setFAte] = useState('')
  const [pagina, setPagina] = useState(1)

  // Setores presentes nos dados (já canônicos pela importação; o gestor só vê o
  // seu). Usados como opções do filtro de setor, sem dividir a área por escrita.
  const setoresOpc = useMemo(
    () => Array.from(new Set(marcacoes.map((m) => m.setor).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [marcacoes],
  )

  const filtradas = useMemo(() => {
    const termo = normalizar(busca)
    return marcacoes.filter((m) => {
      if (termo && !normalizar(m.funcionario || 'Não informado').includes(termo)) return false
      if (fHumor && m.humor !== fHumor) return false
      if (fSetor && m.setor !== fSetor) return false
      if (fDe && (m.dia || '') < fDe) return false
      if (fAte && (m.dia || '') > fAte) return false
      return true
    })
  }, [marcacoes, busca, fHumor, fSetor, fDe, fAte])

  const temFiltro = !!(busca || fHumor || fSetor || fDe || fAte)
  function limparFiltros() { setBusca(''); setFHumor(''); setFSetor(''); setFDe(''); setFAte('') }

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  // Se o filtro encolher a lista, não deixa a página passar do fim.
  const paginaAtual = Math.min(pagina, totalPaginas)
  useEffect(() => { if (pagina > totalPaginas) setPagina(totalPaginas) }, [pagina, totalPaginas])
  // Volta para a primeira página sempre que qualquer filtro muda.
  useEffect(() => { setPagina(1) }, [busca, fHumor, fSetor, fDe, fAte])

  const inicio = (paginaAtual - 1) * POR_PAGINA
  const visiveis = filtradas.slice(inicio, inicio + POR_PAGINA)
  const de = filtradas.length === 0 ? 0 : inicio + 1
  const ate = inicio + visiveis.length

  if (marcacoes.length === 0) return <p className="px-4 py-6 text-sm text-tinta-3">Sem marcações no período.</p>

  return (
    <div>
      {/* Filtros: busca por nome + Humor + Setor + Data (combinados) */}
      <div className="space-y-2.5 border-b border-borda px-4 py-3">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-3" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome do funcionário"
              aria-label="Buscar por nome do funcionário"
              className="w-full rounded-lg border border-borda-forte bg-white py-2 pl-9 pr-3 text-sm text-tinta placeholder:text-tinta-3 focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
            />
          </div>
          <select
            value={fHumor}
            onChange={(e) => setFHumor(e.target.value)}
            aria-label="Filtrar por humor"
            className="w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
          >
            <option value="">Todos os humores</option>
            {HUMORES.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          {setoresOpc.length > 1 && (
            <select
              value={fSetor}
              onChange={(e) => setFSetor(e.target.value)}
              aria-label="Filtrar por setor"
              className="w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
            >
              <option value="">Todos os setores</option>
              {setoresOpc.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <div className="flex items-center gap-1.5">
            <label className="sr-only" htmlFor="humor-de">Data inicial</label>
            <input
              id="humor-de"
              type="date"
              value={fDe}
              max={fAte || undefined}
              onChange={(e) => setFDe(e.target.value)}
              className="w-full rounded-lg border border-borda-forte bg-white px-2.5 py-2 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
            />
            <span className="flex-none text-xs text-tinta-3">até</span>
            <label className="sr-only" htmlFor="humor-ate">Data final</label>
            <input
              id="humor-ate"
              type="date"
              value={fAte}
              min={fDe || undefined}
              onChange={(e) => setFAte(e.target.value)}
              className="w-full rounded-lg border border-borda-forte bg-white px-2.5 py-2 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tinta-3">
          <span className="tabular">{filtradas.length} marcação(ões){temFiltro ? ` de ${marcacoes.length}` : ''}</span>
          {temFiltro && (
            <button type="button" onClick={limparFiltros} className="font-medium text-tinta-2 transition-colors hover:text-marca">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-borda text-left text-xs font-semibold text-tinta-3">
              <th className="px-4 py-2.5 font-semibold">Data e hora</th>
              <th className="px-4 py-2.5 font-semibold">Funcionário</th>
              <th className="px-4 py-2.5 font-semibold">Setor</th>
              <th className="px-4 py-2.5 font-semibold">Humor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borda">
            {visiveis.map((m) => (
              <tr key={m.id} className="hover:bg-superficie-2">
                <td className="whitespace-nowrap px-4 py-2.5 text-tinta-2 tabular">{fmtDataHora(m.ts)}</td>
                <td className="px-4 py-2.5 font-medium text-tinta">{m.funcionario || 'Não informado'}</td>
                <td className="px-4 py-2.5 text-tinta-2">{m.setor}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-1.5 font-medium text-tinta">
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COR_HUMOR[m.humor] }} aria-hidden /> {m.humor}
                  </span>
                </td>
              </tr>
            ))}
            {visiveis.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-tinta-3">
                  Nenhuma marcação encontrada para os filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé: indicador + paginação */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borda px-4 py-3">
        <p className="text-xs text-tinta-3 tabular">
          Mostrando {de} a {ate} de {filtradas.length} marcação(ões)
        </p>
        {totalPaginas > 1 && (
          <Paginacao pagina={paginaAtual} totalPaginas={totalPaginas} aoMudar={setPagina} />
        )}
      </div>
    </div>
  )
}

// Controles de página: Anterior / números / Próxima (com reticências quando há muitas).
function Paginacao({ pagina, totalPaginas, aoMudar }: { pagina: number; totalPaginas: number; aoMudar: (p: number) => void }) {
  const paginas = paginasVisiveis(pagina, totalPaginas)
  const btn = 'inline-flex min-w-8 items-center justify-center rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  return (
    <nav className="flex items-center gap-1" aria-label="Paginação das marcações">
      <button
        type="button"
        onClick={() => aoMudar(pagina - 1)}
        disabled={pagina <= 1}
        className={`${btn} border-borda-forte bg-white text-tinta hover:bg-superficie-2`}
      >
        <ChevronLeft size={15} aria-hidden /> <span className="sr-only sm:not-sr-only">Anterior</span>
      </button>
      {paginas.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1.5 text-sm text-tinta-3" aria-hidden>…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => aoMudar(p)}
            aria-current={p === pagina ? 'page' : undefined}
            className={`${btn} ${p === pagina ? 'border-marca bg-marca text-white' : 'border-borda-forte bg-white text-tinta hover:bg-superficie-2'}`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => aoMudar(pagina + 1)}
        disabled={pagina >= totalPaginas}
        className={`${btn} border-borda-forte bg-white text-tinta hover:bg-superficie-2`}
      >
        <span className="sr-only sm:not-sr-only">Próxima</span> <ChevronRight size={15} aria-hidden />
      </button>
    </nav>
  )
}

// Janela de páginas: sempre 1 e a última, com reticências em volta da atual.
function paginasVisiveis(atual: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const ini = Math.max(2, atual - 1)
  const fim = Math.min(total - 1, atual + 1)
  if (ini > 2) out.push('…')
  for (let p = ini; p <= fim; p++) out.push(p)
  if (fim < total - 1) out.push('…')
  out.push(total)
  return out
}

// Chip de humor (bolinha na cor + nome), opcionalmente com a contagem.
function ChipHumor({ humor, n }: { humor: Humor; n?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-tinta">
      <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COR_HUMOR[humor] }} aria-hidden />
      {humor}{typeof n === 'number' ? <span className="text-tinta-3">({n})</span> : null}
    </span>
  )
}

// Lista por pessoa: humor predominante no período + histórico ao clicar.
function TabelaPredominante({ pessoas }: { pessoas: PessoaResumo[] }) {
  const [aberta, setAberta] = useState<string | null>(null)
  if (pessoas.length === 0) return <p className="px-4 py-6 text-sm text-tinta-3">Sem marcações no período.</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <thead>
          <tr className="border-b border-borda text-left text-xs font-semibold text-tinta-3">
            <th className="px-4 py-2.5 font-semibold">Funcionário</th>
            <th className="px-4 py-2.5 font-semibold">Humor predominante</th>
            <th className="px-4 py-2.5 text-right font-semibold">Vezes</th>
            <th className="px-4 py-2.5 text-right font-semibold">Total no período</th>
            <th className="px-4 py-2.5" aria-label="Expandir" />
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {pessoas.map((p) => {
            const expandida = aberta === p.chave
            return (
              <Fragment key={p.chave}>
                <tr
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandida}
                  onClick={() => setAberta(expandida ? null : p.chave)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAberta(expandida ? null : p.chave) }
                  }}
                  className="cursor-pointer hover:bg-superficie-2"
                >
                  <td className="px-4 py-2.5 align-top">
                    <span className="font-medium text-tinta">{p.nome}</span>
                    <span className="block text-xs text-tinta-3">{p.setor}</span>
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      {p.predominantes.map((d) => <ChipHumor key={d.humor} humor={d.humor} n={p.empate ? d.n : undefined} />)}
                      {p.empate && (
                        <span className="rounded-md bg-[#f3ead6] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-[#8a6d1f]">empate</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right align-top text-tinta-2 tabular">{p.vezes}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right align-top text-tinta-2 tabular">{p.total}</td>
                  <td className="px-4 py-2.5 align-top text-tinta-3">
                    <ChevronRight size={15} aria-hidden className={`transition-transform ${expandida ? 'rotate-90' : ''}`} />
                  </td>
                </tr>
                {expandida && (
                  <tr className="bg-superficie-2">
                    <td colSpan={5} className="px-4 py-3">
                      <p className="mb-2 text-xs font-semibold text-tinta-2">
                        Histórico de {p.nome} · {p.total} marcação(ões)
                      </p>
                      <ul className="space-y-1">
                        {p.historico.map((h, i) => (
                          <li key={`${h.ts}-${i}`} className="flex items-center justify-between gap-3 border-b border-borda/60 py-1 last:border-0">
                            <span className="text-tinta-2 tabular">{fmtDataHora(h.ts)}</span>
                            <ChipHumor humor={h.humor} />
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Stat({
  icone,
  rotulo,
  valor,
  pequeno,
}: {
  icone: React.ReactNode
  rotulo: string
  valor: string
  pequeno?: boolean
}) {
  return (
    <div className="cartao px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-tinta-3">
        <span className="text-marca">{icone}</span>
        {rotulo}
      </p>
      <p className={`mt-1.5 font-[650] tracking-[-0.02em] text-tinta ${pequeno ? 'text-lg' : 'text-[2rem] leading-[1.05]'}`}>
        {valor}
      </p>
    </div>
  )
}

function Termometro({
  term,
}: {
  term: ReturnType<typeof termometro>
}) {
  const rotulo =
    term.indice >= 25 ? 'Clima positivo' : term.indice <= -25 ? 'Clima de atenção' : 'Clima neutro'
  const emoji = term.indice >= 25 ? '😄' : term.indice <= -25 ? '😟' : '🙂'
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <span className="text-3xl leading-none" aria-hidden>{emoji}</span>
        <span className="text-lg font-semibold text-tinta">{rotulo}</span>
      </div>

      <div className="mt-4 flex h-4 w-full overflow-hidden rounded-full bg-plano">
        {term.pctPos > 0 && <span style={{ width: `${term.pctPos}%`, background: COR_CATEGORIA.positivo }} />}
        {term.pctNeu > 0 && <span style={{ width: `${term.pctNeu}%`, background: COR_CATEGORIA.neutro }} />}
        {term.pctNeg > 0 && <span style={{ width: `${term.pctNeg}%`, background: COR_CATEGORIA.negativo }} />}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        <Legenda cor={COR_CATEGORIA.positivo} rotulo="Positivos" n={term.pos} pct={term.pctPos} />
        <Legenda cor={COR_CATEGORIA.neutro} rotulo="Neutros" n={term.neu} pct={term.pctNeu} />
        <Legenda cor={COR_CATEGORIA.negativo} rotulo="Negativos" n={term.neg} pct={term.pctNeg} />
      </div>
    </div>
  )
}

function Legenda({ cor, rotulo, n, pct }: { cor: string; rotulo: string; n: number; pct: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-tinta-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} aria-hidden />
      {rotulo}: <strong className="font-semibold text-tinta tabular">{n}</strong>
      <span className="text-tinta-3">({pct}%)</span>
    </span>
  )
}

function BarrasHumor({ dados, total }: { dados: { humor: Humor; n: number }[]; total: number }) {
  const maximo = Math.max(...dados.map((d) => d.n), 1)
  return (
    <ul className="space-y-1.5">
      {dados.map((d) => (
        <li key={d.humor} className="grid grid-cols-[minmax(6rem,8rem)_1fr_5rem] items-center gap-3">
          <span className="flex items-center gap-2 truncate text-xs text-tinta-2">
            <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COR_HUMOR[d.humor] }} aria-hidden />
            {d.humor}
          </span>
          <span className="relative block h-3.5 rounded-sm bg-plano">
            <span
              className="absolute inset-y-0 left-0 rounded-r-[4px]"
              style={{ width: `${Math.max((d.n / maximo) * 100, 2)}%`, background: COR_HUMOR[d.humor] }}
            />
          </span>
          <span className="text-right text-xs text-tinta-2 tabular">
            <strong className="font-semibold text-tinta">{d.n}</strong>
            <span className="ml-1 text-tinta-3">{total > 0 ? `${Math.round((d.n / total) * 100)}%` : ''}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------
// Gráfico de pizza (rosca) + legenda com percentual (e índice, quando houver).
// ---------------------------------------------------------------
const PALETA_PIZZA = [
  '#1a4895', '#5e7e1c', '#8a6d00', '#9c4221', '#2f9e8a', '#4a6fa5',
  '#7b5ea7', '#b5651d', '#3f7db0', '#6b8e23', '#c2756b', '#508484',
]

// ---------------------------------------------------------------
// Clima por setor: barra empilhada (%) com drill-down nos 8 humores.
// Dados agregados por setor (nunca por pessoa).
// ---------------------------------------------------------------
type SetorHumor = { setor: string; total: number; pos: number; neu: number; neg: number; humores: Record<Humor, number> }

function ClimaSetorBarras({ dados }: { dados: SetorHumor[] }) {
  const [sel, setSel] = useState<string | null>(null)
  if (dados.length === 0) return <p className="text-sm text-tinta-3">Sem dados.</p>
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0)
  const pessoas = (n: number) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`
  const grid = 'grid grid-cols-[minmax(6rem,10rem)_1fr_3rem] items-center gap-3'

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-tinta-3">Clique num setor para ver o detalhe dos 8 humores.</p>

      <div className={`${grid} text-[10px] text-tinta-3`}>
        <span />
        <span className="flex justify-between"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></span>
        <span />
      </div>

      <ul className="space-y-1">
        {dados.map((d) => {
          const p = pct(d.pos, d.total), n = pct(d.neu, d.total), g = pct(d.neg, d.total)
          const ativo = sel === d.setor
          return (
            <li key={d.setor}>
              <button
                type="button"
                onClick={() => setSel(ativo ? null : d.setor)}
                aria-expanded={ativo}
                className={`${grid} w-full rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-superficie-2 ${ativo ? 'bg-superficie-2' : ''}`}
              >
                <span className="flex items-center gap-1 truncate text-xs text-tinta-2" title={d.setor}>
                  <ChevronRight size={13} className={`flex-none transition-transform ${ativo ? 'rotate-90' : ''}`} aria-hidden /> {d.setor}
                </span>
                <span className="flex h-4 w-full overflow-hidden rounded bg-plano">
                  {d.pos > 0 && <span style={{ width: `${p}%`, background: COR_CATEGORIA.positivo }} title={`Positivo: ${pessoas(d.pos)} (${p}%)`} />}
                  {d.neu > 0 && <span style={{ width: `${n}%`, background: COR_CATEGORIA.neutro }} title={`Neutro: ${pessoas(d.neu)} (${n}%)`} />}
                  {d.neg > 0 && <span style={{ width: `${g}%`, background: COR_CATEGORIA.negativo }} title={`Negativo: ${pessoas(d.neg)} (${g}%)`} />}
                </span>
                <span className="text-right text-xs text-tinta-3 tabular">n={d.total}</span>
              </button>
              {ativo && <DetalheSetor d={d} />}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-tinta-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_CATEGORIA.positivo }} aria-hidden /> Positivo</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_CATEGORIA.neutro }} aria-hidden /> Neutro</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_CATEGORIA.negativo }} aria-hidden /> Negativo</span>
      </div>
    </div>
  )
}

function DetalheSetor({ d }: { d: SetorHumor }) {
  const pct = (x: number) => (d.total > 0 ? Math.round((x / d.total) * 100) : 0)
  return (
    <div className="ml-4 mt-1.5 rounded-lg border border-borda bg-superficie-2 p-3">
      <p className="mb-2 text-xs font-semibold text-tinta-2">Detalhe de {d.setor}: {d.total} {d.total === 1 ? 'registro' : 'registros'}</p>
      <ul className="space-y-1">
        {HUMORES.map((h) => {
          const x = d.humores[h] ?? 0
          const w = pct(x)
          return (
            <li key={h} className="grid grid-cols-[minmax(5.5rem,7rem)_1fr_4rem] items-center gap-3" title={`${h}: ${x} ${x === 1 ? 'pessoa' : 'pessoas'} (${w}%)`}>
              <span className="flex items-center gap-2 truncate text-xs text-tinta-2">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: COR_HUMOR[h] }} aria-hidden /> {h}
              </span>
              <span className="relative block h-3 rounded-sm bg-plano">
                <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${x > 0 ? Math.max(w, 2) : 0}%`, background: COR_HUMOR[h] }} />
              </span>
              <span className="text-right text-xs text-tinta-3 tabular"><strong className="font-semibold text-tinta">{x}</strong> {w}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Caminho SVG de uma fatia de rosca (raio externo r, interno ri). */
function arcoRosca(cx: number, cy: number, r: number, ri: number, a0: number, a1: number): string {
  const ponto = (raio: number, a: number) => [cx + raio * Math.cos(a), cy + raio * Math.sin(a)]
  const grande = a1 - a0 > Math.PI ? 1 : 0
  const [x0, y0] = ponto(r, a0)
  const [x1, y1] = ponto(r, a1)
  const [xi1, yi1] = ponto(ri, a1)
  const [xi0, yi0] = ponto(ri, a0)
  return `M${x0},${y0} A${r},${r} 0 ${grande} 1 ${x1},${y1} L${xi1},${yi1} A${ri},${ri} 0 ${grande} 0 ${xi0},${yi0} Z`
}

// Paleta de ALTO CONTRASTE por setor (chave normalizada: sem acento, caixa, "&"→"e").
function chaveSetor(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' e ').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase()
}
const COR_SETOR = new Map(
  Object.entries({
    'Administrativo/Financeiro': '#2563EB',
    'Atração & Seleção': '#16A34A',
    'Gente & Cultura/Cadastro e Suprimentos': '#F59E0B',
    'Thomas': '#DC2626',
    'Suporte e Dados': '#06B6D4',
    'Marketing': '#9333EA',
  }).map(([k, v]) => [chaveSetor(k), v]),
)
function corDoSetor(setor: string, idx: number): string {
  return COR_SETOR.get(chaveSetor(setor)) ?? PALETA_PIZZA[idx % PALETA_PIZZA.length]
}

// ---------------------------------------------------------------
// Participação por setor: rosca OU barras (toggle). Cores de alto contraste.
// Tooltips com registros e %. Dados reais por setor.
// ---------------------------------------------------------------
function ParticipacaoSetor({ dados }: { dados: { setor: string; total: number; pct: number }[] }) {
  const [modo, setModo] = useState<'rosca' | 'barras'>('rosca')
  if (dados.length === 0) return <p className="text-sm text-tinta-3">Sem dados.</p>

  const totalReg = dados.reduce((s, d) => s + d.total, 0)
  const comCor = dados.map((d, i) => ({ ...d, cor: corDoSetor(d.setor, i) }))
  const titulo = (d: { setor: string; total: number; pct: number }) => `${d.setor}: ${d.total} ${d.total === 1 ? 'registro' : 'registros'} (${d.pct}%)`

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-borda-forte bg-white p-0.5 text-xs font-semibold">
        {(['rosca', 'barras'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setModo(m)}
            aria-pressed={modo === m}
            className={`rounded-md px-3 py-1.5 transition-colors ${modo === m ? 'bg-marca text-white' : 'text-tinta-2 hover:text-marca'}`}
          >
            {m === 'rosca' ? 'Rosca' : 'Barras'}
          </button>
        ))}
      </div>

      {modo === 'rosca' ? <SetorRosca dados={comCor} totalReg={totalReg} titulo={titulo} /> : <SetorBarras dados={comCor} titulo={titulo} />}
    </div>
  )
}

function SetorRosca({ dados, totalReg, titulo }: {
  dados: { setor: string; total: number; pct: number; cor: string }[]
  totalReg: number
  titulo: (d: any) => string
}) {
  const cx = 90, cy = 90, r = 86, ri = 54
  let ang = -Math.PI / 2
  const fatias = dados.map((d) => {
    const frac = totalReg > 0 ? d.total / totalReg : 0
    const a0 = ang; const a1 = ang + frac * 2 * Math.PI; ang = a1
    return { ...d, a0, a1, frac }
  })
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative h-48 w-48 flex-none">
        <svg viewBox="0 0 180 180" className="h-full w-full" role="img" aria-label="Rosca de participação por setor">
          {fatias.map((f, i) => (
            <g key={i}>
              {f.frac >= 0.999 ? (
                <circle cx={cx} cy={cy} r={(r + ri) / 2} fill="none" stroke={f.cor} strokeWidth={r - ri}><title>{titulo(f)}</title></circle>
              ) : (
                <path d={arcoRosca(cx, cy, r, ri, f.a0, f.a1)} fill={f.cor} stroke="#fff" strokeWidth={1.5}><title>{titulo(f)}</title></path>
              )}
            </g>
          ))}
        </svg>
        {/* Centro: quantidade de setores */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[1.6rem] font-[680] leading-none text-tinta">{dados.length}</span>
          <span className="mt-0.5 text-[0.6875rem] font-medium text-tinta-3">{dados.length === 1 ? 'setor' : 'setores'}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {dados.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-sm" title={titulo(d)}>
            <span className="h-3 w-3 flex-none rounded-sm" style={{ background: d.cor }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-tinta-2">{d.setor}</span>
            <strong className="flex-none font-semibold text-tinta tabular">{d.pct}%</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SetorBarras({ dados, titulo }: {
  dados: { setor: string; total: number; pct: number; cor: string }[]
  titulo: (d: any) => string
}) {
  const ordenado = [...dados].sort((a, b) => b.pct - a.pct)
  const grid = 'grid grid-cols-[minmax(6rem,11rem)_1fr_3rem] items-center gap-3'
  return (
    <div className="space-y-1.5">
      <div className={`${grid} text-[10px] text-tinta-3`}>
        <span />
        <span className="flex justify-between"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></span>
        <span />
      </div>
      {ordenado.map((d, i) => (
        <div key={i} className={grid} title={titulo(d)}>
          <span className="truncate text-xs text-tinta-2">{d.setor}</span>
          <span className="relative block h-4 rounded-sm bg-plano">
            <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${Math.max(d.pct, d.pct > 0 ? 2 : 0)}%`, background: d.cor }} />
          </span>
          <strong className="text-right text-xs font-semibold text-tinta tabular">{d.pct}%</strong>
        </div>
      ))}
    </div>
  )
}
