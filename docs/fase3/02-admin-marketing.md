# Fase 3 — PR 2: aba Marketing no Admin

Parecer do conselho: PDF com o pdfkit que já existe, rotas novas de leitura sem mudar as antigas, e nenhum dado pessoal no relatório. O gráfico por dia fica, porque o Jorge pediu e o mockup 3 mostra. O botão Espaços fica de fora.

Esta PR não mostra anúncio no Início do lojista. A faixa e a tela cheia de verdade ficam para a PR 3. Os componentes da prévia já nascem prontos para essa troca.

## O que a tela faz

A aba Marketing fica entre Concessões e Registro. Só o admin chega nela. Por dentro: Visão geral, Contratos e Resultados.

O cabeçalho do painel passa a "Painel administrativo", com abas finas e sublinhado navy. As outras abas continuam fazendo o mesmo.

Visão geral: quatro cartões (patrocinadores ativos, vencendo em 7 dias, exibições do mês com cliques, CTR do mês) e a lista. Busca, "Novo patrocinador", selo de status e "vence em N dias". Vazio, carregando e erro têm texto próprio.

Contrato: datas, Free e Pro, Enterprise desativado, chaves de faixa e tela cheia, aviso de vencimento, pausar, retomar, renovar e cancelar. Renovar só chama o servidor quando o contrato está vencido. Rascunho ganha "Colocar no ar", porque o contrato nasce rascunho e a rota de ativar já existe. Sem isso, nada entra no ar.

Criativo: imagem ou vídeo, título, dois links https e texto alternativo. Salvar cria ou atualiza. A prévia é a Opção A: a arte ocupa o card, e do Fiado Pro ficam o selo "Patrocinado" e o botão branco "Saiba mais". O degradê escuro é leve e só no lado do botão. A tela cheia da prévia tem X, selo e o mesmo botão. Tamanho pedido da arte: faixa 358×132 px (coluna do Início num celular de 390, com 16 px de cada lado) e tela cheia 390×844 px.

Resultados: contrato, período, cartões, gráfico por dia (barras de exibição e linha de cliques), tabela por espaço e plano, e o rodapé de que só há contagens. "Baixar PDF" usa o pdfkit já instalado. Sem dependência nova e sem migration.

No celular a lista vira cartões.

## Servidor

Dois ajustes na base que já está na main:

- Prefixo `fc`, `fd` e `fe80` só em IPv6 (quando o host tem `:`). Assim `fcbarcelona.com` passa. Continuam bloqueados o IPv6 `::`, o IPv4 `100.64.0.0/10` e o IPv4 privado escrito como `::ffff:`, inclusive na forma que o endereço normaliza (`::ffff:7f00:1`).
- O conjunto que evita contar o mesmo evento duas vezes no dia apaga as chaves de dias anteriores quando o dia vira em São Paulo.

Rotas novas, atrás de admin, sem mudar o JSON das rotas atuais. O front não usa o cliente antigo do admin, porque essas respostas não trazem `success`.

- `GET /api/admin/sponsors/board` — lista sem contato, valor ou observação
- `GET /api/admin/sponsors/summary` — só contagens dos cartões
- `GET /api/admin/sponsors/contracts/:id` — detalhe para editar; contato só com nome
- `GET /api/admin/sponsors/contracts/:id/daily?from&to` — série por dia, sem pessoa
- `GET /api/admin/sponsors/contracts/:id/report.pdf?from&to` — PDF só com contagens
- `PATCH /api/admin/sponsors/creatives/:id` — corrige o criativo, com auditoria sem URL (um link de WhatsApp pode carregar telefone)

Contrato vencido ou cancelado não troca de criativo.

## Fora desta PR

Anúncio no app, upload, AdMob, cobrança, Espaços e mudança de plano.
