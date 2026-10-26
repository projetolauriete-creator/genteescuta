'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import { UserX, CheckCircle2, XCircle, MessageSquare, Trash2, Check, X as XIcon, Loader2, CircleCheck, Circle, CheckCheck, RotateCcw } from 'lucide-react'
import {
  listarManifestacoes, marcarAnalise, responderPeloPortal, excluirManifestacao,
  aprovarReconhecimentoNaLista, reprovarReconhecimentoNaLista,
  concluirManifestacao, reabrirManifestacao,
} from '@/lib/fb/admin'
import { usuarioAtual } from '@/lib/fb/auth'
import { CabecalhoPagina, Cartao, Chip, Scorecard, Vazio, Botao } from '@/components/ui'
import { BarraFiltros } from '@/components/BarraFiltros'
import { StatusChip } from '@/components/StatusManifestacao'
import {
  TIPO_MANIFESTACAO_LABEL,
  TRIAGEM_LABEL,
  ANALISE_LABEL,
  AREAS_SUGESTAO,
  STATUS_FLUXO,
  STATUS_MANIFESTACAO_LABEL,
  type ManifestacaoTipo,
  type Triagem,
  type AnaliseStatus,
} from '@/lib/types'
import { fmtRelativo } from '@/lib/format'

const TIPOS: ManifestacaoTipo[] = ['contribuicao', 'reconhecimento']
const ANALISES: AnaliseStatus[] = ['nao_analisada', 'analisada']
const APROVACOES: Triagem[] = ['aprovada', 'reprovada']

const semAcento = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const analiseDe = (m: any): AnaliseStatus => (m.analise === 'analisada' ? 'analisada' : 'nao_analisada')

export default function CanalAdmin() {
  const [todas, setTodas] = useState<any[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fCategoria, setFCategoria] = useState('')
  const [fAnalise, setFAnalise] = useState('')
  const [fAprovacao, setFAprovacao] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [acaoBusy, setAcaoBusy] = useState('')         // id em ação
  const [respondendo, setRespondendo] = useState<any | null>(null) // manifestação sendo respondida
  const [erroAcao, setErroAcao] = useState<string | null>(null)

  function recarregar() {
    return listarManifestacoes().then(setTodas).catch(() => {})
  }
  useEffect(() => {
    recarregar().finally(() => setCarregando(false))
  }, [])

  function autorAtual() { return usuarioAtual()?.email ?? 'Equipe' }

  async function rodar(id: string, fn: () => Promise<unknown>) {
    setErroAcao(null); setAcaoBusy(id)
    try {
      await fn()
      await recarregar()
      // Avisa o menu para recalcular o badge (não analisadas).
      window.dispatchEvent(new CustomEvent('manifestacoes:mudou'))
    }
    catch (e) { setErroAcao(e instanceof Error ? e.message : 'Não consegui concluir a ação.') }
    setAcaoBusy('')
  }

  const alternarAnalise = (m: any) => rodar(m.id, () => marcarAnalise(m.id, analiseDe(m) !== 'analisada', autorAtual()))
  const concluir = (m: any) => rodar(m.id, () => concluirManifestacao(m.id, autorAtual()))
  const reabrir = (m: any) => rodar(m.id, () => reabrirManifestacao(m.id, autorAtual()))
  const aprovar = (m: any) => rodar(m.id, () => aprovarReconhecimentoNaLista(m, autorAtual()))
  const reprovar = (m: any) => {
    if (!confirm('Reprovar este reconhecimento? Ele não será publicado no mural.')) return
    rodar(m.id, () => reprovarReconhecimentoNaLista(m.id, autorAtual()))
  }
  const excluir = (m: any) => {
    if (!confirm('Excluir esta manifestação? Esta ação não pode ser desfeita.')) return
    rodar(m.id, () => excluirManifestacao(m.id))
  }
  async function enviarResposta(texto: string) {
    if (!respondendo) return
    await rodar(respondendo.id, () => responderPeloPortal(respondendo.id, texto, autorAtual()))
    setRespondendo(null)
  }

  const termo = semAcento(busca.trim())
  const filtradas = useMemo(
    () => todas.filter((m) => {
      if (fTipo && m.tipo !== fTipo) return false
      if (fCategoria && (m.categoria ?? m.area) !== fCategoria) return false
      if (fAnalise && analiseDe(m) !== fAnalise) return false
      if (fAprovacao && m.triagem !== fAprovacao) return false
      if (fStatus && (m.status ?? 'recebida') !== fStatus) return false
      if (termo) {
        const alvo = semAcento([m.titulo, m.nome, m.descricao, m.problema, m.sugestao, m.categoria, m.area, m.departamento, m.centro_custo].join(' '))
        if (!alvo.includes(termo)) return false
      }
      return true
    }),
    [todas, fTipo, fCategoria, fAnalise, fAprovacao, fStatus, termo],
  )

  const naoAnalisadas = todas.filter((m) => analiseDe(m) !== 'analisada').length
  const aprovadas = todas.filter((m) => m.triagem === 'aprovada').length
  const recebidas = todas.filter((m) => m.status === 'recebida').length
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const noMes = todas.filter((m) => (m.criado_em ?? '') >= inicioMes).length

  return (
    <>
      <CabecalhoPagina titulo="Canal Gente Cultura" descricao="Tudo o que chegou pelo canal permanente. Marque como analisada ao tratar e responda pelo portal." />

      <div className="space-y-4 p-4 sm:p-6">
        {erroAcao && (
          <p className="rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-4 py-3 text-sm text-[#8a1f1f]">{erroAcao}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Scorecard rotulo="Total recebido" valor={todas.length} apoio={`${noMes} neste mês`} />
          <Scorecard rotulo="Não analisadas" valor={naoAnalisadas} destaque={naoAnalisadas > 0 ? <Chip faixa="alto">Requer ação</Chip> : undefined} />
          <Scorecard rotulo="Aprovadas" valor={aprovadas} />
          <Scorecard rotulo="Aguardando 1ª análise" valor={recebidas} />
        </div>

        <BarraFiltros
          busca={busca}
          onBusca={setBusca}
          buscaPlaceholder="Buscar por assunto, nome, setor ou texto…"
          grupos={[
            { rotulo: 'Status', valor: fStatus, onChange: setFStatus, opcoes: STATUS_FLUXO.map((s) => ({ valor: s, rotulo: STATUS_MANIFESTACAO_LABEL[s] })) },
            { rotulo: 'Triagem', valor: fAnalise, onChange: setFAnalise, opcoes: ANALISES.map((a) => ({ valor: a, rotulo: ANALISE_LABEL[a] })) },
            { rotulo: 'Aprovação', valor: fAprovacao, onChange: setFAprovacao, opcoes: APROVACOES.map((t) => ({ valor: t, rotulo: TRIAGEM_LABEL[t] })) },
            { rotulo: 'Tipo', valor: fTipo, onChange: setFTipo, opcoes: TIPOS.map((t) => ({ valor: t, rotulo: TIPO_MANIFESTACAO_LABEL[t] })) },
            { rotulo: 'Área da sugestão', valor: fCategoria, onChange: setFCategoria, opcoes: AREAS_SUGESTAO.map((a) => ({ valor: a, rotulo: a })) },
          ]}
        />

        <Cartao titulo={`${filtradas.length} ${filtradas.length === 1 ? 'manifestação' : 'manifestações'}`} padding={false}>
          {carregando ? (
            <div className="p-6 text-sm text-tinta-3">Carregando…</div>
          ) : filtradas.length === 0 ? (
            <div className="p-4"><Vazio titulo="Nada por aqui" descricao="Nenhuma manifestação corresponde aos filtros." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[60rem] text-sm">
                <thead>
                  <tr className="border-b border-borda text-left text-xs font-semibold text-tinta-3">
                    <th className="px-4 py-2.5 font-semibold">Quem enviou</th>
                    <th className="px-4 py-2.5 font-semibold">Assunto</th>
                    <th className="px-4 py-2.5 font-semibold">Tipo</th>
                    <th className="px-4 py-2.5 font-semibold">Área / categoria</th>
                    <th className="px-4 py-2.5 font-semibold">Triagem</th>
                    <th className="px-4 py-2.5 font-semibold">Ações</th>
                    <th className="px-4 py-2.5 font-semibold">Status</th>
                    <th className="px-4 py-2.5 font-semibold">Recebida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borda">
                  {filtradas.map((m) => {
                    const analisada = analiseDe(m) === 'analisada'
                    const ehReconhecimento = m.tipo === 'reconhecimento'
                    const busy = acaoBusy === m.id
                    return (
                      <tr key={m.id} className="hover:bg-superficie-2">
                        <td className="px-4 py-2.5">
                          {m.anonima ? (
                            <span className="inline-flex items-center gap-1.5 text-tinta-3"><UserX size={13} aria-hidden /> Anônimo</span>
                          ) : (
                            <span className="block max-w-[11rem] truncate font-medium text-tinta">{m.nome ?? '-'}</span>
                          )}
                        </td>
                        <td className="max-w-[20rem] px-4 py-2.5">
                          <Link href={`/admin/canal/ver?id=${m.id}`} className="block truncate font-medium text-tinta hover:text-marca">{m.titulo}</Link>
                        </td>
                        <td className="px-4 py-2.5 text-tinta-2">{TIPO_MANIFESTACAO_LABEL[m.tipo as ManifestacaoTipo] ?? m.tipo}</td>
                        <td className="max-w-[14rem] px-4 py-2.5 text-tinta-2"><span className="block truncate">{m.categoria ?? m.area ?? '-'}</span></td>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => alternarAnalise(m)}
                            title={analisada ? 'Marcar como não analisada' : 'Marcar como analisada'}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${analisada ? 'bg-[#eef7e3] text-verde-escuro hover:bg-[#e3f1d2]' : 'bg-superficie-2 text-tinta-2 hover:bg-plano'}`}
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : analisada ? <CircleCheck size={13} aria-hidden /> : <Circle size={13} aria-hidden />}
                            {ANALISE_LABEL[analiseDe(m)]}
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {ehReconhecimento && (
                              <>
                                <BtnAcao title={m.triagem === 'aprovada' ? 'Aprovada (publicada no mural)' : 'Aprovar e publicar no mural'} tom="ok" disabled={busy || m.triagem === 'aprovada'} onClick={() => aprovar(m)}>
                                  <CheckCircle2 size={15} aria-hidden />
                                </BtnAcao>
                                <BtnAcao title={m.triagem === 'reprovada' ? 'Reprovada (não publicada)' : 'Reprovar (não publicar)'} tom="perigo" disabled={busy || m.triagem === 'reprovada'} onClick={() => reprovar(m)}>
                                  <XCircle size={15} aria-hidden />
                                </BtnAcao>
                              </>
                            )}
                            <BtnAcao
                              title={m.anonima ? 'Anônima: não há para quem responder' : 'Responder pelo portal'}
                              tom="neutro"
                              disabled={busy || m.anonima}
                              onClick={() => { setErroAcao(null); setRespondendo(m) }}
                            >
                              <MessageSquare size={15} aria-hidden />
                            </BtnAcao>
                            {m.status === 'concluida' ? (
                              <BtnAcao title="Reabrir o assunto" tom="neutro" disabled={busy} onClick={() => reabrir(m)}>
                                <RotateCcw size={15} aria-hidden />
                              </BtnAcao>
                            ) : (
                              <BtnAcao title="Marcar como concluída (encerrar)" tom="ok" disabled={busy} onClick={() => concluir(m)}>
                                <CheckCheck size={15} aria-hidden />
                              </BtnAcao>
                            )}
                            <BtnAcao title="Excluir" tom="perigo" disabled={busy} onClick={() => excluir(m)}>
                              <Trash2 size={15} aria-hidden />
                            </BtnAcao>
                          </div>
                        </td>
                        <td className="px-4 py-2.5"><StatusChip status={m.status} /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-tinta-3">{fmtRelativo(m.criado_em)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      </div>

      {respondendo && (
        <ModalResponder
          m={respondendo}
          busy={acaoBusy === respondendo.id}
          onEnviar={enviarResposta}
          onFechar={() => setRespondendo(null)}
        />
      )}
    </>
  )
}

function BtnAcao({ children, title, onClick, disabled, tom }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; tom: 'ok' | 'perigo' | 'neutro' }) {
  const cor = tom === 'ok'
    ? 'border-[#cfe6b8] text-verde-escuro hover:bg-[#f4faec]'
    : tom === 'perigo'
      ? 'border-[#f0c2c2] text-critico hover:bg-[#fdeaea]'
      : 'border-borda-forte text-tinta-2 hover:border-marca hover:text-marca-texto'
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg border bg-white p-1.5 transition-colors disabled:opacity-40 ${cor}`}>
      {children}
    </button>
  )
}

function ModalResponder({ m, busy, onEnviar, onFechar }: { m: any; busy: boolean; onEnviar: (texto: string) => void; onFechar: () => void }) {
  const [texto, setTexto] = useState('')
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onFechar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-tinta">Responder pelo portal</h3>
            <p className="mt-0.5 text-xs text-tinta-3">{m.nome ?? 'O colaborador'} vê a resposta em "Minhas manifestações", e fica registrada no histórico.</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-tinta-3 hover:bg-superficie-2" aria-label="Fechar"><XIcon size={18} aria-hidden /></button>
        </div>
        <p className="mt-3 truncate rounded-lg bg-superficie-2 px-3 py-2 text-sm text-tinta-2" title={m.titulo}>{m.titulo}</p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Escreva a resposta para quem enviou…"
          className="mt-3 block w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm text-tinta focus:border-marca focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-marca"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={onFechar} disabled={busy}>Cancelar</Botao>
          <Botao type="button" onClick={() => onEnviar(texto)} disabled={busy || texto.trim().length < 3}>
            {busy ? 'Enviando…' : <><Check size={15} aria-hidden /> Enviar resposta</>}
          </Botao>
        </div>
      </div>
    </div>
  )
}
