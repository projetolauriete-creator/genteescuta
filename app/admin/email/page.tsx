'use client'

import { useEffect, useState } from 'react'
import { Mail, Send, Power, Save, Loader2, Info, CheckCircle2, TriangleAlert, Receipt, Megaphone, HeartPulse } from 'lucide-react'
import { minhaConta, type Conta } from '@/lib/fb/usuarios'
import {
  getConfigEmail,
  salvarConfigEmail,
  enviarEmailTeste,
  CONFIG_EMAIL_PADRAO,
  type ConfigEmail,
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

// Campo de hora (0 a 23), mostrado como "10h".
function HoraInput({
  valor,
  aoMudar,
  desabilitado,
  rotuloAria,
}: {
  valor: number
  aoMudar: (v: number) => void
  desabilitado?: boolean
  rotuloAria: string
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={23}
        value={valor}
        disabled={desabilitado}
        aria-label={rotuloAria}
        onChange={(e) => {
          const n = Math.max(0, Math.min(23, Math.floor(Number(e.target.value) || 0)))
          aoMudar(n)
        }}
        className="w-16 rounded-lg border border-borda-forte bg-white px-2 py-1 text-sm text-tinta tabular focus:border-marca focus:outline-none disabled:opacity-40"
      />
      <span className="text-xs text-tinta-3">h</span>
    </span>
  )
}

export default function AdminEmail() {
  const [eu, setEu] = useState<Conta | null | undefined>(undefined)
  const [cfg, setCfg] = useState<ConfigEmail | null>(null)
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
        setCfg(c)
        setAtualizado({ em: c.atualizado_em, por: c.atualizado_por })
      })
      .catch(() => setCfg(CONFIG_EMAIL_PADRAO))
      .finally(() => setCarregando(false))
  }, [])

  const souSuper = !!eu?.ativo && eu?.nivel === 'super'
  const ativo = !!cfg?.ativo

  // Atualiza o rascunho de configuração de forma imutável.
  function patch(mut: (c: ConfigEmail) => void) {
    setCfg((c) => {
      if (!c) return c
      const n: ConfigEmail = JSON.parse(JSON.stringify(c))
      mut(n)
      return n
    })
  }

  async function salvar() {
    if (!cfg) return
    setSalvando(true); setErro(null); setAviso(null)
    try {
      await salvarConfigEmail(cfg)
      setAviso('Configuração salva.')
      const c = await getConfigEmail()
      setCfg(c)
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

  const fin = cfg?.reembolso.financeiro

  return (
    <>
      <CabecalhoPagina
        titulo="Disparo de e-mail"
        descricao="Central única das notificações por e-mail do portal. O que está aqui é o que acontece de verdade."
      />

      <div className="max-w-3xl space-y-4 p-4 sm:p-6">
        {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}
        {erro && <Aviso tom="erro">{erro}</Aviso>}

        {/* Pré-requisito técnico */}
        <Aviso tom="alerta" titulo="Antes de ligar: plano Blaze e deploy">
          O envio roda nas Cloud Functions, que exigem o plano <strong>Blaze</strong> no Firebase e o deploy das funções
          (<code className="rounded bg-white/60 px-1 text-[0.8em]">firebase deploy --only functions</code>), com a chave do
          SendGrid guardada no cofre. Enquanto isso não estiver pronto, pode deixar tudo configurado aqui: nada é enviado
          até o interruptor geral abaixo ser ligado.
        </Aviso>

        {carregando || !cfg ? (
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
                      ? 'Os itens ligados abaixo são enviados (quando as functions estiverem no ar). Desligar aqui para tudo de uma vez.'
                      : 'Nenhum e-mail é enviado, nem os resumos, nem o mural, nem o clima. Os avisos continuam só no sino do portal.'}
                  </p>
                </div>
                <Interruptor ligado={ativo} aoMudar={(v) => patch((c) => { c.ativo = v })} rotuloAria="Ativar o disparo de e-mail" />
              </div>
            </Cartao>

            {/* Grupo 1: Reembolso */}
            <Cartao titulo="Reembolso" apoio="Resumos agendados por papel (fuso de São Paulo) e os avisos ao colaborador.">
              <div className={`divide-y divide-borda ${ativo ? '' : 'opacity-60'}`}>
                {/* Gestor */}
                <div className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-tinta">Gestor Aprovador</p>
                    <p className="mt-0.5 text-xs leading-5 text-tinta-3">Resumo 1x por dia das pendências de aprovação da área dele. Sem pendência, não envia.</p>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <HoraInput valor={cfg.reembolso.gestor.hora} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.reembolso.gestor.hora = v })} rotuloAria="Horário do resumo do gestor" />
                    <Interruptor ligado={cfg.reembolso.gestor.on} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.reembolso.gestor.on = v })} rotuloAria="Resumo do gestor" />
                  </div>
                </div>

                {/* Master */}
                <div className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-tinta">Master Administrador</p>
                    <p className="mt-0.5 text-xs leading-5 text-tinta-3">Resumo 1x por dia com todas as pendências de todas as áreas. Sem pendência, não envia.</p>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <HoraInput valor={cfg.reembolso.master.hora} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.reembolso.master.hora = v })} rotuloAria="Horário do resumo do master" />
                    <Interruptor ligado={cfg.reembolso.master.on} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.reembolso.master.on = v })} rotuloAria="Resumo do master" />
                  </div>
                </div>

                {/* Financeiro */}
                <div className="flex items-start gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-tinta">Financeiro</p>
                    <p className="mt-0.5 text-xs leading-5 text-tinta-3">Resumo 2x por dia dos reembolsos aprovados aguardando pagamento. Sem nada a pagar, não envia.</p>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <HoraInput valor={fin!.horas[0] ?? 10} desabilitado={!ativo} aoMudar={(v) => patch((c) => { const h = [...c.reembolso.financeiro.horas]; h[0] = v; c.reembolso.financeiro.horas = h })} rotuloAria="Primeiro horário do financeiro" />
                      <HoraInput valor={fin!.horas[1] ?? 15} desabilitado={!ativo} aoMudar={(v) => patch((c) => { const h = [...c.reembolso.financeiro.horas]; h[1] = v; c.reembolso.financeiro.horas = h })} rotuloAria="Segundo horário do financeiro" />
                    </span>
                    <Interruptor ligado={cfg.reembolso.financeiro.on} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.reembolso.financeiro.on = v })} rotuloAria="Resumo do financeiro" />
                  </div>
                </div>

                {/* Colaborador */}
                <div className="py-3">
                  <p className="text-sm font-medium text-tinta">Colaborador</p>
                  <p className="mt-0.5 text-xs leading-5 text-tinta-3">E-mail ao colaborador do pedido, no evento final. Os avisos intermediários ficam só no sino.</p>
                  <div className="mt-2.5 space-y-2">
                    <div className="flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-tinta-2">Recusado (precisa de reajuste)</p>
                      </div>
                      <Interruptor ligado={cfg.reembolso.colaborador.recusado} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.reembolso.colaborador.recusado = v })} rotuloAria="Aviso de recusa ao colaborador" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-tinta-2">Pago (inclui pagamento agendado)</p>
                      </div>
                      <Interruptor ligado={cfg.reembolso.colaborador.pago} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.reembolso.colaborador.pago = v })} rotuloAria="Aviso de pagamento ao colaborador" />
                    </div>
                  </div>
                </div>
              </div>
            </Cartao>

            {/* Grupo 2: Mural */}
            <Cartao titulo="Mural">
              <div className={`flex items-start gap-4 ${ativo ? '' : 'opacity-60'}`}>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-marca-clara text-marca"><Megaphone size={17} aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-tinta">Aviso de nova publicação no mural</p>
                  <p className="mt-0.5 text-xs leading-5 text-tinta-3">Quando um aviso do Gente Informa é publicado, envia e-mail para todos os colaboradores ativos. Cada pessoa recebe o seu (ninguém vê o e-mail do outro).</p>
                </div>
                <Interruptor ligado={cfg.mural.on} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.mural.on = v })} rotuloAria="Aviso de mural" />
              </div>
            </Cartao>

            {/* Grupo 3: Pesquisa de Clima */}
            <Cartao titulo="Pesquisa de Clima">
              <div className={`flex items-start gap-4 ${ativo ? '' : 'opacity-60'}`}>
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-marca-clara text-marca"><HeartPulse size={17} aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-tinta">Aviso de nova pesquisa de clima</p>
                  <p className="mt-0.5 text-xs leading-5 text-tinta-3">Quando uma nova pesquisa de clima é aberta, envia e-mail aos colaboradores avisando. Cada pessoa recebe o seu.</p>
                </div>
                <Interruptor ligado={cfg.clima.on} desabilitado={!ativo} aoMudar={(v) => patch((c) => { c.clima.on = v })} rotuloAria="Aviso de pesquisa de clima" />
              </div>
            </Cartao>

            {!ativo && (
              <p className="flex items-center gap-1.5 text-xs text-tinta-3">
                <Info size={13} aria-hidden /> Ligue o interruptor geral para habilitar os itens acima.
              </p>
            )}

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

            {/* Resumo do fluxo */}
            <Cartao titulo="Quem recebe o quê e quando">
              <ul className="space-y-2 text-sm leading-6 text-tinta-2">
                <li className="flex gap-2"><Receipt size={16} className="mt-0.5 flex-none text-marca" aria-hidden /> Reembolso: o gestor e o master recebem um resumo 1x por dia; o financeiro, 2x por dia. Só quem tem pendência recebe. O colaborador recebe no evento final do pedido dele (recusa ou pagamento).</li>
                <li className="flex gap-2"><Megaphone size={16} className="mt-0.5 flex-none text-marca" aria-hidden /> Mural: todos os colaboradores ativos são avisados quando sai uma nova publicação do Gente Informa.</li>
                <li className="flex gap-2"><HeartPulse size={16} className="mt-0.5 flex-none text-marca" aria-hidden /> Clima: os colaboradores são avisados quando uma nova pesquisa de clima é aberta.</li>
                <li className="flex gap-2"><Mail size={16} className="mt-0.5 flex-none text-marca" aria-hidden /> Remetente: Gente e Cultura (genteecultura@soulanrh.com.br). O corpo não leva valores nem dados sensíveis, só o essencial e o link do portal. Em envios a vários, ninguém vê o e-mail do outro.</li>
              </ul>
            </Cartao>

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
