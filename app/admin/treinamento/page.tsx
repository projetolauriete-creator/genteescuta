'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Save, Loader2, X, Eye, EyeOff, FolderOpen } from 'lucide-react'
import {
  listarTrilhas, criarTrilha, atualizarTrilha, excluirTrilha, trocarOrdemTrilhas,
  getTreinamentoEmBreve, setTreinamentoEmBreve,
  type TrilhaDoc,
} from '@/lib/fb/treinos'
import { CENTROS_CUSTO } from '@/lib/reembolso'
import { type Trilha, type Etapa } from '@/lib/treinamentos'
import { CabecalhoPagina, Cartao, Campo, ENTRADA, Botao, Aviso } from '@/components/ui'

const VAZIA: Trilha = { id: '', title: '', desc: '', icon: '📘', color: '#1a4895', tag: 'obrigatorio', mins: 10, areas: [], capa: null, acts: [] }

function uid() {
  return (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2)).slice(0, 12)
}

export default function AdminTreinamento() {
  const [trilhas, setTrilhas] = useState<TrilhaDoc[]>([])
  const [doFirestore, setDoFirestore] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [editando, setEditando] = useState<Trilha | null>(null)
  const [emBreve, setEmBreve] = useState<boolean | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  function recarregar() {
    setCarregando(true)
    listarTrilhas().then((r) => { setTrilhas(r.trilhas as TrilhaDoc[]); setDoFirestore(r.doFirestore) }).catch(() => {}).finally(() => setCarregando(false))
    getTreinamentoEmBreve().then(setEmBreve).catch(() => {})
  }
  useEffect(recarregar, [])

  async function alternarEmBreve() {
    if (emBreve === null) return
    const novo = !emBreve
    setErro(null); setAviso(null)
    try {
      await setTreinamentoEmBreve(novo)
      setEmBreve(novo)
      setAviso(novo ? 'Página pública em modo "Em breve": os colaboradores não veem as trilhas.' : 'Treinamento publicado! As trilhas já aparecem no site.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui alterar.')
    }
  }

  async function acao(fn: () => Promise<unknown>, msg?: string) {
    setErro(null); setAviso(null)
    try { await fn(); if (msg) setAviso(msg); recarregar() }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui concluir.') }
  }

  if (editando) {
    return <Editor trilha={editando} onFechar={() => setEditando(null)} onSalvo={(msg) => { setEditando(null); setAviso(msg); recarregar() }} setErro={setErro} />
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Central de Conhecimento"
        descricao="Crie e edite as trilhas da página pública. As mudanças aparecem no site na hora."
        voltar={{ href: '/treinamento', rotulo: 'Ver página pública' }}
        acoes={<Botao type="button" onClick={() => setEditando({ ...VAZIA })}><Plus size={15} aria-hidden /> Nova trilha</Botao>}
      />
      <div className="max-w-4xl space-y-4 p-4 sm:p-6">
        {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}
        {erro && <Aviso tom="erro">{erro}</Aviso>}

        {/* Atalho para a Sala de documentos por área. */}
        <Link href="/admin/treinamento/documentos" className="flex items-center gap-3 rounded-xl border border-borda bg-white p-4 transition-colors hover:border-marca">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-marca-clara text-marca">
            <FolderOpen size={18} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-tinta">Sala de documentos por área</span>
            <span className="block text-xs text-tinta-2">Adicione materiais (PDF, link, planilha, vídeo) que cada área vê. Visível só para a própria área.</span>
          </span>
          <span className="flex-none text-sm font-semibold text-marca-texto">Gerir →</span>
        </Link>

        {/* Interruptor "Em breve": controla o que os colaboradores veem. */}
        <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-4 ${emBreve ? 'border-[#f2dfae] bg-[#fdf7e7]' : 'border-[#cfe6b8] bg-[#f4faec]'}`}>
          <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${emBreve ? 'bg-[#f6e6bd] text-[#6b4a00]' : 'bg-[#dcefc7] text-verde-escuro'}`}>
            {emBreve ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-tinta">
              {emBreve === null ? 'Carregando…' : emBreve ? 'Página pública em “Em breve”' : 'Treinamento publicado'}
            </p>
            <p className="text-xs text-tinta-2">
              {emBreve
                ? 'Os colaboradores veem só o aviso “Em breve”. Monte as trilhas à vontade e publique quando estiver pronto.'
                : 'As trilhas estão visíveis para os colaboradores no site.'}
            </p>
          </div>
          <Botao type="button" variante={emBreve ? 'primario' : 'secundario'} onClick={alternarEmBreve} disabled={emBreve === null}>
            {emBreve ? 'Publicar agora' : 'Voltar para “Em breve”'}
          </Botao>
        </div>

        {carregando ? (
          <p className="text-sm text-tinta-3">Carregando…</p>
        ) : (
          <div className="space-y-2">
            {trilhas.map((t, i) => (
              <div key={t.id || i} className="flex items-center gap-3 rounded-lg border border-borda bg-white p-3">
                <span className="text-2xl">{t.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-tinta">{t.title}</p>
                  <p className="truncate text-xs text-tinta-3">{t.acts.length} etapa(s) · {t.tag === 'obrigatorio' ? 'Obrigatória' : 'Sugerida'} · {t.mins} min</p>
                </div>
                {doFirestore && (
                  <div className="flex flex-none gap-0.5">
                    <IconBtn title="Subir" disabled={i === 0} onClick={() => acao(() => trocarOrdemTrilhas(trilhas[i], trilhas[i - 1]))}><ArrowUp size={16} /></IconBtn>
                    <IconBtn title="Descer" disabled={i === trilhas.length - 1} onClick={() => acao(() => trocarOrdemTrilhas(trilhas[i], trilhas[i + 1]))}><ArrowDown size={16} /></IconBtn>
                    <IconBtn title="Editar" onClick={() => setEditando(JSON.parse(JSON.stringify(t)))}><Pencil size={16} /></IconBtn>
                    <IconBtn title="Remover" perigo onClick={() => { if (confirm(`Remover a trilha "${t.title}"?`)) acao(() => excluirTrilha(t.id), 'Trilha removida.') }}><Trash2 size={16} /></IconBtn>
                  </div>
                )}
              </div>
            ))}
            {trilhas.length === 0 && <p className="text-sm text-tinta-3">Nenhuma trilha ainda.</p>}
          </div>
        )}
      </div>
    </>
  )
}

// -------------------------------------------------------------
// Editor de uma trilha
// -------------------------------------------------------------
function Editor({ trilha, onFechar, onSalvo, setErro }: { trilha: Trilha; onFechar: () => void; onSalvo: (msg: string) => void; setErro: (s: string | null) => void }) {
  const [t, setT] = useState<Trilha>(trilha)
  const [pendente, setPendente] = useState(false)
  const novo = !t.id

  function up<K extends keyof Trilha>(k: K, v: Trilha[K]) { setT((a) => ({ ...a, [k]: v })) }
  function upAct(i: number, patch: Partial<Etapa>) { setT((a) => ({ ...a, acts: a.acts.map((x, j) => (j === i ? { ...x, ...patch } as Etapa : x)) })) }
  function moverAct(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= t.acts.length) return
    const c = [...t.acts]; [c[i], c[j]] = [c[j], c[i]]; up('acts', c)
  }
  function addAct(type: Etapa['type']) {
    const base = { id: uid(), title: '', pts: 100, coins: 10 }
    const nova = type === 'quiz' ? { ...base, type, q: '', opts: ['', ''], ans: 0 }
      : type === 'material' ? { ...base, type, url: '', content: '', midia: 'link' }
      : { ...base, type: 'texto', content: '' }
    up('acts', [...t.acts, nova as Etapa])
  }

  async function salvar() {
    setPendente(true); setErro(null)
    try {
      if (novo) await criarTrilha(t); else await atualizarTrilha(t.id, t)
      onSalvo(novo ? 'Trilha criada.' : 'Trilha atualizada.')
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui salvar.'); setPendente(false) }
  }

  return (
    <>
      <CabecalhoPagina titulo={novo ? 'Nova trilha' : 'Editar trilha'} acoes={<Botao type="button" variante="secundario" onClick={onFechar}>← Voltar à lista</Botao>} />
      <div className="max-w-4xl space-y-4 p-4 sm:p-6">
        <Cartao titulo="Dados da trilha">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[5rem_1fr]">
              <Campo rotulo="Ícone"><input value={t.icon} onChange={(e) => up('icon', e.target.value)} className={`${ENTRADA} text-center text-xl`} maxLength={2} /></Campo>
              <Campo rotulo="Título"><input value={t.title} onChange={(e) => up('title', e.target.value)} className={ENTRADA} placeholder="Ex.: Trabalho em Equipe" /></Campo>
            </div>
            <Campo rotulo="Descrição"><textarea value={t.desc} onChange={(e) => up('desc', e.target.value)} rows={2} className={ENTRADA} /></Campo>
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo rotulo="Tipo">
                <select value={t.tag} onChange={(e) => up('tag', e.target.value as Trilha['tag'])} className={ENTRADA}>
                  <option value="obrigatorio">Obrigatória</option>
                  <option value="sugerido">Sugerida</option>
                </select>
              </Campo>
              <Campo rotulo="Minutos"><input type="number" value={t.mins} onChange={(e) => up('mins', Number(e.target.value))} className={ENTRADA} /></Campo>
              <Campo rotulo="Cor"><input type="color" value={t.color} onChange={(e) => up('color', e.target.value)} className={`${ENTRADA} h-[42px] p-1`} /></Campo>
            </div>
            <Campo rotulo="Imagem de capa (URL, opcional)"><input value={t.capa ?? ''} onChange={(e) => up('capa', e.target.value || null)} className={ENTRADA} placeholder="https://…" /></Campo>
            <Campo rotulo="Áreas que veem a trilha" ajuda="Deixe tudo desmarcado para todas as áreas.">
              <div className="flex flex-wrap gap-3 pt-1">
                {CENTROS_CUSTO.map((c) => (
                  <label key={c} className="inline-flex items-center gap-1.5 text-sm text-tinta">
                    <input type="checkbox" checked={t.areas.includes(c)} onChange={() => up('areas', t.areas.includes(c) ? t.areas.filter((x) => x !== c) : [...t.areas, c])} className="accent-[var(--color-marca)]" />
                    {c}
                  </label>
                ))}
              </div>
            </Campo>
          </div>
        </Cartao>

        <Cartao titulo={`Etapas (${t.acts.length})`}>
          <div className="space-y-3">
            {t.acts.map((a, i) => (
              <div key={a.id} className="rounded-lg border border-borda bg-white p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-tinta-3">#{i + 1}</span>
                  <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-tinta-2">{rotulo(a.type)}</span>
                  <div className="ml-auto flex gap-0.5">
                    <IconBtn title="Subir" disabled={i === 0} onClick={() => moverAct(i, -1)}><ArrowUp size={15} /></IconBtn>
                    <IconBtn title="Descer" disabled={i === t.acts.length - 1} onClick={() => moverAct(i, 1)}><ArrowDown size={15} /></IconBtn>
                    <IconBtn title="Remover" perigo onClick={() => up('acts', t.acts.filter((_, j) => j !== i))}><Trash2 size={15} /></IconBtn>
                  </div>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_5rem_5rem]">
                  <input value={a.title} onChange={(e) => upAct(i, { title: e.target.value })} className={ENTRADA} placeholder="Título da etapa" />
                  <input type="number" value={a.pts} onChange={(e) => upAct(i, { pts: Number(e.target.value) })} className={ENTRADA} title="Pontos" />
                  <input type="number" value={a.coins} onChange={(e) => upAct(i, { coins: Number(e.target.value) })} className={ENTRADA} title="Moedas" />
                </div>

                {a.type === 'texto' && (
                  <textarea value={(a as any).content ?? ''} onChange={(e) => upAct(i, { content: e.target.value } as Partial<Etapa>)} rows={4} className={`${ENTRADA} mt-2`} placeholder="Conteúdo da leitura (use linha em branco para separar parágrafos)" />
                )}

                {a.type === 'material' && (
                  <div className="mt-2 space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                      <select value={(a as any).midia ?? 'link'} onChange={(e) => upAct(i, { midia: e.target.value } as Partial<Etapa>)} className={ENTRADA}>
                        <option value="link">Link</option>
                        <option value="video">Vídeo</option>
                      </select>
                      <input value={(a as any).url ?? ''} onChange={(e) => upAct(i, { url: e.target.value } as Partial<Etapa>)} className={ENTRADA} placeholder="https://… (YouTube/Drive para vídeo)" />
                    </div>
                    <textarea value={(a as any).content ?? ''} onChange={(e) => upAct(i, { content: e.target.value } as Partial<Etapa>)} rows={2} className={ENTRADA} placeholder="Descrição (opcional)" />
                  </div>
                )}

                {a.type === 'quiz' && <EditorQuiz etapa={a as any} onChange={(p) => upAct(i, p)} />}

                {a.type === 'caca' && (
                  <div className="mt-2 rounded-lg bg-superficie-2 px-3 py-2 text-xs text-tinta-3">
                    Caça-palavras (não editável por aqui ainda). Palavras: {((a as any).palavras ?? []).join(', ')}
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <AddBtn onClick={() => addAct('texto')}>+ Leitura</AddBtn>
              <AddBtn onClick={() => addAct('quiz')}>+ Quiz</AddBtn>
              <AddBtn onClick={() => addAct('material')}>+ Material/Vídeo</AddBtn>
            </div>
          </div>
        </Cartao>

        <div className="sticky bottom-3 flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao type="button" onClick={salvar} disabled={pendente}>
            {pendente ? <><Loader2 size={15} className="animate-spin" aria-hidden /> Salvando…</> : <><Save size={15} aria-hidden /> Salvar trilha</>}
          </Botao>
        </div>
      </div>
    </>
  )
}

function EditorQuiz({ etapa, onChange }: { etapa: { q: string; opts: string[]; ans: number }; onChange: (p: Partial<Etapa>) => void }) {
  return (
    <div className="mt-2 space-y-2">
      <input value={etapa.q} onChange={(e) => onChange({ q: e.target.value } as Partial<Etapa>)} className={ENTRADA} placeholder="Pergunta" />
      <p className="text-xs text-tinta-3">Marque a alternativa correta:</p>
      {etapa.opts.map((op, k) => (
        <div key={k} className="flex items-center gap-2">
          <input type="radio" name={`ans-${(etapa as any).id ?? ''}-${Math.random()}`} checked={etapa.ans === k} onChange={() => onChange({ ans: k } as Partial<Etapa>)} className="accent-[var(--color-marca)]" />
          <input value={op} onChange={(e) => onChange({ opts: etapa.opts.map((o, j) => (j === k ? e.target.value : o)) } as Partial<Etapa>)} className={ENTRADA} placeholder={`Opção ${k + 1}`} />
          <IconBtn title="Remover opção" perigo disabled={etapa.opts.length <= 2} onClick={() => onChange({ opts: etapa.opts.filter((_, j) => j !== k), ans: Math.min(etapa.ans, etapa.opts.length - 2) } as Partial<Etapa>)}><X size={15} /></IconBtn>
        </div>
      ))}
      <AddBtn onClick={() => onChange({ opts: [...etapa.opts, ''] } as Partial<Etapa>)}>Adicionar opção</AddBtn>
    </div>
  )
}

function rotulo(t: Etapa['type']) { return t === 'quiz' ? 'Quiz' : t === 'material' ? 'Material' : t === 'caca' ? 'Caça-palavras' : 'Leitura' }

function IconBtn({ children, title, onClick, disabled, perigo }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; perigo?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={`rounded p-1.5 text-tinta-3 disabled:opacity-30 ${perigo ? 'hover:bg-plano hover:text-critico' : 'hover:bg-superficie-2 hover:text-marca'}`}>{children}</button>
  )
}
function AddBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-borda-forte px-3 py-2 text-sm font-medium text-tinta-2 transition-colors hover:border-marca hover:text-marca-texto"><Plus size={14} aria-hidden /> {children}</button>
  )
}
