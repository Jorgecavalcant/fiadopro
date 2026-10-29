# Plano de PRs

Só depois do Jorge aprovar esta proposta. Cada PR é pequena. Nenhuma aqui foi aberta. Nenhuma mexe em produção agora.

Ordem: (a) tokens, (b) telas que já existem, (c) backend da Fase 3, (d) telas da Fase 3.

A regra de saldo não entra nestas PRs. Dívida e devolução aumentam. Pagamento e abatimento diminuem.

## (a) Design system

1. **Tokens no app.** Copiar `tokens.css` para o frontend e apontar o Tailwind para as mesmas cores. Nenhuma tela muda ainda. Sem migração.

## (b) Telas que já existem

2. **Botões, alerta, saldo e campo.** Três ou quatro componentes usados por todo o app. Sem migração.
3. **Painel.** Cartões com o mesmo saldo e o mesmo título. Sem migração.
4. **Lista de clientes.** Linha com nome TESTE no protótipo; na tela real, o nome que já existe. Tag Te deve / Você deve / Em dia. Sem migração.
5. **Detalhe do cliente.** Quatro botões da família nova e o aviso de saldo credor sem botão próprio. Sem migração. A PR #59 já tirou os botões antigos; esta só troca o visual do aviso.
6. **Lançamento.** As quatro abas no mesmo formulário: saldo, moeda, erro em português, Salvando..., Devolver tudo e Abater tudo. Sem migração.
7. **Dividir conta.** Mesmo cartão, mesmo campo de data e os mesmos botões. Sem migração.
8. **Admin.** As abas atuais no mesmo visual. Sem migração.
9. **Resto.** A pagar, perfil, ajuda, despesas, notificações e login, uma PR por grupo se a anterior ficar grande. Sem migração.

## (c) Fase 3, servidor

10. **Patrocinador e contrato.** Migração nova (a próxima livre; hoje a última na main é a 015), com arquivo de descida. Campos: nome, início, fim, status. No dia seguinte ao fim, o contrato fica inativo sozinho. Sem apagar a linha.
11. **Renovação.** Só um admin, ou um pagamento de contrato confirmado, religa o anúncio. Sem migração nova se a coluna de status já existir na PR 10.
12. **Criativo.** Imagem ou vídeo, link e prévia. Arquivo fora do Git. Sem chave de anúncio no código. Migração só se precisar de tabela de peça.
13. **Espaço.** Barra do topo, tela cheia, ou nenhum. A política que já existe (`fullscreen_and_top`, `local_sponsor`, `none`) passa a ser preenchida de verdade.
14. **Resultado e PDF.** Contagem feita no servidor, PDF só com o patrocinador e o período, sem CPF, e-mail ou telefone de lojista. Sem migração se a contagem for consulta.

Free: tela cheia no máximo uma vez em cada período (manhã, tarde, noite/madrugada) e a barra. Pro: só patrocinador local na barra. Enterprise: nenhum anúncio. Anúncio do Google é peça de exemplo na tela; a chave real não entra no Git.

O Android continua sem preço, sem botão e sem link de assinatura dentro do anúncio.

## (d) Fase 3, telas

15. **Aba Marketing.** Lista, contrato e o aviso de vencimento. Sem migração.
16. **Criativo.** Envio e prévia. Sem migração.
17. **Espaços.** Marcar onde a peça entra. Sem migração.
18. **PDF.** Botão que baixa o relatório da PR 14. Sem migração.
19. **Anúncio no app.** Barra e tela cheia conforme o plano, no celular e no desktop. Sem migração.

Cada PR de servidor leva o teste dela. Cada PR de tela leva o teste do componente e os quatro checks verdes. Quem mergeia é o Jorge.
