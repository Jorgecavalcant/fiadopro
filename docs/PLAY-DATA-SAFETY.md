# Guia para responder à Play Console

Use este guia para consultar cada seção do formulário. Responda de acordo com o funcionamento atual do app.

## Segurança dos dados (Data safety)

### O app coleta ou compartilha dados?

- **Coleta dados:** Sim.
- **Vende ou compartilha dados para publicidade:** Não.
- **Compartilha dados com terceiros:** Não, conforme a definição da Play para esta situação. A hospedagem Hetzner e o serviço de e-mail transacional Resend processam dados apenas para operar o serviço e não os usam para fins próprios; por isso, não são considerados compartilhamento nessa resposta.

### Os dados são criptografados em trânsito?

- **Sim.** A comunicação usa HTTPS.

### O usuário pode pedir a exclusão dos dados?

- **Sim.** No app: **Meu Perfil → Zona de Perigo → Cancelar Conta**.
- A página de exclusão na web só deve ser informada depois de publicada. Endereço previsto: `https://www.fiadopro.com.br/excluir-conta`.

**Importante sobre a exclusão:** o cancelamento atual anonimiza a conta do lojista — nome, e-mail, telefone, foto, senha e dados do Google — e encerra a sessão. Ele não apaga automaticamente, no servidor, os registros de fiado. Para solicitar a exclusão completa desses registros, o usuário deve escrever para `contato@tech42.com.br`. Não prometa prazo de exclusão de backups.

### Que tipos de dados são coletados?

Os dados abaixo são necessários para o funcionamento da conta e dos registros:

- **Informações pessoais do lojista:** nome, e-mail e telefone.
- **Informações pessoais dos clientes:** nome e telefone digitados pelo próprio lojista.
- **Informações financeiras:** valores de fiados e pagamentos inseridos pelo lojista. Não são dados de cartão nem compras feitas dentro do app.

### Que tipos de dados não devem ser declarados?

Não declare coleta de:

- Localização.
- Contatos do aparelho.
- Dados para anúncios.
- Identificador de publicidade.

O app não lê a agenda do telefone. O lojista digita os nomes e telefones dos clientes.

## Classificação de conteúdo

O app não apresenta violência, sexo, linguagem grosseira, drogas, apostas, medo, compras simuladas ou anúncios de terceiros. Não é uma rede social pública.

- **Conteúdo público:** marque **Não**.
- **Interação entre usuários:** leia o enunciado da Play e responda com honestidade. O app tem uma caixa privada de aprovação de lançamentos; não é uma área pública. O WhatsApp é aberto fora do app.

## Público-alvo

- Público: comerciantes adultos.
- Faixa etária: **18 anos ou mais**.
- O app não foi feito para crianças e não é direcionado a elas.
- O app não exibe anúncios.

## Recursos financeiros

- **O app oferece recursos financeiros:** **Não**.

Se o formulário pedir uma explicação em texto livre, use:

> O Fiado Pro é um caderno digital para o comerciante organizar fiados e pagamentos registrados por ele. O app não oferece empréstimos, serviços bancários, seguros, criptomoedas, carteira ou processamento de pagamentos. O texto sobre Pix é apenas um lembrete; o app não processa o pagamento.

Não há compra dentro do app para Android.

## Acesso ao app

Todas as funções úteis exigem login. Para preparar o acesso do revisor:

1. Crie manualmente uma conta de teste no site `www.fiadopro.com.br`.
2. Use o e-mail sugerido: `revisor.play@fiadopro.com.br`.
3. Configure uma senha e informe-a somente na Play Console e no 1Password. **Não coloque a senha neste arquivo nem no Git.**
4. Deixe prontos dados fictícios com fiados em aberto, pagos e atrasados, incluindo pelo menos um pagamento registrado:
   - Ana Costa — (11) 91111-1111
   - Rui Pereira — (11) 92222-2222
   - Lucia Ferreira — (11) 93333-3333
   - Pedro Lima — (11) 94444-4444
   - Maria Souza — (11) 95555-5555

Notas curtas para o revisor:

> O Fiado Pro é um caderno digital de fiado. Não há compras no app. Para cancelar a conta, acesse Meu Perfil → Zona de Perigo.

## URLs e contato

- **Site:** `www.fiadopro.com.br`.
- **Exclusão de conta:** `https://www.fiadopro.com.br/excluir-conta` — só informe depois do deploy.
- **Privacidade:** https://www.fiadopro.com.br/privacidade
- **Termos:** https://www.fiadopro.com.br/termos
- **Contato:** `contato@tech42.com.br`.
