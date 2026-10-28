'use client'

import { useEffect, useRef, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import {
  ShieldCheck,
  Lock,
  Send,
  ArrowLeft,
  CheckCircle2,
  Paperclip,
  ImageIcon,
  FileText,
  X,
} from 'lucide-react'
import { configurado } from '@/lib/firebase'
import { getConfig } from '@/lib/fb/publico'
import { observarLogin } from '@/lib/fb/auth'
import { perfilAtual, type Perfil } from '@/lib/fb/funcionarios'
import {
  enviarRelatoAssedio,
  getMensagensAssedio,
  MENSAGENS_ASSEDIO_PADRAO,
  MAX_ANEXOS_RELATO,
  type AnexoRelato,
} from '@/lib/fb/assedio'
import { comprimirImagem } from '@/lib/imagem'
import { lerDocumentoDataURL } from '@/lib/arquivo'
import { CENTROS_CUSTO } from '@/lib/reembolso'
import { CabecalhoPublico, RodapePublico } from '@/components/CabecalhoPublico'
import { TelaConfiguracao } from '@/components/TelaConfiguracao'
import { Aviso, Botao, BotaoLink, Campo, ENTRADA } from '@/components/ui'

export default function RelatoAssedio() {
  const [empresa, setEmpresa] = useState('Soulan Recursos Humanos')

  useEffect(() => {
    if (!configurado()) return
    getConfig().then((c) => setEmpresa(c.empresa_nome)).catch(() => {})
  }, [])

  if (!configurado()) return <TelaConfiguracao />

  return (
    <div className="min-h-screen">
      <CabecalhoPublico empresa={empresa} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <Link
          href="/canal/assedio"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-tinta-3 transition-colors hover:text-marca"
        >
          <ArrowLeft size={15} aria-hidden /> Voltar para o protocolo
        </Link>

        <div className="mt-4 flex items-center gap-3.5">
          <span
            className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl text-white shadow-[0_2px_6px_rgba(26,23,20,0.16)]"
            style={{ background: 'linear-gradient(135deg, #1a4895 0%, #002443 100%)' }}
          >
            <ShieldCheck size={22} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h1 className="titulo-hero text-[1.75rem] text-tinta">Fazer um relato</h1>
            <p className="text-sm text-tinta-2">Recebido pela equipe de Gente e Cultura, em um canal reservado.</p>
          </div>
        </div>

        <div className="cartao-g mt-7 p-5 sm:p-7">
          <FormRelato />
        </div>
      </main>
      <RodapePublico />
    </div>
  )
}

function FormRelato() {
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [centro, setCentro] = useState('')
  const [relato, setRelato] = useState('')
  const [anexos, setAnexos] = useState<AnexoRelato[]>([])
  const [lendoAnexo, setLendoAnexo] = useState(false)
  const [anexoErro, setAnexoErro] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, setPendente] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [acolhimento, setAcolhimento] = useState(MENSAGENS_ASSEDIO_PADRAO.acolhimento)
  const inputArquivo = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    getMensagensAssedio().then((m) => setAcolhimento(m.acolhimento)).catch(() => {})
    const cancelar = observarLogin(async (u) => {
      const p = u ? await perfilAtual().catch(() => null) : null
      setPerfil(p)
      // Preenche o que der do cadastro (a pessoa pode ajustar).
      if (p && p.ativo) {
        setNome((atual) => atual || p.nome || '')
        setEmail((atual) => atual || p.email || '')
        setCentro((atual) => atual || p.centro_custo || '')
      }
    })
    return cancelar
  }, [])

  async function adicionarAnexos(lista: FileList | null) {
    if (!lista || lista.length === 0) return
    setAnexoErro(null)
    setLendoAnexo(true)
    try {
      const novos: AnexoRelato[] = []
      for (const file of Array.from(lista)) {
        if (anexos.length + novos.length >= MAX_ANEXOS_RELATO) {
          setAnexoErro(`Você pode anexar até ${MAX_ANEXOS_RELATO} arquivos.`)
          break
        }
        if (file.type.startsWith('image/')) {
          novos.push({ tipo: 'imagem', nome: file.name, dados: await comprimirImagem(file) })
        } else {
          const { dados, nome } = await lerDocumentoDataURL(file)
          novos.push({ tipo: 'documento', nome, dados })
        }
      }
      if (novos.length) setAnexos((a) => [...a, ...novos])
    } catch (e) {
      setAnexoErro(e instanceof Error ? e.message : 'Não consegui ler o anexo.')
    } finally {
      setLendoAnexo(false)
      if (inputArquivo.current) inputArquivo.current.value = ''
    }
  }

  function removerAnexo(i: number) {
    setAnexos((a) => a.filter((_, idx) => idx !== i))
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErro(null)
    setPendente(true)
    try {
      await enviarRelatoAssedio({ nome, email, centro_custo: centro, relato, anexos })
      setEnviado(true)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui registrar agora.')
      setPendente(false)
    }
  }

  // ---------------- Confirmação + acolhimento ----------------
  if (enviado) {
    return (
      <div>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#eff8ef] text-[#0b5d0b]">
          <CheckCircle2 size={24} aria-hidden />
        </span>
        <h2 className="titulo-hero mt-5 text-[1.5rem] text-tinta">Recebemos o seu relato</h2>
        <p className="mt-4 whitespace-pre-line rounded-xl border border-[#cfe6b8] bg-[#f4faec] px-4 py-3 text-sm leading-6 text-verde-escuro">
          {acolhimento}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <BotaoLink href="/canal/assedio" variante="secundario">Voltar ao protocolo</BotaoLink>
          <BotaoLink href="/">Ir para o início</BotaoLink>
        </div>
      </div>
    )
  }

  // ---------------- Formulário ----------------
  return (
    <form onSubmit={enviar} className="space-y-6">
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {/* Identificação: obrigatória, para a equipe atuar e acolher. */}
      <fieldset className="rounded-md border border-borda bg-superficie-2 p-4">
        <legend className="px-1 text-sm font-semibold text-tinta">Seus dados</legend>
        <p className="mb-3 text-xs leading-5 text-tinta-2">
          Precisamos saber quem é você e a sua área para poder atuar e acolher. Seus dados ficam visíveis só para
          a equipe de Gente e Cultura.
        </p>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome completo" obrigatorio>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={ENTRADA} placeholder="Ex.: Joana Ribeiro da Silva" autoComplete="name" />
            </Campo>
            <Campo rotulo="E-mail" ajuda="Para a equipe falar com você em sigilo." obrigatorio>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={ENTRADA} placeholder="voce@soulan.com.br" autoComplete="email" />
            </Campo>
          </div>
          <Campo rotulo="Seu centro de custo (área)" obrigatorio>
            <select value={centro} onChange={(e) => setCentro(e.target.value)} className={ENTRADA}>
              <option value="">Selecione a sua área…</option>
              {CENTROS_CUSTO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
        </div>
      </fieldset>

      {/* Relato */}
      <Campo
        rotulo="Conte o que aconteceu"
        ajuda="Descreva o ocorrido com o máximo de detalhes que você se sentir à vontade para compartilhar (o que, quando, onde e quem)."
        obrigatorio
      >
        <textarea
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
          rows={8}
          minLength={10}
          maxLength={5000}
          className={`${ENTRADA} min-h-[11rem] resize-y leading-relaxed`}
          placeholder="Descreva o ocorrido…"
        />
      </Campo>

      {/* Anexos */}
      <div>
        <p className="text-sm font-medium text-tinta">Anexos <span className="font-normal text-tinta-3">(opcional)</span></p>
        <p className="mt-0.5 text-xs leading-5 text-tinta-3">
          Prints, fotos ou PDF que ajudem a entender o ocorrido. Até {MAX_ANEXOS_RELATO} arquivos. Evite incluir
          imagens explícitas, telefones pessoais ou dados identificáveis desnecessários.
        </p>

        {anexos.length > 0 && (
          <ul className="mt-3 space-y-2">
            {anexos.map((a, i) => (
              <li key={i} className="flex items-center gap-2.5 rounded-lg border border-borda bg-white px-3 py-2">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-superficie-2 text-tinta-2">
                  {a.tipo === 'imagem' ? <ImageIcon size={16} aria-hidden /> : <FileText size={16} aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-tinta">{a.nome}</span>
                <button
                  type="button"
                  onClick={() => removerAnexo(i)}
                  className="flex-none rounded-lg p-1.5 text-tinta-3 transition-colors hover:bg-plano hover:text-critico"
                  aria-label={`Remover ${a.nome}`}
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {anexoErro && <p className="mt-2 text-xs font-medium text-critico">{anexoErro}</p>}

        {anexos.length < MAX_ANEXOS_RELATO && (
          <div className="mt-3">
            <input
              ref={inputArquivo}
              type="file"
              accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
              multiple
              onChange={(e) => adicionarAnexos(e.target.files)}
              className="hidden"
              id="anexo-relato"
            />
            <label
              htmlFor="anexo-relato"
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3.5 py-2.5 text-sm font-semibold text-tinta transition-colors hover:border-marca hover:bg-superficie-2 ${lendoAnexo ? 'pointer-events-none opacity-60' : ''}`}
            >
              <Paperclip size={15} aria-hidden /> {lendoAnexo ? 'Lendo arquivo…' : 'Adicionar anexo'}
            </label>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-borda bg-superficie-2 px-3 py-2.5 text-xs leading-5 text-tinta-2">
        <Lock size={14} className="mt-0.5 flex-none text-tinta-3" aria-hidden />
        <p>
          Este relato vai direto para a equipe de Gente e Cultura, em um canal reservado. Ele não aparece na
          lista comum de manifestações e não fica visível para gestores ou colegas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-borda pt-4">
        <Botao type="submit" disabled={pendente || lendoAnexo}>
          <Send size={15} aria-hidden /> {pendente ? 'Enviando…' : 'Enviar relato'}
        </Botao>
      </div>
    </form>
  )
}
