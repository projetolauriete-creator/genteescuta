'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import { ArrowRight, LifeBuoy, GraduationCap, ClipboardList, Cake, MessageSquarePlus, Clock } from 'lucide-react'
import { configurado } from '@/lib/firebase'
import { getConfig } from '@/lib/fb/publico'
import { CabecalhoPublico, RodapePublico } from '@/components/CabecalhoPublico'
import { Carrossel } from '@/components/Carrossel'
import { CardReembolsoHome } from '@/components/CardReembolsoHome'
import { TelaConfiguracao } from '@/components/TelaConfiguracao'

type CardHome = { href: string; titulo: string; frase: string; Icone: typeof LifeBuoy; cor: string; destaque?: boolean; emBreve?: boolean }

// "Sobre nós" e "Missão, Visão e Valores" saíram daqui e viraram itens do
// rodapé (RodapePublico), acessíveis de qualquer página.
const CARDS: CardHome[] = [
  { href: '/canal', titulo: 'Compartilhe sua voz', frase: 'Tem uma ideia, sugestão ou reconhecimento? Envie a sua manifestação.', Icone: MessageSquarePlus, cor: 'linear-gradient(135deg, #1a4895 0%, #002443 100%)' },
  { href: '/aniversariantes', titulo: 'Aniversariantes do mês', frase: 'Veja quem aniversaria e quem completa tempo de casa neste mês.', Icone: Cake, cor: 'linear-gradient(135deg, #2f9e8a 0%, #0f5a52 100%)' },
  { href: '/informacoes-administrativas', titulo: 'Informações Administrativas', frase: 'Aqui você encontra acessos e informações importantes para facilitar sua rotina, consultar documentos, e acompanhar os principais processos administrativos da Soulan.', Icone: ClipboardList, cor: 'linear-gradient(135deg, #3f8fcf 0%, #1a4895 100%)' },
  { href: '/contato', titulo: 'Contato e Suporte', frase: 'Fale com a equipe de Gente & Cultura.', Icone: LifeBuoy, cor: 'linear-gradient(135deg, #1f5f9a 0%, #002443 100%)' },
  { href: '/treinamento', titulo: 'Central de Conhecimento', frase: 'Acesse os materiais da sua área disponíveis, além das trilhas de desenvolvimento, treinamentos e conteúdos institucionais da Soulan.', Icone: GraduationCap, cor: 'linear-gradient(135deg, #1a4895 0%, #0a2f63 100%)', emBreve: true },
]

export default function Inicio() {
  const [empresa, setEmpresa] = useState('Soulan Recursos Humanos')

  useEffect(() => {
    if (!configurado()) return
    getConfig().then((c) => setEmpresa(c.empresa_nome)).catch(() => {})
  }, [])

  if (!configurado()) return <TelaConfiguracao />

  return (
    <div className="min-h-screen">
      <CabecalhoPublico empresa={empresa} />

      {/* -------- Banner full-bleed -------- */}
      <section className="banner-hero">
        <div className="banner-bg" aria-hidden />
        <img
          src="/capa-soulan.png"
          alt="Equipe da Soulan de costas, com a frase “Eu te ajudo a trabalhar mais feliz” nas camisetas"
          className="banner-img"
        />
      </section>

      <main className="mx-auto max-w-7xl px-4 pt-10">
        {/* -------- Carrossel de notícias (aniversariantes, mural, …) -------- */}
        <Carrossel />

        {/* -------- Grade de cards -------- */}
        <section className="mb-14">
          <h2 className="titulo-secao text-tinta">Explore o Gente Cultura</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Reembolso: primeiro card, "vivo" conforme o papel de quem logou. */}
            <CardReembolsoHome />
            {CARDS.map(({ href, titulo, frase, Icone, cor, destaque, emBreve }) => {
              const classe = `group flex flex-col items-center gap-3 rounded-2xl p-5 text-center text-white sm:p-6 [text-shadow:0_1px_6px_rgba(0,0,0,0.22)] ${
                emBreve
                  ? 'cursor-default shadow-[0_6px_18px_rgba(0,36,67,0.14)]'
                  : destaque
                    ? 'transition-transform hover:-translate-y-1 shadow-[0_10px_30px_rgba(255,136,100,0.5)] ring-2 ring-[#ff8864] ring-offset-2 ring-offset-white'
                    : 'transition-transform hover:-translate-y-1 shadow-[0_6px_18px_rgba(0,36,67,0.14)]'
              }`
              const conteudo = (
                <>
                  {emBreve ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide [text-shadow:none]">
                      <Clock size={12} aria-hidden /> Em breve
                    </span>
                  ) : destaque ? (
                    <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wide [text-shadow:none]">Destaque</span>
                  ) : null}
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
                    <Icone size={22} aria-hidden />
                  </span>
                  <span className="text-base font-semibold tracking-[-0.012em]">{titulo}</span>
                  <span className="text-sm leading-6 text-white/90">{frase}</span>
                  {emBreve ? (
                    <span className="mt-auto inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 pt-1 text-sm font-semibold [text-shadow:none]">
                      <Clock size={14} aria-hidden /> Em breve
                    </span>
                  ) : (
                    <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-semibold">
                      Abrir
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  )}
                </>
              )
              return emBreve ? (
                <div key={href} style={{ background: cor }} className={classe} aria-disabled="true">{conteudo}</div>
              ) : (
                <Link key={href} href={href} style={{ background: cor }} className={classe}>{conteudo}</Link>
              )
            })}
          </div>
        </section>

      </main>

      <RodapePublico />
    </div>
  )
}
