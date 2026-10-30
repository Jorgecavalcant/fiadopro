# Fase 3, PR 2B — fluxo do patrocínio e contrato

Plano depois da leitura do servidor da PR 1, da aba da PR 2 e dos mockups `fluxo-1-pj`, `fluxo-1-pf`, `fluxo-3-arte` e `fluxo-4-revisar`. O app do usuário não ganha anúncio nesta PR.

## O que entra

- O botão Novo patrocinador abre um fluxo de 4 passos: Patrocinador, Contrato, Arte, Revisar e gerar contrato. Editar um item da lista abre o mesmo fluxo, no primeiro passo incompleto. A tela antiga de contrato sai.
- Cada Salvar e continuar grava rascunho. Toast verde, botão Salvando… e o foco no primeiro erro.
- PJ e PF com documento validado. Telefone e e-mail passam a ser obrigatórios no patrocinador, só para o contrato e só na tela do admin. A lista mostra o documento mascarado. Relatório, PDF de resultados, rotas públicas, auditoria e log não levam CPF, CNPJ, telefone nem e-mail.
- Upload de JPG, PNG ou WebP até 2 MB, conferido pelos bytes mágicos. A imagem fica no Postgres (`bytea`), não em pasta da VPS. Link de imagem continua como caminho secundário. Post de Instagram avisa que é página, não arquivo.
- Prévia ao vivo com `SponsorStrip` e `SponsorFullscreen`. Tamanho recomendado da faixa: 358×92 px. Tela cheia: 390×844 px. Zoom e posição ficam no criativo.
- Contrato formal em `backend/src/templates/contrato-patrocinio.md`, PDF com o pdfkit que já existe. Cada geração guarda versão, data, sha256 e o snapshot. Se os dados mudarem, Colocar no ar pede a versão nova.
- Contrato com início futuro fica Ativo no banco e aparece como Agendado. A entrega já exige `status = ativo` e `inicio <= hoje`, então ele entra sozinho no dia, sem rotina extra.
- O botão Word do mockup não entra: exigiria biblioteca nova e ficaria morto.

## Servidor

Migration `017`, só colunas e tabelas novas, e o CHECK de `media_origem` ampliado para `link` e `upload`. Rollback em `migrations/down/017_sponsor_contract_flow.sql`. O deploy não executa `down/`.

Não há `sharp`, `jimp` nem `pngjs`. A imagem não é regravada. Metadados que já vierem no arquivo podem continuar lá. A biblioteca que regravaria e tiraria EXIF é o `sharp`. Não foi instalada.

Rotas novas, admin, com id em UUID (inválido devolve 400):

- `PATCH` do patrocinador passa a aceitar os dados do contrato, e a auditoria grava só o id e a frase "dados do patrocinador alterados".
- `POST /api/admin/sponsors/contracts/:id/media` recebe o arquivo.
- `POST /api/admin/sponsors/contracts/:id/document` gera a versão.
- `GET /api/admin/sponsors/contracts/:id/contract.pdf` baixa o PDF. O nome do arquivo não leva documento.

`GET /api/sponsors/media/:id` é público só para contrato ativo (incluindo o agendado, que também está ativo). Rascunho, pausado, vencido e cancelado só com cookie de admin. Resposta com tipo fixo, `nosniff`, `inline` e ETag pelo sha256.

`isPrivateHost` passa a barrar `fe80::/10` inteiro e o NAT64 `64:ff9b::/96`.

## Fora desta PR

Faixa e tela cheia no Início do usuário. Upload continua só no admin. Word. Regravação da imagem. Revisão de advogado do texto do contrato: a minuta está clara, e o texto ainda precisa dessa revisão antes de valer como contrato final. CNPJ e endereço da Tech 42 ficam como `[CNPJ da Tech 42]` e `[Endereço da Tech 42]`.
