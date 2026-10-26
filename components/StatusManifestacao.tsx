import { Check, CheckCheck, Clock, Search, Hammer, CircleSlash, Archive, Inbox, MessageSquare } from 'lucide-react'
import { Chip } from './ui'
import { STATUS_MANIFESTACAO_LABEL, type ManifestacaoStatus } from '@/lib/types'
import { fmtDataHora } from '@/lib/format'

const TOM: Record<ManifestacaoStatus, 'neutro' | 'marca' | 'baixo' | 'moderado'> = {
  recebida: 'neutro',
  respondida: 'marca',
  concluida: 'baixo',
  em_analise: 'marca',
  analisada: 'marca',
  em_implementacao: 'marca',
  implementada: 'baixo',
  nao_aplicavel: 'moderado',
  arquivada: 'neutro',
}

const ICONE: Record<ManifestacaoStatus, typeof Check> = {
  recebida: Inbox,
  respondida: MessageSquare,
  concluida: CheckCheck,
  em_analise: Search,
  analisada: Clock,
  em_implementacao: Hammer,
  implementada: Check,
  nao_aplicavel: CircleSlash,
  arquivada: Archive,
}

// Cores do fluxo principal: Recebida (cinza), Respondida (azul), Concluída (verde).
const COR_FLUXO: Partial<Record<ManifestacaoStatus, string>> = {
  recebida: 'border-borda bg-superficie-2 text-tinta-2',
  respondida: 'border-[#bcd9f7] bg-[#eaf2fd] text-[#14498a]',
  concluida: 'border-[#cfe6b8] bg-[#eef7e3] text-verde-escuro',
}

export function StatusChip({ status }: { status: ManifestacaoStatus }) {
  const cor = COR_FLUXO[status]
  const Icone = ICONE[status] ?? Inbox
  if (cor) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cor}`}>
        <Icone size={12} strokeWidth={2.4} aria-hidden /> {STATUS_MANIFESTACAO_LABEL[status]}
      </span>
    )
  }
  return <Chip faixa={TOM[status]}>{STATUS_MANIFESTACAO_LABEL[status]}</Chip>
}

/** Histórico visível ao colaborador: é aqui que mora o "retorno". */
export function LinhaDoTempo({
  eventos,
}: {
  eventos: {
    status_novo: string | null
    mensagem: string | null
    autor: string | null
    criado_em: string
  }[]
}) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-tinta-3">
        Ainda não há movimentações registradas nesta manifestação.
      </p>
    )
  }

  return (
    <ol className="relative space-y-5 border-l border-borda pl-5">
      {eventos.map((evento, i) => {
        const status = (evento.status_novo ?? 'recebida') as ManifestacaoStatus
        const Icone = ICONE[status] ?? Inbox
        const ultimo = i === eventos.length - 1

        return (
          <li key={i} className="relative">
            <span
              className={`absolute -left-[1.9rem] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${
                ultimo ? 'bg-marca text-white' : 'bg-plano text-tinta-3'
              }`}
            >
              <Icone size={12} strokeWidth={2.4} aria-hidden />
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={status} />
              <span className="text-xs text-tinta-3">{fmtDataHora(evento.criado_em)}</span>
            </div>

            {evento.mensagem && (
              <p className="mt-1.5 text-sm leading-5 text-tinta-2">{evento.mensagem}</p>
            )}
            {evento.autor && (
              <p className="mt-1 text-xs text-tinta-3">por {evento.autor}</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}
