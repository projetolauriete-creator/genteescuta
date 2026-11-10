'use client'

import { useEffect, useState } from 'react'
import { configurado } from '@/lib/firebase'
import { getConfig } from '@/lib/fb/publico'
import { observarLogin } from '@/lib/fb/auth'
import { perfilAtual, type Perfil } from '@/lib/fb/funcionarios'
import { getProgresso, type ProgressoTreino } from '@/lib/fb/treino'
import { listarTrilhas, getTreinamentoEmBreve } from '@/lib/fb/treinos'
import { type Trilha } from '@/lib/treinamentos'
import { GraduationCap, Clock, FolderOpen, ArrowRight } from 'lucide-react'
import Link from '@/components/LinkSemPrefetch'
import { BotaoVoltar } from '@/components/BotaoVoltar'
import { CabecalhoPublico, RodapePublico } from '@/components/CabecalhoPublico'
import { TelaConfiguracao } from '@/components/TelaConfiguracao'
import { TrilhasApp } from '@/components/Treino'

export default function Treinamento() {
  const [empresa, setEmpresa] = useState('Soulan Recursos Humanos')
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)
  const [prog, setProg] = useState<ProgressoTreino | null>(null)
  const [trilhas, setTrilhas] = useState<Trilha[] | null>(null)
  const [emBreve, setEmBreve] = useState<boolean | null>(null)

  useEffect(() => {
    if (!configurado()) return
    getConfig().then((c) => setEmpresa(c.empresa_nome)).catch(() => {})
    getTreinamentoEmBreve().then(setEmBreve).catch(() => setEmBreve(true))
    listarTrilhas().then((r) => setTrilhas(r.trilhas)).catch(() => setTrilhas([]))
    const cancelar = observarLogin(async (u) => {
      const p = u ? await perfilAtual().catch(() => null) : null
      setPerfil(p)
      setProg(await getProgresso().catch(() => ({ etapas: {}, trilhas: {}, pontos: 0 })))
    })
    return cancelar
  }, [])

  if (!configurado()) return <TelaConfiguracao />

  return (
    <div className="min-h-screen">
      <CabecalhoPublico empresa={empresa} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <BotaoVoltar />

        <div className="mt-5">
          <div className="fio-marca mb-5 w-14" aria-hidden />
          <h1 className="titulo-hero text-[1.875rem] text-tinta">Central de Conhecimento</h1>
          <p className="mt-2 max-w-2xl text-[1rem] leading-7 text-tinta-2">
            Os materiais da sua área ficam na Sala de documentos. As trilhas de desenvolvimento chegam em breve.
          </p>
        </div>

        {emBreve === null ? (
          <p className="mt-6 text-sm text-tinta-3">Carregando…</p>
        ) : emBreve ? (
          // Sala de documentos liberada + Trilhas ainda "Em breve" (desabilitada).
          // Lado a lado em telas largas, empilhando no celular.
          <div className="mt-6 grid items-stretch gap-4 sm:grid-cols-2">
            <CardDocumentos />
            <CardTrilhasEmBreve />
          </div>
        ) : perfil === undefined || prog === null || trilhas === null ? (
          <p className="mt-6 text-sm text-tinta-3">Carregando trilhas…</p>
        ) : (
          // Trilhas já liberadas: a Sala de documentos continua acessível no topo.
          <>
            <div className="mt-6">
              <CardDocumentos />
            </div>
            <div className="mt-8">
              <TrilhasApp perfil={perfil} progInicial={prog} trilhas={trilhas} />
            </div>
          </>
        )}
      </main>
      <RodapePublico />
    </div>
  )
}

// Entrada para a Sala de documentos por área (acessível a qualquer colaborador
// logado; cada um vê apenas os materiais da própria área).
function CardDocumentos() {
  return (
    <Link
      href="/treinamento/documentos"
      className="cartao-g cartao-clicavel group flex h-full flex-col gap-3 p-6"
    >
      <span
        className="flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white"
        style={{ background: 'linear-gradient(135deg, #1a4895 0%, #0a2f63 100%)' }}
      >
        <FolderOpen size={24} aria-hidden />
      </span>
      <span className="text-base font-semibold tracking-[-0.012em] text-tinta">Sala de documentos por área</span>
      <span className="text-sm leading-6 text-tinta-2">
        Materiais, planilhas, PDFs e vídeos da sua área, organizados por módulo.
      </span>
      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold text-marca-texto">
        Abrir <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}

// Trilhas de Desenvolvimento: selo "Em breve" e acesso desabilitado (não abre
// nada ao clicar) até a área ficar pronta.
function CardTrilhasEmBreve() {
  return (
    <div className="cartao-g flex h-full cursor-default flex-col gap-3 p-6" aria-disabled="true">
      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-superficie-2 text-tinta-3">
        <GraduationCap size={24} aria-hidden />
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-base font-semibold tracking-[-0.012em] text-tinta">Trilhas de Desenvolvimento</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-superficie-2 px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide text-tinta-3">
          <Clock size={12} aria-hidden /> Em breve
        </span>
      </span>
      <span className="text-sm leading-6 text-tinta-2">
        Trilhas de aprendizagem com conteúdos, quizzes e conquistas para você crescer com a gente. Estamos preparando: fique de olho.
      </span>
      <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-tinta-3">
        <Clock size={14} aria-hidden /> Disponível em breve
      </span>
    </div>
  )
}
