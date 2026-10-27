'use client'

import { useEffect, useState } from 'react'
import { configurado } from '@/lib/firebase'
import { getConfig } from '@/lib/fb/publico'
import { observarLogin } from '@/lib/fb/auth'
import { perfilAtual, type Perfil } from '@/lib/fb/funcionarios'
import { getProgresso, type ProgressoTreino } from '@/lib/fb/treino'
import { listarTrilhas, getTreinamentoEmBreve } from '@/lib/fb/treinos'
import { type Trilha } from '@/lib/treinamentos'
import { GraduationCap, BookOpen, Trophy, Sparkles, Clock, FolderOpen, ArrowRight } from 'lucide-react'
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
        {/* Sala de documentos por área: sempre visível (independe do "Em breve"
            das trilhas). Cada colaborador vê os materiais da própria área. */}
        <Link
          href="/treinamento/documentos"
          className="cartao-g cartao-clicavel group mb-6 flex items-center gap-4 p-5"
        >
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #1a4895 0%, #0a2f63 100%)' }}>
            <FolderOpen size={22} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold tracking-[-0.012em] text-tinta">Sala de documentos por área</span>
            <span className="block text-[0.8125rem] leading-[1.5] text-tinta-3">Materiais, planilhas, PDFs e vídeos disponíveis para a sua área.</span>
          </span>
          <ArrowRight size={18} className="flex-none text-tinta-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>

        {emBreve === null ? (
          <p className="text-sm text-tinta-3">Carregando…</p>
        ) : emBreve ? (
          <>
            <BotaoVoltar />

            {/* Hero de largura total */}
            <div className="mt-6 overflow-hidden rounded-3xl border border-borda" style={{ background: 'linear-gradient(135deg, #3f7db0 0%, #223f6a 100%)' }}>
              <div className="grid items-center gap-6 p-8 sm:grid-cols-[1fr_auto] sm:p-12">
                <div className="text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur">
                    <Sparkles size={13} aria-hidden /> Em breve
                  </span>
                  <h1 className="titulo-hero mt-4 text-[2rem] leading-tight text-white sm:text-[2.5rem]">Treinamento e Desenvolvimento</h1>
                  <p className="mt-3 max-w-xl text-[1rem] leading-7 text-white/85">
                    Estamos preparando trilhas de aprendizagem para você crescer com a gente: conteúdos, quizzes e
                    conquistas. <strong className="font-semibold text-white">Fique de olho</strong>: vem novidade por aí! 🚀
                  </p>
                </div>
                <span className="hidden h-28 w-28 flex-none items-center justify-center rounded-3xl bg-white/15 text-white backdrop-blur sm:flex">
                  <GraduationCap size={56} aria-hidden />
                </span>
              </div>
            </div>

            {/* Cards do que está por vir: preenchem a largura */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { Icone: BookOpen, cor: '#1a4895', titulo: 'Trilhas de conteúdo', txt: 'Materiais e leituras rápidas sobre temas do dia a dia.' },
                { Icone: Trophy, cor: '#5e7e1c', titulo: 'Quizzes e conquistas', txt: 'Responda, pontue e acompanhe o seu progresso.' },
                { Icone: Clock, cor: '#8a6d00', titulo: 'No seu ritmo', txt: 'Faça quando e onde quiser, direto pelo portal.' },
              ].map(({ Icone, cor, titulo, txt }) => (
                <div key={titulo} className="cartao-g p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: cor }}>
                    <Icone size={20} aria-hidden />
                  </span>
                  <p className="mt-3 text-[0.9375rem] font-semibold text-tinta">{titulo}</p>
                  <p className="mt-1 text-sm leading-6 text-tinta-2">{txt}</p>
                </div>
              ))}
            </div>
          </>
        ) : perfil === undefined || prog === null || trilhas === null ? (
          <p className="text-sm text-tinta-3">Carregando trilhas…</p>
        ) : (
          <TrilhasApp perfil={perfil} progInicial={prog} trilhas={trilhas} />
        )}
      </main>
      <RodapePublico />
    </div>
  )
}
