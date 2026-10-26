'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Mail, UserX, MapPin, Calendar, User, Building2, CheckCircle2, XCircle, MessageSquare, CheckCheck, RotateCcw } from 'lucide-react'
import { getManifestacao, triarManifestacao, responderPeloPortal, concluirManifestacao, reabrirManifestacao, marcarAnalise } from '@/lib/fb/admin'
import { usuarioAtual } from '@/lib/fb/auth'
import { CabecalhoPagina, Cartao, Chip, Aviso, Botao } from '@/components/ui'
import { LinhaDoTempo, StatusChip } from '@/components/StatusManifestacao'
import { FormMural } from '@/components/FormTratativa'
import { TIPO_MANIFESTACAO_LABEL, TRIAGEM_LABEL, type ManifestacaoTipo, type Triagem } from '@/lib/types'
import { fmtDataHora } from '@/lib/format'

function Detalhe() {
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const [m, setM] = useState<any>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'nao'>('carregando')

  function recarregar() {
    if (!id) return setEstado('nao')
    getManifestacao(id).then((d) => {
      if (!d) return setEstado('nao')
      setM(d); setEstado('ok')
      // Abrir = visualizar: marca como analisada (sai do badge) uma única vez.
      if ((d.analise ?? 'nao_analisada') !== 'analisada') {
        marcarAnalise(id, true, usuarioAtual()?.email ?? 'Equipe')
          .then(() => {
            setM((prev: any) => (prev ? { ...prev, analise: 'analisada' } : prev))
            window.dispatchEvent(new CustomEvent('manifestacoes:mudou'))
          })
          .catch(() => {})
      }
    }).catch(() => setEstado('nao'))
  }
  useEffect(recarregar, [id])

  if (estado === 'carregando') return <div className="p-6 text-sm text-tinta-3">Carregando…</div>
  if (estado === 'nao' || !m) {
    return (
      <>
        <CabecalhoPagina titulo="Manifestação não encontrada" voltar={{ href: '/admin/canal', rotulo: 'Voltar ao canal' }} />
      </>
    )
  }

  const historico = (m.updates ?? []).filter((u: any) => u.visivel_ao_colaborador !== false)

  return (
    <>
      <CabecalhoPagina
        titulo={m.titulo}
        voltar={{ href: '/admin/canal', rotulo: 'Voltar ao canal' }}
        descricao={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={m.status} />
            <Chip faixa={m.triagem === 'aprovada' ? 'baixo' : m.triagem === 'reprovada' ? 'critico' : 'moderado'}>Triagem: {TRIAGEM_LABEL[(m.triagem ?? 'pendente') as Triagem]}</Chip>
            <Chip faixa="neutro">{TIPO_MANIFESTACAO_LABEL[m.tipo as ManifestacaoTipo] ?? m.tipo}</Chip>
            <Chip faixa="marca">{m.categoria ?? m.area}</Chip>
            {m.anonima && <Chip faixa="neutro">Envio anônimo</Chip>}
          </span>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Cartao titulo="O que foi enviado">
            {m.problema || m.sugestao ? (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-tinta-3">Problema ou oportunidade</p>
                  <p className="mt-1 whitespace-pre-line leading-6 text-tinta-2">{m.problema || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-tinta-3">Sugestão de melhoria</p>
                  <p className="mt-1 whitespace-pre-line leading-6 text-tinta-2">{m.sugestao || '-'}</p>
                </div>
                {Array.isArray(m.impactos) && m.impactos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-tinta-3">Impacto principal esperado</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.impactos.map((imp: string) => (
                        <Chip key={imp} faixa="neutro">{imp === 'Outro' && m.impacto_outro ? `Outro: ${m.impacto_outro}` : imp}</Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="whitespace-pre-line text-sm leading-6 text-tinta-2">{m.descricao}</p>
            )}
          </Cartao>

          <AndamentoStatus m={m} aoSalvar={recarregar} />
          <PainelTriagem m={m} aoSalvar={recarregar} />
          <ResponderParticular m={m} aoSalvar={recarregar} />

          {m.anonima && (
            <Aviso tom="alerta" titulo="Manifestação anônima">
              Nome e setor não foram gravados. A área <strong>{m.categoria ?? m.area}</strong> ficou registrada: use ela para direcionar. Não há como responder a pessoa diretamente.
            </Aviso>
          )}

          {m.tipo === 'reconhecimento' && <FormMural m={m} aoSalvar={recarregar} />}
        </div>

        <div className="space-y-4">
          <Cartao titulo="Quem enviou">
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                {m.anonima ? <UserX size={15} className="mt-0.5 flex-none text-tinta-3" aria-hidden /> : <User size={15} className="mt-0.5 flex-none text-tinta-3" aria-hidden />}
                <div className="min-w-0"><dt className="text-xs text-tinta-3">Nome</dt><dd className="font-medium text-tinta">{m.anonima ? 'Não identificado' : (m.nome ?? '-')}</dd></div>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail size={15} className="mt-0.5 flex-none text-tinta-3" aria-hidden />
                <div className="min-w-0"><dt className="text-xs text-tinta-3">E-mail</dt><dd className="break-all font-medium text-tinta">{m.anonima ? 'Não gravado' : (m.email ?? '-')}</dd></div>
              </div>
              {!m.anonima && m.departamento && (
                <div className="flex items-start gap-2.5">
                  <Building2 size={15} className="mt-0.5 flex-none text-tinta-3" aria-hidden />
                  <div><dt className="text-xs text-tinta-3">Departamento / setor</dt><dd className="font-medium text-tinta">{m.departamento}</dd></div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <MapPin size={15} className="mt-0.5 flex-none text-tinta-3" aria-hidden />
                <div><dt className="text-xs text-tinta-3">Área da sugestão</dt><dd className="font-medium text-tinta">{m.categoria ?? m.area}</dd></div>
              </div>
              <div className="flex items-start gap-2.5">
                <Calendar size={15} className="mt-0.5 flex-none text-tinta-3" aria-hidden />
                <div><dt className="text-xs text-tinta-3">Recebida em</dt><dd className="font-medium text-tinta">{fmtDataHora(m.criado_em)}</dd></div>
              </div>
              {m.responsavel && (
                <div className="border-t border-borda pt-3"><dt className="text-xs text-tinta-3">Responsável</dt><dd className="font-medium text-tinta">{m.responsavel}</dd></div>
              )}
            </dl>
          </Cartao>

          <Cartao titulo="Histórico"><LinhaDoTempo eventos={historico} /></Cartao>
        </div>
      </div>
    </>
  )
}

function PainelTriagem({ m, aoSalvar }: { m: any; aoSalvar: () => void }) {
  const triagem: Triagem = (m.triagem ?? 'pendente') as Triagem
  const [modo, setModo] = useState<'idle' | 'reprovar'>('idle')
  const [resposta, setResposta] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function agir(acao: 'aprovada' | 'reprovada') {
    setErro(null); setBusy(true)
    try {
      const autor = usuarioAtual()?.email ?? 'Equipe'
      await triarManifestacao(m.id, { triagem: acao, resposta_privada: acao === 'reprovada' ? resposta : undefined, autor })
      setModo('idle'); setResposta('')
      aoSalvar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.')
    }
    setBusy(false)
  }

  return (
    <Cartao titulo="Triagem" apoio="Aprove ou reprove esta manifestação. Ao reprovar, registre uma resposta particular ao autor.">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-tinta-2">Situação atual:</span>
          <Chip faixa={triagem === 'aprovada' ? 'baixo' : triagem === 'reprovada' ? 'critico' : 'moderado'}>{TRIAGEM_LABEL[triagem]}</Chip>
          {m.triado_por && <span className="text-xs text-tinta-3">por {m.triado_por}</span>}
        </div>

        {m.triagem === 'reprovada' && m.resposta_privada && (
          <div className="rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-sm text-[#8a1f1f]">
            <p className="text-xs font-semibold">Resposta registrada ao autor</p>
            <p className="mt-0.5 whitespace-pre-line leading-5">{m.resposta_privada}</p>
          </div>
        )}

        {erro && <p className="text-xs font-medium text-critico">{erro}</p>}

        {modo === 'reprovar' ? (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-tinta">Resposta particular ao autor <span className="text-critico">*</span></label>
            <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} className={`block w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca`} placeholder="Explique o motivo e o que pode ser ajustado…" />
            <p className="text-xs text-tinta-3">Fica guardada no histórico. O envio por e-mail ainda não está ligado: contate a pessoa pelo canal disponível.</p>
            <div className="flex gap-2">
              <Botao type="button" onClick={() => agir('reprovada')} disabled={busy || resposta.trim().length < 5}>
                <XCircle size={15} aria-hidden /> {busy ? 'Salvando…' : 'Confirmar reprovação'}
              </Botao>
              <Botao type="button" variante="secundario" onClick={() => { setModo('idle'); setErro(null) }}>Cancelar</Botao>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Botao type="button" onClick={() => agir('aprovada')} disabled={busy || triagem === 'aprovada'}>
              <CheckCircle2 size={15} aria-hidden /> {triagem === 'aprovada' ? 'Aprovada' : 'Aprovar'}
            </Botao>
            <Botao type="button" variante="secundario" onClick={() => setModo('reprovar')} disabled={busy}>
              <XCircle size={15} aria-hidden /> Reprovar…
            </Botao>
          </div>
        )}
      </div>
    </Cartao>
  )
}

// Andamento: status do assunto, com concluir/reabrir manual.
function AndamentoStatus({ m, aoSalvar }: { m: any; aoSalvar: () => void }) {
  const [busy, setBusy] = useState(false)
  const concluida = m.status === 'concluida'
  async function agir(fn: () => Promise<unknown>) {
    setBusy(true)
    try { await fn(); aoSalvar() } catch { /* silencioso */ }
    setBusy(false)
  }
  return (
    <Cartao titulo="Andamento" apoio="O status reflete a resposta: Recebida, Respondida e Concluída.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-tinta-2">Status atual:</span>
          <StatusChip status={m.status ?? 'recebida'} />
        </div>
        {concluida ? (
          <Botao type="button" variante="secundario" onClick={() => agir(() => reabrirManifestacao(m.id, usuarioAtual()?.email ?? 'Equipe'))} disabled={busy}>
            <RotateCcw size={15} aria-hidden /> Reabrir
          </Botao>
        ) : (
          <Botao type="button" onClick={() => agir(() => concluirManifestacao(m.id, usuarioAtual()?.email ?? 'Equipe'))} disabled={busy}>
            <CheckCheck size={15} aria-hidden /> Marcar como concluída
          </Botao>
        )}
      </div>
    </Cartao>
  )
}

// Responder particular: mensagem interna direta ao autor (aparece no portal).
function ResponderParticular({ m, aoSalvar }: { m: any; aoSalvar: () => void }) {
  const [texto, setTexto] = useState('')
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const anonima = !!m.anonima || !m.autor_uid

  async function enviar() {
    setErro(null); setBusy(true)
    try {
      await responderPeloPortal(m.id, texto, usuarioAtual()?.email ?? 'Equipe')
      setTexto(''); setOk(true); aoSalvar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar a resposta.')
    }
    setBusy(false)
  }

  return (
    <Cartao titulo="Responder particular" apoio="Mensagem interna direto para quem enviou. Aparece no portal da pessoa (Minhas manifestações) e fica no histórico. Não publica no mural.">
      {anonima ? (
        <Aviso tom="alerta" titulo="Sem destinatário">
          Esta manifestação é anônima: não há para quem responder. Dê o retorno pelo mural, quando aplicável.
        </Aviso>
      ) : (
        <div className="space-y-2">
          {ok && (
            <p className="rounded-lg border border-[#cfe6b8] bg-[#f4faec] px-3 py-2 text-sm text-verde-escuro">
              Resposta enviada. {m.nome ?? 'A pessoa'} vê no portal, em "Minhas manifestações".
            </p>
          )}
          {erro && <p className="text-xs font-medium text-critico">{erro}</p>}
          <textarea
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setOk(false) }}
            rows={3}
            placeholder="Escreva a resposta para quem enviou…"
            className="block w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-tinta-3">Fica registrada no histórico.</p>
            <Botao type="button" onClick={enviar} disabled={busy || texto.trim().length < 3}>
              <MessageSquare size={15} aria-hidden /> {busy ? 'Enviando…' : 'Enviar resposta'}
            </Botao>
          </div>
        </div>
      )}
    </Cartao>
  )
}

export default function DetalheManifestacao() {
  return <Suspense fallback={null}><Detalhe /></Suspense>
}
