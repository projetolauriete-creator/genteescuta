// =============================================================
// Cloud Functions do Gente Cultura.
//
// O SendGrid já está configurado em ./sendgrid.js (enviarEmail).
// Nenhum e-mail é disparado ainda: quais avisos viram e-mail,
// e quando, é decisão de quem administra o projeto.
//
// Função de teste (só administrador logado pode chamar):
//   testeEmail({ para: 'alguem@soulan.com.br' })
// Serve para validar a chave depois do deploy. Pode apagar depois.
// =============================================================
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { setGlobalOptions } = require('firebase-functions/v2')
const { SENDGRID_API_KEY, enviarEmail } = require('./sendgrid')

setGlobalOptions({ region: 'southamerica-east1' })

exports.testeEmail = onCall({ secrets: [SENDGRID_API_KEY] }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Faça login.')
  const para = req.data && req.data.para
  if (!para) throw new HttpsError('invalid-argument', 'Informe o campo "para".')
  const status = await enviarEmail({
    para,
    assunto: 'Teste de envio: Gente Cultura',
    html: '<p>Este é um e-mail de teste do portal Gente Cultura. Se chegou, o envio está funcionando.</p>',
  })
  return { ok: true, status }
})
