'use client'

// =============================================================
// Solicitação de Reembolso: experiência por papel.
//  - Solicitar: formulário guiado com trilha de progresso.
//  - Minhas solicitações: as do próprio usuário (cartões).
//  - Fila de Trabalho (aprovador): o que aguarda a MINHA decisão (tabela).
//  - Central das Solicitações (aprovador): tudo no meu escopo (tabela +
//    KPIs + filtros + busca + exportação).
// Segurança reforçada nas Regras do Firestore.
// =============================================================
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from '@/components/LinkSemPrefetch'
import {
  Receipt, Plus, ClipboardList, CheckSquare, LayoutList, Paperclip,
  CheckCircle2, XCircle, Download, Printer, FileText, Image as ImageIcon, Search, FileSpreadsheet,
  X, ChevronUp, ChevronDown, ChevronsUpDown, Check, Lock, User, Building2, CalendarDays, AlertCircle,
  ArrowLeft, ArrowRight, Pencil, Trash2,
} from 'lucide-react'
import {
  CATEGORIAS, STATUS_LABEL, STATUS_FAIXA, PAPEL_LABEL, CENTROS_CUSTO, TODOS_CENTROS,
  formatBRL, formatData, podeAprovar, statusEfetivo, ehEtapaFinanceiro, estaPendente, editavelPeloSolicitante,
  ehCategoriaKm, valorKm, detalheKm, TAXA_KM_PADRAO,
  type StatusReembolso,
} from '@/lib/reembolso'
import {
  criarReembolso, prepararAnexo, listarMinhas, listarParaGestao,
  aprovarReembolso, recusarReembolso, registrarPagamento, getAnexo, editarReembolso, excluirReembolso, excluirReembolsoMaster,
  getTaxaKm,
  type Reembolso, type Anexo,
} from '@/lib/fb/reembolso'
import type { Perfil } from '@/lib/fb/funcionarios'
import { Campo, ENTRADA, Botao, Aviso, Chip } from '@/components/ui'
import { exportarXlsx, cabecalhoImpressaoHtml } from '@/lib/exportar'
import { BotaoVoltar } from '@/components/BotaoVoltar'

type Aba = 'solicitar' | 'minhas' | 'fila' | 'central'

/** Normaliza para busca: sem acento, minúsculas. */
function normalizar(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** 'AAAA-MM' → "set/2026". */
function rotuloMes(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? '')
  return m ? `${MESES_ABREV[Number(m[2]) - 1] ?? m[2]}/${m[1]}` : ym
}

export function ReembolsoApp({ perfil }: { perfil: Perfil }) {
  const ehMaster = perfil.papeis.includes('master')
  const ehFinanceiro = perfil.papeis.includes('financeiro')
  const ehGestor = perfil.papeis.includes('gestor')
  const ehAprovador = ehMaster || ehFinanceiro || ehGestor
  // Rótulo da fila conforme o papel: Gestor = "Solicitações"; Financeiro/Master = "Fila de Solicitações".
  const filaLabel = (ehFinanceiro || ehMaster) ? 'Fila de Solicitações' : 'Solicitações'

  // Todos podem solicitar (inclusive o Master Administrador). Aprovadores
  // começam na fila; os demais, na tela de solicitar.
  const [aba, setAba] = useState<Aba>(ehAprovador ? 'fila' : 'solicitar')
  const [minhas, setMinhas] = useState<Reembolso[]>([])
  const [gestao, setGestao] = useState<Reembolso[]>([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  async function recarregar() {
    setCarregando(true)
    try {
      const [m, g] = await Promise.all([
        listarMinhas(),
        ehAprovador ? listarParaGestao(perfil) : Promise.resolve([] as Reembolso[]),
      ])
      setMinhas(m); setGestao(g)
    } catch { /* silencioso */ } finally { setCarregando(false) }
  }
  useEffect(() => { recarregar() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  const pendentes = useMemo(
    () => gestao.filter((r) => r.solicitante_uid !== perfil.uid && podeAprovar(r.status, perfil.papeis, perfil.centro_custo, r.centro_custo)),
    [gestao, perfil],
  )

  const ABAS: { id: Aba; rotulo: string; Icone: typeof Plus; badge?: number }[] = [
    { id: 'solicitar' as Aba, rotulo: 'Solicitar', Icone: Plus },
    { id: 'minhas' as Aba, rotulo: 'Minhas solicitações', Icone: ClipboardList },
    ...(ehAprovador ? [
      { id: 'fila' as Aba, rotulo: filaLabel, Icone: CheckSquare, badge: pendentes.length },
      { id: 'central' as Aba, rotulo: 'Central das Solicitações', Icone: LayoutList },
    ] : []),
  ]

  return (
    <>
      <BotaoVoltar />

      <div className="mt-6 flex items-start gap-3">
        <span className="mt-1 flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-marca-clara text-marca">
          <Receipt size={22} aria-hidden />
        </span>
        <div>
          <h1 className="titulo-hero text-[1.875rem] text-tinta">Reembolso</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {perfil.papeis.map((p) => (
              <span key={p} className="rounded-full bg-superficie-2 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-tinta-2">
                {PAPEL_LABEL[p as keyof typeof PAPEL_LABEL] ?? p}
              </span>
            ))}
            {perfil.centro_custo && (
              <span className="rounded-full bg-marca-clara px-2.5 py-0.5 text-[0.6875rem] font-semibold text-marca-texto">{perfil.centro_custo}</span>
            )}
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="mt-6 flex flex-wrap gap-2">
        {ABAS.map(({ id, rotulo, Icone, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              aba === id ? 'bg-marca text-white' : 'border border-borda-forte bg-white text-tinta-2 hover:border-marca hover:text-marca-texto'
            }`}
          >
            <Icone size={15} aria-hidden /> {rotulo}
            {typeof badge === 'number' && badge > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] font-semibold leading-5 ${aba === id ? 'bg-white/25 text-white' : 'bg-critico text-white'}`}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {aviso && <Aviso tom="sucesso">{aviso}</Aviso>}
        {erro && <Aviso tom="erro">{erro}</Aviso>}

        {aba === 'solicitar' && (
          <FormReembolso perfil={perfil} aoEnviar={() => { setErro(null); recarregar(); setAba('minhas'); setSucesso(true) }} setAviso={setAviso} setErro={setErro} />
        )}
        {aba === 'minhas' && <ListaMinhas carregando={carregando} itens={minhas} perfil={perfil} aoAtualizar={recarregar} setErro={setErro} setAviso={setAviso} />}
        {aba === 'fila' && (
          <Fila perfil={perfil} carregando={carregando} pendentes={pendentes} aoDecidir={recarregar} />
        )}
        {aba === 'central' && (
          <Central perfil={perfil} carregando={carregando} registros={gestao} aoAtualizar={recarregar} setErro={setErro} setAviso={setAviso} />
        )}
      </div>

      {sucesso && <ModalSucesso onFechar={() => setSucesso(false)} />}
    </>
  )
}

// -------------------------------------------------------------
// Mensagem de sucesso após enviar a solicitação
// -------------------------------------------------------------
function ModalSucesso({ onFechar }: { onFechar: () => void }) {
  // Persiste na tela até a pessoa clicar em "Ciente": o clique fora do cartão
  // NÃO fecha (sem onClick no fundo) e a tecla Esc é ignorada.
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl sm:p-7">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eef7e3] text-verde-escuro">
          <CheckCircle2 size={34} aria-hidden />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-tinta">Solicitação realizada com sucesso!</h3>
        <div className="mt-3 space-y-2 text-sm leading-6 text-tinta-2">
          <p>
            Agora, aguarde as próximas etapas do processo. A solicitação será encaminhada para aprovação da sua
            gestão e, após a aprovação, seguirá para o Financeiro para realização do pagamento.
          </p>
          <p>Acompanhe o andamento da solicitação e aguarde a conclusão das etapas.</p>
        </div>
        <Botao type="button" onClick={onFechar} className="mt-6 w-full justify-center">
          <Check size={16} aria-hidden /> Ciente
        </Botao>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Fluxo do reembolso (4 etapas): SÓ na tela de acompanhamento do
// pedido já enviado, destacando a etapa atual conforme o status.
// -------------------------------------------------------------
const ETAPAS_FLUXO = [
  { t: 'Solicitação', d: 'Pedido enviado com o comprovante.' },
  { t: 'Aprovação do gestor', d: 'O gestor da área aprova ou recusa.' },
  { t: 'Pagamento (Financeiro)', d: 'O Financeiro registra o pagamento.' },
  { t: 'Pago', d: 'Reembolso concluído.' },
]
/** Etapa "corrente" (1..4) a partir do status; 5 = concluído (pago). */
function etapaDoStatus(status: StatusReembolso): number {
  if (status === 'pendente_gestor' || status === 'pendente_master') return 2
  if (status === 'pendente_financeiro') return 3
  if (status === 'agendado') return 4
  if (status === 'pago' || status === 'aprovado') return 5
  return 2
}
function FluxoReembolso({ status, dataPagamento }: { status: StatusReembolso; dataPagamento?: string | null }) {
  const efetivo = statusEfetivo(status, dataPagamento)
  const recusado = efetivo === 'recusado'
  const atual = etapaDoStatus(efetivo)
  return (
    <div className="rounded-xl border border-borda bg-superficie-2 p-4">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-tinta-3">Fluxo do reembolso</p>
      <ol className="mt-3">
        {ETAPAS_FLUXO.map((p, i) => {
          const n = i + 1
          let estado: 'feito' | 'ativo' | 'pendente' | 'recusa'
          if (recusado) estado = n === 1 ? 'feito' : n === 2 ? 'recusa' : 'pendente'
          else if (n < atual) estado = 'feito'
          else if (n === atual) estado = 'ativo'
          else estado = 'pendente'
          const bolha =
            estado === 'feito' ? 'bg-verde-escuro text-white'
              : estado === 'ativo' ? 'bg-marca text-white ring-4 ring-marca-clara'
                : estado === 'recusa' ? 'bg-critico text-white'
                  : 'border border-borda-forte bg-white text-tinta-3'
          const titulo = estado === 'recusa' ? 'Recusado' : p.t
          return (
            <li key={n} className="relative flex gap-3 pb-3.5 last:pb-0">
              {n < ETAPAS_FLUXO.length && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-borda-forte" aria-hidden />}
              <span className={`relative z-10 flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold ${bolha}`}>
                {estado === 'feito' ? <Check size={14} aria-hidden /> : estado === 'recusa' ? <X size={14} aria-hidden /> : n}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={`text-[0.8125rem] font-semibold ${estado === 'ativo' ? 'text-marca-escura' : estado === 'recusa' ? 'text-critico' : 'text-tinta'}`}>{titulo}</p>
                <p className="text-[0.6875rem] leading-4 text-tinta-3">{estado === 'recusa' ? 'A solicitação foi recusada.' : p.t === 'Pago' && estado === 'ativo' ? 'Pagamento agendado.' : p.d}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// -------------------------------------------------------------
// Barra dos 5 passos do wizard: SÓ enquanto preenche a solicitação.
// -------------------------------------------------------------
const PASSOS_WIZARD = ['Identificação', 'Despesa', 'Motivo', 'Comprovante', 'Conclusão']
function BarraPassos({ atual, maximo, aoIr }: { atual: number; maximo: number; aoIr: (n: number) => void }) {
  return (
    <ol className="flex items-start gap-1 overflow-x-auto pb-1">
      {PASSOS_WIZARD.map((rot, i) => {
        const n = i + 1
        const feito = n < atual
        const ativo = n === atual
        const alcancavel = n <= maximo
        return (
          <li key={n} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" style={{ minWidth: '3.4rem' }}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${n === 1 ? 'opacity-0' : feito || ativo ? 'bg-marca' : 'bg-borda-forte'}`} aria-hidden />
              <button
                type="button"
                disabled={!alcancavel}
                onClick={() => alcancavel && aoIr(n)}
                aria-current={ativo ? 'step' : undefined}
                className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-bold transition-colors ${ativo ? 'bg-marca text-white ring-4 ring-marca-clara' : feito ? 'bg-verde-escuro text-white' : 'border border-borda-forte bg-white text-tinta-3'} ${alcancavel && !ativo ? 'cursor-pointer' : ''} disabled:cursor-default`}
              >
                {feito ? <Check size={14} aria-hidden /> : n}
              </button>
              <span className={`h-0.5 flex-1 ${n === PASSOS_WIZARD.length ? 'opacity-0' : feito ? 'bg-marca' : 'bg-borda-forte'}`} aria-hidden />
            </div>
            <span className={`text-center text-[0.625rem] font-semibold leading-tight ${ativo ? 'text-marca-escura' : feito ? 'text-tinta-2' : 'text-tinta-3'}`}>{rot}</span>
          </li>
        )
      })}
    </ol>
  )
}

// -------------------------------------------------------------
// Campos auxiliares do formulário (fora do componente para não
// remontar os inputs a cada tecla: evita o "erro ao digitar").
// -------------------------------------------------------------
function CampoLeitura({ Icone, rotulo, valor }: { Icone: typeof User; rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-tinta-3">{rotulo}</p>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-borda bg-superficie-2 px-3 py-2 text-sm text-tinta">
        <Icone size={14} className="flex-none text-tinta-3" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{valor}</span>
        <span title="Preenchido automaticamente" className="flex-none"><Lock size={12} className="text-tinta-3" aria-hidden /></span>
      </div>
    </div>
  )
}
function ErroCampo({ msg }: { msg: string }) {
  if (!msg) return null
  return <p className="mt-1 flex items-center gap-1 text-xs font-medium text-critico"><AlertCircle size={12} aria-hidden /> {msg}</p>
}
const fmtDataBR = (iso: string) => { const p = iso.slice(0, 10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso }

// -------------------------------------------------------------
// Formulário de solicitação
// -------------------------------------------------------------
function FormReembolso({ perfil, aoEnviar, setAviso, setErro }: {
  perfil: Perfil; aoEnviar: () => void; setAviso: (s: string | null) => void; setErro: (s: string | null) => void
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  // Centros para os quais a pessoa pode lançar: a própria área + os extras.
  // Gestor com "Todos os centros de custo" pode lançar para qualquer área.
  const opcoesCentro = (() => {
    if ((perfil.centro_custo || '') === TODOS_CENTROS) return [...CENTROS_CUSTO]
    const base = perfil.centro_custo ? [perfil.centro_custo] : []
    const extras = Array.isArray(perfil.centros_extra) ? perfil.centros_extra : []
    return Array.from(new Set([...base, ...extras])).filter(Boolean)
  })()
  const [centro, setCentro] = useState(opcoesCentro[0] ?? '')
  const semCentro = opcoesCentro.length === 0
  const escolheCentro = opcoesCentro.length > 1

  const [passo, setPasso] = useState(1)          // 1..5
  const [maximo, setMaximo] = useState(1)         // passo mais avançado já alcançado
  const [tentou, setTentou] = useState(false)     // mostra erros do passo atual
  const [data, setData] = useState('')            // data da compra/gasto
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [km, setKm] = useState('')               // só quando a categoria é KM
  const [taxaKm, setTaxaKm] = useState(TAXA_KM_PADRAO)
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [pendente, setPendente] = useState(false)

  // Taxa de KM configurada no admin (fonte única do cálculo).
  useEffect(() => { getTaxaKm().then(setTaxaKm).catch(() => {}) }, [])

  const ehKm = ehCategoriaKm(categoria)
  const valorNum = Number(String(valor).replace(/\./g, '').replace(',', '.'))
  const kmNum = Number(String(km).replace(/\./g, '').replace(',', '.'))
  // Em KM o valor é calculado (km x taxa); nas demais, é o valor digitado.
  const valorEfetivo = ehKm ? valorKm(kmNum, taxaKm) : valorNum
  const erros = {
    data: !data ? 'Informe a data da compra/gasto.' : '',
    categoria: !categoria ? 'Escolha a categoria da despesa.' : '',
    valor: ehKm
      ? (!(kmNum > 0) ? 'Informe os quilômetros rodados.' : '')
      : (!(valorNum > 0) ? 'Informe um valor maior que zero.' : ''),
    descricao: descricao.trim().length < 3 ? 'Descreva o motivo (mínimo 3 letras).' : '',
    arquivo: !arquivo ? 'Anexe o comprovante (imagem ou PDF).' : '',
  }
  const destino = perfil.papeis.includes('gestor') ? 'Master' : perfil.papeis.includes('master') ? 'Financeiro' : `gestor do centro ${centro}`
  const borda = (e: string) => `${ENTRADA}${tentou && e ? ' border-critico focus:border-critico' : ''}`

  function passoValido(n: number): boolean {
    if (n === 1) return !semCentro
    if (n === 2) return !erros.data && !erros.categoria && !erros.valor
    if (n === 3) return !erros.descricao
    if (n === 4) return !erros.arquivo
    return !semCentro && !Object.values(erros).some(Boolean)
  }
  function avancar() {
    if (!passoValido(passo)) { setTentou(true); return }
    const n = Math.min(PASSOS_WIZARD.length, passo + 1)
    setPasso(n); setMaximo((m) => Math.max(m, n)); setTentou(false)
  }
  function voltar() { setPasso((p) => Math.max(1, p - 1)); setTentou(false) }
  function irPara(n: number) { if (n <= maximo) { setPasso(n); setTentou(false) } }

  async function enviar() {
    setErro(null); setAviso(null)
    if (!passoValido(5)) {
      setTentou(true)
      const primeiro = [1, 2, 3, 4].find((n) => !passoValido(n)) ?? 1
      setPasso(primeiro)
      setErro('Preencha todos os campos obrigatórios antes de enviar.')
      return
    }
    setPendente(true)
    try {
      const anexo: Anexo = await prepararAnexo(arquivo!)
      await criarReembolso({
        centro_custo: centro, data_despesa: data, categoria, descricao,
        valor: valorEfetivo,
        ...(ehKm ? { km: kmNum, km_taxa: taxaKm } : {}),
      }, anexo, perfil)
      aoEnviar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não consegui enviar a solicitação.')
    }
    setPendente(false)
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); passo < 5 ? avancar() : enviar() }} className="space-y-4" noValidate>
      <div className="cartao-g p-5">
        <BarraPassos atual={passo} maximo={maximo} aoIr={irPara} />
      </div>

      <div className="cartao-g space-y-4 p-5 sm:p-6">
        {/* Passo 1: Identificação */}
        {passo === 1 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-tinta">Identificação</p>
              <p className="mt-1 text-xs text-tinta-3">
                {escolheCentro
                  ? 'Confira seus dados e escolha o centro de custo da despesa.'
                  : 'Preenchido automaticamente do seu cadastro, confira e siga.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <CampoLeitura Icone={User} rotulo="Solicitante" valor={perfil.nome || perfil.email || '-'} />
              {escolheCentro ? (
                <label className="block">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-tinta-3">
                    <Building2 size={13} className="text-marca" aria-hidden /> Centro de custo da despesa
                  </span>
                  <select value={centro} onChange={(e) => setCentro(e.target.value)} className={ENTRADA}>
                    {opcoesCentro.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              ) : (
                <CampoLeitura Icone={Building2} rotulo="Centro de custo" valor={centro || 'Não definido'} />
              )}
              <CampoLeitura Icone={CalendarDays} rotulo="Data da solicitação" valor={fmtDataBR(hoje)} />
            </div>
            {escolheCentro && (
              <p className="text-xs leading-5 text-tinta-3">
                Este reembolso será aprovado pelo gestor do centro de custo escolhido.
              </p>
            )}
            {semCentro && (
              <p className="flex items-start gap-2 rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-xs leading-5 text-[#8a1f1f]">
                <AlertCircle size={14} className="mt-0.5 flex-none" aria-hidden />
                Seu centro de custo ainda não foi definido no cadastro. Peça à equipe de Gente &amp; Cultura para configurar antes de solicitar.
              </p>
            )}
          </div>
        )}

        {/* Passo 2: Despesa */}
        {passo === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-semibold text-tinta">Despesa</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-tinta">Data da compra / gasto <span className="text-critico">*</span></label>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={borda(erros.data)} max={hoje} />
                {tentou && <ErroCampo msg={erros.data} />}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-tinta">Categoria <span className="text-critico">*</span></label>
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={borda(erros.categoria)}>
                  <option value="">Escolha…</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                {tentou && <ErroCampo msg={erros.categoria} />}
              </div>
            </div>
            {ehKm ? (
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-tinta">Quilômetros rodados <span className="text-critico">*</span></label>
                  <input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="Ex.: 120" className={borda(erros.valor)} />
                  {tentou && <ErroCampo msg={erros.valor} />}
                </div>
                <div className="rounded-lg border border-borda bg-superficie-2 px-3 py-2.5">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-tinta-3">Valor do reembolso (calculado)</p>
                  <p className="mt-0.5 flex items-center gap-2 text-tinta">
                    <span className="text-lg font-[680]">{formatBRL(valorEfetivo)}</span>
                    <span title="Calculado automaticamente, não editável"><Lock size={12} className="text-tinta-3" aria-hidden /></span>
                  </p>
                  <p className="mt-0.5 text-xs text-tinta-3">{detalheKm(kmNum, taxaKm, valorEfetivo)}</p>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-tinta">Valor (R$) <span className="text-critico">*</span></label>
                <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 150,00" className={borda(erros.valor)} />
                {tentou && <ErroCampo msg={erros.valor} />}
              </div>
            )}
          </div>
        )}

        {/* Passo 3: Motivo */}
        {passo === 3 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-tinta">Motivo</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-tinta">Descrição <span className="text-critico">*</span></label>
              <textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} className={borda(erros.descricao)} placeholder="Ex.: almoço com cliente, corrida de app até o evento…" />
              {tentou && <ErroCampo msg={erros.descricao} />}
            </div>
          </div>
        )}

        {/* Passo 4: Comprovante */}
        {passo === 4 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-tinta">Comprovante</p>
            <div>
              <label className="mb-1 block text-sm font-medium text-tinta">Anexo <span className="text-critico">*</span></label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-white px-4 py-3 text-sm text-tinta-2 transition-colors hover:border-marca ${tentou && erros.arquivo ? 'border-critico' : 'border-borda-forte'}`}>
                <Paperclip size={16} className="text-marca" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{arquivo ? arquivo.name : 'Escolher foto ou PDF…'}</span>
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              </label>
              <p className="mt-1 text-xs text-tinta-3">Aceita imagem (foto) ou PDF.</p>
              {tentou && <ErroCampo msg={erros.arquivo} />}
            </div>
          </div>
        )}

        {/* Passo 5: Conclusão */}
        {passo === 5 && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-tinta">Conclusão</p>
              <p className="mt-1 text-xs text-tinta-3">Confira os dados e envie. Depois vai direto para <strong className="font-semibold text-tinta-2">{destino}</strong>.</p>
            </div>
            <dl className="grid gap-x-4 gap-y-2.5 rounded-xl border border-borda bg-superficie-2 p-4 sm:grid-cols-2">
              <Resumo rotulo="Solicitante" valor={perfil.nome || perfil.email || '-'} />
              <Resumo rotulo="Centro de custo" valor={centro || '-'} />
              <Resumo rotulo="Data da compra" valor={data ? fmtDataBR(data) : '-'} />
              <Resumo rotulo="Categoria" valor={categoria || '-'} />
              <Resumo rotulo="Valor" valor={valorEfetivo > 0 ? formatBRL(valorEfetivo) : '-'} />
              {ehKm && <Resumo rotulo="Quilometragem" valor={kmNum > 0 ? detalheKm(kmNum, taxaKm, valorEfetivo) : '-'} />}
              <Resumo rotulo="Comprovante" valor={arquivo ? arquivo.name : '-'} />
              <div className="sm:col-span-2"><Resumo rotulo="Descrição" valor={descricao.trim() || '-'} /></div>
            </dl>
          </div>
        )}

        {/* Navegação do wizard */}
        <div className="flex items-center justify-between gap-3 border-t border-borda pt-4">
          <button
            type="button"
            onClick={voltar}
            disabled={passo === 1 || pendente}
            className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3.5 py-2 text-sm font-medium text-tinta-2 transition-colors hover:border-marca disabled:opacity-40"
          >
            <ArrowLeft size={15} aria-hidden /> Voltar
          </button>
          {passo < PASSOS_WIZARD.length ? (
            <Botao type="submit" disabled={semCentro}>
              Continuar <ArrowRight size={15} aria-hidden />
            </Botao>
          ) : (
            <Botao type="submit" disabled={pendente || semCentro}>
              <Receipt size={15} aria-hidden /> {pendente ? 'Enviando…' : 'Enviar solicitação'}
            </Botao>
          )}
        </div>
      </div>
    </form>
  )
}
function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-tinta-3">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-sm text-tinta">{valor}</dd>
    </div>
  )
}

// -------------------------------------------------------------
// Minhas solicitações (cartões)
// -------------------------------------------------------------
/** "Em aberto" = ainda tramitando (pendências e pagamento agendado). */
function emAbertoReembolso(r: Reembolso): boolean {
  const s = statusEfetivo(r.status, r.data_pagamento)
  return estaPendente(s) || s === 'agendado'
}

function ListaMinhas({ carregando, itens, perfil, aoAtualizar, setErro, setAviso }: {
  carregando: boolean; itens: Reembolso[]; perfil: Perfil; aoAtualizar: () => void
  setErro: (s: string | null) => void; setAviso: (s: string | null) => void
}) {
  const [editar, setEditar] = useState<Reembolso | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fCategoria, setFCategoria] = useState('')

  const statuses = useMemo(() => Array.from(new Set(itens.map((r) => statusEfetivo(r.status, r.data_pagamento)))), [itens])
  const categorias = useMemo(() => Array.from(new Set(itens.map((r) => r.categoria).filter(Boolean))).sort(), [itens])

  const filtrados = useMemo(() => {
    const q = normalizar(busca)
    return itens.filter((r) => {
      if (fStatus && statusEfetivo(r.status, r.data_pagamento) !== fStatus) return false
      if (fCategoria && r.categoria !== fCategoria) return false
      if (q) {
        const blob = normalizar(`${formatBRL(r.valor)} ${r.categoria} ${r.centro_custo} ${r.descricao ?? ''} ${STATUS_LABEL[statusEfetivo(r.status, r.data_pagamento)]}`)
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [itens, busca, fStatus, fCategoria])

  const emAberto = filtrados.filter(emAbertoReembolso)
  const concluido = filtrados.filter((r) => !emAbertoReembolso(r))
  const temFiltro = !!(busca || fStatus || fCategoria)

  if (carregando) return <p className="text-sm text-tinta-3">Carregando…</p>
  if (itens.length === 0)
    return (
      <div className="cartao-g p-8 text-center">
        <p className="text-sm font-medium text-tinta">Você ainda não fez nenhuma solicitação.</p>
        <p className="mt-1 text-sm text-tinta-3">Use a aba "Solicitar" para pedir seu primeiro reembolso.</p>
      </div>
    )

  const abrirEdicao = (r: Reembolso) => setEditar(r)

  async function excluir(r: Reembolso) {
    if (!confirm(`Excluir esta solicitação de ${formatBRL(r.valor)} (${r.categoria})? Esta ação não pode ser desfeita.`)) return
    setErro(null); setAviso(null); setExcluindo(r.id)
    try {
      await excluirReembolso(r.id, perfil)
      setAviso('Solicitação excluída.')
      aoAtualizar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir a solicitação.')
    } finally {
      setExcluindo(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Filtros de pesquisa (mesmos do painel dos aprovadores) */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-3" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} className={`${ENTRADA} pl-9`} placeholder="Buscar (valor, categoria, motivo…)" />
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={ENTRADA}>
          <option value="">Todos os status</option>
          {statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className={ENTRADA}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {temFiltro && (
        <div className="-mt-3 flex items-center justify-between text-xs text-tinta-3">
          <span>{filtrados.length} de {itens.length} solicitação(ões)</span>
          <button type="button" onClick={() => { setBusca(''); setFStatus(''); setFCategoria('') }} className="inline-flex items-center gap-1 font-medium hover:text-critico">
            <X size={12} aria-hidden /> Limpar filtros
          </button>
        </div>
      )}

      <SecaoMinhas titulo="Em aberto" itens={emAberto} vazio="Nada em aberto no momento." onEditar={abrirEdicao} onExcluir={excluir} excluindo={excluindo} />
      <SecaoMinhas titulo="Concluído" itens={concluido} vazio="Nada concluído ainda." onEditar={abrirEdicao} onExcluir={excluir} excluindo={excluindo} />

      {editar && (
        <ModalEditar
          r={editar}
          perfil={perfil}
          onFechar={() => setEditar(null)}
          aoSalvo={(msg) => { setEditar(null); setErro(null); setAviso(msg); aoAtualizar() }}
        />
      )}
    </div>
  )
}

function SecaoMinhas({ titulo, itens, vazio, onEditar, onExcluir, excluindo }: {
  titulo: string; itens: Reembolso[]; vazio: string
  onEditar: (r: Reembolso) => void; onExcluir: (r: Reembolso) => void; excluindo: string | null
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-tinta">
        {titulo}
        <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-tinta-3">{itens.length}</span>
      </h3>
      {itens.length === 0 ? (
        <p className="mt-2 text-sm text-tinta-3">{vazio}</p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{itens.map((r) => <CardReembolso key={r.id} r={r} onEditar={onEditar} onExcluir={onExcluir} excluindo={excluindo === r.id} />)}</div>
      )}
    </section>
  )
}

function StatusChip({ status, dataPagamento }: { status: StatusReembolso; dataPagamento?: string | null }) {
  const s = statusEfetivo(status, dataPagamento)
  return <Chip faixa={STATUS_FAIXA[s]}>{STATUS_LABEL[s]}</Chip>
}

function CardReembolso({ r, onEditar, onExcluir, excluindo }: {
  r: Reembolso; onEditar?: (r: Reembolso) => void; onExcluir?: (r: Reembolso) => void; excluindo?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const recusa = [...(r.historico ?? [])].reverse().find((h) => h.status_novo === 'recusado')
  const efetivo = statusEfetivo(r.status, r.data_pagamento)
  const foiRecusado = efetivo === 'recusado'
  const podeMexer = editavelPeloSolicitante(efetivo)
  return (
    <div className="cartao-g overflow-hidden">
      <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-[620] text-tinta">{formatBRL(r.valor)}</span>
            <span className="text-sm text-tinta-3">· {r.categoria}</span>
          </span>
          <span className="mt-0.5 block text-xs text-tinta-3">{formatData(r.data_despesa)} · {r.centro_custo}</span>
        </span>
        <StatusChip status={r.status} dataPagamento={r.data_pagamento} />
      </button>
      {aberto && (
        <div className="border-t border-borda px-4 py-4">
          <p className="text-sm leading-6 text-tinta-2">{r.descricao}</p>
          {r.km != null && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-marca-clara px-2.5 py-1 text-xs font-semibold text-marca-texto">
              Quilometragem: {detalheKm(r.km, r.km_taxa, r.valor)}
            </p>
          )}
          {recusa?.motivo && (
            <p className="mt-3 rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-sm text-[#8a1f1f]">
              <strong className="font-semibold">Motivo da recusa:</strong> {recusa.motivo}
            </p>
          )}
          {podeMexer && (onEditar || onExcluir) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onEditar && (
                <button
                  type="button"
                  onClick={() => onEditar(r)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-marca-escura"
                >
                  <Pencil size={15} aria-hidden /> {foiRecusado ? 'Editar e reenviar' : 'Ajustar'}
                </button>
              )}
              {onExcluir && (
                <button
                  type="button"
                  onClick={() => onExcluir(r)}
                  disabled={excluindo}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3.5 py-2 text-sm font-medium text-tinta-2 transition-colors hover:border-critico hover:text-critico disabled:opacity-50"
                >
                  <Trash2 size={15} aria-hidden /> {excluindo ? 'Excluindo…' : 'Excluir'}
                </button>
              )}
            </div>
          )}
          <div className="mt-3"><FluxoReembolso status={r.status} dataPagamento={r.data_pagamento} /></div>
          <Timeline r={r} />
          <div className="mt-3"><BotaoAnexo id={r.id} tipo={r.anexo_tipo} /></div>
        </div>
      )}
    </div>
  )
}

function Timeline({ r }: { r: Reembolso }) {
  return (
    <ol className="mt-4 space-y-2">
      {(r.historico ?? []).map((h, i) => {
        const recusado = h.status_novo === 'recusado'
        const edicao = h.tipo === 'edicao'
        return (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full ${recusado ? 'bg-[#fdeaea] text-critico' : edicao ? 'bg-marca-clara text-marca-texto' : 'bg-[#eef7e3] text-verde-escuro'}`}>
              {recusado ? <XCircle size={13} aria-hidden /> : edicao ? <Pencil size={12} aria-hidden /> : <CheckCircle2 size={13} aria-hidden />}
            </span>
            <span className="text-tinta-2">
              <strong className="font-semibold text-tinta">{edicao ? 'Editado e reenviado' : STATUS_LABEL[h.status_novo]}</strong>
              {(edicao || h.papel !== 'solicitante') && <> · por {h.por_nome || '-'}</>}
              <span className="text-tinta-3"> · {formatData(h.em)}</span>
              {h.data_pagamento && <span className="text-tinta-3"> · pagamento em {formatData(h.data_pagamento)}</span>}
              {edicao && h.alteracoes && <span className="mt-0.5 block text-xs text-tinta-3">{h.alteracoes}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function BotaoAnexo({ id, tipo }: { id: string; tipo: 'image' | 'pdf' | null }) {
  const [carregando, setCarregando] = useState(false)
  async function abrir() {
    setCarregando(true)
    try {
      const a = await getAnexo(id)
      if (!a) return
      const blob = await (await fetch(a.dados)).blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally { setCarregando(false) }
  }
  return (
    <button type="button" onClick={abrir} disabled={carregando} className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3 py-1.5 text-sm font-medium text-tinta-2 transition-colors hover:border-marca hover:text-marca-texto disabled:opacity-60">
      {tipo === 'pdf' ? <FileText size={15} aria-hidden /> : <ImageIcon size={15} aria-hidden />}
      {carregando ? 'Abrindo…' : 'Ver comprovante'}
    </button>
  )
}

// -------------------------------------------------------------
// Editar após recusa (solicitante): ajusta o pedido e reenvia ao fluxo
// -------------------------------------------------------------
function ModalEditar({ r, perfil, onFechar, aoSalvo }: {
  r: Reembolso; perfil: Perfil; onFechar: () => void; aoSalvo: (msg: string) => void
}) {
  const hoje = new Date().toISOString().slice(0, 10)
  const [data, setData] = useState(String(r.data_despesa ?? '').slice(0, 10))
  const [categoria, setCategoria] = useState(r.categoria ?? '')
  const [valor, setValor] = useState(String(r.valor ?? '').replace('.', ','))
  const [km, setKm] = useState(r.km != null ? String(r.km).replace('.', ',') : '')
  const [taxaKm, setTaxaKm] = useState(r.km_taxa && r.km_taxa > 0 ? r.km_taxa : TAXA_KM_PADRAO)
  const [descricao, setDescricao] = useState(r.descricao ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const recusa = [...(r.historico ?? [])].reverse().find((h) => h.status_novo === 'recusado')

  // Taxa atual de KM (para recalcular se a pessoa mexer no km).
  useEffect(() => { getTaxaKm().then(setTaxaKm).catch(() => {}) }, [])

  const ehKm = ehCategoriaKm(categoria)
  const valorNum = Number(String(valor).replace(/\./g, '').replace(',', '.'))
  const kmNum = Number(String(km).replace(/\./g, '').replace(',', '.'))
  const valorEfetivo = ehKm ? valorKm(kmNum, taxaKm) : valorNum

  async function salvar() {
    setErro(null)
    if (!data) return setErro('Informe a data da compra/gasto.')
    if (!categoria) return setErro('Escolha a categoria.')
    if (ehKm ? !(kmNum > 0) : !(valorNum > 0)) {
      return setErro(ehKm ? 'Informe os quilômetros rodados.' : 'Informe um valor maior que zero.')
    }
    if (descricao.trim().length < 3) return setErro('Descreva o motivo (mínimo 3 letras).')
    setPendente(true)
    try {
      const anexo = arquivo ? await prepararAnexo(arquivo) : null
      await editarReembolso(r.id, {
        data_despesa: data, categoria, descricao,
        valor: valorEfetivo,
        ...(ehKm ? { km: kmNum, km_taxa: taxaKm } : {}),
      }, perfil, anexo)
      aoSalvo('Reembolso ajustado e reenviado para aprovação.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui reenviar.')
      setPendente(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onFechar}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-tinta">Editar e reenviar</h3>
            <p className="mt-0.5 text-xs text-tinta-3">Ajuste o pedido recusado. Ele volta para aprovação e o histórico guarda a alteração.</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-tinta-3 hover:bg-superficie-2" aria-label="Fechar"><X size={18} aria-hidden /></button>
        </div>

        {recusa?.motivo && (
          <p className="mt-3 rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-sm text-[#8a1f1f]">
            <strong className="font-semibold">Motivo da recusa:</strong> {recusa.motivo}
          </p>
        )}
        {erro && <div className="mt-3"><Aviso tom="erro">{erro}</Aviso></div>}

        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-tinta">Data da compra / gasto</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={ENTRADA} max={hoje} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-tinta">Categoria</label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={ENTRADA}>
                <option value="">Escolha…</option>
                {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {ehKm ? (
            <div className="space-y-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-tinta">Quilômetros rodados</label>
                <input inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="Ex.: 120" className={ENTRADA} />
              </div>
              <div className="rounded-lg border border-borda bg-superficie-2 px-3 py-2.5">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-tinta-3">Valor do reembolso (calculado)</p>
                <p className="mt-0.5 flex items-center gap-2 text-tinta">
                  <span className="text-lg font-[680]">{formatBRL(valorEfetivo)}</span>
                  <span title="Calculado automaticamente, não editável"><Lock size={12} className="text-tinta-3" aria-hidden /></span>
                </p>
                <p className="mt-0.5 text-xs text-tinta-3">{detalheKm(kmNum, taxaKm, valorEfetivo)}</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-tinta">Valor (R$)</label>
              <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 150,00" className={ENTRADA} />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-tinta">Descrição</label>
            <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} className={ENTRADA} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-tinta">Comprovante</label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-borda-forte bg-white px-4 py-3 text-sm text-tinta-2 transition-colors hover:border-marca">
              <Paperclip size={16} className="text-marca" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{arquivo ? arquivo.name : (r.anexo_nome ? `Atual: ${r.anexo_nome}: trocar (opcional)` : 'Anexar foto ou PDF (opcional)')}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
            <p className="mt-1 text-xs text-tinta-3">Deixe em branco para manter o comprovante atual.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Botao type="button" variante="secundario" onClick={onFechar} disabled={pendente}>Cancelar</Botao>
          <Botao type="button" onClick={salvar} disabled={pendente}>
            {pendente ? 'Reenviando…' : <><Check size={15} aria-hidden /> Salvar e reenviar</>}
          </Botao>
        </div>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Tabela de solicitações (busca + filtros + ordenação)
// -------------------------------------------------------------
type Coluna = { key: string; label: string; texto: (r: Reembolso) => string; ord: (r: Reembolso) => string | number; right?: boolean; chip?: boolean; trunc?: boolean }

const COLS_BASE: Coluna[] = [
  { key: 'data', label: 'Data', texto: (r) => formatData(r.data_despesa), ord: (r) => r.data_despesa ?? '' },
  { key: 'solicitante', label: 'Solicitante', texto: (r) => r.solicitante_nome, ord: (r) => normalizar(r.solicitante_nome), trunc: true },
  { key: 'centro', label: 'Centro de custo', texto: (r) => r.centro_custo, ord: (r) => normalizar(r.centro_custo) },
  { key: 'categoria', label: 'Categoria', texto: (r) => r.categoria, ord: (r) => normalizar(r.categoria) },
  { key: 'valor', label: 'Valor', texto: (r) => formatBRL(r.valor), ord: (r) => r.valor ?? 0, right: true },
  { key: 'status', label: 'Status', texto: (r) => STATUS_LABEL[statusEfetivo(r.status, r.data_pagamento)], ord: (r) => r.status, chip: true },
]
const COLS_CENTRAL: Coluna[] = [
  ...COLS_BASE,
  { key: 'pagamento', label: 'Pagamento', texto: (r) => (r.data_pagamento ? formatData(r.data_pagamento) : '-'), ord: (r) => r.data_pagamento ?? '' },
]

function TabelaSolicitacoes({ registros, colunas, aoAbrir, acoes, aoFiltrar }: {
  registros: Reembolso[]; colunas: Coluna[]; aoAbrir: (r: Reembolso) => void; acoes?: (r: Reembolso) => React.ReactNode
  /** Informa ao pai a lista já filtrada e o resumo dos filtros (para exportar o mesmo recorte). */
  aoFiltrar?: (dados: Reembolso[], resumoFiltros: string) => void
}) {
  const [busca, setBusca] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fCentro, setFCentro] = useState('')
  const [fCategoria, setFCategoria] = useState('')
  const [fMes, setFMes] = useState('')
  const [ordKey, setOrdKey] = useState('data')
  const [ordDir, setOrdDir] = useState<1 | -1>(-1)

  const centros = useMemo(() => Array.from(new Set(registros.map((r) => r.centro_custo).filter(Boolean))).sort(), [registros])
  const categorias = useMemo(() => Array.from(new Set(registros.map((r) => r.categoria).filter(Boolean))).sort(), [registros])
  // Meses presentes (pela data da despesa), mais recentes primeiro.
  const meses = useMemo(
    () => Array.from(new Set(registros.map((r) => String(r.data_despesa ?? '').slice(0, 7)).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [registros],
  )
  // Só mostra o filtro de centro quando há mais de uma área no escopo (oculta
  // para colaborador e para gestor de uma área só).
  const mostrarCentro = centros.length > 1
  const statuses = useMemo(() => Array.from(new Set(registros.map((r) => statusEfetivo(r.status, r.data_pagamento)))), [registros])

  const filtrados = useMemo(() => {
    const q = normalizar(busca)
    const arr = registros.filter((r) => {
      if (fStatus && statusEfetivo(r.status, r.data_pagamento) !== fStatus) return false
      if (fCentro && r.centro_custo !== fCentro) return false
      if (fCategoria && r.categoria !== fCategoria) return false
      if (fMes && String(r.data_despesa ?? '').slice(0, 7) !== fMes) return false
      if (q) {
        const blob = normalizar(colunas.map((c) => c.texto(r)).join(' ') + ' ' + (r.descricao ?? ''))
        if (!blob.includes(q)) return false
      }
      return true
    })
    const col = colunas.find((c) => c.key === ordKey)
    if (col) arr.sort((a, b) => { const va = col.ord(a), vb = col.ord(b); return (va < vb ? -1 : va > vb ? 1 : 0) * ordDir })
    return arr
  }, [registros, busca, fStatus, fCentro, fCategoria, fMes, ordKey, ordDir, colunas])

  // Resumo textual dos filtros ativos (para o topo das exportações).
  const resumoFiltros = useMemo(() => [
    fStatus && `Status: ${STATUS_LABEL[fStatus as StatusReembolso] ?? fStatus}`,
    fMes && `Mês: ${rotuloMes(fMes)}`,
    fCentro && `Centro de custo: ${fCentro}`,
    fCategoria && `Categoria: ${fCategoria}`,
    busca.trim() && `Busca: “${busca.trim()}”`,
  ].filter(Boolean).join(' · '), [fStatus, fMes, fCentro, fCategoria, busca])

  // Repassa ao pai a lista filtrada e o resumo, para exportar o MESMO recorte.
  useEffect(() => { aoFiltrar?.(filtrados, resumoFiltros) }, [filtrados, resumoFiltros, aoFiltrar])

  // Totais do que está filtrado: total geral e total AINDA PENDENTE (em R$).
  const totalGeral = useMemo(() => filtrados.reduce((s, r) => s + (Number(r.valor) || 0), 0), [filtrados])
  const totalPendente = useMemo(
    () => filtrados.filter((r) => estaPendente(r.status)).reduce((s, r) => s + (Number(r.valor) || 0), 0),
    [filtrados],
  )

  function ordenar(key: string) {
    if (key === ordKey) setOrdDir((d) => (d === 1 ? -1 : 1))
    else { setOrdKey(key); setOrdDir(1) }
  }

  const limpar = busca || fStatus || fCentro || fCategoria || fMes

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-3" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} className={`${ENTRADA} pl-9`} placeholder="Buscar em tudo (nome, valor, status…)" />
        </div>
        <select value={fMes} onChange={(e) => setFMes(e.target.value)} className={ENTRADA}>
          <option value="">Todos os meses</option>
          {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={ENTRADA}>
          <option value="">Todos os status</option>
          {statuses.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        {mostrarCentro && (
          <select value={fCentro} onChange={(e) => setFCentro(e.target.value)} className={ENTRADA}>
            <option value="">Todos os centros</option>
            {centros.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className={ENTRADA}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-tinta-3">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{filtrados.length} de {registros.length} solicitação(ões)</span>
          <span>· Total: <strong className="font-semibold text-tinta">{formatBRL(totalGeral)}</strong></span>
          <span>· Pendente: <strong className="font-semibold text-[#8a6d00]">{formatBRL(totalPendente)}</strong></span>
        </span>
        {limpar && (
          <button type="button" onClick={() => { setBusca(''); setFStatus(''); setFCentro(''); setFCategoria(''); setFMes('') }} className="inline-flex items-center gap-1 font-medium hover:text-critico">
            <X size={12} aria-hidden /> Limpar filtros
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="cartao-g p-6 text-center text-sm text-tinta-3">Nada encontrado com esses filtros.</div>
      ) : (
        <div className="cartao-g overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs font-semibold text-tinta-3">
                {colunas.map((c) => (
                  <th key={c.key} className={`px-4 py-2.5 ${c.right ? 'text-right' : ''}`}>
                    <button type="button" onClick={() => ordenar(c.key)} className={`inline-flex items-center gap-1 hover:text-marca ${c.right ? 'flex-row-reverse' : ''}`}>
                      {c.label}
                      {ordKey === c.key ? (ordDir === 1 ? <ChevronUp size={13} aria-hidden /> : <ChevronDown size={13} aria-hidden />) : <ChevronsUpDown size={13} className="opacity-40" aria-hidden />}
                    </button>
                  </th>
                ))}
                {acoes && <th className="px-4 py-2.5 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {filtrados.map((r) => (
                <tr key={r.id} onClick={() => aoAbrir(r)} className="cursor-pointer hover:bg-superficie-2">
                  {colunas.map((c) => (
                    <td key={c.key} className={`px-4 py-2.5 ${c.trunc ? '' : 'whitespace-nowrap'} ${c.right ? 'text-right font-medium text-tinta' : 'text-tinta-2'}`}>
                      {c.chip ? (
                        <StatusChip status={r.status} dataPagamento={r.data_pagamento} />
                      ) : c.trunc ? (
                        <span className="block max-w-[12rem] truncate" title={c.texto(r)}>{c.texto(r)}</span>
                      ) : (
                        c.texto(r)
                      )}
                    </td>
                  ))}
                  {acoes && <td className="whitespace-nowrap px-4 py-2.5 text-right">{acoes(r)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// Fila de Trabalho (aprovador): tabela + modal de decisão
// -------------------------------------------------------------
type ResultadoAcao = { tipo: 'sucesso' | 'reprovado'; titulo: string; mensagem: string }

function Fila({ perfil, carregando, pendentes, aoDecidir }: {
  perfil: Perfil; carregando: boolean; pendentes: Reembolso[]; aoDecidir: () => void
}) {
  const [aberto, setAberto] = useState<{ r: Reembolso; modo: 'ver' | 'recusar' } | null>(null)
  const [resultado, setResultado] = useState<ResultadoAcao | null>(null)
  if (carregando) return <p className="text-sm text-tinta-3">Carregando…</p>

  const icones = (r: Reembolso) => (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <button type="button" title={ehEtapaFinanceiro(r.status) ? 'Registrar pagamento' : 'Aprovar'} onClick={() => setAberto({ r, modo: 'ver' })} className="rounded-md p-1.5 text-verde-escuro transition-colors hover:bg-[#eef7e3]">
        <CheckCircle2 size={18} aria-hidden />
      </button>
      <button type="button" title="Recusar" onClick={() => setAberto({ r, modo: 'recusar' })} className="rounded-md p-1.5 text-critico transition-colors hover:bg-[#fdeaea]">
        <XCircle size={18} aria-hidden />
      </button>
    </div>
  )

  return (
    <>
      <p className="text-sm text-tinta-2">Solicitações aguardando <strong>a sua decisão</strong> ({pendentes.length}).</p>
      {pendentes.length === 0 ? (
        <div className="cartao-g p-6 text-center text-sm text-tinta-3">Nada aguardando você agora. 🎉</div>
      ) : (
        <TabelaSolicitacoes registros={pendentes} colunas={COLS_BASE} aoAbrir={(r) => setAberto({ r, modo: 'ver' })} acoes={icones} />
      )}
      {aberto && (
        <ModalDecisao
          r={aberto.r}
          perfil={perfil}
          modoInicial={aberto.modo}
          onFechar={() => setAberto(null)}
          aoConcluir={(res) => { setAberto(null); setResultado(res) }}
        />
      )}
      {resultado && <ModalResultado {...resultado} onFechar={() => { setResultado(null); aoDecidir() }} />}
    </>
  )
}

function ModalResultado({ tipo, titulo, mensagem, onFechar }: ResultadoAcao & { onFechar: () => void }) {
  const sucesso = tipo === 'sucesso'
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 p-4" onClick={onFechar}>
      <div className="anim-fade-up w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl sm:p-7" onClick={(e) => e.stopPropagation()}>
        <span className={`anim-pop mx-auto flex h-16 w-16 items-center justify-center rounded-full ${sucesso ? 'bg-[#eef7e3] text-verde-escuro' : 'bg-[#fdeaea] text-critico'}`}>
          {sucesso ? <CheckCircle2 size={34} aria-hidden /> : <XCircle size={34} aria-hidden />}
        </span>
        <h3 className="mt-4 text-lg font-semibold text-tinta">{titulo}</h3>
        <p className="mt-3 text-sm leading-6 text-tinta-2">{mensagem}</p>
        <Botao type="button" onClick={onFechar} className="mt-6 w-full justify-center">Entendi</Botao>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Central das Solicitações (aprovador): KPIs + tabela + exportar
// -------------------------------------------------------------
function Central({ perfil, carregando, registros, aoAtualizar, setErro, setAviso }: {
  perfil: Perfil; carregando: boolean; registros: Reembolso[]
  aoAtualizar: () => void; setErro: (s: string | null) => void; setAviso: (s: string | null) => void
}) {
  const [aberto, setAberto] = useState<Reembolso | null>(null)
  const [excluindo, setExcluindo] = useState<string | null>(null)
  const ehMaster = perfil.papeis.includes('master')

  async function excluir(r: Reembolso) {
    if (!confirm(`Excluir a solicitação de ${r.solicitante_nome} (${formatBRL(r.valor)} · ${r.categoria})? Esta ação não pode ser desfeita.`)) return
    setErro(null); setAviso(null); setExcluindo(r.id)
    try {
      await excluirReembolsoMaster(r.id, perfil)
      setAviso('Solicitação excluída.')
      aoAtualizar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui excluir.')
    } finally {
      setExcluindo(null)
    }
  }

  const acoesMaster = ehMaster
    ? (r: Reembolso) => (
        <button
          type="button"
          title="Excluir solicitação"
          disabled={excluindo === r.id}
          onClick={(e) => { e.stopPropagation(); excluir(r) }}
          className="rounded-md p-1.5 text-tinta-3 transition-colors hover:bg-plano hover:text-critico disabled:opacity-40"
        >
          <Trash2 size={17} aria-hidden />
        </button>
      )
    : undefined
  const kpis = useMemo(() => {
    let pend = 0, pagos = 0, recus = 0, pendValor = 0
    for (const r of registros) {
      const s = statusEfetivo(r.status, r.data_pagamento)
      if (estaPendente(r.status)) { pend++; pendValor += Number(r.valor) || 0 }
      else if (s === 'pago' || s === 'agendado' || s === 'aprovado') pagos++
      else if (s === 'recusado') recus++
    }
    return { total: registros.length, pend, pagos, recus, pendValor }
  }, [registros])
  const escopo = perfil.papeis.includes('gestor') && !perfil.papeis.includes('master') && !perfil.papeis.includes('financeiro')
    ? `centro ${perfil.centro_custo || '-'}` : 'todos os centros de custo'

  // Exportar EXATAMENTE o que a tabela mostra: a lista filtrada e o resumo dos
  // filtros vêm da própria TabelaSolicitacoes (mesma coleção que ela renderiza).
  const [expDados, setExpDados] = useState<Reembolso[]>(registros)
  const [expResumo, setExpResumo] = useState('')
  const aoFiltrar = useCallback((dados: Reembolso[], resumo: string) => {
    setExpDados(dados)
    setExpResumo(resumo)
  }, [])
  const filtrosExport = [expResumo, `Escopo: ${escopo}`].filter(Boolean).join(' · ')

  if (carregando) return <p className="text-sm text-tinta-3">Carregando…</p>

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi rotulo="Total" valor={kpis.total} />
        <Kpi rotulo="Pendentes" valor={kpis.pend} faixa="moderado" />
        {/* Total de despesas pendentes, em valor (R$). */}
        <div className="cartao-g px-4 py-3">
          <p className="text-xs font-medium text-tinta-3">Pendente (R$)</p>
          <p className="mt-1 text-[1.5rem] font-[650] leading-none tracking-tight text-[#8a6d00]">{formatBRL(kpis.pendValor)}</p>
        </div>
        <Kpi rotulo="Pagos / agendados" valor={kpis.pagos} faixa="baixo" />
        <Kpi rotulo="Recusados" valor={kpis.recus} faixa="critico" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-tinta-3">Você enxerga {escopo}.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => baixarXlsxReemb(expDados, filtrosExport)} className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3 py-1.5 text-sm font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><FileSpreadsheet size={15} aria-hidden /> Planilha</button>
          <button type="button" onClick={() => baixarCSV(expDados, filtrosExport)} className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3 py-1.5 text-sm font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Download size={15} aria-hidden /> CSV</button>
          <button type="button" onClick={() => imprimirPDF(expDados, filtrosExport)} className="inline-flex items-center gap-1.5 rounded-lg border border-borda-forte bg-white px-3 py-1.5 text-sm font-medium text-tinta-2 hover:border-marca hover:text-marca-texto"><Printer size={15} aria-hidden /> PDF</button>
        </div>
      </div>

      <TabelaSolicitacoes registros={registros} colunas={COLS_CENTRAL} aoAbrir={setAberto} acoes={acoesMaster} aoFiltrar={aoFiltrar} />

      {aberto && <ModalDetalhe r={aberto} onFechar={() => setAberto(null)} />}
    </div>
  )
}

function Kpi({ rotulo, valor, faixa }: { rotulo: string; valor: number; faixa?: 'moderado' | 'baixo' | 'critico' }) {
  const cor = faixa === 'baixo' ? 'text-verde-escuro' : faixa === 'critico' ? 'text-critico' : faixa === 'moderado' ? 'text-[#8a6d00]' : 'text-tinta'
  return (
    <div className="cartao-g px-4 py-3">
      <p className="text-xs font-medium text-tinta-3">{rotulo}</p>
      <p className={`mt-1 text-[2rem] font-[650] leading-none tracking-tight ${cor}`}>{valor}</p>
    </div>
  )
}

// -------------------------------------------------------------
// Modais
// -------------------------------------------------------------
function Envelope({ r, children, onFechar }: { r: Reembolso; children: React.ReactNode; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onFechar}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-[680] text-tinta">{formatBRL(r.valor)}</span>
              <span className="text-sm text-tinta-3">· {r.categoria}</span>
              <StatusChip status={r.status} dataPagamento={r.data_pagamento} />
            </p>
            <p className="mt-0.5 text-xs text-tinta-3">{r.solicitante_nome} · {r.centro_custo} · {formatData(r.data_despesa)}</p>
          </div>
          <button type="button" onClick={onFechar} className="rounded-lg p-1.5 text-tinta-3 hover:bg-superficie-2" aria-label="Fechar"><X size={18} aria-hidden /></button>
        </div>
        <p className="mt-3 text-sm leading-6 text-tinta-2">{r.descricao}</p>
        {r.km != null && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-marca-clara px-2.5 py-1 text-xs font-semibold text-marca-texto">
            Quilometragem: {detalheKm(r.km, r.km_taxa, r.valor)}
          </p>
        )}
        <div className="mt-3"><BotaoAnexo id={r.id} tipo={r.anexo_tipo} /></div>
        {children}
        <Timeline r={r} />
      </div>
    </div>
  )
}

function ModalDetalhe({ r, onFechar }: { r: Reembolso; onFechar: () => void }) {
  const recusa = [...(r.historico ?? [])].reverse().find((h) => h.status_novo === 'recusado')
  return (
    <Envelope r={r} onFechar={onFechar}>
      {recusa?.motivo && (
        <p className="mt-3 rounded-lg border border-[#f0c2c2] bg-[#fdeaea] px-3 py-2 text-sm text-[#8a1f1f]"><strong className="font-semibold">Motivo da recusa:</strong> {recusa.motivo}</p>
      )}
    </Envelope>
  )
}

function ModalDecisao({ r, perfil, modoInicial, onFechar, aoConcluir }: {
  r: Reembolso; perfil: Perfil; modoInicial: 'ver' | 'recusar'; onFechar: () => void; aoConcluir: (res: ResultadoAcao) => void
}) {
  const [pendente, setPendente] = useState(false)
  const [recusando, setRecusando] = useState(modoInicial === 'recusar')
  const [motivo, setMotivo] = useState('')
  const [dataPag, setDataPag] = useState(new Date().toISOString().slice(0, 10))
  const [erro, setErro] = useState<string | null>(null)
  const financeiro = ehEtapaFinanceiro(r.status)

  async function aprovar() {
    setPendente(true); setErro(null)
    try {
      await aprovarReembolso(r.id, perfil)
      aoConcluir({ tipo: 'sucesso', titulo: 'Solicitação aprovada!', mensagem: 'Encaminhada ao Financeiro para o pagamento. Acompanhe o andamento nas próximas etapas.' })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui aprovar.'); setPendente(false) }
  }
  async function pagar() {
    setPendente(true); setErro(null)
    try {
      const { status } = await registrarPagamento(r.id, perfil, dataPag)
      aoConcluir(status === 'agendado'
        ? { tipo: 'sucesso', titulo: 'Pagamento agendado!', mensagem: 'O pagamento foi agendado para a data informada. O solicitante acompanha o status.' }
        : { tipo: 'sucesso', titulo: 'Pagamento concluído!', mensagem: 'O reembolso foi marcado como pago. Processo finalizado. ✅' })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui registrar o pagamento.'); setPendente(false) }
  }
  async function recusar() {
    setPendente(true); setErro(null)
    try {
      await recusarReembolso(r.id, perfil, motivo)
      aoConcluir({ tipo: 'reprovado', titulo: 'Solicitação reprovada', mensagem: 'O solicitante será informado com o motivo que você registrou.' })
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não consegui recusar.'); setPendente(false) }
  }

  return (
    <Envelope r={r} onFechar={onFechar}>
      <div className="mt-4 border-t border-borda pt-4">
        {erro && <div className="mb-3"><Aviso tom="erro">{erro}</Aviso></div>}
        {!recusando ? (
          financeiro ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium text-tinta-2">
                Data do pagamento
                <span className="mt-0.5 block text-[11px] font-normal text-tinta-3">Futura = Agendado; hoje/passada = Pago.</span>
                <input type="date" value={dataPag} onChange={(e) => setDataPag(e.target.value)} className={`${ENTRADA} mt-1`} />
              </label>
              <Botao type="button" disabled={pendente || !dataPag} onClick={pagar}><CheckCircle2 size={15} aria-hidden /> {pendente ? '…' : 'Registrar pagamento'}</Botao>
              <Botao type="button" variante="secundario" disabled={pendente} onClick={() => setRecusando(true)}><XCircle size={15} aria-hidden /> Recusar</Botao>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Botao type="button" disabled={pendente} onClick={aprovar}><CheckCircle2 size={15} aria-hidden /> {pendente ? '…' : 'Aprovar'}</Botao>
              <Botao type="button" variante="secundario" disabled={pendente} onClick={() => setRecusando(true)}><XCircle size={15} aria-hidden /> Recusar</Botao>
            </div>
          )
        ) : (
          <div className="space-y-2">
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder="Motivo da recusa (o solicitante vê isso)…" className={ENTRADA} />
            <div className="flex flex-wrap gap-2">
              <Botao type="button" variante="perigo" disabled={pendente || motivo.trim().length < 3} onClick={recusar}>Confirmar recusa</Botao>
              <Botao type="button" variante="fantasma" disabled={pendente} onClick={() => { setRecusando(false); setMotivo('') }}>Cancelar</Botao>
            </div>
          </div>
        )}
      </div>
    </Envelope>
  )
}

// -------------------------------------------------------------
// Exportações
// -------------------------------------------------------------
function linhasExport(itens: Reembolso[]) {
  return itens.map((r) => ({
    Data: formatData(r.data_despesa), Solicitante: r.solicitante_nome, 'Centro de custo': r.centro_custo,
    Categoria: r.categoria, Descrição: r.descricao, Valor: formatBRL(r.valor),
    Status: STATUS_LABEL[statusEfetivo(r.status, r.data_pagamento)], Pagamento: r.data_pagamento ? formatData(r.data_pagamento) : '-',
  }))
}
function baixarCSV(itens: Reembolso[], filtros: string) {
  const linhas = linhasExport(itens); if (linhas.length === 0) return
  const cab = Object.keys(linhas[0]); const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  // Topo: título, filtros aplicados + total de registros e data.
  const topo = [
    [esc('Central das Solicitações de Reembolso')].join(';'),
    [esc(`${filtros || 'Sem filtros'} · ${itens.length} registro(s)`)].join(';'),
    [esc(`Gerado em ${new Date().toLocaleString('pt-BR')}`)].join(';'),
    '',
  ]
  const csv = [...topo, cab.join(';'), ...linhas.map((l) => cab.map((c) => esc((l as any)[c])).join(';'))].join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = `reembolsos-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
async function baixarXlsxReemb(itens: Reembolso[], filtros: string) {
  const linhas = linhasExport(itens); if (linhas.length === 0) return
  const cab = Object.keys(linhas[0])
  await exportarXlsx({
    nomeArquivo: `reembolsos-${new Date().toISOString().slice(0, 10)}`,
    titulo: 'Central das Solicitações de Reembolso',
    filtros: `${filtros || 'Sem filtros'} · ${itens.length} registro(s)`,
    colunas: cab,
    linhas: linhas.map((l) => cab.map((c) => (l as any)[c] ?? '')),
    nomeAba: 'Reembolsos',
  })
}
function imprimirPDF(itens: Reembolso[], filtros: string) {
  const linhas = linhasExport(itens); const cab = linhas.length ? Object.keys(linhas[0]) : []
  const total = itens.reduce((s, r) => s + (Number(r.valor) || 0), 0)
  const w = window.open('', '_blank'); if (!w) return
  const body = linhas.map((l) => `<tr>${cab.map((c) => `<td>${String((l as any)[c] ?? '')}</td>`).join('')}</tr>`).join('')
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Reembolsos</title>
    <style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1a1714;margin:32px}
    table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d6d0c7;padding:6px 8px;text-align:left;vertical-align:top}th{background:#e7eefb;color:#002443}tfoot td{font-weight:bold;background:#f7f5f2}</style></head><body>
    ${cabecalhoImpressaoHtml('Central das Solicitações de Reembolso', `${filtros || 'Sem filtros'} · ${itens.length} registro(s)`)}
    <table><thead><tr>${cab.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody>
    <tfoot><tr><td colspan="${Math.max(1, cab.length - 3)}">Total</td><td>${formatBRL(total)}</td><td></td><td></td></tr></tfoot></table>
    <script>window.onload=function(){window.print()}</script></body></html>`)
  w.document.close()
}
