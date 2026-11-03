# E-mail do mural (Gente Informa) por SMTP

Canal separado do SendGrid. Quando um aviso do **Gente Informa** é publicado,
a função `emailDoMural` manda um e-mail para todos os colaboradores ativos.

## Como funciona
- Gatilho: `onDocumentWritten` em `posts/{id}` (`functions/index.js`).
- Dispara **uma vez**, quando o post passa a publicado (nasce publicado ou um
  rascunho é publicado). Só a categoria `informa` (reconhecimentos não entram).
- Nunca reenvia: edição, repost, reação ou post antigo já publicado não geram
  novo e-mail (trava pela transição para publicado e pelo campo `email_mural_em`).
- Destinatários: `funcionarios` ativos com e-mail. Envio em **BCC** por lotes de
  90, sem expor os endereços uns dos outros.
- Conteúdo: título + resumo do aviso + link para o portal. Sem dados sensíveis.
- Resultado gravado no próprio post: `email_mural_status` (`enviado` / `parcial`
  / `falhou` / `sem_destinatario`), `email_mural_enviados`, `email_mural_falhas`,
  `email_mural_total`, `email_mural_em`.

## Credencial (nunca no código nem no repositório)
- Conta remetente: **gentecultura@soulan.com.br** (Google Workspace).
- Precisa de uma **senha de app** (a conta tem que estar com verificação em duas
  etapas ligada; depois gere em "Senhas de app", 16 caracteres).
- A senha fica no cofre do Firebase, no secret `GMAIL_APP_PASSWORD`.
- Não mexe em DNS: a autenticação é a própria conta Workspace no SMTP
  (`smtp.gmail.com:465`).

## Ativar (uma vez)
1. Gerar a senha de app na conta gentecultura@soulan.com.br.
2. Guardar no cofre (cole a senha quando pedir):
   `firebase functions:secrets:set GMAIL_APP_PASSWORD`
3. `cd functions && npm install`
4. `firebase deploy --only functions`
   - Se `emailDoMural` falhar na 1ª vez com erro do Eventarc (permissão do agente
     de serviço), espere 3 a 5 minutos e rode o deploy de novo.
5. Teste: publique um aviso novo no Gente Informa e confira o e-mail.

## Desligar sem novo deploy
- Crie/edite o doc `config/mural_email` com `ativo: false`. Sem o doc, fica ligado.

## Limites
- Workspace: cerca de 2.000 destinatários por dia. A base de colaboradores é bem
  menor; o envio em lotes já respeita o limite por mensagem.
