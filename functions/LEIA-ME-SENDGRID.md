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
  - **Resumos de reembolso** (agendados, America/Sao_Paulo), sem valores, só o
    essencial + link do portal. Cada papel vê só o que lhe cabe:
    - `resumoDiarioGestor` (10:00): um por Gestor, só o centro de custo dele,
      dos pedidos aguardando a aprovação dele.
    - `resumoDiarioMaster` (10:00): visão geral, todos os pendentes de todas as
      áreas (aguardando gestor/master + aguardando pagamento). Não inclui
      agendados. Vai para papel master + contas `admins`.
    - `resumoFinanceiro` (10:00 e 15:00): aprovados aguardando pagamento
      (`pendente_financeiro`), para o papel financeiro.
    Quem não tem pendência não recebe. Envio individual (ninguém vê o e-mail do
    outro). Por isso o `emailDaNotificacao` ignora os alvos `g:`, `m` e `f`.
  - **Colaborador**: continua recebendo e-mail por evento, mas só em recusa,
    pago e agendado (os intermediários ficam só no sino).
  - Liga/desliga tudo em `config/resumo_reembolso.ativo` (sem o doc, ligado).
    Teste: ponha um e-mail em `config/resumo_reembolso.teste_para` e TODO resumo
    vai só para esse endereço (assunto `[TESTE]`, com aviso de quem seria o real)
    para conferir horário, lista e link; apague o campo para entrar no ar. O
    resultado de cada execução fica em `config/resumo_reembolso` (gestor/master/
    financeiro).
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
