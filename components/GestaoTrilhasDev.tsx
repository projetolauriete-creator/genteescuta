'use client'

// =============================================================
// Admin das Trilhas de Desenvolvimento (Fase 1). CRUD de trilhas e,
// dentro de cada trilha, CRUD de atividades com editor por tipo.
// =============================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2, Save, Loader2, ChevronUp, ChevronDown, Pencil, Eye, EyeOff, X, ListChecks, Image as ImageIcon, Star, Upload, Sparkles, FileText, ExternalLink, LayoutGrid } from 'lucide-react'
import { Campo, ENTRADA, Botao, Aviso, Chip } from '@/components/ui'
import { comprimirImagem } from '@/lib/imagem'
import { lerDocumentoDataURL } from '@/lib/arquivo'
import { gerarCaca, DIRECAO_LABEL, type DirecaoCaca } from '@/lib/caca'
import {
  listarTrilhasDev, salvarTrilhaDev, excluirTrilhaDev, trilhaDevVazia,
  listarAtividades, salvarAtividade, excluirAtividade, atividadeVazia,
  semearOnboarding, perguntaVazia,
  TIPO_LABEL, TIPOS_SELECIONAVEIS, TIPOS_COM_OPCOES,
  type TrilhaDev, type Atividade, type TipoAtividade, type PerguntaQuiz,
} from '@/lib/fb/trilhasDev'

export function GestaoTrilhasDev() {
  const [itens, setItens] = useState<TrilhaDev[] | null>(null)
  const [persistidos, setPersistidos] = useState<Set<string>>(new Set())
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TrilhaDev | null>(null)
  const [pendente, setPendente] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() {
    const lista = await listarTrilhasDev().catch(() => [])
    setItens(lista)
    setPersistidos(new Set(lista.map((t) => t.id)))
    return lista
  }
  useEffect(() => { carregar() }, [])

  function selecionar(t: TrilhaDev) { setErro(null); setAviso(null); setEditId(t.id); setDraft({ ...t }) }
  function limparSelecao() { setEditId(null); setDraft(null) }
  function patch(p: Partial<TrilhaDev>) { setDraft((d) => (d ? { ...d, ...p } : d)) }

  async function salvar() {
    if (!draft) return
    if (!draft.titulo.trim()) { setErro('Dê um título à trilha.'); return }
    setPendente(true); setErro(null); setAviso(null)
    try {
      const limpo = { ...draft, titulo: draft.titulo.trim() }
      await salvarTrilhaDev(limpo)
      setAviso('Trilha salva.')
      setDraft(limpo)
      await carregar() // a trilha segue selecionada (agora persistida)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui salvar.') }
    setPendente(false)
  }

  function adicionar() {
    const ordem = (itens && itens.length ? Math.max(...itens.map((i) => i.ordem)) : 0) + 1
    const nova = trilhaDevVazia(ordem)
    setItens([...(itens ?? []), nova]); selecionar(nova)
  }

  async function mover(t: TrilhaDev, dir: 'up' | 'down') {
    if (!itens) return
    const idx = itens.findIndex((i) => i.id === t.id); const j = dir === 'up' ? idx - 1 : idx + 1
    if (j < 0 || j >= itens.length) return
    const a = itens[idx], b = itens[j]
    await Promise.all([salvarTrilhaDev({ ...a, ordem: b.ordem }), salvarTrilhaDev({ ...b, ordem: a.ordem })]).catch(() => {})
    await carregar()
  }

  // Ativar/desativar na hora: persiste já (igual ao comportamento antigo), e
  // leva junto as edições em aberto quando a trilha já tem título.
  async function toggleAtiva() {
    if (!draft) return
    const novo = { ...draft, ativa: !draft.ativa }
    setDraft(novo)
    if (novo.titulo.trim()) {
      setErro(null)
      try { await salvarTrilhaDev(novo); await carregar() }
      catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui atualizar o status.') }
    }
  }

  async function semear() {
    if (!confirm('Criar (ou atualizar) a trilha de exemplo "Integração (Onboarding)" com as casas 1 a 4? Ela entra desativada, para você revisar antes de publicar.')) return
    setPendente(true); setErro(null); setAviso(null)
    try { await semearOnboarding(); setAviso('Trilha de Onboarding criada (desativada). Edite as perguntas e ative quando quiser.'); await carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui semear a trilha.') }
    setPendente(false)
  }
  async function remover(t: TrilhaDev) {
    if (!confirm(`Remover a trilha "${t.titulo || 'sem título'}" e todas as suas atividades?`)) return
    await excluirTrilhaDev(t.id).catch(() => {})
    if (editId === t.id) limparSelecao()
    await carregar()
  }

  const novaSelecionada = !!editId && !persistidos.has(editId)

  return (
    <div className="space-y-3">
      {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}
      {erro && <Aviso tom="erro">{erro}</Aviso>}

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr] xl:grid-cols-[24rem_1fr]">
        {/* ----------------- Coluna esquerda: lista de trilhas ----------------- */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="cartao">
            <header className="flex items-center justify-between gap-3 border-b border-borda px-4 py-3">
              <div>
                <h2 className="cartao-titulo">Trilhas</h2>
                <p className="mt-0.5 text-xs text-tinta-3">{itens === null ? 'Carregando…' : `${itens.length} ${itens.length === 1 ? 'trilha' : 'trilhas'}`}</p>
              </div>
            </header>
            <div className="space-y-2.5 p-3">
              <button type="button" onClick={adicionar} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-borda-forte px-3 py-2.5 text-sm font-semibold text-tinta-2 transition-colors hover:border-marca hover:bg-marca-clara hover:text-marca-texto">
                <Plus size={16} aria-hidden /> Adicionar trilha
              </button>

              {itens === null ? (
                <p className="px-1 py-2 text-sm text-tinta-3">Carregando…</p>
              ) : itens.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-tinta-3">Nenhuma trilha ainda. Crie a primeira ou semeie o exemplo.</p>
              ) : (
                itens.map((t, i) => {
                  const sel = editId === t.id
                  return (
                    <div key={t.id} className={`flex items-center gap-1.5 rounded-xl border p-2 transition-colors ${sel ? 'border-marca bg-marca-clara ring-1 ring-marca' : 'border-borda bg-white hover:border-borda-forte'}`}>
                      <button type="button" onClick={() => selecionar(t)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span className="flex h-11 w-16 flex-none items-center justify-center overflow-hidden rounded-lg bg-superficie-2">
                          {t.capa ? <img src={t.capa} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={16} className="text-tinta-3" aria-hidden />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-tinta">{t.titulo || '(sem título)'}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Chip faixa="marca"><Star size={11} className="fill-current" aria-hidden /> {t.pontos} pts</Chip>
                            <Chip faixa={t.ativa ? 'baixo' : 'neutro'}>{t.ativa ? 'Ativa' : 'Inativa'}</Chip>
                          </span>
                        </span>
                      </button>
                      <div className="flex flex-none flex-col">
                        <BtnIcone title="Subir" onClick={() => mover(t, 'up')} disabled={i === 0}><ChevronUp size={15} /></BtnIcone>
                        <BtnIcone title="Descer" onClick={() => mover(t, 'down')} disabled={i === itens.length - 1}><ChevronDown size={15} /></BtnIcone>
                      </div>
                    </div>
                  )
                })
              )}

              <button type="button" onClick={semear} disabled={pendente} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-borda-forte bg-white px-3 py-2 text-xs font-medium text-tinta-2 transition-colors hover:border-marca hover:text-marca-texto disabled:opacity-60">
                <Sparkles size={14} aria-hidden /> Semear Onboarding (exemplo)
              </button>
            </div>
          </div>
        </aside>

        {/* ----------------- Coluna direita: canvas de edição ----------------- */}
        <section className="min-w-0">
          {!draft ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-dashed border-borda-forte bg-white/60 px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-clara text-marca">
                <LayoutGrid size={26} aria-hidden />
              </span>
              <p className="mt-4 text-[0.9375rem] font-semibold text-tinta">Selecione uma trilha para editar</p>
              <p className="mt-1.5 max-w-sm text-sm text-tinta-3">Escolha uma trilha na lista ao lado ou crie uma nova para montar os módulos e atividades aqui.</p>
            </div>
          ) : (
            <div className="cartao overflow-hidden">
              {/* Cabeçalho do canvas: título, status, ações */}
              <div className="space-y-4 border-b border-borda p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-[0.6875rem] font-semibold uppercase tracking-[0.04em] text-tinta-3">Título da trilha</label>
                    <input
                      value={draft.titulo}
                      onChange={(e) => patch({ titulo: e.target.value })}
                      className="w-full rounded-lg border border-transparent bg-transparent px-1 py-1 text-[1.375rem] font-semibold tracking-[-0.014em] text-tinta transition-colors placeholder:text-tinta-3 hover:border-borda focus:border-marca focus:bg-white focus:outline-none"
                      placeholder="Ex.: Boas-vindas à Soulan"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleAtiva}
                    title={draft.ativa ? 'Clique para desativar' : 'Clique para ativar'}
                    className={`inline-flex flex-none items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${draft.ativa ? 'border-[#cfe6b8] bg-[#f4faec] text-verde-escuro hover:bg-[#edf6df]' : 'border-borda-forte bg-white text-tinta-2 hover:border-marca hover:text-marca-texto'}`}
                  >
                    {draft.ativa ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
                    {draft.ativa ? 'Ativa' : 'Inativa'}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Botao type="button" onClick={salvar} disabled={pendente}>
                    {pendente ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Salvando…</> : <><Save size={15} aria-hidden /> Salvar</>}
                  </Botao>
                  <a href="/trilhas" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm font-medium text-tinta-2 transition-colors hover:border-marca hover:text-marca-texto">
                    <ExternalLink size={15} aria-hidden /> Ver como colaborador
                  </a>
                  <div className="ml-auto">
                    <button type="button" onClick={() => editId && remover({ ...draft, id: editId })} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-tinta-3 transition-colors hover:bg-plano hover:text-critico">
                      <Trash2 size={15} aria-hidden /> Remover trilha
                    </button>
                  </div>
                </div>
              </div>

              {/* Corpo do canvas: dados da trilha + construtor de módulos */}
              <div className="space-y-5 p-4 sm:p-5">
                <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
                  <Campo rotulo="Descrição"><textarea value={draft.descricao} onChange={(e) => patch({ descricao: e.target.value })} rows={5} className={`${ENTRADA} min-h-[7.5rem] resize-y leading-relaxed`} placeholder="Um resumo curto do que a pessoa vai aprender." /></Campo>
                  <Campo rotulo="Pontos ao concluir"><input type="number" min={0} value={draft.pontos} onChange={(e) => patch({ pontos: Math.max(0, Math.round(Number(e.target.value) || 0)) })} className={ENTRADA} /></Campo>
                </div>
                <ImagemCampo rotulo="Capa da trilha" valor={draft.capa} onChange={(v) => patch({ capa: v })} />

                <div className="border-t border-borda pt-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-marca-clara text-marca"><ListChecks size={16} aria-hidden /></span>
                    <div>
                      <h3 className="text-[0.9375rem] font-semibold text-tinta">Módulos</h3>
                      <p className="text-xs text-tinta-3">Monte os módulos (01, 02, 03...) e as atividades de cada um. Arraste pela ordem com as setas.</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    {novaSelecionada ? (
                      <Aviso tom="info">Salve a trilha para começar a adicionar os módulos.</Aviso>
                    ) : (
                      <EditorAtividades key={editId!} trilhaId={editId!} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// Campo de imagem: envia um arquivo e guarda como data URL (sem Storage).
function ImagemCampo({ valor, onChange, rotulo }: { valor: string; onChange: (v: string) => void; rotulo: string }) {
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  async function escolher(file: File | null) {
    if (!file) return
    setErro(null); setCarregando(true)
    try { onChange(await comprimirImagem(file)) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui usar essa imagem.') }
    setCarregando(false)
  }
  return (
    <Campo rotulo={rotulo}>
      <div className="flex items-center gap-2">
        {valor
          ? <img src={valor} alt="" className="h-12 w-20 flex-none rounded-md border border-borda object-cover" />
          : <span className="flex h-12 w-20 flex-none items-center justify-center rounded-md bg-superficie-2 text-tinta-3"><ImageIcon size={16} aria-hidden /></span>}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm font-medium text-tinta transition-colors hover:border-marca hover:text-marca-texto">
          {carregando ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
          {valor ? 'Trocar' : 'Enviar imagem'}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => escolher(e.target.files?.[0] ?? null)} />
        </label>
        {valor && <button type="button" onClick={() => onChange('')} title="Remover imagem" className="rounded p-1.5 text-tinta-3 hover:text-critico"><Trash2 size={14} /></button>}
      </div>
      {erro && <p className="mt-1 text-xs text-critico">{erro}</p>}
    </Campo>
  )
}

// -------- Atividades de uma trilha --------
function EditorAtividades({ trilhaId }: { trilhaId: string }) {
  const [itens, setItens] = useState<Atividade[] | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Atividade | null>(null)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function carregar() { setItens(await listarAtividades(trilhaId).catch(() => [])) }
  useEffect(() => { carregar() }, [trilhaId])

  function abrir(a: Atividade) { setErro(null); setEditId(a.id); setDraft({ ...a, opcoes: [...a.opcoes], corretas: [...a.corretas], campos: [...a.campos] }) }
  function fechar() { setEditId(null); setDraft(null) }
  function patch(p: Partial<Atividade>) { setDraft((d) => (d ? { ...d, ...p } : d)) }

  async function salvar() {
    if (!draft) return
    if (!draft.titulo.trim()) { setErro('Dê um título à atividade.'); return }
    setPendente(true); setErro(null)
    try { await salvarAtividade(trilhaId, draft); fechar(); await carregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui salvar a atividade.') }
    setPendente(false)
  }

  function adicionar() {
    const ordem = (itens && itens.length ? Math.max(...itens.map((i) => i.ordem)) : 0) + 1
    const nova = atividadeVazia(ordem, 'multipla_uma')
    setItens([...(itens ?? []), nova]); abrir(nova)
  }
  async function mover(a: Atividade, dir: 'up' | 'down') {
    if (!itens) return
    const idx = itens.findIndex((i) => i.id === a.id); const j = dir === 'up' ? idx - 1 : idx + 1
    if (j < 0 || j >= itens.length) return
    const x = itens[idx], y = itens[j]
    await Promise.all([salvarAtividade(trilhaId, { ...x, ordem: y.ordem }), salvarAtividade(trilhaId, { ...y, ordem: x.ordem })]).catch(() => {})
    await carregar()
  }
  async function remover(a: Atividade) {
    if (!confirm(`Remover a atividade "${a.titulo || 'sem título'}"?`)) return
    await excluirAtividade(trilhaId, a.id).catch(() => {})
    if (editId === a.id) fechar()
    await carregar()
  }

  if (itens === null) return <p className="text-sm text-tinta-3">Carregando atividades…</p>

  return (
    <div className="space-y-2 rounded-lg bg-superficie-2 p-2.5">
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {itens.length === 0 && <p className="px-1 text-xs text-tinta-3">Nenhum módulo ainda. Adicione o primeiro abaixo.</p>}
      {itens.map((a, i) => (
        <div key={a.id} className="rounded-lg border border-borda bg-white">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-marca-clara text-xs font-bold tabular text-marca-texto">{String(i + 1).padStart(2, '0')}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-tinta">{a.titulo || '(sem título)'}</span>
            <Chip faixa="neutro">{CHIP_TIPO[a.tipo]}</Chip>
            <div className="flex items-center gap-0.5">
              <BtnIcone title="Subir" onClick={() => mover(a, 'up')} disabled={i === 0}><ChevronUp size={15} /></BtnIcone>
              <BtnIcone title="Descer" onClick={() => mover(a, 'down')} disabled={i === itens.length - 1}><ChevronDown size={15} /></BtnIcone>
              <BtnIcone title="Editar" onClick={() => (editId === a.id ? fechar() : abrir(a))}><Pencil size={14} /></BtnIcone>
              <BtnIcone title="Remover" perigo onClick={() => remover(a)}><Trash2 size={14} /></BtnIcone>
            </div>
          </div>
          {editId === a.id && draft && (
            <div className="space-y-3 border-t border-borda px-3 py-3">
              <Campo rotulo="Tipo de atividade">
                <select
                  value={draft.tipo}
                  onChange={(e) => {
                    const novo = e.target.value as TipoAtividade
                    const extra: Partial<Atividade> = {}
                    if (TIPOS_COM_OPCOES.includes(novo) && (!draft.opcoes || draft.opcoes.length === 0)) extra.opcoes = ['', '']
                    if (novo === 'quiz' && (!draft.perguntas || draft.perguntas.length === 0)) extra.perguntas = [perguntaVazia(false)]
                    if (novo === 'caca' && (!draft.cacaDirecoes || draft.cacaDirecoes.length === 0)) extra.cacaDirecoes = ['horizontal', 'vertical']
                    patch({ tipo: novo, ...extra })
                  }}
                  className={ENTRADA}
                >
                  {TIPOS_SELECIONAVEIS.map((tp) => <option key={tp} value={tp}>{TIPO_LABEL[tp]}</option>)}
                  {!TIPOS_SELECIONAVEIS.includes(draft.tipo) && <option value={draft.tipo}>{TIPO_LABEL[draft.tipo]}</option>}
                </select>
              </Campo>
              <Campo rotulo="Título"><input value={draft.titulo} onChange={(e) => patch({ titulo: e.target.value })} className={ENTRADA} placeholder="Ex.: Nossos valores" /></Campo>
              <Campo rotulo="Enunciado (a pergunta)"><textarea value={draft.enunciado} onChange={(e) => patch({ enunciado: e.target.value })} rows={2} className={ENTRADA} placeholder="O que a pessoa deve responder ou fazer." /></Campo>

              {/* Configuração por tipo */}
              {TIPOS_COM_OPCOES.includes(draft.tipo) && <EditorOpcoesSimples draft={draft} patch={patch} tipo={draft.tipo} />}
              {draft.tipo === 'quiz' && <EditorQuiz draft={draft} patch={patch} />}
              {draft.tipo === 'caca' && <EditorCaca draft={draft} patch={patch} />}
              {draft.tipo === 'curta' && <p className="rounded-lg bg-superficie-2 px-3 py-2 text-xs text-tinta-3">Resposta curta (uma linha). O colaborador escreve e segue.</p>}
              {draft.tipo === 'paragrafo' && <p className="rounded-lg bg-superficie-2 px-3 py-2 text-xs text-tinta-3">Parágrafo (texto longo). O colaborador escreve e segue.</p>}
              {draft.tipo === 'material' && <p className="rounded-lg bg-superficie-2 px-3 py-2 text-xs text-tinta-3">Só leitura: adicione os materiais de apoio abaixo. A pessoa abre e marca como lido.</p>}
              {draft.tipo === 'assinalar' && <EditorAssinalar draft={draft} patch={patch} />}
              {draft.tipo === 'listar' && <EditorListar draft={draft} patch={patch} />}

              {/* Materiais de apoio: valem para qualquer tipo de atividade */}
              <EditorMateriais draft={draft} patch={patch} />

              <div className="flex items-center gap-2">
                <Botao type="button" onClick={salvar} disabled={pendente}>{pendente ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Salvando…</> : <><Save size={15} aria-hidden /> Salvar atividade</>}</Botao>
                <button type="button" onClick={fechar} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-tinta-2 hover:bg-superficie-2"><X size={15} aria-hidden /> Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={adicionar} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-3 py-1.5 text-xs font-medium text-tinta-2 transition-colors hover:border-marca hover:text-marca-texto">
        <Plus size={14} aria-hidden /> Adicionar módulo
      </button>
    </div>
  )
}

// Rótulo curto do tipo para o chip da lista.
const CHIP_TIPO: Record<TipoAtividade, string> = {
  multipla_uma: 'Múltipla', caixas: 'Seleção', suspensa: 'Lista', curta: 'Curta', paragrafo: 'Parágrafo',
  material: 'Material', quiz: 'Quiz', caca: 'Caça-palavras', assinalar: 'Assinalar', responder: 'Responder', listar: 'Listar',
}

// Opções de múltipla escolha / caixas / lista suspensa (sem marcar correta).
function EditorOpcoesSimples({ draft, patch, tipo }: { draft: Atividade; patch: (p: Partial<Atividade>) => void; tipo: TipoAtividade }) {
  const opcoes = draft.opcoes.length ? draft.opcoes : ['', '']
  function setOpcao(i: number, v: string) { patch({ opcoes: opcoes.map((o, j) => (j === i ? v : o)) }) }
  function addOpcao() { patch({ opcoes: [...opcoes, ''] }) }
  function removeOpcao(i: number) { patch({ opcoes: opcoes.filter((_, j) => j !== i) }) }
  const rotulo = tipo === 'caixas' ? 'Opções (a pessoa marca uma ou mais)' : tipo === 'suspensa' ? 'Opções da lista' : 'Opções (a pessoa marca uma)'
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-tinta-2">{rotulo}</p>
      <div className="space-y-2">
        {opcoes.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex-none text-xs text-tinta-3">{tipo === 'caixas' ? '☐' : tipo === 'suspensa' ? `${i + 1}.` : '○'}</span>
            <input value={o} onChange={(e) => setOpcao(i, e.target.value)} className={ENTRADA} placeholder={`Opção ${i + 1}`} />
            {opcoes.length > 2 && <button type="button" onClick={() => removeOpcao(i)} title="Remover opção" className="rounded p-1.5 text-tinta-3 hover:text-critico"><Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
      <button type="button" onClick={addOpcao} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Plus size={13} aria-hidden /> Adicionar opção</button>
    </div>
  )
}

// Editor de caça-palavras: lista de palavras, direções e tabuleiro gerado.
const DIRECOES_CACA: DirecaoCaca[] = ['horizontal', 'vertical', 'diagonal', 'invertidas']

function EditorCaca({ draft, patch }: { draft: Atividade; patch: (p: Partial<Atividade>) => void }) {
  const [palavras, setPalavras] = useState<string[]>(draft.cacaPalavras.length ? draft.cacaPalavras : [''])
  const [aviso, setAviso] = useState<string | null>(null)
  const direcoes = (draft.cacaDirecoes.length ? draft.cacaDirecoes : ['horizontal', 'vertical']) as DirecaoCaca[]
  const chaveNorm = useMemo(() => palavras.map((p) => p.trim()).filter(Boolean).join('|').toUpperCase(), [palavras])
  const refInit = useRef(true)

  function gerar() {
    const res = gerarCaca(palavras, direcoes)
    patch({
      cacaPalavras: res.palavras,
      cacaGrade: res.grade.map((r) => r.join('')),
      cacaCols: res.tamanho,
      cacaPos: res.posicoes,
    })
    setAviso(res.naoCouberam.length
      ? `Não couberam: ${res.naoCouberam.join(', ')}. Tente gerar de novo, reduzir palavras ou habilitar mais direções.`
      : null)
  }

  // Regenera quando as palavras ou direções mudam (mantém o tabuleiro válido).
  useEffect(() => {
    if (refInit.current) { refInit.current = false; if (draft.cacaGrade.length > 0) return }
    gerar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveNorm, direcoes.join('|')])

  function setPalavra(i: number, v: string) { setPalavras((ps) => ps.map((p, j) => (j === i ? v : p))) }
  function addPalavra() { setPalavras((ps) => [...ps, '']) }
  function removePalavra(i: number) { setPalavras((ps) => (ps.length > 1 ? ps.filter((_, j) => j !== i) : ps)) }
  function toggleDir(d: DirecaoCaca) {
    const nova = direcoes.includes(d) ? direcoes.filter((x) => x !== d) : [...direcoes, d]
    patch({ cacaDirecoes: nova.length ? nova : ['horizontal'] })
  }

  const cols = draft.cacaCols
  const grade = draft.cacaGrade

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-tinta-2">Palavras (viram MAIÚSCULAS, sem espaços e sem acentos)</p>
        <div className="space-y-2">
          {palavras.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={p} onChange={(e) => setPalavra(i, e.target.value)} className={ENTRADA} placeholder={`Palavra ${i + 1} (ex.: Day off)`} />
              {palavras.length > 1 && <button type="button" onClick={() => removePalavra(i)} title="Remover palavra" className="rounded p-1.5 text-tinta-3 hover:text-critico"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
        <button type="button" onClick={addPalavra} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Plus size={13} aria-hidden /> Adicionar palavra</button>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-tinta-2">Direções</p>
        <div className="flex flex-wrap gap-3">
          {DIRECOES_CACA.map((d) => (
            <label key={d} className="flex items-center gap-2 text-sm text-tinta">
              <input type="checkbox" checked={direcoes.includes(d)} onChange={() => toggleDir(d)} className="h-4 w-4 accent-[var(--color-marca)]" />
              {DIRECAO_LABEL[d]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={gerar} className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm font-medium text-tinta transition-colors hover:border-marca hover:text-marca-texto">
          <Sparkles size={15} aria-hidden /> {grade.length ? 'Gerar novo tabuleiro' : 'Pré-visualizar tabuleiro'}
        </button>
      </div>

      {aviso && <Aviso tom="erro">{aviso}</Aviso>}

      {grade.length > 0 && cols > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-tinta-2">Prévia ({cols} x {cols})</p>
          <div className="overflow-x-auto">
            <div className="mx-auto grid w-max gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {grade.flatMap((linha, r) => linha.split('').map((letra, c) => (
                <span key={`${r}-${c}`} className="flex h-6 w-6 items-center justify-center rounded bg-superficie-2 text-[0.65rem] font-semibold text-tinta-2">{letra}</span>
              )))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Materiais de apoio (valem para qualquer atividade): link, vídeo, imagem, documento.
function EditorMateriais({ draft, patch }: { draft: Atividade; patch: (p: Partial<Atividade>) => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  async function anexar(file: File | null) {
    if (!file) return
    setErro(null); setCarregando(true)
    try { const { dados, nome } = await lerDocumentoDataURL(file); patch({ arquivo: dados, arquivoNome: nome }) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui anexar o arquivo.') }
    setCarregando(false)
  }
  return (
    <div className="space-y-3 rounded-lg border border-borda bg-superficie-2 p-3">
      <p className="text-xs font-semibold text-tinta-2">Materiais de apoio (opcionais)</p>
      <Campo rotulo="Link" ajuda="Manual, artigo, pasta do Google Drive, etc. Abre em nova aba.">
        <input value={draft.link} onChange={(e) => patch({ link: e.target.value })} className={ENTRADA} placeholder="https://..." />
      </Campo>
      <Campo rotulo="Vídeo (YouTube, Vimeo ou Google Drive)" ajuda="Cole o link do vídeo. Ele aparece incorporado na atividade.">
        <input value={draft.video} onChange={(e) => patch({ video: e.target.value })} className={ENTRADA} placeholder="https://youtu.be/..." />
      </Campo>
      <ImagemCampo rotulo="Imagem" valor={draft.imagem} onChange={(v) => patch({ imagem: v })} />
      <Campo rotulo="Documento" ajuda="PDF, Word ou planilha de até ~700 KB. Para arquivos maiores, use um link do Drive.">
        <div className="flex flex-wrap items-center gap-2">
          {draft.arquivo
            ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm text-tinta"><FileText size={14} aria-hidden /> {draft.arquivoNome || 'documento'}</span>
            : <span className="text-xs text-tinta-3">Nenhum documento anexado.</span>}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm font-medium text-tinta transition-colors hover:border-marca hover:text-marca-texto">
            {carregando ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
            {draft.arquivo ? 'Trocar' : 'Anexar documento'}
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx" className="hidden" onChange={(e) => anexar(e.target.files?.[0] ?? null)} />
          </label>
          {draft.arquivo && <button type="button" onClick={() => patch({ arquivo: '', arquivoNome: '' })} title="Remover" className="rounded p-1.5 text-tinta-3 hover:text-critico"><Trash2 size={14} /></button>}
        </div>
      </Campo>
      {erro && <p className="text-xs text-critico">{erro}</p>}
    </div>
  )
}

// Editor do quiz: lista de perguntas (múltipla ou sim/não) + nota mínima.
function EditorQuiz({ draft, patch }: { draft: Atividade; patch: (p: Partial<Atividade>) => void }) {
  const perguntas = draft.perguntas ?? []
  function setPergunta(i: number, np: PerguntaQuiz) { patch({ perguntas: perguntas.map((p, j) => (j === i ? np : p)) }) }
  function add(simnao: boolean) { patch({ perguntas: [...perguntas, perguntaVazia(simnao)] }) }
  function remove(i: number) { patch({ perguntas: perguntas.filter((_, j) => j !== i) }) }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {perguntas.map((p, i) => (
          <PerguntaEditor key={i} n={i + 1} pergunta={p} onChange={(np) => setPergunta(i, np)} onRemove={() => remove(i)} />
        ))}
        {perguntas.length === 0 && <p className="rounded-lg bg-superficie-2 px-3 py-2 text-xs text-tinta-3">Adicione ao menos uma pergunta.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => add(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Plus size={13} aria-hidden /> Pergunta de múltipla escolha</button>
        <button type="button" onClick={() => add(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Plus size={13} aria-hidden /> Pergunta sim ou não</button>
      </div>
      <Campo rotulo="Nota mínima (acertos para concluir)" ajuda={`De 0 a ${perguntas.length}. Use 0 para exigir todas. Para "qualquer Não trava", deixe igual ao total.`}>
        <input type="number" min={0} max={perguntas.length} value={draft.notaMinima}
          onChange={(e) => patch({ notaMinima: Math.max(0, Math.min(perguntas.length, Math.round(Number(e.target.value) || 0))) })}
          className={`${ENTRADA} max-w-[8rem]`} />
      </Campo>
    </div>
  )
}

function PerguntaEditor({ n, pergunta, onChange, onRemove }: { n: number; pergunta: PerguntaQuiz; onChange: (p: PerguntaQuiz) => void; onRemove: () => void }) {
  function patch(p: Partial<PerguntaQuiz>) { onChange({ ...pergunta, ...p }) }
  function setOpcao(i: number, v: string) { patch({ opcoes: pergunta.opcoes.map((o, j) => (j === i ? v : o)) }) }
  function addOpcao() { patch({ opcoes: [...pergunta.opcoes, ''] }) }
  function removeOpcao(i: number) {
    const opcoes = pergunta.opcoes.filter((_, j) => j !== i)
    const correta = pergunta.correta === i ? 0 : pergunta.correta > i ? pergunta.correta - 1 : pergunta.correta
    patch({ opcoes, correta: Math.min(correta, Math.max(0, opcoes.length - 1)) })
  }
  return (
    <div className="rounded-lg border border-borda bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-tinta-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-marca-clara text-[0.6875rem] font-bold text-marca-texto">{n}</span>
          {pergunta.simnao ? 'Sim ou não' : 'Múltipla escolha'}
        </span>
        <button type="button" onClick={onRemove} title="Remover pergunta" className="rounded p-1.5 text-tinta-3 hover:text-critico"><Trash2 size={14} /></button>
      </div>
      <Campo rotulo="Pergunta"><textarea value={pergunta.texto} onChange={(e) => patch({ texto: e.target.value })} rows={2} className={ENTRADA} placeholder="Digite a pergunta." /></Campo>
      <div className="mt-2"><ImagemCampo rotulo="Imagem da pergunta (opcional)" valor={pergunta.imagem} onChange={(v) => patch({ imagem: v })} /></div>
      <p className="mb-1.5 mt-2 text-xs font-semibold text-tinta-2">Opções (marque a correta)</p>
      <div className="space-y-2">
        {pergunta.opcoes.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" checked={pergunta.correta === i} onChange={() => patch({ correta: i })} title="Correta" className="h-4 w-4 flex-none accent-[var(--color-marca)]" />
            {pergunta.simnao
              ? <span className="flex-1 rounded-lg bg-superficie-2 px-3 py-2 text-sm text-tinta">{o}</span>
              : <input value={o} onChange={(e) => setOpcao(i, e.target.value)} className={ENTRADA} placeholder={`Opção ${i + 1}`} />}
            {!pergunta.simnao && pergunta.opcoes.length > 2 && (
              <button type="button" onClick={() => removeOpcao(i)} title="Remover opção" className="rounded p-1.5 text-tinta-3 hover:text-critico"><Trash2 size={14} /></button>
            )}
          </div>
        ))}
      </div>
      {!pergunta.simnao && (
        <button type="button" onClick={addOpcao} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Plus size={13} aria-hidden /> Adicionar opção</button>
      )}
      <div className="mt-2"><Campo rotulo="Explicação (aparece ao responder)"><input value={pergunta.explicacao} onChange={(e) => patch({ explicacao: e.target.value })} className={ENTRADA} placeholder="Por que esta é a resposta certa." /></Campo></div>
    </div>
  )
}

function EditorAssinalar({ draft, patch }: { draft: Atividade; patch: (p: Partial<Atividade>) => void }) {
  function setOpcao(i: number, v: string) { patch({ opcoes: draft.opcoes.map((o, j) => (j === i ? v : o)) }) }
  function addOpcao() { patch({ opcoes: [...draft.opcoes, ''] }) }
  function removeOpcao(i: number) {
    patch({
      opcoes: draft.opcoes.filter((_, j) => j !== i),
      corretas: draft.corretas.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)),
    })
  }
  function toggleCorreta(i: number) {
    patch({ corretas: draft.corretas.includes(i) ? draft.corretas.filter((c) => c !== i) : [...draft.corretas, i] })
  }
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-tinta-2">Opções (marque a correta; pode marcar mais de uma)</p>
      <div className="space-y-2">
        {draft.opcoes.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" checked={draft.corretas.includes(i)} onChange={() => toggleCorreta(i)} title="Correta" className="h-4 w-4 flex-none accent-[var(--color-marca)]" />
            <input value={o} onChange={(e) => setOpcao(i, e.target.value)} className={ENTRADA} placeholder={`Opção ${i + 1}`} />
            <button type="button" onClick={() => removeOpcao(i)} title="Remover opção" className="rounded p-1.5 text-tinta-3 hover:bg-plano hover:text-critico"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addOpcao} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Plus size={13} aria-hidden /> Adicionar opção</button>
    </div>
  )
}

function EditorListar({ draft, patch }: { draft: Atividade; patch: (p: Partial<Atividade>) => void }) {
  function setCampo(i: number, v: string) { patch({ campos: draft.campos.map((c, j) => (j === i ? v : c)) }) }
  function addCampo() { patch({ campos: [...draft.campos, ''] }) }
  function removeCampo(i: number) { patch({ campos: draft.campos.filter((_, j) => j !== i) }) }
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-tinta-2">Campos para a pessoa preencher</p>
      <div className="space-y-2">
        {draft.campos.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={c} onChange={(e) => setCampo(i, e.target.value)} className={ENTRADA} placeholder={`Campo ${i + 1} (ex.: Meta do mês)`} />
            <button type="button" onClick={() => removeCampo(i)} title="Remover campo" className="rounded p-1.5 text-tinta-3 hover:bg-plano hover:text-critico"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addCampo} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-2.5 py-1.5 text-xs font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Plus size={13} aria-hidden /> Adicionar campo</button>
    </div>
  )
}

function BtnIcone({ children, title, onClick, disabled, perigo }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; perigo?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={`rounded p-1.5 text-tinta-3 transition-colors disabled:opacity-30 ${perigo ? 'hover:bg-plano hover:text-critico' : 'hover:bg-superficie-2 hover:text-tinta'}`}>{children}</button>
  )
}
