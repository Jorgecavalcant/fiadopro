# Modelo de conta

Documento. Nada disto está implementado nesta proposta. Não há migration nova.

## Cadastro

A pessoa informa nome, e-mail ou Google, senha e telefone. Entra com e-mail ou com Google.

O e-mail é único e precisa ser confirmado. A confirmação por link já existe (migration 015) e hoje nasce desligada.

Não há escolha entre pessoa física e pessoa jurídica no cadastro. Quem usa em nome de uma empresa usa a mesma conta e pode colocar o nome da empresa. Quem quiser separar cria outra conta, com outro e-mail.

## CPF ou CNPJ

O documento só é pedido na assinatura do Pro, porque o Asaas exige. Ele é único no banco, para a mesma pessoa não repetir o teste grátis com outra conta.

## Telefone confirmado — depois do lançamento

A próxima entrega, depois do lançamento, é esta: a pessoa confirma o telefone com um código. Aí ela passa a ver o que foi lançado para aquele número.

Sem o telefone confirmado, a conta não mostra esses lançamentos. Isso protege o dado de outra pessoa (LGPD).

### Riscos

- Mostrar lançamento antes da confirmação entrega o histórico de um número a quem ainda não provou que o telefone é dele.
- Um código enviado para o número errado, ou reenviado sem limite, vira incômodo e custo.
- Dois cadastros com o mesmo telefone, antes da confirmação, precisam de uma regra clara: a conta que confirma primeiro é a que enxerga os lançamentos daquele número. A outra não recebe a lista.

### Custo do código

O preço de cada código não foi medido nesta sessão. Antes de ligar o envio, medir com o provedor o custo por mensagem e o volume esperado. Sem essa conta, não dá para decidir o limite de reenvios.

### Índices

Quando essa entrega for construída, o banco precisa achar rápido:

- telefone confirmado de uma conta (único entre contas ativas);
- lançamentos daquele telefone, para montar a lista depois da confirmação;
- CPF ou CNPJ único, já na assinatura do Pro, separado deste índice de telefone.

Esses índices não são criados agora.
