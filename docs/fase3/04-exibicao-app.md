# Fase 3 — Exibição no Início

Plano da PR que mostra o patrocínio para quem usa o app. A base é a main com as PRs #66, #67 e #68. Sem merge.

## O que fica

- Free: faixa opção A no fim do celular e no meio do computador, largura do conteúdo. A arte ocupa o card, com degradê escuro, título e nome em branco. O selo "Patrocinado" e o botão "Saiba mais" são do Fiado Pro. Altura da faixa: 92 px.
- Free: tela cheia no máximo 1 vez por período (manhã, tarde e noite), regra que já está no servidor. X de 48 px, Esc, texto "Fechar anúncio" e a nota "Você verá isso no máximo 1 vez por período".
- A tela cheia não abre na mesma sessão do cadastro, do login ou da redefinição de senha. Também não abre por cima de nova dívida, receber, cliente ou pagamento. A busca da tela cheia só acontece quando o Início está livre, porque essa busca já marca o período.
- Pro: faixa clara, sem imagem, numa linha "Nome · texto" e o link "Saiba mais". Sem tela cheia.
- Enterprise e admin: nenhum anúncio e nenhum espaço vazio.
- Sem patrocínio, falha de busca ou imagem quebrada: não mostra nada e não mostra erro.
- "Saiba mais" abre o https já validado, com target=_blank e rel=noopener noreferrer. No Android, a mesma abertura tenta o navegador do aparelho. Não entra pacote novo para isso.
- Impressão da faixa: uma vez por sessão, quando o card aparece na tela. Abertura da tela cheia conta como exibição. Clique conta como clique. Fechar ou sair usa a marca de período que o servidor já grava. Não há tipo novo de evento e não há migration.
- O corpo do evento só leva o id do criativo e o tipo. Sem id de usuário, e-mail, IP ou aparelho.
- A mídia pública prefere o contrato ativo (incluindo o agendado) e não a linha vencida.
- O envio aceita até 2,5 MB na requisição e continua recusando arquivo acima de 2 MB.
- A arte é regravada com sharp, no mesmo formato, com a rotação do EXIF aplicada e o restante do metadado removido. Tamanho, medidas e sha256 são os da imagem nova.
- A auditoria do envio guarda "arte enviada", o id da mídia e o id do criativo.
- As abas do admin rolam na horizontal, numa linha só.
- O contrato usa a razão TECH 42 LTDA, o CNPJ 66.499.920/0001-04 e o endereço de Goiânia. A qualificação e o objeto dizem que o Fiado Pro é produto criado e gerido pela TECH 42 LTDA.

## O que não entra

- Segunda tela, anúncio no Enterprise ou no admin, e pacote além do sharp.
- Migration. Os tipos de evento já existem.
- Mudança na regra de arte agendada: a URL de contrato ativo continua pública, como o CEO deixou na #68. O Início só pede criativo com início já chegado.
- Acesso à VPS, restart ou mudança em produção.

## Conselho

O parecer não teve veto. Ficou assim:

- A sessão do cadastro ou do login fica sem tela cheia. Na abertura seguinte, mesmo no mesmo dia, ela pode aparecer. Não trava o dia inteiro.
- A impressão conta uma vez por sessão, quando a faixa entra na tela. Não foi criada deduplicação nova por dia.
- Fechar a tela cheia usa a marca de período que o servidor já grava. Não há tipo novo de evento, porque a tabela só aceita exibição e clique.
- Enterprise e admin não buscam anúncio.
- O sharp fica. Se a regravação falha, a foto não é gravada.
- A URL de um contrato agendado continua disponível, como o pedido desta PR pediu ao preferir o contrato ativo ou agendado. O Início só pede criativo com a data de início já chegada. Arte de contrato vencido não ganha a preferência.
