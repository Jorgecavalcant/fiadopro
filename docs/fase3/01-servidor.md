# Fase 3 — PR 1: servidor de patrocinadores

Parecer do conselho: cadastrar, entregar e contar. Contrato vencido não volta. Plano desconhecido mostra no máximo a faixa e essa faixa não entra no total.

Esta PR não muda tela do app nem do Admin. Não há upload, AdMob, AdSense nem cobrança.

## Modelo

Migration `016_sponsors.sql`, só tabelas novas. A pasta `down/` existe para rollback manual; o deploy não executa essa pasta.

- `sponsors`: nome, categoria, cidade, contato só com nome, ativo. Sem CPF, CNPJ, telefone ou e-mail.
- `sponsor_contracts`: início e fim (date), planos `free`/`pro`, espaços `faixa`/`tela_cheia`, status `rascunho|ativo|pausado|vencido|cancelado`, valor em centavos opcional, observação curta, `renovado_de`, `created_by`.
- `sponsor_creatives`: imagem ou vídeo, espaço, `media_url` e `link_destino` https, `media_origem` só `link`, título, texto alternativo, ativo, ordem.
- `sponsor_events`: contagem do dia por criativo, contrato, tipo (`exibicao`/`clique`), espaço e plano. Sem usuário, IP ou aparelho.
- `sponsor_fullscreen_seen`: usuário, dia e turno, chave única. Some depois de 7 dias. Serve só para não repetir a tela cheia.

## Regras

O dia e o turno usam `America/Sao_Paulo`. Manhã 06–12, tarde 12–18, noite 18–06.

No ar: patrocinador ativo, criativo ativo, contrato `ativo`, hoje entre início e fim (os dois inclusos).

Contrato `ativo` com fim anterior a hoje vira `vencido` na hora da consulta. Pausar, retomar ou cancelar não religa um vencido. Renovar cria outro contrato com `renovado_de` e copia os criativos ativos. O antigo continua `vencido`.

Quem pode ver:

- Free: faixa e tela cheia.
- Pro: só faixa. Todo patrocinador desta fase é local.
- Enterprise e admin: nada.
- Plano não confirmado: no máximo faixa, nunca tela cheia, e o evento não é gravado.

A tela cheia é no máximo uma por usuário por turno. O servidor grava a marca ao entregar. Se não houver criativo, a marca não é gasta.

O rodízio escolhe, entre os criativos no ar daquele espaço e plano, o que teve menos exibições hoje. Empate: menor ordem, depois o id.

A exibição e o clique sobem em `POST /api/sponsors/event`, no máximo uma vez por usuário, criativo e tipo no dia, com limite por minuto. A tela cheia só conta se o servidor já tiver entregue naquele turno. O servidor não abre nem redireciona o link.

## Rotas

App, com login:

- `GET /api/sponsors/slot?slot=faixa|tela_cheia` — um criativo público ou vazio. Sem valor, observação ou dado interno.
- `POST /api/sponsors/event` — `{ creative_id, tipo }`.

Admin, com papel admin e auditoria em toda escrita:

- patrocinadores, contratos e criativos
- pausar, retomar, cancelar, renovar
- `GET /api/admin/sponsors/contracts/:id/results?from&to` — exibições, cliques e CTR por espaço e plano

Endereço só `https`. Ficam de fora `http`, `javascript:`, `data:`, localhost e IP privado.

## Fora desta PR

Telas, upload, anúncio de rede, Asaas, mudança de plano, saldo, Dividir conta e IA.
