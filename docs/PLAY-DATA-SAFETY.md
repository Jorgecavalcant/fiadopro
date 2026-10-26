# Guia para responder à Play Console

Use este guia para preencher as seções da Play Console de acordo com o funcionamento do app.

## Segurança dos dados

### O app coleta ou compartilha dados?

- **Coleta dados:** Sim.
- **Compartilha dados para publicidade:** Não.
- **Criptografa os dados em trânsito:** Sim, a comunicação usa HTTPS.
- **O app tem anúncios:** Não.

### Dados coletados

| Dado | Obrigatório? | Para que é usado | Compartilhado? Com quem? |
|---|---|---|---|
| Nome do lojista | Sim | Identificar a conta e personalizar o uso do serviço | Não é compartilhado com terceiros para publicidade |
| E-mail do lojista | Sim | Criar e manter a conta e enviar e-mails do serviço | Resend, para envio de e-mails |
| Telefone do lojista | Não | Dado de contato da conta, se informado | Não é compartilhado com terceiros para publicidade |
| Nome e telefone dos clientes, digitados pelo lojista | Sim, para registrar um fiado | Identificar o cliente nos registros da loja | Hetzner, para hospedagem; OpenRouter recebe o nome somente durante a análise com IA |
| Valores de fiado e pagamento | Sim, para registrar o fiado e seus pagamentos | Manter o caderno e o histórico da loja | Hetzner, para hospedagem; o saldo do cliente é enviado ao OpenRouter somente durante a análise com IA |
| CPF/CNPJ | Sim, somente para assinar no site | Atender à assinatura feita no site | Asaas, para processar a assinatura no site |
| Foto de perfil | Não | Mostrar a foto na conta, se adicionada | Não é compartilhada com terceiros para publicidade |
| Identificador do aparelho para notificação | Não | Enviar notificações, se ativadas | Google/Firebase |

O OpenRouter recebe o nome e o saldo do cliente somente quando o lojista usa a análise com IA. O Asaas recebe CPF/CNPJ e dados da assinatura somente para assinaturas feitas no site. Google/Firebase é usado para login Google e notificações, inclusive com o identificador do aparelho. Hetzner hospeda o serviço e Resend envia e-mails.

Não há venda de dados nem compartilhamento para publicidade. O lojista digita os nomes e telefones dos clientes; o app não lê a agenda do aparelho.

### Exclusão de dados

- A conta do lojista é desativada na hora.
- Clientes, fiados e pagamentos daquela loja são apagados em até 30 dias.
- O lojista pode pedir a exclusão no app: **Meu Perfil → Zona de Perigo → Cancelar Conta**.
- Também pode pedir por `contato@tech42.com.br`, inclusive para antecipar a exclusão dos registros.
- A página `https://www.fiadopro.com.br/excluir-conta` só deve ser informada depois do deploy.

## Classificação de conteúdo

O app não apresenta conteúdo sensível. Não é uma rede social pública e não exibe anúncios.

- Responda de acordo com o conteúdo real do app e com as perguntas da Play Console.
- O app é um caderno privado de registros do comerciante.

## Público-alvo

- Público: comerciantes adultos.
- Idade: **18 anos ou mais**.
- O app não é feito para crianças.

## Recursos financeiros e compras

- **O app oferece recursos financeiros:** Não.
- O Fiado Pro é somente um caderno de registro. Não oferece empréstimos, serviços bancários, seguros, carteira ou processamento de pagamentos.
- O Pix é apenas um texto de lembrete; o app não processa pagamentos.
- Não há compra dentro do app para Android.

## Acesso ao app

Todas as funções úteis exigem login. Conta de teste para o revisor:

- E-mail: `revisor.play@fiadopro.com.br`

Não coloque senha neste arquivo. Informe os dados de acesso diretamente na Play Console, conforme necessário.

Nota para o revisor:

> O Fiado Pro é um caderno digital para organizar fiados e pagamentos registrados pelo comerciante. Não há compras no app. Para cancelar a conta, acesse Meu Perfil → Zona de Perigo.

## URLs e contato

- **Site:** https://www.fiadopro.com.br
- **Exclusão de conta:** https://www.fiadopro.com.br/excluir-conta — só informe depois do deploy.
- **Privacidade:** https://www.fiadopro.com.br/privacidade
- **Termos:** https://www.fiadopro.com.br/termos
- **Contato:** `contato@tech42.com.br`
