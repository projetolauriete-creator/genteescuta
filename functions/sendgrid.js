// =============================================================
// Envio de e-mail pelo SendGrid (roda SÓ no servidor, nas Cloud Functions).
//
// A chave NUNCA fica no código nem no site. Ela mora no cofre do
// Firebase (Secret Manager) com o nome SENDGRID_API_KEY:
//   firebase functions:secrets:set SENDGRID_API_KEY
//
// Remetente padrão: genteecultura@soulanrh.com.br
// Chave criada no SendGrid: "genteescuta-envio" (permissão só de envio).
//
// Uso dentro de qualquer função:
//   const { SENDGRID_API_KEY, enviarEmail } = require('./sendgrid')
//   exports.minhaFuncao = onDocumentCreated(
//     { document: 'colecao/{id}', secrets: [SENDGRID_API_KEY] },
//     async (event) => { await enviarEmail({ para, assunto, html }) })
//
// Importante: toda função que chamar enviarEmail precisa declarar
// `secrets: [SENDGRID_API_KEY]`, senão a chave não chega nela.
// =============================================================
const { defineSecret } = require('firebase-functions/params')
const sgMail = require('@sendgrid/mail')

const SENDGRID_API_KEY = defineSecret('SENDGRID_API_KEY')

const REMETENTE = { email: 'genteecultura@soulanrh.com.br', name: 'Gente e Cultura' }

/**
 * Envia um e-mail.
 * @param {object} p
 * @param {string|string[]} p.para   destinatário(s)
 * @param {string} p.assunto
 * @param {string} [p.html]          corpo em HTML
 * @param {string} [p.texto]         corpo em texto puro (se não vier, é gerado do HTML)
 * @param {string} [p.responderPara] e-mail de resposta (reply-to), opcional
 */
async function enviarEmail({ para, assunto, html, texto, responderPara }) {
  if (!para || !assunto || (!html && !texto)) {
    throw new Error('enviarEmail: informe para, assunto e html ou texto')
  }
  sgMail.setApiKey(SENDGRID_API_KEY.value())
  const msg = {
    to: para,
    from: REMETENTE,
    subject: assunto,
    text: texto || String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    ...(html ? { html } : {}),
    ...(responderPara ? { replyTo: responderPara } : {}),
  }
  const [resp] = await sgMail.send(msg)
  return resp.statusCode // 202 = aceito pelo SendGrid
}

module.exports = { SENDGRID_API_KEY, REMETENTE, enviarEmail }
