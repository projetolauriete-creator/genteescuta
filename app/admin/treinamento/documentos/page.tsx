'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  ExternalLink,
  FileText,
  Table,
  Video,
  Link2,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import { CENTROS_CUSTO } from '@/lib/reembolso'
import {
  listarTodosModulos,
  listarTodosDocumentos,
  criarModulo,
  atualizarModulo,
  excluirModulo,
  trocarOrdemModulos,
  criarDocumento,
  atualizarDocumento,
  excluirDocumento,
  trocarOrdemDocumentos,
  TIPOS_DOC,
  TIPO_DOC_LABEL,
  type AreaModulo,
  type AreaDocumento,
  type TipoDoc,
} from '@/lib/fb/documentos'
import { CabecalhoPagina, Cartao, Campo, ENTRADA, Botao, Aviso } from '@/components/ui'

type RascModulo = { id?: string; area: string; titulo: string }
type RascDoc = { id?: string; area: string; modulo_id: string; titulo: string; tipo: TipoDoc; url: string; descricao: string }

function IconeTipo({ tipo }: { tipo: TipoDoc }) {
  if (tipo === 'pdf') return <FileText size={16} aria-hidden />
  if (tipo === 'planilha') return <Table size={16} aria-hidden />
  if (tipo === 'video') return <Video size={16} aria-hidden />
  return <Link2 size={16} aria-hidden />
}

export default function AdminDocumentos() {
  const [area, setArea] = useState<string>(CENTROS_CUSTO[0])
  const [modulos, setModulos] = useState<AreaModulo[] | null>(null)
  const [docs, setDocs] = useState<AreaDocumento[] | null>(null)
  const [editModulo, setEditModulo] = useState<RascModulo | null>(null)
  const [editDoc, setEditDoc] = useState<RascDoc | null>(null)
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [pendente, setPendente] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function recarregar() {
    listarTodosModulos().then(setModulos).catch(() => setModulos([]))
    listarTodosDocumentos().then(setDocs).catch(() => setDocs([]))
  }
  useEffect(recarregar, [])

  const modulosArea = useMemo(
    () => (modulos ?? []).filter((m) => m.area === area).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    [modulos, area],
  )

  const docsPorModulo = useMemo(() => {
    const mapa = new Map<string, AreaDocumento[]>()
    for (const d of docs ?? []) {
      if (d.area !== area) continue
      const lista = mapa.get(d.modulo_id) ?? []
      lista.push(d)
      mapa.set(d.modulo_id, lista)
    }
    for (const lista of mapa.values()) lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    return mapa
  }, [docs, area])

  // Documentos da área sem um módulo válido (dados antigos). Ficam num balde
  // "Sem módulo" para o admin reaproveitar, em vez de sumirem.
  const orfaos = useMemo(() => {
    const ids = new Set(modulosArea.map((m) => m.id))
    return (docs ?? [])
      .filter((d) => d.area === area && !ids.has(d.modulo_id))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  }, [docs, area, modulosArea])

  function alternar(id: string) {
    setAbertos((atual) => {
      const nova = new Set(atual)
      if (nova.has(id)) nova.delete(id)
      else nova.add(id)
      return nova
    })
  }

  async function acao(fn: () => Promise<unknown>, msg?: string) {
    setErro(null); setAviso(null)
    try { await fn(); if (msg) setAviso(msg); recarregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui concluir.') }
  }

  async function salvarModulo() {
    if (!editModulo) return
    setPendente(true); setErro(null); setAviso(null)
    try {
      if (editModulo.id) {
        await atualizarModulo(editModulo.id, editModulo)
        setAviso('Módulo atualizado.')
      } else {
        const id = await criarModulo(editModulo)
        setAbertos((atual) => new Set(atual).add(id))
        setAviso('Módulo criado.')
      }
      setEditModulo(null)
      recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar o módulo.')
    } finally {
      setPendente(false)
    }
  }

  async function salvarDoc() {
    if (!editDoc) return
    setPendente(true); setErro(null); setAviso(null)
    try {
      if (editDoc.id) {
        await atualizarDocumento(editDoc.id, editDoc)
        setAviso('Documento atualizado.')
      } else {
        await criarDocumento(editDoc)
        setAviso('Documento adicionado.')
      }
      setEditDoc(null)
      recarregar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar o documento.')
    } finally {
      setPendente(false)
    }
  }

  const carregando = modulos === null || docs === null

  return (
    <>
      <CabecalhoPagina
        titulo="Sala de documentos por área"
        descricao="Organize, por área, os materiais em módulos (temas). Cada colaborador vê apenas os módulos e documentos da própria área."
        voltar={{ href: '/admin/treinamento', rotulo: 'Central de Conhecimento' }}
        acoes={
          <Botao
            type="button"
            onClick={() => { setEditModulo({ area, titulo: '' }); setEditDoc(null); setAviso(null); setErro(null) }}
          >
            <FolderPlus size={15} aria-hidden /> Novo módulo
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
        <Cartao titulo="Área (centro de custo)" apoio="Escolha a área para montar os módulos e documentos dela.">
          <select
            value={area}
            onChange={(e) => { setArea(e.target.value); setEditModulo(null); setEditDoc(null) }}
            className={ENTRADA}
          >
            {CENTROS_CUSTO.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Cartao>

        {/* Formulário de módulo */}
        {editModulo && (
          <Cartao titulo={editModulo.id ? 'Editar módulo' : 'Novo módulo'}>
            <div className="space-y-4">
              <Campo rotulo="Área">
                <select value={editModulo.area} onChange={(e) => setEditModulo({ ...editModulo, area: e.target.value })} className={ENTRADA}>
                  {CENTROS_CUSTO.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Título do módulo" ajuda="Um tema dentro da área. Ex.: Integração, Políticas, Segurança.">
                <input value={editModulo.titulo} onChange={(e) => setEditModulo({ ...editModulo, titulo: e.target.value })} className={ENTRADA} placeholder="Ex.: Integração" />
              </Campo>
              <div className="flex justify-end gap-2">
                <Botao type="button" variante="secundario" onClick={() => setEditModulo(null)}>Cancelar</Botao>
                <Botao type="button" onClick={salvarModulo} disabled={pendente}>
                  {pendente ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Salvando…</> : <><Save size={15} aria-hidden /> Salvar módulo</>}
                </Botao>
              </div>
            </div>
          </Cartao>
        )}

        {/* Formulário de documento */}
        {editDoc && (
          <Cartao titulo={editDoc.id ? 'Editar documento' : 'Novo documento'}>
            <div className="space-y-4">
              <Campo rotulo="Módulo">
                <select value={editDoc.modulo_id} onChange={(e) => setEditDoc({ ...editDoc, modulo_id: e.target.value })} className={ENTRADA}>
                  <option value="">Selecione o módulo…</option>
                  {modulosArea.map((m) => (
                    <option key={m.id} value={m.id}>{m.titulo}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Título">
                <input value={editDoc.titulo} onChange={(e) => setEditDoc({ ...editDoc, titulo: e.target.value })} className={ENTRADA} placeholder="Ex.: Manual de integração" />
              </Campo>
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                <Campo rotulo="Tipo">
                  <select value={editDoc.tipo} onChange={(e) => setEditDoc({ ...editDoc, tipo: e.target.value as TipoDoc })} className={ENTRADA}>
                    {TIPOS_DOC.map((t) => (
                      <option key={t} value={t}>{TIPO_DOC_LABEL[t]}</option>
                    ))}
                  </select>
                </Campo>
                <Campo rotulo="Link" ajuda="Cole o link do Google Drive, do material ou do vídeo. Abre em uma nova aba.">
                  <input value={editDoc.url} onChange={(e) => setEditDoc({ ...editDoc, url: e.target.value })} className={ENTRADA} placeholder="https://…" />
                </Campo>
              </div>
              <Campo rotulo="Descrição" ajuda="Explique em poucas linhas o que é o material e para que serve.">
                <textarea
                  value={editDoc.descricao}
                  onChange={(e) => setEditDoc({ ...editDoc, descricao: e.target.value })}
                  rows={3}
                  maxLength={1000}
                  className={`${ENTRADA} resize-y`}
                  placeholder="Ex.: Passo a passo da integração de novos colaboradores da área."
                />
              </Campo>
              <div className="flex justify-end gap-2">
                <Botao type="button" variante="secundario" onClick={() => setEditDoc(null)}>Cancelar</Botao>
                <Botao type="button" onClick={salvarDoc} disabled={pendente}>
                  {pendente ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Salvando…</> : <><Save size={15} aria-hidden /> Salvar documento</>}
                </Botao>
              </div>
            </div>
          </Cartao>
        )}

        {/* Lista de módulos da área */}
        <Cartao
          titulo={`Módulos de ${area}`}
          apoio={carregando ? undefined : `${modulosArea.length} ${modulosArea.length === 1 ? 'módulo' : 'módulos'}`}
        >
          {carregando ? (
            <p className="text-sm text-tinta-3">Carregando…</p>
          ) : modulosArea.length === 0 && orfaos.length === 0 ? (
            <div className="rounded-lg border border-dashed border-borda bg-superficie-2 p-6 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-tinta-3">
                <Inbox size={20} aria-hidden />
              </span>
              <p className="mt-3 text-sm text-tinta-2">Nenhum módulo nesta área ainda.</p>
              <p className="mt-1 text-sm text-tinta-3">Use “Novo módulo” para criar o primeiro tema (ex.: Integração).</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modulosArea.map((m, i) => {
                const lista = docsPorModulo.get(m.id) ?? []
                const aberto = abertos.has(m.id)
                return (
                  <div key={m.id} className="rounded-xl border border-borda bg-white">
                    {/* Cabeçalho do módulo */}
                    <div className="flex items-center gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => alternar(m.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        aria-expanded={aberto}
                      >
                        <span className="flex-none text-tinta-3">
                          {aberto ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-tinta">{m.titulo}</span>
                          <span className="text-xs text-tinta-3">{lista.length} {lista.length === 1 ? 'documento' : 'documentos'}</span>
                        </span>
                      </button>
                      <div className="flex flex-none gap-0.5">
                        <IconBtn title="Subir módulo" disabled={i === 0} onClick={() => acao(() => trocarOrdemModulos(modulosArea[i], modulosArea[i - 1]))}><ArrowUp size={16} /></IconBtn>
                        <IconBtn title="Descer módulo" disabled={i === modulosArea.length - 1} onClick={() => acao(() => trocarOrdemModulos(modulosArea[i], modulosArea[i + 1]))}><ArrowDown size={16} /></IconBtn>
                        <IconBtn title="Editar módulo" onClick={() => { setEditModulo({ id: m.id, area: m.area, titulo: m.titulo }); setEditDoc(null); setAviso(null); setErro(null) }}><Pencil size={16} /></IconBtn>
                        <IconBtn title="Remover módulo" perigo onClick={() => { if (confirm(`Remover o módulo "${m.titulo}"${lista.length ? ` e os seus ${lista.length} documento(s)` : ''}? Esta ação não pode ser desfeita.`)) acao(() => excluirModulo(m.id), 'Módulo removido.') }}><Trash2 size={16} /></IconBtn>
                      </div>
                    </div>

                    {/* Documentos do módulo */}
                    {aberto && (
                      <div className="border-t border-borda bg-superficie-2 p-3">
                        {lista.length === 0 ? (
                          <p className="px-1 py-2 text-sm text-tinta-3">Nenhum documento neste módulo ainda.</p>
                        ) : (
                          <div className="space-y-2">
                            {lista.map((d, j) => (
                              <div key={d.id} className="flex items-start gap-3 rounded-lg border border-borda bg-white p-3">
                                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-superficie-2 text-tinta-2">
                                  <IconeTipo tipo={d.tipo} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-tinta">{d.titulo}</p>
                                  {d.descricao && <p className="mt-0.5 line-clamp-2 text-xs text-tinta-2">{d.descricao}</p>}
                                  <p className="mt-0.5 truncate text-xs text-tinta-3">{TIPO_DOC_LABEL[d.tipo]} · {d.url}</p>
                                </div>
                                <div className="flex flex-none gap-0.5">
                                  <IconBtn title="Abrir" onClick={() => window.open(d.url, '_blank', 'noopener,noreferrer')}><ExternalLink size={16} /></IconBtn>
                                  <IconBtn title="Subir" disabled={j === 0} onClick={() => acao(() => trocarOrdemDocumentos(lista[j], lista[j - 1]))}><ArrowUp size={16} /></IconBtn>
                                  <IconBtn title="Descer" disabled={j === lista.length - 1} onClick={() => acao(() => trocarOrdemDocumentos(lista[j], lista[j + 1]))}><ArrowDown size={16} /></IconBtn>
                                  <IconBtn title="Editar" onClick={() => { setEditDoc({ id: d.id, area: d.area, modulo_id: d.modulo_id, titulo: d.titulo, tipo: d.tipo, url: d.url, descricao: d.descricao ?? '' }); setEditModulo(null); setAviso(null); setErro(null) }}><Pencil size={16} /></IconBtn>
                                  <IconBtn title="Remover" perigo onClick={() => { if (confirm(`Remover o documento "${d.titulo}"?`)) acao(() => excluirDocumento(d.id), 'Documento removido.') }}><Trash2 size={16} /></IconBtn>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <Botao
                          type="button"
                          variante="secundario"
                          onClick={() => { setEditDoc({ area, modulo_id: m.id, titulo: '', tipo: 'link', url: '', descricao: '' }); setEditModulo(null); setAviso(null); setErro(null) }}
                          className="mt-3"
                        >
                          <Plus size={15} aria-hidden /> Adicionar documento
                        </Botao>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Documentos antigos sem módulo válido */}
              {orfaos.length > 0 && (
                <div className="rounded-xl border border-dashed border-[#e4b85c] bg-[#fdf6e8] p-3">
                  <p className="px-1 text-sm font-semibold text-tinta">Sem módulo</p>
                  <p className="mb-2 px-1 text-xs text-tinta-2">
                    Documentos antigos que ainda não estão em um módulo. Edite cada um e escolha um módulo para eles aparecerem ao colaborador.
                  </p>
                  <div className="space-y-2">
                    {orfaos.map((d) => (
                      <div key={d.id} className="flex items-start gap-3 rounded-lg border border-borda bg-white p-3">
                        <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-superficie-2 text-tinta-2">
                          <IconeTipo tipo={d.tipo} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-tinta">{d.titulo}</p>
                          <p className="mt-0.5 truncate text-xs text-tinta-3">{TIPO_DOC_LABEL[d.tipo]} · {d.url}</p>
                        </div>
                        <div className="flex flex-none gap-0.5">
                          <IconBtn title="Editar" onClick={() => { setEditDoc({ id: d.id, area: d.area, modulo_id: '', titulo: d.titulo, tipo: d.tipo, url: d.url, descricao: d.descricao ?? '' }); setEditModulo(null); setAviso(null); setErro(null) }}><Pencil size={16} /></IconBtn>
                          <IconBtn title="Remover" perigo onClick={() => { if (confirm(`Remover o documento "${d.titulo}"?`)) acao(() => excluirDocumento(d.id), 'Documento removido.') }}><Trash2 size={16} /></IconBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
