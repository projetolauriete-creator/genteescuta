'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Save, Loader2, ExternalLink, FileText, Table, Video, Link2 } from 'lucide-react'
import { CENTROS_CUSTO } from '@/lib/reembolso'
import {
  listarTodosDocumentos,
  criarDocumento,
  atualizarDocumento,
  excluirDocumento,
  trocarOrdemDocumentos,
  TIPOS_DOC,
  TIPO_DOC_LABEL,
  type AreaDocumento,
  type TipoDoc,
} from '@/lib/fb/documentos'
import { CabecalhoPagina, Cartao, Campo, ENTRADA, Botao, Aviso } from '@/components/ui'

type Rascunho = { id?: string; area: string; titulo: string; tipo: TipoDoc; url: string }

function IconeTipo({ tipo }: { tipo: TipoDoc }) {
  if (tipo === 'pdf') return <FileText size={16} aria-hidden />
  if (tipo === 'planilha') return <Table size={16} aria-hidden />
  if (tipo === 'video') return <Video size={16} aria-hidden />
  return <Link2 size={16} aria-hidden />
}

export default function AdminDocumentos() {
  const [area, setArea] = useState<string>(CENTROS_CUSTO[0])
  const [docs, setDocs] = useState<AreaDocumento[] | null>(null)
  const [editando, setEditando] = useState<Rascunho | null>(null)
  const [pendente, setPendente] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function recarregar() {
    listarTodosDocumentos().then(setDocs).catch(() => setDocs([]))
  }
  useEffect(recarregar, [])

  const daArea = useMemo(
    () => (docs ?? []).filter((d) => d.area === area).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [docs, area],
  )

  async function acao(fn: () => Promise<unknown>, msg?: string) {
    setErro(null); setAviso(null)
    try { await fn(); if (msg) setAviso(msg); recarregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui concluir.') }
  }

  async function salvar() {
    if (!editando) return
    setPendente(true); setErro(null); setAviso(null)
    try {
      if (editando.id) {
        await atualizarDocumento(editando.id, editando)
        setAviso('Documento atualizado.')
      } else {
        await criarDocumento(editando)
        setAviso('Documento adicionado.')
      }
      setEditando(null)
      recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.')
    } finally {
      setPendente(false)
    }
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Sala de documentos por área"
        descricao="Monte, por área, os materiais que cada colaborador vê. Cada pessoa enxerga apenas os documentos da própria área."
        voltar={{ href: '/admin/treinamento', rotulo: 'Central de Conhecimento' }}
        acoes={
          <Botao type="button" onClick={() => { setEditando({ area, titulo: '', tipo: 'link', url: '' }); setAviso(null); setErro(null) }}>
            <Plus size={15} aria-hidden /> Novo documento
          </Botao>
        }
      />

      <div className="max-w-4xl space-y-4 p-4 sm:p-6">
        {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}
        {erro && <Aviso tom="erro">{erro}</Aviso>}

        <Aviso tom="alerta" titulo="Materiais do Google Drive">
          Ao usar um link do Google Drive, confira se o arquivo está compartilhado com toda a Soulan. Se não estiver, o
          colaborador verá uma tela de pedir acesso ao abrir.
        </Aviso>

        {/* Seletor de área */}
        <Cartao titulo="Área (centro de custo)" apoio="Escolha a área para montar a lista de documentos dela.">
          <select value={area} onChange={(e) => { setArea(e.target.value); setEditando(null) }} className={ENTRADA}>
            {CENTROS_CUSTO.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Cartao>

        {/* Formulário de adicionar/editar */}
        {editando && (
          <Cartao titulo={editando.id ? 'Editar documento' : 'Novo documento'}>
            <div className="space-y-4">
              <Campo rotulo="Área">
                <select value={editando.area} onChange={(e) => setEditando({ ...editando, area: e.target.value })} className={ENTRADA}>
                  {CENTROS_CUSTO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Título">
                <input value={editando.titulo} onChange={(e) => setEditando({ ...editando, titulo: e.target.value })} className={ENTRADA} placeholder="Ex.: Manual de integração" />
              </Campo>
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <Campo rotulo="Tipo">
                  <select value={editando.tipo} onChange={(e) => setEditando({ ...editando, tipo: e.target.value as TipoDoc })} className={ENTRADA}>
                    {TIPOS_DOC.map((t) => (
                      <option key={t} value={t}>{TIPO_DOC_LABEL[t]}</option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Link" ajuda="Cole o link do Google Drive, do material ou do vídeo. Abre em uma nova aba.">
                  <input value={editando.url} onChange={(e) => setEditando({ ...editando, url: e.target.value })} className={ENTRADA} placeholder="https://…" />
                </Campo>
              </div>
              <div className="flex justify-end gap-2">
                <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
                <Botao type="button" onClick={salvar} disabled={pendente}>
                  {pendente ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Salvando…</> : <><Save size={15} aria-hidden /> Salvar</>}
                </Botao>
              </div>
            </div>
          </Cartao>
        )}

        {/* Lista de documentos da área */}
        <Cartao titulo={`Documentos de ${area}`} apoio={docs === null ? undefined : `${daArea.length} ${daArea.length === 1 ? 'documento' : 'documentos'}`}>
          {docs === null ? (
            <p className="text-sm text-tinta-3">Carregando…</p>
          ) : daArea.length === 0 ? (
            <p className="text-sm text-tinta-3">Nenhum documento nesta área ainda. Use “Novo documento” para começar.</p>
          ) : (
            <div className="space-y-2">
              {daArea.map((d, i) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-borda bg-white p-3">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-superficie-2 text-tinta-2">
                    <IconeTipo tipo={d.tipo} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-tinta">{d.titulo}</p>
                    <p className="truncate text-xs text-tinta-3">{TIPO_DOC_LABEL[d.tipo]} · {d.url}</p>
                  </div>
                  <div className="flex flex-none gap-0.5">
                    <IconBtn title="Abrir" onClick={() => window.open(d.url, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /></IconBtn>
                    <IconBtn title="Subir" disabled={i === 0} onClick={() => acao(() => trocarOrdemDocumentos(daArea[i], daArea[i - 1]))}><ArrowUp size={16} /></IconBtn>
                    <IconBtn title="Descer" disabled={i === daArea.length - 1} onClick={() => acao(() => trocarOrdemDocumentos(daArea[i], daArea[i + 1]))}><ArrowDown size={16} /></IconBtn>
                    <IconBtn title="Editar" onClick={() => { setEditando({ id: d.id, area: d.area, titulo: d.titulo, tipo: d.tipo, url: d.url }); setAviso(null); setErro(null) }}><Pencil size={16} /></IconBtn>
                    <IconBtn title="Remover" perigo onClick={() => { if (confirm(`Remover o documento "${d.titulo}"?`)) acao(() => excluirDocumento(d.id), 'Documento removido.') }}><Trash2 size={16} /></IconBtn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Cartao>
      </div>
    </>
  )
}

function IconBtn({ children, title, onClick, disabled, perigo }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; perigo?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={`rounded p-1.5 text-tinta-3 disabled:opacity-30 ${perigo ? 'hover:bg-plano hover:text-critico' : 'hover:bg-superficie-2 hover:text-marca'}`}>{children}</button>
  )
}
