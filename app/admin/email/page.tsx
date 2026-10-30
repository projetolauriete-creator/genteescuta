'use client'

import { useEffect, useState } from 'react'
import { Mail, Send, Power, Save, Loader2, Info, CheckCircle2, TriangleAlert } from 'lucide-react'
import { minhaConta, type Conta } from '@/lib/fb/usuarios'
import {
  getConfigEmail,
  salvarConfigEmail,
  enviarEmailTeste,
  TIPOS_EMAIL,
} from '@/lib/fb/email'
import { CabecalhoPagina, Cartao, Campo, ENTRADA, Botao, Aviso } from '@/components/ui'

// Interruptor simples (acessível) reaproveitado na tela.
function Interruptor({
  ligado,
  aoMudar,
  rotuloAria,
  desabilitado,
}: {
  ligado: boolean
  aoMudar: (v: boolean) => void
  rotuloAria: string
  desabilitado?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotuloAria}
      disabled={desabilitado}
      onClick={() => aoMudar(!ligado)}
      className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full transition-colors disabled:opacity-40 ${
        ligado ? 'bg-marca' : 'bg-borda-forte'
      }`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${ligado ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export default function AdminEmail() {
  const [eu, setEu] = useState<Conta | null | undefined>(undefined)
  const [ativo, setAtivo] = useState(false)
  const [tipos, setTipos] = useState<Record<string, boolean>>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [atualizado, setAtualizado] = useState<{ em?: string; por?: string }>({})

  const [emailTeste, setEmailTeste] = useState('')
  const [testando, setTestando] = useState(false)
  const [avisoTeste, setAvisoTeste] = useState<string | null>(null)
  const [erroTeste, setErroTeste] = useState<string | null>(null)

  useEffect(() => {
    minhaConta().then(setEu).catch(() => setEu(null))
    getConfigEmail()
      .then((c) => {
        setAtivo(c.ativo)
        setTipos(c.tipos)
        setAtualizado({ em: c.atualizado_em, por: c.atualizado_por })
      })
      .catch(() => {})
      .finally(() => setCarregando(false))
  }, [])

  const souSuper = !!eu?.ativo && eu?.nivel === 'super'

  async function salvar() {
    setSalvando(true); setErro(null); setAviso(null)
    try {
      await salvarConfigEmail({ ativo, tipos })
      setAviso('Configuração salva.')
      const c = await getConfigEmail()
      setAtualizado({ em: c.atualizado_em, por: c.atualizado_por })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.')
    } finally {
      setSalvando(false)
    }
  }

  async function testar() {
    setTestando(true); setErroTeste(null); setAvisoTeste(null)
    try {
      await enviarEmailTeste(emailTeste)
      setAvisoTeste(`E-mail de teste enviado para ${emailTeste.trim()}. Confira a caixa de entrada (e o spam).`)
    } catch (e) {
      setErroTeste(traduzErroTeste(e))
    } finally {
      setTestando(false)
    }
  }

  if (eu === undefined) {
    return (
      <>
        <CabecalhoPagina titulo="Disparo de e-mail" />
        <p className="p-6 text-sm text-tinta-3">Carregando…</p>
      </>
    )
  }

  if (!souSuper) {
    return (
      <>
        <CabecalhoPagina titulo="Disparo de e-mail" />
        <div className="p-4 sm:p-6">
          <Aviso tom="alerta" titulo="Acesso restrito">
            Apenas o <strong>Super Admin</strong> configura o disparo de e-mail.
          </Aviso>
        </div>
      </>
    )
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Disparo de e-mail"
        descricao="Envia por e-mail os mesmos avisos do sino. Comece desligado e ligue quando quiser."
      />

      <div className="max-w-3xl space-y-4 p-4 sm:p-6">
        {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}
        {erro && <Aviso tom="erro">{erro}</Aviso>}

        {/* Pré-requisito técnico */}
        <Aviso tom="alerta" titulo="Antes de ligar: plano Blaze e deploy">
          O envio roda nas Cloud Functions, que exigem o plano <strong>Blaze</strong> no Firebase e o deploy das funções
          (<code className="rounded bg-white/60 px-1 text-[0.8em]">firebase deploy --only functions</code>), com a chave do
          SendGrid guardada no cofre. Enquanto isso não estiver pronto, pode deixar tudo configurado aqui: nada é enviado
          até o interruptor abaixo ser ligado.
        </Aviso>

        {carregando ? (
          <p className="text-sm text-tinta-3">Carregando configuração…</p>
        ) : (
          <>
            {/* Interruptor geral */}
            <Cartao>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${ativo ? 'bg-marca-clara text-marca' : 'bg-superficie-2 text-tinta-3'}`}>
                  <Power size={20} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-tinta">Disparo de e-mail ativo</p>
                  <p className="mt-0.5 text-sm text-tinta-3">
                    {ativo
                      ? 'Os avisos ligados abaixo serão enviados por e-mail (quando as functions estiverem no ar).'
                      : 'Nenhum e-mail é enviado. Os avisos continuam só no sino do portal.'}
                  </p>
                </div>
                <Interruptor ligado={ativo} aoMudar={setAtivo} rotuloAria="Ativar o disparo de e-mail" />
              </div>
            </Cartao>

            {/* Tipos de aviso */}
            <Cartao titulo="Quais avisos viram e-mail" apoio="Mesmos avisos do sino. Desligue os que não quiser enviar.">
              <div className="divide-y divide-borda">
                {TIPOS_EMAIL.map((t) => {
                  const on = tipos[t.id] !== false
                  return (
                    <div key={t.id} className={`flex items-start gap-4 py-3 ${ativo ? '' : 'opacity-60'}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-tinta">{t.titulo}</p>
                        <p className="mt-0.5 text-xs leading-5 text-tinta-3">{t.desc}</p>
                      </div>
                      <Interruptor
                        ligado={on}
                        desabilitado={!ativo}
                        aoMudar={(v) => setTipos((atual) => ({ ...atual, [t.id]: v }))}
                        rotuloAria={`Enviar e-mail para: ${t.titulo}`}
                      />
                    </div>
                  )
                })}
              </div>
              {!ativo && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-tinta-3">
                  <Info size={13} aria-hidden /> Ligue o interruptor geral para habilitar os avisos individuais.
                </p>
              )}
            </Cartao>

            <div className="flex flex-wrap items-center gap-3">
              <Botao type="button" onClick={salvar} disabled={salvando}>
                {salvando ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Salvando…</> : <><Save size={15} aria-hidden /> Salvar configuração</>}
              </Botao>
              {atualizado.em && (
                <span className="text-xs text-tinta-3">
                  Última alteração: {fmt(atualizado.em)}{atualizado.por ? ` por ${atualizado.por}` : ''}
                </span>
              )}
            </div>

            {/* Teste de envio */}
            <Cartao
              titulo="Enviar um e-mail de teste"
              apoio="Valida a chave e o remetente. Funciona só depois do deploy das functions."
            >
              {avisoTeste && (
                <p className="mb-3 flex items-start gap-2 rounded-lg border border-[#cfe6b8] bg-[#f4faec] px-3 py-2 text-sm text-verde-escuro">
                  <CheckCircle2 size={16} className="mt-0.5 flex-none" aria-hidden /> {avisoTeste}
                </p>
              )}
              {erroTeste && (
                <p className="mb-3 flex items-start gap-2 rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-sm text-[#8a1f1f]">
                  <TriangleAlert size={16} className="mt-0.5 flex-none" aria-hidden /> {erroTeste}
                </p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Campo rotulo="E-mail de destino">
                    <input
                      value={emailTeste}
                      onChange={(e) => setEmailTeste(e.target.value)}
                      type="email"
                      className={ENTRADA}
                      placeholder="voce@soulan.com.br"
                      autoComplete="email"
                    />
                  </Campo>
                </div>
                <Botao type="button" variante="secundario" onClick={testar} disabled={testando}>
                  {testando ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Enviando…</> : <><Send size={15} aria-hidden /> Enviar teste</>}
                </Botao>
              </div>
            </Cartao>

            {/* Como funciona */}
            <Cartao titulo="Como funciona">
              <ul className="space-y-2 text-sm leading-6 text-tinta-2">
                <li className="flex gap-2"><Mail size={16} className="mt-0.5 flex-none text-marca" aria-hidden /> O e-mail segue os mesmos destinatários do sino: o colaborador do pedido, o gestor da área, o financeiro ou o master, conforme o aviso.</li>
                <li className="flex gap-2"><Mail size={16} className="mt-0.5 flex-none text-marca" aria-hidden /> Remetente: Gente e Cultura (genteecultura@soulanrh.com.br). A chave do SendGrid fica no cofre do Firebase, nunca no site.</li>
                <li className="flex gap-2"><Mail size={16} className="mt-0.5 flex-none text-marca" aria-hidden /> Desligar aqui para imediatamente, sem precisar de novo deploy.</li>
              </ul>
            </Cartao>
          </>
        )}
      </div>
    </>
  )
}

function fmt(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR')
}

// Traduz erros comuns da chamada da função (incluindo "ainda não publicada").
function traduzErroTeste(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const codigo = (e as { code?: string })?.code ?? ''
  if (codigo.includes('unauthenticated')) return 'Faça login novamente para enviar o teste.'
  if (codigo.includes('permission-denied')) return 'Apenas administradores podem enviar o teste.'
  if (codigo.includes('not-found') || codigo.includes('internal') || codigo.includes('unavailable') || /not-found|internal|unavailable|functions/i.test(msg)) {
    return 'A função de envio ainda não está no ar. Isso é esperado antes do deploy das Cloud Functions (plano Blaze). Depois do deploy, o teste funciona.'
  }
  return msg || 'Não consegui enviar o teste agora.'
}
