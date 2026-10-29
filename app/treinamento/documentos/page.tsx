'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import {
  FolderOpen,
  FileText,
  Table,
  Video,
  Link2,
  ExternalLink,
  ArrowLeft,
  LogIn,
  Inbox,
  Layers,
} from 'lucide-react'
import { configurado } from '@/lib/firebase'
import { getConfig } from '@/lib/fb/publico'
import { observarLogin } from '@/lib/fb/auth'
import { perfilAtual, type Perfil } from '@/lib/fb/funcionarios'
import {
  listarModulosDaArea,
  listarTodosModulos,
  listarDocumentosDaArea,
  listarTodosDocumentos,
  TIPO_DOC_LABEL,
  type AreaModulo,
  type AreaDocumento,
  type TipoDoc,
} from '@/lib/fb/documentos'
import { CabecalhoPublico, RodapePublico } from '@/components/CabecalhoPublico'
import { TelaConfiguracao } from '@/components/TelaConfiguracao'

// Um bloco de módulo com os seus documentos. O id vazio ('') é o balde de
// "Outros materiais": documentos da área que ainda não estão num módulo.
type Bloco = { id: string; titulo: string; docs: AreaDocumento[] }
type Grupo = { area: string; total: number; blocos: Bloco[] }

function IconeTipo({ tipo, size = 18 }: { tipo: TipoDoc; size?: number }) {
  if (tipo === 'pdf') return <FileText size={size} aria-hidden />
  if (tipo === 'planilha') return <Table size={size} aria-hidden />
  if (tipo === 'video') return <Video size={size} aria-hidden />
  return <Link2 size={size} aria-hidden />
}

const COR_TIPO: Record<TipoDoc, string> = {
  pdf: '#b23b3b',
  planilha: '#2f7d32',
  video: '#8a3fb0',
  link: '#1a4895',
}

/** Monta os blocos (módulos + documentos) de uma área, na ordem definida. */
function montarBlocos(modulos: AreaModulo[], docs: AreaDocumento[]): Bloco[] {
  const mods = [...modulos].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  const ids = new Set(mods.map((m) => m.id))
  const blocos: Bloco[] = []
  for (const m of mods) {
    const doModulo = docs
      .filter((d) => d.modulo_id === m.id)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    if (doModulo.length) blocos.push({ id: m.id, titulo: m.titulo, docs: doModulo })
  }
  // Documentos da área sem módulo válido entram em "Outros materiais".
  const soltos = docs
    .filter((d) => !ids.has(d.modulo_id))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
  if (soltos.length) blocos.push({ id: '', titulo: 'Outros materiais', docs: soltos })
  return blocos
}

export default function SalaDocumentos() {
  const [empresa, setEmpresa] = useState('Soulan Recursos Humanos')
  const [perfil, setPerfil] = useState<Perfil | null | undefined>(undefined)
  const [grupos, setGrupos] = useState<Grupo[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [areaAberta, setAreaAberta] = useState<string | null>(null)

  useEffect(() => {
    if (!configurado()) return
    getConfig().then((c) => setEmpresa(c.empresa_nome)).catch(() => {})
    const cancelar = observarLogin(async (u) => {
      setPerfil(u ? await perfilAtual().catch(() => null) : null)
    })
    return cancelar
  }, [])

  const ehAdmin = !!perfil && (perfil.tipo === 'admin' || perfil.papeis.includes('master'))
  const minhaArea = (perfil?.centro_custo ?? '').trim()

  useEffect(() => {
    if (perfil === undefined) return
    const logado = !!perfil && (perfil.tipo === 'admin' || perfil.tipo === 'funcionario') && perfil.ativo
    if (!logado) {
      setGrupos(null)
      return
    }
    setErro(null)
    const carregar = async () => {
      if (ehAdmin) {
        const [modulos, docs] = await Promise.all([listarTodosModulos(), listarTodosDocumentos()])
        const areas = new Set<string>()
        modulos.forEach((m) => areas.add(m.area))
        docs.forEach((d) => areas.add(d.area))
        const gs = Array.from(areas)
          .map((area) => {
            const blocos = montarBlocos(
              modulos.filter((m) => m.area === area),
              docs.filter((d) => d.area === area),
            )
            const total = blocos.reduce((s, b) => s + b.docs.length, 0)
            return { area, total, blocos }
          })
          .filter((g) => g.total > 0)
          .sort((a, b) => a.area.localeCompare(b.area))
        setGrupos(gs)
      } else if (minhaArea) {
        const [modulos, docs] = await Promise.all([
          listarModulosDaArea(minhaArea),
          listarDocumentosDaArea(minhaArea),
        ])
        const blocos = montarBlocos(modulos, docs)
        const total = blocos.reduce((s, b) => s + b.docs.length, 0)
        setGrupos([{ area: minhaArea, total, blocos }])
      } else {
        setGrupos([])
      }
    }
    carregar().catch(() => setErro('Não consegui carregar os documentos agora. Tente de novo em instantes.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil])

  const grupoAberto = useMemo(
    () => (areaAberta ? grupos?.find((g) => g.area === areaAberta) ?? null : null),
    [areaAberta, grupos],
  )

  if (!configurado()) return <TelaConfiguracao />

  const logado = !!perfil && (perfil.tipo === 'admin' || perfil.tipo === 'funcionario') && perfil.ativo

  return (
    <div className="min-h-screen">
      <CabecalhoPublico empresa={empresa} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <Link href="/treinamento" className="inline-flex items-center gap-1.5 text-sm font-medium text-tinta-3 hover:text-marca">
          <ArrowLeft size={15} aria-hidden /> Central de Conhecimento
        </Link>

        {perfil === undefined ? (
          <p className="mt-6 text-sm text-tinta-3">Carregando…</p>
        ) : !logado ? (
          <div className="mx-auto mt-6 max-w-md cartao-g p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-clara text-marca">
              <FolderOpen size={26} aria-hidden />
            </span>
            <h1 className="titulo-hero mt-5 text-[1.5rem] text-tinta">Sala de documentos</h1>
            <p className="mx-auto mt-3 max-w-sm text-[0.9688rem] leading-7 text-tinta-2">
              Entre com o seu e-mail para ver os documentos da sua área.
            </p>
            <Link href="/entrar" className="botao-gradiente mt-6 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold">
              <LogIn size={16} aria-hidden /> Entrar
            </Link>
          </div>
        ) : (
          <div className="mt-5">
            <div className="fio-marca mb-5 w-14" aria-hidden />
            <h1 className="titulo-hero text-[1.875rem] text-tinta">Sala de documentos por área</h1>
            <p className="mt-2 max-w-2xl text-[1rem] leading-7 text-tinta-2">
              {ehAdmin
                ? 'Materiais organizados por área e por módulo. Cada colaborador vê apenas os da própria área.'
                : 'Materiais da sua área, organizados por módulo.'}
            </p>

            {erro && (
              <p className="mt-4 rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-sm text-[#8a1f1f]">{erro}</p>
            )}

            {grupos === null ? (
              <p className="mt-6 text-sm text-tinta-3">Carregando documentos…</p>
            ) : !ehAdmin && !minhaArea ? (
              <div className="mt-6 cartao-g p-6 text-center text-sm text-tinta-2">
                A sua área ainda não está definida no cadastro. Fale com o Gente &amp; Cultura para liberar os seus documentos.
              </div>
            ) : grupoAberto ? (
              <ListaModulos grupo={grupoAberto} aoVoltar={() => setAreaAberta(null)} mostrarVoltar={ehAdmin || grupos.length > 1} />
            ) : grupos.length === 0 ? (
              <div className="mt-6 cartao-g p-10 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-superficie-2 text-tinta-3">
                  <Inbox size={22} aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold text-tinta">Nenhum documento ainda</p>
                <p className="mt-1 text-sm text-tinta-3">
                  {ehAdmin ? 'Adicione módulos e documentos na gestão da Sala de documentos.' : 'Assim que houver materiais para a sua área, eles aparecem aqui.'}
                </p>
              </div>
            ) : grupos.length === 1 ? (
              // Uma área só (caso do colaborador): abre os módulos direto.
              <div className="mt-6">
                <ListaModulos grupo={grupos[0]} aoVoltar={() => {}} mostrarVoltar={false} />
              </div>
            ) : (
              <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                {grupos.map((g) => (
                  <button
                    key={g.area}
                    type="button"
                    onClick={() => setAreaAberta(g.area)}
                    className="cartao-g cartao-clicavel flex flex-col gap-3 p-5 text-left"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-marca-clara text-marca">
                      <FolderOpen size={20} aria-hidden />
                    </span>
                    <span className="text-[0.9375rem] font-semibold tracking-[-0.012em] text-tinta">{g.area}</span>
                    <span className="text-[0.8125rem] text-tinta-3">
                      {g.blocos.length} {g.blocos.length === 1 ? 'módulo' : 'módulos'} · {g.total} {g.total === 1 ? 'documento' : 'documentos'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      <RodapePublico />
    </div>
  )
}

function ListaModulos({ grupo, aoVoltar, mostrarVoltar }: { grupo: Grupo; aoVoltar: () => void; mostrarVoltar: boolean }) {
  return (
    <div>
      {mostrarVoltar && (
        <button type="button" onClick={aoVoltar} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-tinta-3 hover:text-marca">
          <ArrowLeft size={15} aria-hidden /> Todas as áreas
        </button>
      )}
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-marca-clara text-marca">
          <FolderOpen size={18} aria-hidden />
        </span>
        <h2 className="titulo-secao text-tinta">{grupo.area}</h2>
      </div>

      {grupo.blocos.length === 0 ? (
        <div className="mt-4 cartao-g p-6 text-center text-sm text-tinta-3">Nenhum documento nesta área ainda.</div>
      ) : (
        <div className="mt-5 space-y-7">
          {grupo.blocos.map((b) => (
            <section key={b.id || 'outros'}>
              <div className="flex items-center gap-2 border-b border-borda pb-2">
                <Layers size={16} className="flex-none text-marca" aria-hidden />
                <h3 className="text-[0.9375rem] font-semibold tracking-[-0.012em] text-tinta">{b.titulo}</h3>
                <span className="text-xs text-tinta-3">· {b.docs.length} {b.docs.length === 1 ? 'documento' : 'documentos'}</span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {b.docs.map((d) => (
                  <li key={d.id} className="cartao-g flex items-start gap-3 p-4">
                    <span
                      className="mt-0.5 flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white"
                      style={{ background: COR_TIPO[d.tipo] }}
                    >
                      <IconeTipo tipo={d.tipo} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-tinta">{d.titulo}</p>
                      {d.descricao && <p className="mt-0.5 text-[0.8125rem] leading-[1.5] text-tinta-2">{d.descricao}</p>}
                      <p className="mt-1 text-xs text-tinta-3">{TIPO_DOC_LABEL[d.tipo]}</p>
                    </div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-none items-center gap-1.5 self-center rounded-full border border-borda-forte px-4 py-2 text-sm font-semibold text-marca-texto transition-colors hover:border-marca hover:bg-marca-clara"
                    >
                      Abrir <ExternalLink size={15} aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
