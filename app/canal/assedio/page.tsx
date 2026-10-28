'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import { ShieldCheck, ArrowLeft, ArrowRight, MessageSquareWarning } from 'lucide-react'
import { configurado } from '@/lib/firebase'
import { getConfig } from '@/lib/fb/publico'
import { PASSOS_PROTOCOLO } from '@/lib/fb/assedio'
import { CabecalhoPublico, RodapePublico } from '@/components/CabecalhoPublico'
import { TelaConfiguracao } from '@/components/TelaConfiguracao'

export default function ProtocoloAssedio() {
  const [empresa, setEmpresa] = useState('Soulan Recursos Humanos')

  useEffect(() => {
    if (!configurado()) return
    getConfig().then((c) => setEmpresa(c.empresa_nome)).catch(() => {})
  }, [])

  if (!configurado()) return <TelaConfiguracao />

  return (
    <div className="min-h-screen">
      <CabecalhoPublico empresa={empresa} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <Link
          href="/canal"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-tinta-3 transition-colors hover:text-marca"
        >
          <ArrowLeft size={15} aria-hidden /> Voltar para Compartilhe sua voz
        </Link>

        {/* Cabeçalho */}
        <div className="mt-4 flex items-start gap-3.5">
          <span
            className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-white shadow-[0_2px_6px_rgba(26,23,20,0.16)]"
            style={{ background: 'linear-gradient(135deg, #1a4895 0%, #002443 100%)' }}
          >
            <ShieldCheck size={22} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h1 className="titulo-hero text-[1.75rem] leading-tight text-tinta">
              Protocolo de Prevenção e Enfrentamento ao Assédio e às Condutas Inadequadas
            </h1>
            <p className="mt-2 text-[0.9375rem] leading-6 text-tinta-2">
              A Soulan trata qualquer situação de assédio ou conduta inadequada com seriedade, sigilo e cuidado.
              Abaixo você entende como funciona o nosso fluxo de acolhimento e pode registrar um relato.
            </p>
          </div>
        </div>

        {/* Fluxo em 5 passos */}
        <section className="mt-9">
          <h2 className="titulo-secao text-tinta">Como funciona, passo a passo</h2>
          <ol className="mt-4 space-y-3">
            {PASSOS_PROTOCOLO.map((passo, i) => (
              <li key={passo.titulo} className="cartao-g flex gap-4 p-5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-marca-clara text-sm font-bold tabular text-marca-texto">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="text-[0.9375rem] font-semibold tracking-[-0.012em] text-tinta">{passo.titulo}</p>
                  <p className="mt-1 text-sm leading-6 text-tinta-2">{passo.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Chamada para o relato */}
        <section className="mt-9">
          <Link
            href="/canal/assedio/relato"
            className="cartao-g cartao-clicavel group flex items-center gap-4 p-5 sm:p-6"
          >
            <span
              className="flex h-12 w-12 flex-none items-center justify-center rounded-xl text-white"
              style={{ background: 'linear-gradient(135deg, #1a4895 0%, #002443 100%)' }}
            >
              <MessageSquareWarning size={22} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold tracking-[-0.012em] text-tinta">
                Fazer um relato
              </span>
              <span className="block text-[0.8125rem] leading-[1.5] text-tinta-3">
                Leva poucos minutos e é recebido pela equipe de Gente e Cultura.
              </span>
            </span>
            <ArrowRight size={18} className="flex-none text-tinta-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </section>
      </main>
      <RodapePublico />
    </div>
  )
}
