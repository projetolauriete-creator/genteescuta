# SendGrid e disparo de e-mail

Base entregue pela equipe do Rike; o disparo e o painel foram montados por cima.

## O que já está pronto no código
- `functions/sendgrid.js`: `enviarEmail({ para, assunto, html, texto, responderPara })`.
  Remetente **genteecultura@soulanrh.com.br** (Gente e Cultura). Chave via cofre
  (`SENDGRID_API_KEY`), roda só no servidor.
- `functions/index.js`:
  - `emailDaNotificacao`: gatilho em `notificacoes/{id}`. Quando uma notificação
    é criada, resolve o destinatário (`u:uid` / `g:centro` / `f` / `m`) nos mesmos
    e-mails do sino e envia. **Só envia quando o painel estiver ligado.**
  - `testeEmail({ para })`: envio de teste, só para administrador logado.
- Painel admin **Sistema > Disparo de e-mail** (`/admin/email`, só Super Admin):
  liga/desliga o disparo geral, liga/desliga por tipo de aviso e manda teste.
  O estado fica em `config/email` (`ativo`, `tipos`). Começa **desligado**.
- `firebase.json`: bloco `functions`.

## Como está a trava
- `config/email.ativo = false` por padrão: nenhum e-mail sai, mesmo com as
  functions no ar. Ligar/desligar é no painel, **sem novo deploy**.
- A leitura de `config/email` é pública (só interruptores, nada sensível); só o
  Super Admin escreve (Regras do Firestore).

## O que falta (quando o Blaze for aprovado)
1. Subir o projeto Firebase `genteescuta` para o plano **Blaze** (Cloud Functions exige).
2. Guardar a chave no cofre (o valor vem à parte, fora do repositório):
   `firebase functions:secrets:set SENDGRID_API_KEY`
3. `cd functions && npm install`
4. `firebase deploy --only functions`
5. No painel **/admin/email**, enviar um teste para validar a chave.
6. Ligar o interruptor geral e deixar ligados só os avisos desejados.

## Regras
- A chave nunca vai para o código, `.env` do site ou navegador. O site é estático:
  tudo que está nele é público.
- Toda função que usar `enviarEmail` precisa declarar `secrets: [SENDGRID_API_KEY]`.
