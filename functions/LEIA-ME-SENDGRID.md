# SendGrid: o que já está pronto

Configuração entregue pela equipe do Rike. Daqui pra frente a gestão é de vocês.

## Pronto
- Chave no SendGrid: **genteescuta-envio**, com permissão **só de envio** (mail.send). Testada e válida.
- Remetente: **genteecultura@soulanrh.com.br** (nome "Gente e Cultura"), domínio soulanrh.com.br.
- `functions/sendgrid.js`: função `enviarEmail({ para, assunto, html, texto, responderPara })`.
- `functions/index.js`: só uma função de teste (`testeEmail`, exige login). Nenhum aviso dispara e-mail ainda.
- `firebase.json`: bloco `functions` adicionado.

## O que falta (com vocês)
1. Plano Blaze no projeto Firebase `genteescuta` (Cloud Functions exige).
2. Guardar a chave no cofre do Firebase (o valor é entregue à parte, fora do repositório):
   `firebase functions:secrets:set SENDGRID_API_KEY`
3. `cd functions && npm install` e `firebase deploy --only functions`.
4. Testar chamando `testeEmail({ para: '...' })` logado como admin. Depois pode apagar.
5. Decidir quais avisos viram e-mail e ligar `enviarEmail` neles (sugestão natural: gatilho na coleção `notificacoes`, que já existe).

## Regras
- A chave nunca vai para o código, `.env` do site ou navegador. O site é estático: tudo que está nele é público.
- Toda função que usar `enviarEmail` precisa declarar `secrets: [SENDGRID_API_KEY]`.
