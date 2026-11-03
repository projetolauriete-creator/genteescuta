// =============================================================
// Envio por SMTP do Google Workspace (conta gentecultura@soulan.com.br).
//
// Usado pelo disparo do MURAL (avisos do "Gente Informa"). Independente do
// SendGrid (que cuida das notificacoes do sino). A senha de APP do Gmail fica
// no cofre do Firebase (secret GMAIL_APP_PASSWORD), nunca no codigo nem no
// repositorio. Nao mexe em DNS: a autenticacao e a propria conta Workspace.
// =============================================================
const nodemailer = require('nodemailer')
const { defineSecret } = require('firebase-functions/params')
const { logger } = require('firebase-functions')

// Senha de app (16 caracteres) gerada na conta do Google. Guardada no cofre.
const GMAIL_APP_PASSWORD = defineSecret('GMAIL_APP_PASSWORD')

// Remetente: a propria conta Workspace que autentica no SMTP.
const REMETENTE_SMTP = 'gentecultura@soulan.com.br'
const REMETENTE_NOME = 'Gente e Cultura'

// Lote de destinatarios por mensagem (BCC). O Workspace limita o total diario
// (cerca de 2.000) e aceita muitos destinatarios por envio; mesmo assim,
// quebramos em lotes para nao estourar o limite por mensagem.
const TAM_LOTE = 90

function transporte() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: REMETENTE_SMTP, pass: GMAIL_APP_PASSWORD.value() },
  })
}

/**
 * Envia um mesmo e-mail para muitos destinatarios SEM expor os enderecos uns
 * dos outros: cada mensagem vai com "to" para a propria conta e a lista em BCC.
 * Retorna quantos foram enviados e quantos falharam (por lote).
 */
async function enviarMuralBcc({ assunto, html, texto, destinatarios }) {
  const lista = Array.from(new Set((destinatarios || []).filter(Boolean)))
  if (lista.length === 0) return { enviados: 0, falhas: 0 }

  const t = transporte()
  let enviados = 0
  let falhas = 0
  for (let i = 0; i < lista.length; i += TAM_LOTE) {
    const lote = lista.slice(i, i + TAM_LOTE)
    try {
      await t.sendMail({
        from: `"${REMETENTE_NOME}" <${REMETENTE_SMTP}>`,
        to: REMETENTE_SMTP,
        bcc: lote,
        subject: assunto,
        text: texto,
        html,
      })
      enviados += lote.length
    } catch (e) {
      falhas += lote.length
      logger.error(`SMTP: lote de ${lote.length} falhou`, e)
    }
  }
  return { enviados, falhas }
}

module.exports = { GMAIL_APP_PASSWORD, REMETENTE_SMTP, enviarMuralBcc }
