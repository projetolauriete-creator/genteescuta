# E-mail do mural (Gente Informa)

Quando um aviso do **Gente Informa** é publicado, a função `emailDoMural` manda
um e-mail para todos os colaboradores ativos.

## Como funciona
- Gatilho: `onDocumentWritten` em `posts/{id}` (`functions/index.js`).
- Dispara **uma vez**, quando o post passa a publicado (nasce publicado ou um
  rascunho é publicado). Só a categoria `informa` (reconhecimentos não entram).
- Nunca reenvia: edição, repost, reação ou post antigo já publicado não geram
  novo e-mail (trava pela transição para publicado e pelo campo `email_mural_em`).
- Destinatários: `funcionarios` ativos com e-mail. **Um e-mail por pessoa**
  (ninguém vê o endereço do outro).
- Envio pelo **SendGrid** (a mesma chave do sino, secret `SENDGRID_API_KEY`).
  Remetente: Gente e Cultura (genteecultura@soulanrh.com.br).
- Conteúdo: título + resumo do aviso + link para o portal. Sem dados sensíveis.
- Resultado gravado no próprio post: `email_mural_status` (`enviado` / `parcial`
  / `falhou` / `sem_destinatario`), `email_mural_enviados`, `email_mural_falhas`,
  `email_mural_total`, `email_mural_em`.

## Atenção ao limite do SendGrid
- O plano gratuito do SendGrid envia cerca de **100 e-mails por dia**. Como a
  base de colaboradores ativos pode passar disso, parte dos envios de um mesmo
  aviso (ou de vários avisos no mesmo dia) pode falhar por limite. Para volume
  maior, subir o plano do SendGrid.

## Desligar sem novo deploy
- Crie/edite o doc `config/mural_email` com `ativo: false`. Sem o doc, fica ligado.

## Observação
- A tentativa anterior por SMTP do Gmail (senha de app) foi descartada: a conta
  gentecultura@soulan.com.br está bloqueada de criar senha de app pela política
  do Workspace. Por isso o mural usa o SendGrid, que já estava configurado.
