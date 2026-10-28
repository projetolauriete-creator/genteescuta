'use client'

// =============================================================
// Funcionários (colaboradores): cadastro pelo admin (mesmo fluxo dos
// usuários: sem e-mail, senha padrão soulan123 + troca no 1º acesso) e
// perfil do usuário logado (admin | funcionario | nenhum).
// =============================================================
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, auth, firebaseConfig } from '../firebase'
import { minhaConta, registrarLog, obterUidParaCadastro, EMAIL_SEMENTE } from './usuarios'
import type { LinhaImport } from '../importarFuncionarios'

/** Campos de datas/matrícula que acompanham um funcionário. */
export interface DadosPessoais {
  matricula?: string | null
  aniv_dia?: number | null
  aniv_mes?: number | null
  adm_dia?: number | null
  adm_mes?: number | null
  adm_ano?: number | null
  aniversario?: string | null
  admissao?: string | null
}

/** Projeção PÚBLICA (nome + área + dia/mês + ativo; nada sensível).
 *  Serve ao Mural e ao diretório de pessoas (ex.: reconhecimento). */
async function escreverAniversario(uid: string, nome: string, d: DadosPessoais, area?: string, ativo?: boolean) {
  const dados: Record<string, unknown> = {
    nome,
    aniv_dia: d.aniv_dia ?? null,
    aniv_mes: d.aniv_mes ?? null,
    adm_dia: d.adm_dia ?? null,
    adm_mes: d.adm_mes ?? null,
    adm_ano: d.adm_ano ?? null,
    atualizado_em: new Date().toISOString(),
  }
  // Só sobrescreve a área quando ela foi informada (evita apagar no merge).
  if (area !== undefined) dados.area = area.trim() || null
  if (ativo !== undefined) dados.ativo = ativo
  await setDoc(doc(db(), 'aniversarios', uid), dados, { merge: true })
}

/**
 * Reescreve a projeção pública de aniversários a partir dos funcionários,
 * incluindo a área (centro de custo). Idempotente (merge); só Master escreve.
 * Serve para preencher a área de quem foi cadastrado antes desse campo existir.
 */
/**
 * Salva as permissões (mapa { telaId: [ações] }) de um FUNCIONÁRIO com acesso
 * ao painel (Master/Administrador). Só gerente (Master/Super) grava: imposto
 * pelas Regras. Espelha salvarPermissoes (que grava em /admins).
 */
export async function salvarPermissoesFuncionario(
  uid: string,
  permissoes: Record<string, string[]>,
  centro_custo?: string,
  email?: string,
) {
  const dados: Record<string, unknown> = { permissoes }
  if (centro_custo !== undefined) dados.centro_custo = String(centro_custo ?? '').trim()
  await updateDoc(doc(db(), 'funcionarios', uid), dados)
  await registrarLog('permissoes', email ?? uid)
}

/**
 * Migração única: o papel "Administrador" foi removido. Toda conta que ainda
 * tiver o papel "administrador" (ou o perfil salvo "adm") passa a ter "master"
 * (Master Administrador), com acesso completo. Reescreve os dados em
 * /funcionarios e /admins. Idempotente. Só Master/Super roda (Regras).
 */
export async function migrarAdministradoresParaMaster(): Promise<{ migrados: number; total: number }> {
  let migrados = 0, total = 0

  const funcs = await listarFuncionarios()
  for (const f of funcs) {
    total++
    const papeis = Array.isArray(f.papeis) ? (f.papeis as string[]) : []
    const temPapel = papeis.includes('administrador')
    const temPerfil = (f as any).perfil === 'adm'
    if (!temPapel && !temPerfil) continue
    const novos = Array.from(new Set(['colaborador', ...papeis.filter((p) => p !== 'administrador'), 'master']))
    const dados: Record<string, unknown> = { papeis: novos }
    if (temPerfil) dados.perfil = 'adm_principal'
    await updateDoc(doc(db(), 'funcionarios', f.uid), dados)
    migrados++
  }

  // Administradores do sistema (/admins): raro ter o papel aqui, mas garante.
  const adsnap = await getDocs(collection(db(), 'admins')).catch(() => null)
  if (adsnap) for (const d of adsnap.docs) {
    total++
    const data = d.data() as Record<string, unknown>
    const papeis = Array.isArray(data.papeis) ? (data.papeis as string[]) : []
    const temPapel = papeis.includes('administrador')
    const temPerfil = data.perfil === 'adm'
    if (!temPapel && !temPerfil) continue
    const novos = Array.from(new Set([...papeis.filter((p) => p !== 'administrador'), 'master']))
    const dados: Record<string, unknown> = { papeis: novos }
    if (temPerfil) dados.perfil = 'adm_principal'
    await updateDoc(doc(db(), 'admins', d.id), dados)
    migrados++
  }

  await registrarLog('migrar_admin_master', `${migrados} conta(s)`)
  return { migrados, total }
}

export async function sincronizarAniversarios(): Promise<number> {
  const funcs = await listarFuncionarios()
  let n = 0
  for (const f of funcs) {
    try {
      await escreverAniversario(
        f.uid,
        String(f.nome ?? ''),
        {
          aniv_dia: f.aniv_dia ?? null, aniv_mes: f.aniv_mes ?? null,
          adm_dia: f.adm_dia ?? null, adm_mes: f.adm_mes ?? null, adm_ano: f.adm_ano ?? null,
        },
        String(f.centro_custo ?? ''),
        (f as any).ativo !== false,
      )
      n++
    } catch { /* ignora um registro problemático e segue */ }
  }
  return n
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export type PerfilTipo = 'admin' | 'funcionario' | 'nenhum'

const PAPEIS_VALIDOS = ['master', 'gestor', 'financeiro', 'gente_cultura', 'colaborador'] as const

/**
 * Normaliza o array de papéis vindo do banco (aceita só valores conhecidos).
 * O papel legado "administrador" foi removido do sistema: ao ler, ele é tratado
 * como "master" (Master Administrador), para ninguém perder acesso antes da
 * migração que reescreve os dados.
 */
function limparPapeis(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const p of v) {
    if (typeof p !== 'string') continue
    const papel = p === 'administrador' ? 'master' : p
    if ((PAPEIS_VALIDOS as readonly string[]).includes(papel) && !out.includes(papel)) out.push(papel)
  }
  return out
}

/** Normaliza a lista de centros extra (strings não vazias, sem repetir). */
export function limparCentrosExtra(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out = v.map((c) => String(c ?? '').trim()).filter(Boolean)
  return Array.from(new Set(out))
}

export interface Perfil {
  tipo: PerfilTipo
  uid: string
  email: string
  nome: string
  ativo: boolean
  senha_provisoria: boolean
  /** Papéis de acesso: uma pessoa pode ter vários (ex.: colaborador + financeiro). */
  papeis: string[]
  /** Centro de custo (área da Soulan) do usuário: a área de origem. */
  centro_custo: string
  /** Centros extra para os quais a pessoa também pode lançar reembolso. */
  centros_extra: string[]
  /** Onde mora o documento (para trocar a senha inicial na coleção certa). */
  origem: 'admins' | 'funcionarios' | 'nenhum'
}

/**
 * Quem é o usuário logado.
 *  - Painel admin "de verdade": e-mail semente OU doc em /admins → tipo 'admin'.
 *  - Funcionário: doc em /funcionarios. Se acumular o papel 'master', também é
 *    tratado como 'admin' (Master = admin completo), mas o doc segue em
 *    /funcionarios (importante para a troca de senha inicial).
 */
export async function perfilAtual(): Promise<Perfil | null> {
  const u = auth().currentUser
  if (!u) return null
  const ehSeed = (u.email ?? '').toLowerCase() === EMAIL_SEMENTE

  // Painel admin: e-mail semente ou doc em /admins.
  const adminSnap = await getDoc(doc(db(), 'admins', u.uid)).catch(() => null)
  if (ehSeed || (adminSnap && adminSnap.exists())) {
    const d = (adminSnap && adminSnap.exists() ? adminSnap.data() : {}) as Record<string, unknown>
    const conta = await minhaConta().catch(() => null)
    const papeis = Array.from(new Set(['master', ...limparPapeis(d.papeis)]))
    return {
      tipo: 'admin',
      uid: u.uid,
      email: (d.email as string) ?? conta?.email ?? u.email ?? '',
      nome: (d.nome as string) ?? conta?.nome ?? '',
      ativo: conta?.ativo ?? true,
      senha_provisoria: conta?.senha_provisoria ?? false,
      papeis,
      centro_custo: (d.centro_custo as string) ?? '',
      centros_extra: limparCentrosExtra(d.centros_extra),
      origem: 'admins',
    }
  }

  // Funcionário (colaborador e/ou gestor/financeiro/master).
  const snap = await getDoc(doc(db(), 'funcionarios', u.uid)).catch(() => null)
  if (snap && snap.exists()) {
    const d = snap.data() as Record<string, unknown>
    // Todo funcionário é, no mínimo, colaborador.
    const papeis = Array.from(new Set(['colaborador', ...limparPapeis(d.papeis)]))
    return {
      // Papel "master" (Master Administrador) = acesso completo ao painel.
      tipo: papeis.includes('master') ? 'admin' : 'funcionario',
      uid: u.uid,
      email: (d.email as string) ?? u.email ?? '',
      nome: (d.nome as string) ?? '',
      ativo: d.ativo !== false,
      senha_provisoria: d.senha_provisoria === true,
      papeis,
      centro_custo: (d.centro_custo as string) ?? '',
      centros_extra: limparCentrosExtra(d.centros_extra),
      origem: 'funcionarios',
    }
  }

  return {
    tipo: 'nenhum', uid: u.uid, email: u.email ?? '', nome: '', ativo: false,
    senha_provisoria: false, papeis: [], centro_custo: '', centros_extra: [], origem: 'nenhum',
  }
}

export async function listarFuncionarios() {
  const snap = await getDocs(collection(db(), 'funcionarios'))
  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }) as any)
    .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? ''))
}

export async function cadastrarFuncionario(p: {
  email: string
  nome: string
  centro_custo?: string
  centros_extra?: string[]
  papeis?: string[]
} & DadosPessoais) {
  const email = String(p.email ?? '').trim().toLowerCase()
  const nome = String(p.nome ?? '').trim()
  if (!EMAIL_RE.test(email)) throw new Error('Informe um e-mail válido.')
  if (nome.length < 2) throw new Error('Informe o nome da pessoa.')
  const centro_custo = String(p.centro_custo ?? '').trim()
  // Extras: não repetir a própria área (ela já é permitida por padrão).
  const centros_extra = limparCentrosExtra(p.centros_extra).filter((c) => c !== centro_custo)
  // "colaborador" é sempre incluído; os demais papéis são opcionais.
  const papeis = Array.from(new Set(['colaborador', ...limparPapeis(p.papeis)]))
  const extras = camposPessoais(p)

  let reaproveitada = false
  let uidCriado = ''
  const secApp = initializeApp(firebaseConfig as Record<string, string>, `func-${Date.now()}`)
  try {
    const secAuth = getAuth(secApp)
    const uid = await obterUidParaCadastro(secAuth, email, (v) => (reaproveitada = v))
    uidCriado = uid
    await signOut(secAuth).catch(() => {})
    const agora = new Date().toISOString()
    // merge: se já havia registro, não zera dados; senão, cria vinculado ao uid.
    await setDoc(
      doc(db(), 'funcionarios', uid),
      { email, nome, centro_custo, centros_extra, papeis, ...extras, ativo: true, senha_provisoria: true, criado_em: agora, criado_por: auth().currentUser?.email ?? null },
      { merge: true },
    )
  } finally {
    await deleteApp(secApp).catch(() => {})
  }
  if (uidCriado) await escreverAniversario(uidCriado, nome, extras, centro_custo, true)
  await registrarLog(reaproveitada ? 'vincular_funcionario' : 'cadastro_funcionario', email)
  return { ok: true, reaproveitada }
}

/** Só os campos de datas/matrícula, já normalizados (para gravar com merge). */
function camposPessoais(p: DadosPessoais): DadosPessoais {
  return {
    matricula: p.matricula ? String(p.matricula).trim() : null,
    aniv_dia: p.aniv_dia ?? null,
    aniv_mes: p.aniv_mes ?? null,
    adm_dia: p.adm_dia ?? null,
    adm_mes: p.adm_mes ?? null,
    adm_ano: p.adm_ano ?? null,
    aniversario: p.aniversario ?? null,
    admissao: p.admissao ?? null,
  }
}

/** Atualiza papéis, centro de custo e dados pessoais (datas/matrícula). */
export async function atualizarPapeisFuncionario(
  uid: string,
  papeis: string[],
  centro_custo: string,
  email?: string,
  extras?: DadosPessoais & { nome?: string },
  centros_extra?: string[],
) {
  const limpos = Array.from(new Set(['colaborador', ...limparPapeis(papeis)]))
  const campos = extras ? camposPessoais(extras) : {}
  const centro = String(centro_custo ?? '').trim()
  await updateDoc(doc(db(), 'funcionarios', uid), {
    papeis: limpos,
    centro_custo: centro,
    ...(centros_extra !== undefined
      ? { centros_extra: limparCentrosExtra(centros_extra).filter((c) => c !== centro) }
      : {}),
    ...campos,
    ...(extras?.nome ? { nome: String(extras.nome).trim() } : {}),
  })
  if (extras) await escreverAniversario(uid, extras.nome ?? '', campos, centro_custo)
  await registrarLog('papeis_funcionario', `${email ?? uid}: ${limpos.join(', ')}${centro_custo ? ' @ ' + centro_custo : ''}`)
}

// -------------------------------------------------------------
// Importação por planilha (só Master: garantido pelas Regras)
// -------------------------------------------------------------
export async function importarFuncionarios(
  linhas: LinhaImport[],
): Promise<{ criados: number; atualizados: number; ignorados: number; falhas: number }> {
  const validas = linhas.filter((l) => l.acao !== 'ignorar')
  const existentes = await listarFuncionarios()
  const mapa = new Map<string, string>() // email -> uid
  for (const f of existentes) if (f.email) mapa.set(String(f.email).toLowerCase(), f.uid)

  let criados = 0, atualizados = 0, falhas = 0
  const secApp = initializeApp(firebaseConfig as Record<string, string>, `import-${Date.now()}`)
  try {
    const secAuth = getAuth(secApp)
    for (const l of validas) {
      try {
        const papeis = Array.from(new Set(['colaborador', ...limparPapeis(l.papeis)]))
        const dados = {
          email: l.email, nome: l.nome, centro_custo: l.centro_custo, papeis,
          ...camposPessoais(l),
        }
        let uid = mapa.get(l.email)
        if (uid) {
          await setDoc(doc(db(), 'funcionarios', uid), dados, { merge: true })
          atualizados++
        } else {
          uid = await obterUidParaCadastro(secAuth, l.email)
          const agora = new Date().toISOString()
          await setDoc(
            doc(db(), 'funcionarios', uid),
            { ...dados, ativo: true, senha_provisoria: true, criado_em: agora, criado_por: auth().currentUser?.email ?? null },
            { merge: true },
          )
          mapa.set(l.email, uid)
          criados++
        }
        await escreverAniversario(uid, l.nome, l, l.centro_custo, true)
      } catch {
        falhas++
      }
    }
    await signOut(secAuth).catch(() => {})
  } finally {
    await deleteApp(secApp).catch(() => {})
  }
  await registrarLog('importar_funcionarios', `${criados} novos, ${atualizados} atualizados, ${falhas} falhas`)
  return { criados, atualizados, ignorados: linhas.length - validas.length, falhas }
}

export async function definirAtivoFuncionario(uid: string, ativo: boolean, email?: string) {
  await updateDoc(doc(db(), 'funcionarios', uid), { ativo })
  // Espelha no diretório público para ocultar desligados (ex.: reconhecimento).
  await updateDoc(doc(db(), 'aniversarios', uid), { ativo }).catch(() => {})
  await registrarLog(ativo ? 'ativar_funcionario' : 'inativar_funcionario', email ?? uid)
}

export async function excluirFuncionario(uid: string, email?: string) {
  await deleteDoc(doc(db(), 'funcionarios', uid))
  await deleteDoc(doc(db(), 'aniversarios', uid)).catch(() => {})
  await registrarLog('excluir_funcionario', email ?? uid)
}

export async function reenviarSenhaFuncionario(email: string) {
  const e = String(email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(e)) throw new Error('E-mail inválido.')
  await sendPasswordResetEmail(auth(), e)
  await registrarLog('redefinir_senha_funcionario', e)
}
