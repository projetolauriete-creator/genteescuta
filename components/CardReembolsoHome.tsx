'use client'

// =============================================================
// Card "vivo" de Reembolso na home: ocupa a PRIMEIRA célula da grade
// (mesmo tamanho dos demais), mas com números ao vivo adaptados ao papel
// de quem está logado, sempre no escopo que a pessoa pode ver:
//   - Colaborador: os próprios pedidos em andamento (listarMinhas).
//   - Gestor: o que aguarda a aprovação dele, só do seu centro de custo.
//   - Financeiro: o que aguarda pagamento.
// O escopo é imposto nas consultas (listarMinhas / listarParaGestao) e,
// de verdade, nas Regras do Firestore: ninguém vê além do seu papel.
// =============================================================
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from '@/components/LinkSemPrefetch'
import { Receipt, ArrowRight } from 'lucide-react'
import { observarLogin } from '@/lib/fb/auth'
import { perfilAtual, type Perfil } from '@/lib/fb/funcionarios'
import { listarMinhas, listarParaGestao, type Reembolso } from '@/lib/fb/reembolso'
import { estaPendente, podeAprovar, statusEfetivo, STATUS_LABEL, formatBRL } from '@/lib/reembolso'

const FUNDO = 'linear-gradient(135deg, #ff8864 0%, #d2451c 100%)'

interface Metricas {
  ehGestor: boolean
  ehFinanceiro: boolean
  ehMaster: boolean
  ehAprovador: boolean
  aprovacoes: number
  pagamentos: number
  meusPendentes: number
  meuTotal: number
  ultimo: Reembolso | null
}

export function CardReembolsoHome() {
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)
  const [minhas, setMinhas] = useState<Reembolso[] | null>(null)
  const [gestao, setGestao] = useState<Reembolso[] | null>(null)

  useEffect(() => {
    const cancelar = observarLogin(async (u) => {
      if (!u) { setPerfil(null); setMinhas(null); setGestao(null); return }
      const p = await perfilAtual().catch(() => null)
      setPerfil(p)
      const logado = !!p && p.ativo && (p.tipo === 'admin' || p.tipo === 'funcionario')
      if (!logado) { setMinhas(null); setGestao(null); return }
      const ehAprovador = p!.papeis.includes('master') || p!.papeis.includes('financeiro') || p!.papeis.includes('gestor')
      const [m, g] = await Promise.all([
        listarMinhas().catch(() => [] as Reembolso[]),
        ehAprovador ? listarParaGestao(p!).catch(() => [] as Reembolso[]) : Promise.resolve([] as Reembolso[]),
      ])
      setMinhas(m); setGestao(g)
    })
    return cancelar
  }, [])

  const logado = !!perfil && perfil.ativo && (perfil.tipo === 'admin' || perfil.tipo === 'funcionario')

  const m = useMemo<Metricas | null>(() => {
    if (!perfil || !logado) return null
    const uid = perfil.uid
    const papeis = perfil.papeis
    const ehGestor = papeis.includes('gestor')
    const ehFinanceiro = papeis.includes('financeiro')
    const ehMaster = papeis.includes('master')
    const g = gestao ?? []
    const aprovacoes = g.filter((r) =>
      r.solicitante_uid !== uid
      && (r.status === 'pendente_gestor' || r.status === 'pendente_master')
      && podeAprovar(r.status, papeis, perfil.centro_custo, r.centro_custo),
    ).length
    const pagamentos = g.filter((r) =>
      r.status === 'pendente_financeiro'
      && podeAprovar(r.status, papeis, perfil.centro_custo, r.centro_custo),
    ).length
    const meusEmAndamento = (minhas ?? []).filter((r) => estaPendente(r.status))
    const meusPendentes = meusEmAndamento.length
    const meuTotal = meusEmAndamento.reduce((s, r) => s + (Number(r.valor) || 0), 0)
    const ultimo = (minhas ?? [])[0] ?? null
    return {
      ehGestor, ehFinanceiro, ehMaster,
      ehAprovador: ehGestor || ehFinanceiro || ehMaster,
      aprovacoes, pagamentos, meusPendentes, meuTotal, ultimo,
    }
  }, [perfil, logado, minhas, gestao])

  return (
    <Link
      href="/reembolso"
      style={{ background: FUNDO }}
      className="group flex h-full flex-col items-center gap-3 rounded-2xl p-5 text-center text-white transition-transform hover:-translate-y-1 sm:p-6 [text-shadow:0_1px_6px_rgba(0,0,0,0.22)] shadow-[0_10px_30px_rgba(255,136,100,0.5)] ring-2 ring-[#ff8864] ring-offset-2 ring-offset-white"
    >
      <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide [text-shadow:none]">
        Destaque
      </span>
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
        <Receipt size={22} aria-hidden />
      </span>
      <span className="text-base font-semibold tracking-[-0.012em]">Solicitação de Reembolso</span>

      <Resumo perfil={perfil} logado={logado} m={m} />

      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold">
        {rotuloAcao(logado, m)}
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}

// -------------------------------------------------------------
function Resumo({ perfil, logado, m }: { perfil: Perfil | null | undefined; logado: boolean; m: Metricas | null }) {
  if (perfil === undefined) {
    return <span className="text-sm leading-6 text-white/90">Carregando os seus dados…</span>
  }
  if (!logado || !m) {
    return (
      <span className="text-sm leading-6 text-white/90">
        Peça reembolsos, anexe o comprovante e acompanhe a aprovação.
      </span>
    )
  }
  if (m.ehFinanceiro) return <Numero valor={m.pagamentos} label="aguardando pagamento" vazio="Nenhum pagamento pendente" />
  if (m.ehGestor || m.ehMaster) return <Numero valor={m.aprovacoes} label="aguardando sua aprovação" vazio="Nenhum reembolso aguardando" />
  // Colaborador
  if (m.meusPendentes > 0) {
    return (
      <span className="flex flex-col items-center">
        <span className="text-[2.25rem] font-bold leading-none tabular [text-shadow:none]">{m.meusPendentes}</span>
        <span className="mt-1 text-[0.8125rem] font-medium text-white/90">
          {m.meusPendentes === 1 ? 'pedido em andamento' : 'pedidos em andamento'}
        </span>
        <span className="text-xs text-white/80">{formatBRL(m.meuTotal)} aguardando</span>
      </span>
    )
  }
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white/90 [text-shadow:none]">
        Nenhum reembolso pendente
      </span>
      {m.ultimo && (
        <span className="text-xs text-white/80">
          Último: {STATUS_LABEL[statusEfetivo(m.ultimo.status, m.ultimo.data_pagamento)]}
        </span>
      )}
    </span>
  )
}

function Numero({ valor, label, vazio }: { valor: number; label: string; vazio: string }) {
  if (valor === 0) {
    return (
      <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white/90 [text-shadow:none]">
        {vazio}
      </span>
    )
  }
  return (
    <span className="flex flex-col items-center">
      <span className="text-[2.25rem] font-bold leading-none tabular [text-shadow:none]">{valor}</span>
      <span className="mt-1 text-[0.8125rem] font-medium text-white/90">{label}</span>
    </span>
  )
}

function rotuloAcao(logado: boolean, m: Metricas | null): ReactNode {
  if (!logado || !m) return 'Abrir'
  if (m.ehFinanceiro) return 'Ver pagamentos'
  if (m.ehGestor || m.ehMaster) return 'Aprovar reembolsos'
  return 'Novo reembolso'
}
