'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import {
  MessageSquarePlus,
  Award,
  ArrowRight,
  Trash2,
  Inbox,
  ShieldCheck,
} from 'lucide-react'
import { configurado } from '@/lib/firebase'
import { getConfig, listarMinhasManifestacoes, excluirMinhaManifestacao } from '@/lib/fb/publico'
import { observarLogin } from '@/lib/fb/auth'
import { TIPO_MANIFESTACAO_LABEL, TRIAGEM_LABEL } from '@/lib/types'
import { CabecalhoPublico, RodapePublico } from '@/components/CabecalhoPublico'
import { TelaConfiguracao } from '@/components/TelaConfiguracao'
import { StatusChip } from '@/components/StatusManifestacao'
import { Chip } from '@/components/ui'

function fmtData(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

// Dois caminhos de entrada. "Contribuir" reúne sugestão, ideia e melhoria
// num único formulário (a equipe classifica depois); "reconhecer" mantém o
// fluxo próprio de reconhecimento. Ambos apontam para /canal/novo?tipo=…
const CARTOES = [
  {
    tipo: 'contribuicao',
    titulo: 'Quero contribuir',
    descricao: 'Tem uma ideia, sugestão ou algo que poderia funcionar melhor? Conte para a gente.',
    Icone: MessageSquarePlus,
  },
  {
    tipo: 'reconhecimento',
    titulo: 'Quero reconhecer',
    descricao: 'Quer reconhecer uma pessoa ou equipe por uma atitude, apoio ou trabalho realizado? Compartilhe aqui.',
    Icone: Award,
  },
] as const

export default function Canal() {
  const [empresa, setEmpresa] = useState('Soulan Recursos Humanos')

  useEffect(() => {
    if (!configurado()) return
    getConfig().then((c) => setEmpresa(c.empresa_nome)).catch(() => {})
  }, [])

  if (!configurado()) return <TelaConfiguracao />

  return (
    <div className="min-h-screen">
      <CabecalhoPublico empresa={empresa} />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="fio-marca mb-6 w-14" aria-hidden />
        <h1 className="titulo-hero text-[2rem] text-tinta">Compartilhe sua voz</h1>
        <p className="texto-leitura mt-3 text-[1.0625rem]">
          Conte para nós o que você pensa, sente ou acredita que pode ser melhorado.
        </p>

        <h2 className="titulo-secao mt-9 text-tinta">Por onde você quer começar?</h2>
        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          {CARTOES.map(({ tipo, titulo, descricao, Icone }, i) => (
            <Link
              key={tipo}
              href={`/canal/novo?tipo=${tipo}`}
              className="cartao-g cartao-clicavel group flex flex-col gap-3 p-5"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[0_2px_6px_rgba(26,23,20,0.14)]"
                style={{ background: `var(--serie-${i + 1})` }}
              >
                <Icone size={20} strokeWidth={2} aria-hidden />
              </span>
              <span className="text-[0.9375rem] font-semibold tracking-[-0.014em] text-tinta">
                {titulo}
              </span>
              <span className="text-[0.8125rem] leading-[1.5] text-tinta-3">
                {descricao}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-marca-texto">
                Começar
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>

        {/* Protocolo de Assédio: canal reservado, à parte dos dois caminhos
            acima. Visual mais sóbrio, por ser um tema sensível. */}
        <Link
          href="/canal/assedio"
          className="cartao-g cartao-clicavel group mt-3.5 flex items-center gap-4 p-5"
        >
          <span
            className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-white shadow-[0_2px_6px_rgba(26,23,20,0.14)]"
            style={{ background: 'linear-gradient(135deg, #1a4895 0%, #002443 100%)' }}
          >
            <ShieldCheck size={20} strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.9375rem] font-semibold tracking-[-0.014em] text-tinta">
              Protocolo de Prevenção e Enfrentamento ao Assédio e às Condutas Inadequadas
            </span>
            <span className="mt-0.5 block text-[0.8125rem] leading-[1.5] text-tinta-3">
              Entenda o fluxo de acolhimento e registre um relato em um canal reservado da equipe de Gente e Cultura.
            </span>
          </span>
          <ArrowRight size={18} className="flex-none text-tinta-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>

        <MinhasManifestacoes />
      </main>
      <RodapePublico />
    </div>
  )
}

// -------------------------------------------------------------
// Minhas manifestações: o colaborador logado acompanha o que enviou
// (identificado) e pode excluir. Anônimas não aparecem (não são rastreadas).
// -------------------------------------------------------------
function MinhasManifestacoes() {
  const [logado, setLogado] = useState<boolean | null>(null)
  const [itens, setItens] = useState<any[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)

  function recarregar() {
    listarMinhasManifestacoes().then(setItens).catch(() => setItens([]))
  }
  useEffect(() => {
    const cancelar = observarLogin((u) => {
      setLogado(!!u)
      if (u) recarregar()
      else setItens([])
    })
    return cancelar
  }, [])

  async function excluir(m: any) {
    if (!confirm('Excluir esta manifestação? Esta ação não pode ser desfeita.')) return
    setErro(null); setExcluindo(m.id)
    try {
      await excluirMinhaManifestacao(m.id)
      setItens((atual) => (atual ?? []).filter((x) => x.id !== m.id))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir.')
    } finally {
      setExcluindo(null)
    }
  }

  if (!logado) return null // só para quem está logado

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-marca-clara text-marca">
          <Inbox size={18} aria-hidden />
        </span>
        <h2 className="titulo-secao text-tinta">Minhas manifestações</h2>
      </div>
      <p className="mt-1.5 text-[0.875rem] text-tinta-3">
        Acompanhe o que você enviou identificado. As enviadas de forma anônima não aparecem aqui.
      </p>

      {erro && <p className="mt-3 rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-sm text-[#8a1f1f]">{erro}</p>}

      {itens === null ? (
        <p className="mt-4 text-sm text-tinta-3">Carregando…</p>
      ) : itens.length === 0 ? (
        <div className="mt-4 cartao-g p-6 text-center text-sm text-tinta-3">
          Você ainda não enviou nenhuma manifestação identificada.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {itens.map((m) => (
            <li key={m.id} className="cartao-g p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-superficie-2 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-tinta-2">
                      {TIPO_MANIFESTACAO_LABEL[m.tipo as keyof typeof TIPO_MANIFESTACAO_LABEL] ?? m.tipo}
                    </span>
                    {m.categoria || m.area ? (
                      <span className="text-xs text-tinta-3">{m.categoria || m.area}</span>
                    ) : null}
                    <span className="text-xs text-tinta-3">· {fmtData(m.criado_em)}</span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-tinta">{m.titulo || m.problema || m.descricao || '-'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusChip status={m.status} />
                    {m.triagem && m.triagem !== 'pendente' && (
                      <Chip faixa={m.triagem === 'aprovada' ? 'baixo' : 'critico'}>{TRIAGEM_LABEL[m.triagem as keyof typeof TRIAGEM_LABEL] ?? m.triagem}</Chip>
                    )}
                  </div>
                  {m.resposta_privada && (
                    <p className="mt-2.5 rounded-lg border border-borda bg-superficie-2 px-3 py-2 text-sm leading-6 text-tinta-2">
                      <strong className="font-semibold text-tinta">Resposta da equipe:</strong> {m.resposta_privada}
                    </p>
                  )}
                  {Array.isArray(m.updates) && m.updates.filter((u: any) => u?.visivel_ao_colaborador && u?.mensagem).length > 0 && (
                    <div className="mt-2.5 space-y-1.5">
                      {m.updates
                        .filter((u: any) => u?.visivel_ao_colaborador && u?.mensagem)
                        .sort((a: any, b: any) => (b.criado_em ?? '').localeCompare(a.criado_em ?? ''))
                        .map((u: any, i: number) => (
                          <div key={i} className="rounded-lg border border-borda bg-superficie-2 px-3 py-2 text-sm leading-6 text-tinta-2">
                            <strong className="font-semibold text-tinta">Mensagem da equipe:</strong> {u.mensagem}
                            <span className="ml-1 text-xs text-tinta-3">· {fmtData(u.criado_em)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  title="Excluir manifestação"
                  disabled={excluindo === m.id}
                  onClick={() => excluir(m)}
                  className="flex-none rounded-lg p-2 text-tinta-3 transition-colors hover:bg-plano hover:text-critico disabled:opacity-40"
                >
                  <Trash2 size={17} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
