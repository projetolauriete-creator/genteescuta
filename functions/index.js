// =============================================================
// Cloud Functions do Gente Cultura.
//
// SendGrid está em ./sendgrid.js (enviarEmail). O disparo por e-mail fica
// DESLIGADO até alguém ligar no painel: o doc config/email guarda o
// interruptor geral (ativo) e os interruptores por tipo de aviso (tipos).
// Enquanto ativo != true, nenhuma função manda e-mail.
//
// Fluxo: quando uma notificação é criada (coleção `notificacoes`, a mesma
// do sino), a função resolve o destinatário (campo `alvo`) em e-mails reais
// e envia. O recorte de quem recebe é o mesmo do sino.
//
// Função de teste (só admin logado): testeEmail({ para: '...' }).
//
// Canal separado: emailDoMural também usa o SendGrid (mesma chave), mas com a
// sua própria trava (config/mural_email) e seu próprio recorte: quando um aviso
// do "Gente Informa" é publicado, manda para todos os colaboradores ativos.
// Não depende do config/email acima.
// =============================================================
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')
const { logger } = require('firebase-functions')
const admin = require('firebase-admin')
const { SENDGRID_API_KEY, enviarEmail } = require('./sendgrid')

admin.initializeApp()
const dbA = admin.firestore()

setGlobalOptions({ region: 'southamerica-east1' })

// Endereço público do portal (para os links dentro do e-mail).
const SITE = 'https://genteescuta.web.app'
// Mesmo valor de lib/reembolso.ts (gestor que abrange todos os centros).
const TODOS_CENTROS = 'Todos os centros de custo'

// -------------------------------------------------------------
// Configuração do disparo (config/email). Sem o doc, tudo fica desligado.
// -------------------------------------------------------------
async function lerConfigEmail() {
  try {
    const snap = await dbA.doc('config/email').get()
    const d = snap.exists ? snap.data() : {}
    return {
      ativo: d && d.ativo === true,
      tipos: (d && typeof d.tipos === 'object' && d.tipos) || {},
    }
  } catch (e) {
    logger.error('config/email ilegível', e)
    return { ativo: false, tipos: {} }
  }
}

/** Um tipo de aviso está ligado quando o interruptor geral está ligado e o
 *  tipo não foi desligado individualmente (ausente = ligado). */
function tipoLigado(cfg, tipo) {
  if (!cfg.ativo) return false
  return cfg.tipos[tipo] !== false
}

// -------------------------------------------------------------
// Resolve o campo `alvo` da notificação em uma lista de e-mails.
//   u:<uid>     -> o colaborador dono do pedido
//   g:<centro>  -> gestores daquele centro (ou de "todos os centros")
//   f           -> financeiro
//   m           -> master (admins + funcionários com papel master)
// Só entram contas ativas e com e-mail.
// -------------------------------------------------------------
function emailDe(data) {
  const e = data && typeof data.email === 'string' ? data.email.trim() : ''
  const ativo = !data || data.ativo !== false
  return e && ativo ? e.toLowerCase() : null
}

async function porPapel(papel) {
  const snap = await dbA.collection('funcionarios').where('papeis', 'array-contains', papel).get()
  const out = []
  snap.forEach((doc) => { const e = emailDe(doc.data()); if (e) out.push({ email: e, data: doc.data() }) })
  return out
}

async function resolverEmails(alvo) {
  const alvoStr = String(alvo || '')
  const set = new Set()

  if (alvoStr.startsWith('u:')) {
    const uid = alvoStr.slice(2)
    const doc = await dbA.doc(`funcionarios/${uid}`).get()
    if (doc.exists) { const e = emailDe(doc.data()); if (e) set.add(e) }
  } else if (alvoStr === 'f') {
    for (const r of await porPapel('financeiro')) set.add(r.email)
  } else if (alvoStr === 'm') {
    for (const r of await porPapel('master')) set.add(r.email)
    // Admins (conta de administração) também recebem o que é do master.
    const adm = await dbA.collection('admins').get()
    adm.forEach((doc) => { const e = emailDe(doc.data()); if (e) set.add(e) })
  } else if (alvoStr.startsWith('g:')) {
    const centro = alvoStr.slice(2)
    for (const r of await porPapel('gestor')) {
      const c = (r.data.centro_custo || '').trim()
      if (c === centro || c === TODOS_CENTROS) set.add(r.email)
    }
  }
  return Array.from(set)
}

// -------------------------------------------------------------
// Monta o corpo do e-mail a partir da notificação.
// -------------------------------------------------------------
function escapar(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function montarHtml(n) {
  const titulo = escapar(n.titulo || 'Aviso do portal Gente Cultura')
  const texto = escapar(n.texto || '')
  const href = SITE + (String(n.link || '/').startsWith('/') ? n.link : '/' + (n.link || ''))
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f5f7;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1a1714">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e8ec">
      <tr><td style="background:#002443;padding:18px 24px;color:#ffffff;font-size:15px;font-weight:bold">Gente e Cultura</td></tr>
      <tr><td style="padding:24px">
        <h1 style="margin:0 0 10px;font-size:18px;color:#002443">${titulo}</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#44474d">${texto}</p>
        <a href="${href}" style="display:inline-block;background:#1a4895;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 20px;border-radius:9px">Abrir no portal</a>
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #eef0f3;font-size:12px;color:#8a8d93">
        Você recebeu este aviso porque participa do portal Gente Cultura da Soulan. Para acompanhar, acesse ${SITE}.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

// -------------------------------------------------------------
// Gatilho: nova notificação -> e-mail (quando ligado no painel).
// Best-effort: nunca derruba nada; marca o doc com o resultado.
// -------------------------------------------------------------
exports.emailDaNotificacao = onDocumentCreated(
  { document: 'notificacoes/{id}', secrets: [SENDGRID_API_KEY] },
  async (event) => {
    const snap = event.data
    if (!snap) return
    const n = snap.data() || {}

    const cfg = await lerConfigEmail()
    if (!tipoLigado(cfg, n.tipo)) {
      logger.info(`e-mail desligado para tipo=${n.tipo}; nada enviado`)
      return
    }

    let destinatarios = []
    try {
      destinatarios = await resolverEmails(n.alvo)
    } catch (e) {
      logger.error('falha ao resolver destinatários', e)
    }
    if (destinatarios.length === 0) {
      await snap.ref.set({ email_status: 'sem_destinatario', email_em: new Date().toISOString() }, { merge: true }).catch(() => {})
      return
    }

    const html = montarHtml(n)
    const resultados = await Promise.allSettled(
      destinatarios.map((para) => enviarEmail({ para, assunto: n.titulo || 'Aviso do portal Gente Cultura', html })),
    )
    const enviados = resultados.filter((r) => r.status === 'fulfilled').length
    const falhas = resultados.length - enviados
    if (falhas) logger.warn(`e-mail: ${enviados} enviados, ${falhas} falharam (tipo=${n.tipo})`)

    await snap.ref.set({
      email_status: falhas ? 'parcial' : 'enviado',
      email_enviados: enviados,
      email_falhas: falhas,
      email_em: new Date().toISOString(),
    }, { merge: true }).catch(() => {})
  },
)

// =============================================================
// Mural (Gente Informa) -> e-mail para todos os colaboradores ativos.
//
// Envia pelo SendGrid (mesma chave do sino). Dispara UMA vez, quando um aviso
// do "Gente Informa" passa a PUBLICADO (nasce publicado ou um rascunho e
// publicado). Nunca reenvia: edicao, repost, reacao ou publicacao antiga nao
// geram novo e-mail. Reconhecimentos (elogios) NAO entram aqui. Cada pessoa
// recebe o seu proprio e-mail (ninguem ve o endereco do outro).
// =============================================================

// Interruptor opcional (config/mural_email.ativo). Sem o doc, fica LIGADO.
async function muralEmailLigado() {
  try {
    const snap = await dbA.doc('config/mural_email').get()
    if (!snap.exists) return true
    return snap.data().ativo !== false
  } catch (e) {
    logger.error('config/mural_email ilegível', e)
    return true
  }
}

// E-mails de todos os colaboradores ATIVOS com e-mail (cadastro = funcionarios).
async function emailsColaboradoresAtivos() {
  const snap = await dbA.collection('funcionarios').get()
  const set = new Set()
  snap.forEach((doc) => { const e = emailDe(doc.data()); if (e) set.add(e) })
  return Array.from(set)
}

// Resumo em texto puro do corpo (rico) do aviso, sem HTML e com teto de tamanho.
function resumoDoCorpo(html, max) {
  const teto = max || 240
  const txt = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  if (txt.length <= teto) return txt
  return txt.slice(0, teto).replace(/\s+\S*$/, '') + '…'
}

function montarHtmlMural(titulo, resumo) {
  const t = escapar(titulo)
  const r = escapar(resumo)
  const href = SITE + '/mural'
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f5f7;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1a1714">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e8ec">
      <tr><td style="background:#002443;padding:18px 24px;color:#ffffff;font-size:15px;font-weight:bold">Gente e Cultura</td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#1a4895;font-weight:bold">Novo no mural</p>
        <h1 style="margin:0 0 10px;font-size:18px;color:#002443">${t}</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#44474d">${r}</p>
        <a href="${href}" style="display:inline-block;background:#1a4895;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 20px;border-radius:9px">Ver no mural</a>
      </td></tr>
      <tr><td style="padding:16px 24px;border-top:1px solid #eef0f3;font-size:12px;color:#8a8d93">
        Você recebeu este aviso porque participa do portal Gente Cultura da Soulan. Acesse ${SITE} para ver o conteúdo completo.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

// Gatilho: um aviso do mural passou a publicado -> e-mail para os ativos.
exports.emailDoMural = onDocumentWritten(
  { document: 'posts/{id}', secrets: [SENDGRID_API_KEY] },
  async (event) => {
    const change = event.data
    if (!change) return
    const after = change.after
    if (!after || !after.exists) return // exclusao: ignora
    const p = after.data() || {}

    // Só avisos do "Gente Informa", já publicados.
    if (p.categoria !== 'informa' || p.publicado !== true) return

    // Só a TRANSICAO para publicado dispara. Se já estava publicado antes desta
    // gravação, é edição / repost / reação: não reenvia.
    const before = change.before
    const jaEstavaPublicado = !!(before && before.exists && (before.data() || {}).publicado === true)
    if (jaEstavaPublicado) return

    // Já disparado alguma vez? Nunca reenvia.
    if (p.email_mural_em) return

    if (!(await muralEmailLigado())) {
      logger.info('mural_email desligado; nada enviado')
      return
    }

    // Trava de envio único (idempotência contra reentregas do gatilho): quem
    // gravar email_mural_em primeiro é quem envia.
    const ref = after.ref
    const reservou = await dbA.runTransaction(async (tx) => {
      const d = await tx.get(ref)
      const cur = d.data() || {}
      if (cur.categoria !== 'informa' || cur.publicado !== true) return false
      if (cur.email_mural_em) return false
      tx.update(ref, { email_mural_em: new Date().toISOString(), email_mural_status: 'enviando' })
      return true
    }).catch((e) => { logger.error('reserva do envio falhou', e); return false })
    if (!reservou) return

    let destinatarios = []
    try {
      destinatarios = await emailsColaboradoresAtivos()
    } catch (e) {
      logger.error('falha ao listar colaboradores ativos', e)
    }
    if (destinatarios.length === 0) {
      await ref.set({ email_mural_status: 'sem_destinatario', email_mural_em: new Date().toISOString() }, { merge: true }).catch(() => {})
      return
    }

    const titulo = p.titulo || 'Novo aviso no mural'
    const resumo = resumoDoCorpo(p.corpo)
    const html = montarHtmlMural(titulo, resumo)
    const texto = `${titulo}\n\n${resumo}\n\nAcesse o portal para ver: ${SITE}/mural`
    const assunto = `Novo no mural: ${titulo}`

    // Um e-mail por pessoa (ninguém vê o endereço do outro). Best-effort.
    const resultados = await Promise.allSettled(
      destinatarios.map((para) => enviarEmail({ para, assunto, html, texto })),
    )
    const enviados = resultados.filter((x) => x.status === 'fulfilled').length
    const r = { enviados, falhas: resultados.length - enviados }
    logger.info(`mural "${titulo}": ${r.enviados} enviados, ${r.falhas} falharam (de ${destinatarios.length})`)

    await ref.set({
      email_mural_status: r.falhas ? (r.enviados ? 'parcial' : 'falhou') : 'enviado',
      email_mural_enviados: r.enviados,
      email_mural_falhas: r.falhas,
      email_mural_total: destinatarios.length,
      email_mural_em: new Date().toISOString(),
    }, { merge: true }).catch(() => {})
  },
)

// -------------------------------------------------------------
// Teste manual (só admin logado). Valida a chave depois do deploy.
// -------------------------------------------------------------
async function ehAdmin(uid, email) {
  try {
    const adm = await dbA.doc(`admins/${uid}`).get()
    if (adm.exists) return true
    const func = await dbA.doc(`funcionarios/${uid}`).get()
    const papeis = (func.exists && func.data().papeis) || []
    if (Array.isArray(papeis) && papeis.includes('master')) return true
    // Conta semente de Gente e Cultura também pode testar.
    if ((email || '').toLowerCase() === 'gentecultura@soulan.com.br') return true
  } catch (e) {
    logger.error('ehAdmin falhou', e)
  }
  return false
}

exports.testeEmail = onCall({ secrets: [SENDGRID_API_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Faça login.')
  if (!(await ehAdmin(req.auth.uid, req.auth.token && req.auth.token.email))) {
    throw new HttpsError('permission-denied', 'Apenas administradores podem enviar o teste.')
  }
  const para = req.data && req.data.para
  if (!para) throw new HttpsError('invalid-argument', 'Informe o campo "para".')
  const status = await enviarEmail({
    para,
    assunto: 'Teste de envio: Gente Cultura',
    html: '<p>Este é um e-mail de teste do portal Gente Cultura. Se chegou, o envio está funcionando.</p>',
  })
  return { ok: true, status }
})
