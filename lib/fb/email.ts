'use client'

// =============================================================
// Central de notificações por e-mail do portal (painel admin).
//
// O envio roda nas Cloud Functions (functions/), que leem este mesmo doc
// config/email. Aqui é a tela: o interruptor geral, os resumos de Reembolso
// por papel (com liga/desliga e horário), os eventos do colaborador, o aviso
// do Mural e o aviso de nova Pesquisa de Clima, alem do e-mail de teste.
//
// Enquanto `ativo` for false (ou o doc não existir), nenhum e-mail sai.
// As Regras do Firestore só deixam o Super Admin escrever config/email.
// =============================================================
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, auth, funcoes } from '../firebase'

// -------------------------------------------------------------
// Formato da configuração (um único doc config/email).
// -------------------------------------------------------------
export interface ConfigEmail {
  ativo: boolean
  reembolso: {
    gestor: { on: boolean; hora: number }
    master: { on: boolean; hora: number }
    financeiro: { on: boolean; horas: number[] }
    colaborador: { recusado: boolean; pago: boolean }
  }
  mural: { on: boolean }
  clima: { on: boolean }
  atualizado_em?: string
  atualizado_por?: string
}

export const CONFIG_EMAIL_PADRAO: ConfigEmail = {
  ativo: false,
  reembolso: {
    gestor: { on: true, hora: 10 },
    master: { on: true, hora: 10 },
    financeiro: { on: true, horas: [10, 15] },
    colaborador: { recusado: true, pago: true },
  },
  mural: { on: true },
  clima: { on: true },
}

// Hora válida (inteiro de 0 a 23); cai no padrão quando vier algo estranho.
function horaOk(v: unknown, padrao: number): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 0 && n <= 23 ? n : padrao
}

// Lista de horas válidas, únicas e ordenadas (1 a 3 horários).
function horasOk(v: unknown, padrao: number[]): number[] {
  if (!Array.isArray(v)) return [...padrao]
  const limpas = Array.from(new Set(v.map((h) => Math.floor(Number(h))).filter((h) => Number.isFinite(h) && h >= 0 && h <= 23)))
  limpas.sort((a, b) => a - b)
  return limpas.length ? limpas.slice(0, 3) : [...padrao]
}

/** Lê a configuração atual, completando com os padrões o que faltar. */
export async function getConfigEmail(): Promise<ConfigEmail> {
  const snap = await getDoc(doc(db(), 'config', 'email')).catch(() => null)
  const d = (snap && snap.exists() ? snap.data() : {}) as Record<string, any>
  const r = (d.reembolso && typeof d.reembolso === 'object' ? d.reembolso : {}) as Record<string, any>
  const g = (r.gestor ?? {}) as Record<string, any>
  const m = (r.master ?? {}) as Record<string, any>
  const f = (r.financeiro ?? {}) as Record<string, any>
  const c = (r.colaborador ?? {}) as Record<string, any>
  const p = CONFIG_EMAIL_PADRAO
  return {
    ativo: d.ativo === true,
    reembolso: {
      gestor: { on: g.on !== false, hora: horaOk(g.hora, p.reembolso.gestor.hora) },
      master: { on: m.on !== false, hora: horaOk(m.hora, p.reembolso.master.hora) },
      financeiro: { on: f.on !== false, horas: horasOk(f.horas, p.reembolso.financeiro.horas) },
      colaborador: { recusado: c.recusado !== false, pago: c.pago !== false },
    },
    mural: { on: (d.mural && typeof d.mural === 'object' ? d.mural.on : d.mural) !== false },
    clima: { on: (d.clima && typeof d.clima === 'object' ? d.clima.on : d.clima) !== false },
    atualizado_em: typeof d.atualizado_em === 'string' ? d.atualizado_em : undefined,
    atualizado_por: typeof d.atualizado_por === 'string' ? d.atualizado_por : undefined,
  }
}

/** Salva a configuração (higieniza e grava por inteiro). Só o Super Admin (Regras). */
export async function salvarConfigEmail(cfg: ConfigEmail): Promise<void> {
  const p = CONFIG_EMAIL_PADRAO
  await setDoc(
    doc(db(), 'config', 'email'),
    {
      ativo: !!cfg.ativo,
      reembolso: {
        gestor: { on: cfg.reembolso.gestor.on !== false, hora: horaOk(cfg.reembolso.gestor.hora, p.reembolso.gestor.hora) },
        master: { on: cfg.reembolso.master.on !== false, hora: horaOk(cfg.reembolso.master.hora, p.reembolso.master.hora) },
        financeiro: { on: cfg.reembolso.financeiro.on !== false, horas: horasOk(cfg.reembolso.financeiro.horas, p.reembolso.financeiro.horas) },
        colaborador: { recusado: cfg.reembolso.colaborador.recusado !== false, pago: cfg.reembolso.colaborador.pago !== false },
      },
      mural: { on: cfg.mural.on !== false },
      clima: { on: cfg.clima.on !== false },
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
