# Pacote de Conteúdo das Lojas — Fiado Pro

> **Como usar:** este documento contém TODO o texto pronto para colar nos consoles
> **Google Play Console** e **Apple App Store Connect**. Cada bloco indica onde colar.
> Mantém os padrões exigidos pela Apple e pelo Google (descrição honesta, política
> de privacidade, classificação de dados, exclusão de conta).
>
> **Dados fixos do app:**
> - **Nome:** Fiado Pro
> - **Bundle/Package ID:** `br.com.fiadopro.app`
> - **Cor primária:** `#553C9A`
> - **Site:** https://www.fiadopro.com.br
> - **Privacidade:** https://www.fiadopro.com.br/privacidade
> - **Termos:** https://www.fiadopro.com.br/termos
> - **Suporte/contato:** (preencher e-mail de suporte, ex.: `suporte@fiadopro.com.br`)
> - **Conta de teste do revisor:** `revisor.apple@fiadopro.com.br` (criar conforme STATE.md)

---

## 1. NOME E SUBTÍTULOS

| Campo | Valor | Limite |
|---|---|---|
| Nome do app (ambas as lojas) | `Fiado Pro` | Apple 30 / Google 30 |
| Subtítulo (Apple) | `Controle de fiado do seu comércio` | 30 |
| Descrição curta (Google) | `Controle o fiado do seu comércio com clareza e sem constrangimento` | 80 |

---

## 2. DESCRIÇÃO LONGA (Google Play "Descrição completa" + Apple "Descrição")

> Cole o texto abaixo. Vale para as duas lojas (limite Apple 4000 / Google 4000).

```
O Fiado Pro é o caderninho de fiado digital feito para o comerciante de bairro:
mercearia, padaria, açougue, mercadinho, bar e salão. Em vez de anotar venda
fiada em papel e tentar lembrar quem deve, você registra em segundos e o app
organiza tudo por cliente.

POR QUE USAR O FIADO PRO
• Saiba exatamente quem te deve e quanto, a qualquer momento.
• Registre uma venda fiada em poucos toques — simples até para quem não tem
  intimidade com tecnologia.
• Envie um lembrete amigável pelo WhatsApp, sem clima ruim com o cliente.
• Confirme o pagamento com um toque e mantenha o histórico sempre atualizado.

O QUE VOCÊ FAZ NO APP
• Cadastrar clientes e lançar vendas no fiado.
• Acompanhar o saldo devedor de cada cliente.
• Ver quem está em atraso e quem está em dia.
• Gerar uma mensagem de cobrança pronta para enviar no WhatsApp.
• Acompanhar um resumo do seu negócio: total a receber e clientes ativos.

FEITO PARA O DIA A DIA DA LOJA
O Fiado Pro foi pensado para ser usado no balcão, no celular, com a loja cheia.
Sem planilha complicada, sem termo difícil. A ideia é simples: organizar o fiado
com dignidade, ajudar você a receber o que é seu e manter a boa relação com o
cliente.

SEUS DADOS PROTEGIDOS
Levamos a privacidade a sério. O Fiado Pro segue a LGPD: você pode excluir sua
conta e seus dados diretamente no app, a qualquer momento.

Baixe o Fiado Pro e transforme o caderninho de fiado em controle de verdade.
```

> **Observação de compliance (CVM 175):** o texto trata o app como **ferramenta de
> tecnologia/organização**, não como consultoria financeira ou de crédito. Não use
> termos como "garantimos recuperação", "rendimento" ou "recomendação de investimento".

---

## 3. PALAVRAS-CHAVE

**Apple (campo "Keywords", limite 100 caracteres, separadas por vírgula, sem espaços):**
```
fiado,credito,comercio,lojista,divida,caderneta,cobranca,mercearia,padaria,vendas,controle,pix
```

**Google Play:** não há campo de keywords — o ranqueamento usa o texto da descrição.
As palavras acima já estão distribuídas naturalmente na descrição longa.

---

## 4. CATEGORIA E CLASSIFICAÇÃO ETÁRIA

| Campo | Apple App Store | Google Play |
|---|---|---|
| Categoria primária | Business (Negócios) | Negócios |
| Categoria secundária | Finance (Finanças) | Finanças |
| Classificação etária | 4+ | Livre / PEGI 3 (resultado esperado do questionário: "Everyone") |

**Notas para o questionário de classificação (Google):** o app NÃO contém violência,
conteúdo sexual, drogas, jogos de azar nem compras simuladas. Responder "Não" a
todas as perguntas de conteúdo sensível. Resultado esperado: **Livre para todos**.

---

## 5. URLs OBRIGATÓRIAS

| Campo | URL |
|---|---|
| Política de Privacidade (ambas) | https://www.fiadopro.com.br/privacidade |
| Termos de Uso | https://www.fiadopro.com.br/termos |
| URL de suporte (Apple) | https://www.fiadopro.com.br |
| URL de marketing (opcional) | https://www.fiadopro.com.br |

---

## 6. GOOGLE PLAY — SEÇÃO "SEGURANÇA DE DADOS" (Data Safety)

> Caminho: Play Console → App → Política → Segurança de dados.
> Responda exatamente conforme a tabela (alinhado à Política de Privacidade publicada).

**Coleta e compartilhamento:**
- O app **coleta** dados? **Sim**
- O app **compartilha** dados com terceiros? **Não**
- Todos os dados em trânsito são **criptografados** (HTTPS/TLS)? **Sim**
- O usuário pode **solicitar a exclusão** dos dados? **Sim** (no app: Perfil → Excluir minha conta)

**Tipos de dados coletados:**

| Tipo de dado | Coletado | Finalidade | Obrigatório |
|---|---|---|---|
| Nome (do lojista) | Sim | Funcionalidade do app, gestão de conta | Sim |
| E-mail | Sim | Funcionalidade do app, gestão de conta | Sim |
| Nome e telefone de clientes do lojista (inseridos pelo lojista) | Sim | Funcionalidade do app (controle de fiado) | Sim |
| Informações financeiras (valores de fiado/dívida inseridos pelo lojista) | Sim | Funcionalidade do app | Sim |

> **Importante:** declarar que dados de terceiros (clientes do lojista) são inseridos
> pelo próprio usuário (lojista), usados apenas para a funcionalidade do app e **não
> são compartilhados nem vendidos**.

---

## 7. APPLE — "APP PRIVACY" (Privacy Nutrition Labels)

> Caminho: App Store Connect → App → App Privacy.

**Data used to track you (rastreamento):** **None / Nenhum.**

**Data linked to you (vinculado à identidade):**
- Contact Info → **Email Address** (finalidade: App Functionality)
- Contact Info → **Name** (finalidade: App Functionality)
- Financial Info → **Other Financial Info** (valores de fiado; finalidade: App Functionality)
- Contacts → **(dados de clientes inseridos pelo lojista)** (finalidade: App Functionality)

**Data not linked to you:** Usage Data → Product Interaction (finalidade: App Functionality), se aplicável.

> Em todas as finalidades, marcar **App Functionality**. NÃO marcar "Third-Party
> Advertising" nem "Developer's Advertising or Marketing".

---

## 8. APPLE — "APP REVIEW INFORMATION" (Notas para o revisor)

**Sign-in required:** Sim
- **Username:** `revisor.apple@fiadopro.com.br`
- **Password:** (senha da conta de teste — ver 1Password "Conta Teste Revisor Apple Fiado Pro")

**Notes (colar exatamente — em inglês, como a Apple prefere):**
```
Fiado Pro is a credit ("fiado") bookkeeping tool for small Brazilian merchants.
The app uses native capabilities that justify a native app over a website:
Push Notifications to alert merchants about overdue credits, Haptic Feedback for
transaction confirmations, and Network status management for offline scenarios.

A demo account is provided above, pre-populated with 5 fictional customers and
several credit entries in different states (pending, paid, overdue) so the full
flow can be reviewed.

Account deletion is available in-app at: Profile > Delete my account
(as required by Guideline 5.1.1(v)). It performs a soft-delete and anonymizes
personal data per Brazilian data protection law (LGPD).
```

---

## 9. DESCRIÇÃO DO QUE HÁ DE NOVO (What's New / Notas da versão 1.0.0)

```
Primeira versão do Fiado Pro:
• Controle de fiado por cliente
• Lembrete de cobrança pelo WhatsApp
• Resumo do total a receber
• Exclusão de conta e dados no próprio app (LGPD)
```

---

## 10. CHECKLIST DE CAMPOS POR LOJA

**Google Play Console:**
- [ ] Nome `Fiado Pro`
- [ ] Descrição curta (80) + descrição completa (seção 2)
- [ ] Ícone 512×512 + Feature graphic 1024×500 (ver `docs/ASSETS-SPEC.md`)
- [ ] Screenshots de telefone (mín. 2, recomendo 4)
- [ ] Categoria: Negócios
- [ ] Classificação de conteúdo (questionário → Livre)
- [ ] Público-alvo e conteúdo
- [ ] Segurança de dados (seção 6)
- [ ] Política de privacidade (URL)
- [ ] AAB enviado em Produção

**Apple App Store Connect:**
- [ ] Nome `Fiado Pro` + Subtítulo
- [ ] Descrição (seção 2) + Keywords (seção 3)
- [ ] Categoria: Business
- [ ] Screenshots iOS (6.7" obrigatório; ver `docs/ASSETS-SPEC.md`)
- [ ] URL de suporte + URL de privacidade
- [ ] App Privacy (seção 7)
- [ ] App Review Information + conta de teste (seção 8)
- [ ] Classificação etária 4+
- [ ] Build do TestFlight selecionado
- [ ] Enviar para análise
</content>
