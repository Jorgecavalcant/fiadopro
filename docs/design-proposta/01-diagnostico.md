# Diagnóstico visual

Base desta leitura: `main` em `10cb45f` (entra a PR #58). Nenhum arquivo de `src/` foi mudado nesta proposta.

O site e o app Android usam o mesmo frontend. O que está torto numa tela aparece nos dois.

## O que se repete

Há dezenas de cores soltas no `App.tsx`. As mais usadas são `#6366F1`, `#4F46E5` e `#5967D8` (três índigos diferentes), mais verde `#2E9D6F`, roxo `#7252E2` e azul `#3D559C`. O documento de design pede navy `#1C2446` e índigo `#4654C4`. A tela não segue o documento.

Contraste medido em 29/10/2026:

| Par | Resultado |
|---|---|
| Texto branco sobre o índigo `#6366F1` dos botões | 4,47:1 — abaixo de 4,5:1 |
| Texto branco sobre o verde `#2E9D6F` do pagamento | 3,40:1 — falha |
| Cinza `#94A3B8` do "Em dia" sobre branco | 2,56:1 — falha |
| O mesmo cinza sobre o fundo `#F8FAFC` | 2,45:1 — falha |

Rótulos de 10px em caixa alta, com espaçamento largo entre letras, aparecem em saldo, extrato e formulário. São menores do que um texto de interface deve ser. Quase tudo usa peso 900. Título, botão e legenda competem.

Os cantos mudam de tela: 12px, 14px, 16px, 18px, 24px e classes `rounded-t42`. O espaçamento também: um cartão com 20px, a caixa de crédito com 32px.

## Tela a tela

**Login.** Fundo e botão índigo, campos grandes, sem o mesmo cartão do restante do app.

**Painel.** Quatro cartões. Em telas de 360px o título e o valor já chegaram a sair do cartão (isso teve correção pontual). O cartão Pro ainda usa outra cor de destaque. Os números e os rótulos não compartilham um componente de saldo.

**Lista de clientes.** Cartão alto, avatar de 64px, nome em peso 900. O saldo positivo e o negativo usam laranja e verde sem o texto "Te deve" / "Você deve" em todos os lugares. Em 360px o cartão ocupa a largura, mas o miolo fica folgado e o saldo pouco legível quando a cor falha contraste.

**Detalhe do cliente.** Os quatro botões não são uma família: Nova despesa é navy, Pagamento é verde, Abatimento é roxo com borda, Devolução é azul com borda. No celular eles vão para uma coluna; no desktop, grade de quatro. Alturas diferentes (o par de cima é maior).

**Caixa "Dinheiro a devolver".** Fundo índigo claro, ícone grande, dois botões índigo na mesma linha (`flex` sem quebra). O texto "Este cliente possui saldo credor. Como deseja proceder?" fica espremido. O botão "Devolver" sai da caixa em 360px. Os dois botões repetem Nova despesa, Pagamento, Abatimento e Devolução, que já estão acima. "Acerto de lucro" grava uma dívida com outro nome. A PR #59 (aberta, fora desta main) trata o comportamento; esta proposta trata o visual de qualquer aviso.

**Lançamento (Nova despesa, Pagamento, Devolução, Abatimento).** Cada aba pinta o topo com um degradê diferente. O saldo das abas de dívida e pagamento é um cartão; o de abatimento e devolução, na main atual, ainda é uma faixa menor ("Saldo do cliente"). Campo de valor em 36px, rótulo em 10px. A mensagem de erro e o "Salvando..." já existem depois da PR #58, mas o formulário não usa o mesmo campo do restante do app.

**Dividir conta.** Lista, pessoas e total misturam o cartão branco grande com inputs nativos. A data dd/mm/aaaa já está encaminhada; o bloco visual continua outro desenho.

**A pagar, a receber, notificações, minhas dívidas, minhas despesas, perfil, ajuda, insights.** Cada uma repete cartão, botão e vazio com raios e pesos diferentes. Ajuda é texto corrido sem o mesmo título de seção. Perfil usa o botão índigo largo. A pagar ainda tem botões curtos ("Devolver") em verde e, na main, o atalho que absorve crédito.

**Admin.** Abas próprias (Usuários, Visão geral, Concessões, Registro, Contas encerradas), outra classe de input (`fp-input`) e tabelas mais apertadas que o app do lojista. Parece outro produto.

**Anúncio de hoje.** Faixa âmbar de 40px, selo "Anúncio" e link índigo para o Pro. A política já prevista no código é `fullscreen_and_top`, `local_sponsor` ou `none`, mas só a faixa do primeiro caso aparece. Não há tela de patrocinador, contrato, criativo nem PDF.

## O que a proposta não mexe

Saldo, tipos de lançamento, planos e o que já está gravado continuam iguais. Isto é desenho para aprovar antes de qualquer PR de tela.
