'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import { ShieldCheck, ArrowLeft, ArrowRight, MessageSquareWarning, Copy, Check, Pencil, Save, X, MessageSquareText } from 'lucide-react'
import { configurado } from '@/lib/firebase'
import { getConfig } from '@/lib/fb/publico'
import { observarLogin } from '@/lib/fb/auth'
import {
  PASSOS_PROTOCOLO,
  getMensagensModeloAssedio,
  salvarMensagensModeloAssedio,
  podeEditarAssedio,
  MENSAGENS_MODELO_ASSEDIO_PADRAO,
  type MensagensModeloAssedio,
} from '@/lib/fb/assedio'
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

        {/* Relato + mensagens-modelo lado a lado (empilha no celular) */}
        <section className="mt-9 grid items-start gap-4 lg:grid-cols-2">
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

          <MensagensModelo />
        </section>
      </main>
      <RodapePublico />
    </div>
  )
}

// -------------------------------------------------------------
// Mensagens-modelo para uso com candidatos. Dois textos prontos com botao de
// copiar. Gente e Cultura (ou Super) pode editar aqui mesmo: o texto pode mudar.
// -------------------------------------------------------------
const CAMPOS_MODELO = [
  { chave: 'aviso_inicial' as const, titulo: 'Aviso importante', apoio: 'No início da conversa' },
  { chave: 'resposta_conduta' as const, titulo: 'Resposta a conduta inadequada', apoio: 'Quando houver desrespeito' },
]

// Copia para a área de transferência. Tenta a API moderna e cai no execCommand
// (funciona quando a API está bloqueada, por exemplo dentro de um iframe).
async function copiarTexto(texto: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // cai no método legado abaixo
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = texto
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function MensagensModelo() {
  const [msgs, setMsgs] = useState<MensagensModeloAssedio>(MENSAGENS_MODELO_ASSEDIO_PADRAO)
  const [podeEditar, setPodeEditar] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState<MensagensModeloAssedio>(MENSAGENS_MODELO_ASSEDIO_PADRAO)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    getMensagensModeloAssedio().then(setMsgs).catch(() => {})
    const cancelar = observarLogin((u) => {
      if (!u) { setPodeEditar(false); return }
      podeEditarAssedio().then(setPodeEditar).catch(() => setPodeEditar(false))
    })
    return cancelar
  }, [])

  async function copiar(chave: string, texto: string) {
    const ok = await copiarTexto(texto)
    if (ok) {
      setErro(null)
      setCopiado(chave)
      setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 2000)
    } else {
      setErro('Não consegui copiar automaticamente. Selecione o texto e copie à mão.')
    }
  }

  function abrirEdicao() {
    setRascunho(msgs); setErro(null); setEditando(true)
  }

  async function salvar() {
    setSalvando(true); setErro(null)
    try {
      await salvarMensagensModeloAssedio(rascunho)
      const novo = await getMensagensModeloAssedio()
      setMsgs(novo)
      setEditando(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar as mensagens.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="cartao-g p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-marca-clara text-marca">
          <MessageSquareText size={19} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-semibold tracking-[-0.012em] text-tinta">Mensagens-modelo</p>
          <p className="text-[0.8125rem] leading-[1.5] text-tinta-3">Textos prontos para usar com candidatos em processos seletivos.</p>
        </div>
        {podeEditar && !editando && (
          <button
            type="button"
            onClick={abrirEdicao}
            className="flex flex-none items-center gap-1.5 rounded-lg border border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta-2 transition-colors hover:border-marca hover:text-marca"
          >
            <Pencil size={13} aria-hidden /> Editar
          </button>
        )}
      </div>

      {erro && <p className="mt-3 rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-sm text-[#8a1f1f]">{erro}</p>}

      <div className="mt-4 space-y-3">
        {CAMPOS_MODELO.map((campo) => (
          <div key={campo.chave} className="rounded-xl border border-borda bg-superficie-2 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-tinta">{campo.titulo}</p>
                <p className="text-xs text-tinta-3">{campo.apoio}</p>
              </div>
              {!editando && (
                <button
                  type="button"
                  onClick={() => copiar(campo.chave, msgs[campo.chave])}
                  className={`flex flex-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    copiado === campo.chave ? 'bg-marca-clara text-marca' : 'bg-white text-tinta-2 hover:bg-plano hover:text-marca'
                  }`}
                  aria-label={`Copiar: ${campo.titulo}`}
                >
                  {copiado === campo.chave ? <><Check size={13} aria-hidden /> Copiado</> : <><Copy size={13} aria-hidden /> Copiar</>}
                </button>
              )}
            </div>
            {editando ? (
              <textarea
                value={rascunho[campo.chave]}
                onChange={(e) => setRascunho((r) => ({ ...r, [campo.chave]: e.target.value }))}
                rows={campo.chave === 'resposta_conduta' ? 7 : 4}
                className="mt-2.5 w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm leading-6 text-tinta focus:border-marca focus:outline-none"
              />
            ) : (
              <p className="mt-2.5 whitespace-pre-line text-sm leading-6 text-tinta-2">{msgs[campo.chave]}</p>
            )}
          </div>
        ))}
      </div>

      {editando && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded-lg bg-marca px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-marca-escura disabled:opacity-40"
          >
            <Save size={15} aria-hidden /> {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => { setEditando(false); setErro(null) }}
            disabled={salvando}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-tinta-3 transition-colors hover:text-tinta disabled:opacity-40"
          >
            <X size={15} aria-hidden /> Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
