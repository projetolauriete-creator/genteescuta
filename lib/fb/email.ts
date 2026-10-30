'use client'

// =============================================================
// Configuração do disparo de e-mail (painel admin).
//
// O envio em si roda nas Cloud Functions (functions/), que leem este mesmo
// doc config/email. Aqui é só a tela: ligar/desligar o disparo geral,
// ligar/desligar por tipo de aviso e mandar um e-mail de teste.
//
// Enquanto `ativo` for false (ou o doc não existir), nenhum e-mail sai.
// As Regras do Firestore só deixam o Super Admin escrever config/email.
// =============================================================
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, auth, funcoes } from '../firebase'

// Tipos de aviso que podem virar e-mail. São os mesmos da coleção
// `notificacoes` (fluxo de Reembolso). Mural e Trilhas não geram
// notificação gravada, então não entram aqui.
export const TIPOS_EMAIL = [
  { id: 'reembolso_novo', titulo: 'Novo reembolso enviado', desc: 'Avisa o gestor da área (ou o master) e o financeiro quando um pedido é criado.' },
  { id: 'reembolso_pendente', titulo: 'Reembolso aguardando ação', desc: 'Avisa quem precisa aprovar ou pagar na etapa atual.' },
  { id: 'reembolso_aprovado', titulo: 'Reembolso aprovado', desc: 'Avisa o colaborador que o pedido foi aprovado.' },
  { id: 'reembolso_recusado', titulo: 'Reembolso recusado', desc: 'Avisa o colaborador que o pedido foi recusado.' },
  { id: 'reembolso_agendado', titulo: 'Pagamento agendado', desc: 'Avisa o colaborador que o pagamento foi agendado.' },
  { id: 'reembolso_pago', titulo: 'Reembolso pago', desc: 'Avisa o colaborador que o pagamento foi registrado.' },
  { id: 'reembolso_editado', titulo: 'Reembolso reenviado', desc: 'Confirma ao colaborador o reenvio após ajuste.' },
  { id: 'reembolso_cancelado', titulo: 'Reembolso cancelado', desc: 'Avisa quem estava com a pendência que o pedido foi cancelado.' },
] as const

export type TipoEmailId = (typeof TIPOS_EMAIL)[number]['id']

export interface ConfigEmail {
  ativo: boolean
  tipos: Record<string, boolean>
  atualizado_em?: string
  atualizado_por?: string
}

/** Lê a configuração atual. Default: desligado, todos os tipos ligados
 *  (quando o interruptor geral for ligado, tudo vale até ser desligado). */
export async function getConfigEmail(): Promise<ConfigEmail> {
  const snap = await getDoc(doc(db(), 'config', 'email')).catch(() => null)
  const d = (snap && snap.exists() ? snap.data() : {}) as Record<string, unknown>
  const tipos: Record<string, boolean> = {}
  const guardados = (d.tipos && typeof d.tipos === 'object' ? d.tipos : {}) as Record<string, unknown>
  for (const t of TIPOS_EMAIL) tipos[t.id] = guardados[t.id] !== false
  return {
    ativo: d.ativo === true,
    tipos,
    atualizado_em: typeof d.atualizado_em === 'string' ? d.atualizado_em : undefined,
    atualizado_por: typeof d.atualizado_por === 'string' ? d.atualizado_por : undefined,
  }
}

/** Salva a configuração (merge). Só o Super Admin consegue (Regras). */
export async function salvarConfigEmail(cfg: { ativo: boolean; tipos: Record<string, boolean> }): Promise<void> {
  const tipos: Record<string, boolean> = {}
  for (const t of TIPOS_EMAIL) tipos[t.id] = cfg.tipos[t.id] !== false
  await setDoc(
    doc(db(), 'config', 'email'),
    {
      ativo: !!cfg.ativo,
      tipos,
      atualizado_em: new Date().toISOString(),
      atualizado_por: auth().currentUser?.email ?? '',
    },
    { merge: true },
  )
}

/** Dispara um e-mail de teste pela Cloud Function. Só funciona depois do
 *  deploy das functions (plano Blaze). Antes disso, cai em erro tratado. */
export async function enviarEmailTeste(para: string): Promise<number> {
  const alvo = String(para ?? '').trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(alvo)) {
    throw new Error('Informe um e-mail válido para o teste.')
  }
  const chamar = httpsCallable<{ para: string }, { ok: boolean; status: number }>(funcoes(), 'testeEmail')
  const r = await chamar({ para: alvo })
  return r.data?.status ?? 0
}
