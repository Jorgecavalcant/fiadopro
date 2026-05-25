# PRD: Empacotamento Mobile — Fiado Pro

> **Produto**: Fiado Pro
> **Versao**: 2.0
> **Data**: 2026-04-13
> **Status**: [ ] Rascunho  [ ] Em revisao  [ ] Aprovado
> **Autor**: Jorge (CEO) + Claude (Analista de Solucoes)

---

## 1. Problema

**Qual e o problema?**

O Fiado Pro existe hoje como uma aplicacao web acessivel pelo navegador. Para crescer e atingir o publico principal — donos de pequeno comercio de bairro (padeiros, acougues, mercearias) — o app precisa estar disponivel na Play Store (Android) e App Store (iOS). Esses comerciantes nao buscam "site no navegador". Eles baixam app.

Alem disso, o PRD v1.0 continha uma abordagem tecnica que **seria rejeitada pela Apple**: carregar a URL de producao dentro de um WebView. Para Apple e Google, isso e apenas um "navegador disfarado de app" — e causa rejeicao automatica. O v2.0 corrige isso: os arquivos do frontend ficam empacotados DENTRO do app. Apenas as chamadas de dados (API) vao para o servidor.

**Por que resolver agora?**

A autenticacao esta completa e o produto ja funciona em producao. O proximo passo natural e a presenca nas lojas de aplicativos para viabilizar aquisicao de usuarios em escala. Sem isso, o canal de crescimento organico (busca nas stores) fica travado.

**O que acontece se nao resolver?**

- O Fiado Pro nao aparece na busca da Play Store nem da App Store
- Nao e possivel rodar anuncios que direcionam para download de app
- O comerciante precisa acessar via browser — experiencia inferior, sem notificacoes nativas, sem icone na tela inicial
- Produtos concorrentes ja estao nas stores

---

## 2. Objetivos

| Objetivo | Metrica de sucesso |
|---|---|
| Publicar app Android na Play Store | App aprovado e disponivel para download publico |
| Publicar app iOS na App Store | App aprovado e disponivel para download publico |
| Corrigir riscos de seguranca conhecidos antes do lancamento | JWT fora do localStorage + secrets fora do docker-compose |
| Implementar features nativas obrigatorias (push, splash, etc.) | Todos os plugins Capacitor listados funcionando nos builds |
| Garantir conformidade com Apple Guideline 5.1.1(v) | Botao "Excluir minha conta" funcional no app |
| Garantir conformidade com Play Store Data Safety | Formulario de seguranca de dados preenchido e publicado |
| Manter paridade funcional com a versao web | Nenhuma funcionalidade quebrada no app mobile |

---

## 3. Fora do escopo

- [ ] Redesign da interface para mobile-first
- [ ] In-app purchases ou pagamento dentro do app
- [ ] Publicacao na App Store da China ou outras lojas alternativas
- [ ] Testes automatizados de UI para mobile
- [ ] Correcao do dominio de e-mail transacional (Resend — fica para outro sprint)
- [ ] Biometria (Touch ID / Face ID) para login
- [ ] Modo offline completo com sincronizacao de dados (o Network plugin apenas exibe aviso — nao armazena dados offline)
- [ ] Onboarding animado ou tour guiado para novos usuarios

**Por que**: O objetivo deste sprint e empacotar o que ja existe, adicionar as features nativas minimas exigidas pelas stores, e publicar. Redesigns e funcionalidades avancadas sao escopo de sprints futuros.

---

## 4. User Stories

**Usuarios afetados:**
- Comerciante lojista: dono de padaria, mercadinho, acougue, bar de bairro
- Jorge (operador/admin): responsavel por publicar e manter o app nas stores

**Historias:**

1. Como comerciante, eu quero encontrar o Fiado Pro buscando na Play Store, para baixar sem precisar de link especifico.
2. Como comerciante, eu quero encontrar o Fiado Pro buscando na App Store, para baixar no iPhone sem precisar de link especifico.
3. Como comerciante, eu quero que o app abra direto sem pedir o navegador, para ter a experiencia de um app de verdade.
4. Como comerciante, eu quero que o app funcione da mesma forma que o site, para nao perder nenhuma funcionalidade que ja uso.
5. Como comerciante, eu quero receber uma notificacao quando um fiado estiver vencido, para nao esquecer de cobrar o cliente.
6. Como comerciante, eu quero sentir uma vibracao ao registrar um fiado, para ter confirmacao fisica de que foi salvo.
7. Como comerciante, eu quero conseguir excluir minha conta de dentro do app, para ter controle sobre meus dados pessoais.
8. Como comerciante, eu quero ver uma mensagem clara quando estiver sem internet, para nao ficar confuso se o app nao carregar.
9. Como Jorge, eu quero gerar o APK Android pelo Android Studio no Windows, para publicar na Play Store sem precisar de servidor externo.
10. Como Jorge, eu quero gerar o build iOS pelo Codemagic (servico em nuvem), para publicar na App Store sem precisar de um computador Mac.

---

## 5. Requisitos funcionais

### 5.1 Capacitor — Assets locais (CORRECAO CRITICA do v1.0)

**O frontend deve ser empacotado DENTRO do app, nao carregado de URL remota.**

- O build do frontend (`npm run build`) gera a pasta `dist/`
- O Capacitor e configurado com `webDir: 'dist'` no `capacitor.config.ts`
- Os arquivos HTML, CSS e JavaScript ficam dentro do pacote do app (APK/IPA)
- Apenas as chamadas de API (ex: `https://api.fiadopro.com.br/api/...`) saem para o servidor remoto
- Isso elimina o risco de rejeicao por "WebView wrapper" tanto na Apple quanto no Google

### 5.2 Android (Play Store)

1. O app deve ser empacotado usando o Capacitor ja instalado no projeto
2. O projeto Android (`android/`) deve estar configurado com App ID `br.com.fiadopro.app`
3. O AAB (Android App Bundle) deve ser gerado via Android Studio no Windows de Jorge
4. O icone do app, nome ("Fiado Pro") e versao (1.0.0) devem estar configurados corretamente
5. O app deve ser submetido via Google Play Console (taxa unica de $25)

### 5.3 iOS (App Store via Codemagic)

1. O build iOS deve ser gerado pelo servico Codemagic (CI/CD em nuvem — nao requer Mac)
2. O projeto deve ser configurado com os certificados e provisioning profiles da Apple Developer
3. O IPA deve ser gerado pelo Codemagic e enviado automaticamente para o TestFlight
4. Apos validacao no TestFlight, o app deve ser submetido para revisao da App Store
5. O app deve ser submetido via App Store Connect

### 5.4 Exclusao de conta — OBRIGATORIO (Apple Guideline 5.1.1(v))

Desde junho de 2022, a Apple exige que todo app com criacao de conta tambem permita exclusao de conta de dentro do proprio app. Sem isso, o app e rejeitado.

1. **Backend**: Novo endpoint `DELETE /api/users/me` para exclusao da conta do usuario autenticado
2. **Confirmacao com senha**: Antes de excluir, o app solicita a senha atual do usuario (evita exclusoes acidentais)
3. **Interface**: Botao "Excluir minha conta" acessivel na tela de Configuracoes do app
4. **Feedback visual**: Mensagem clara explicando o que sera excluido e que a acao e irreversivel
5. **Pos-exclusao**: Usuario e deslogado e redirecionado para a tela inicial
6. **LGPD**: O usuario recebe confirmacao por e-mail de que seus dados foram removidos do sistema

### 5.5 Seguranca — obrigatorio antes do lancamento

1. O JWT de autenticacao deve ser movido do `localStorage` para `httpOnly cookies` — protege contra ataques XSS que roubam tokens de sessao
2. Os secrets do `docker-compose.yml` (senhas, chaves de API) devem ser movidos para variaveis de ambiente em arquivo `.env`
3. O arquivo `.env` deve estar listado no `.gitignore` e nunca enviado ao repositorio
4. **NOVO:** Migrar password hashing de PBKDF2 com SHA-256 (100k iteracoes) → **Argon2** (state-of-the-art, vencedor da Password Hashing Competition 2015)
   - Argon2 e superior: resiste ataques GPU/ASIC, usa memória como barreira adicional
   - Custo: zero (open source). Nenhuma mudanca visivel ao usuario — apenas novo hash para senhas alteradas
   - Migração: hash antigo mantido para usuarios existentes; novo Argon2 ao alterar senha ou fazer nova autenticacao

### 5.6 Features nativas — Plugins Capacitor

Estas features sao obrigatorias para o app parecer nativo e nao ser rejeitado pelas stores:

| Feature | Plugin | O que faz | Estimativa |
|---|---|---|---|
| Splash Screen nativa | @capacitor/splash-screen | Elimina o flash branco ao abrir o app | 2h |
| Status Bar nativa | @capacitor/status-bar | Integra a cor da barra de status com o tema do app | 1h |
| Push Notifications | @capacitor/push-notifications | Notifica o comerciante sobre fiados vencidos | 8h |
| Haptic Feedback | @capacitor/haptics | Vibracao ao registrar um fiado — confirmacao fisica | 1h |
| Toast nativos | @capacitor/toast | Mensagens de confirmacao no estilo nativo (substitui alertas do browser) | 1h |
| Deep Links | @capacitor/app | Permite links `fiadopro://` e Universal Links | 4h |
| Keyboard | @capacitor/keyboard | Controle do teclado virtual — evita bugs de layout em formularios | 1h |
| Network (offline) | @capacitor/network | Detecta ausencia de internet e exibe mensagem amigavel | 2h |

---

## 6. Requisitos nao-funcionais

### Seguranca

- JWT em `httpOnly cookie` elimina o principal vetor de ataque XSS contra sessoes de usuario
- Secrets em `.env` elimina risco de credenciais expostas em repositorios
- Nenhuma informacao sensivel de usuario (nome, telefone, dados de fiado) pode ser logada em texto simples
- Endpoint de exclusao de conta deve validar a senha antes de executar a exclusao

### Performance

- O app mobile deve carregar em no maximo 5 segundos em conexao 4G
- A Splash Screen deve ocultar o carregamento inicial e transicionar suavemente para o app

### Compatibilidade

- Android: versao minima Android 8.0 (API 26) — cobre mais de 95% dos dispositivos Android em uso no Brasil
- iOS: versao minima iOS 15 — cobre mais de 90% dos dispositivos iPhone em uso no Brasil

### LGPD

- O app coleta dados pessoais de clientes dos lojistas (nome, telefone, historico de fiado)
- Consentimento de coleta de dados deve ser registrado no momento do cadastro, com timestamp no banco de dados (LGPD Art. 8)
- O usuario deve poder excluir sua conta e dados de dentro do app (LGPD Art. 18)
- A Politica de Privacidade deve estar acessivel em `https://www.fiadopro.com.br/privacidade`
- Os Termos de Uso devem estar acessiveis em `https://www.fiadopro.com.br/termos`

---

## 7. Criterios de aceite

O sprint so estara concluido quando TODOS os itens abaixo estiverem verificados:

### Sprint 1 — Seguranca (bloqueia tudo — precisa estar pronto primeiro)
- [ ] JWT migrado de `localStorage` para `httpOnly cookie` e testado em producao
- [ ] Secrets removidos do `docker-compose.yml` e funcionando via `.env`
- [ ] `.env` confirmado no `.gitignore`
- [ ] **NOVO:** Password hashing migrado para Argon2 (biblioteca npm + testes + migracao de usuarios existentes)
- [ ] Endpoint `DELETE /api/users/me` implementado com confirmacao de senha
- [ ] Botao "Excluir minha conta" funcional na tela de Configuracoes
- [ ] E-mail de confirmacao de exclusao enviado ao usuario

### Sprint 2 — Features nativas
- [ ] Todos os 8 plugins Capacitor instalados e funcionando
- [ ] Push Notifications enviando notificacao de teste para dispositivo real
- [ ] Splash Screen exibida ao abrir o app (sem flash branco)
- [ ] Haptic Feedback disparado ao registrar fiado
- [ ] Mensagem de "sem internet" exibida ao desconectar

### Sprint 3 — Compliance
- [ ] Pagina `https://www.fiadopro.com.br/privacidade` publicada e acessivel
- [ ] Pagina `https://www.fiadopro.com.br/termos` publicada e acessivel
- [ ] Checkbox de consentimento no cadastro com timestamp gravado no banco
- [ ] Data Safety (Play Store) preenchido
- [ ] Privacy Labels (App Store) preenchido

### Sprint 4 — Build e Publicacao
- [ ] Build AAB Android gerado sem erros pelo Android Studio
- [ ] App instalado e testado em dispositivo Android real
- [ ] Login, listagem de clientes e lancamento de fiado funcionando no app Android
- [ ] Build IPA iOS gerado pelo Codemagic sem erros
- [ ] App disponivel no TestFlight para teste
- [ ] Login, listagem de clientes e lancamento de fiado funcionando no TestFlight
- [ ] App submetido ao Google Play Console
- [ ] App submetido ao App Store Connect

---

## 8. Dependencias e pre-requisitos

### O que Jorge precisa fazer manualmente (nao e codigo)

| Acao | Onde | Observacao |
|---|---|---|
| Criar conta Google Play Console | play.google.com/console | Taxa unica de $25 |
| Criar conta Apple Developer | developer.apple.com | $99/ano — renovacao anual |
| Decidir tipo de conta Apple (ver Secao 10) | — | Individual vs Organization |
| Criar conta no Codemagic | codemagic.io | Plano gratuito ja e suficiente para comecar |
| Preparar icone do app | — | PNG 1024x1024px, fundo opaco (sem transparencia) |
| Preparar screenshots Android | — | 1080x1920px, minimo 2 |
| Preparar screenshots iOS | — | 1290x2796px, minimo 3 |
| Preparar Feature Graphic | — | 1024x500px (obrigatoria Play Store) |
| Escrever descricao curta | — | Maximo 80 caracteres |
| Escrever descricao longa | — | Ate 4000 caracteres |
| Instalar Android Studio | developer.android.com/studio | Para gerar o build Android no Windows |

### Pre-requisitos tecnicos (responsabilidade do time de dev)

- Capacitor ja instalado no projeto (confirmado)
- Pasta `android/` ja criada com projeto Gradle (confirmado)
- App ID `br.com.fiadopro.app` ja definido (confirmado)
- App rodando em producao e acessivel via HTTPS (confirmado)
- `webDir: 'dist'` configurado no `capacitor.config.ts` (a verificar/corrigir)

---

## 9. Riscos identificados

| Risco | Probabilidade | Impacto | Classificacao | Mitigacao |
|---|---|---|---|---|
| Apple rejeitar por falta de exclusao de conta | Alta | Alto | BLOQUEANTE | Sprint 1 implementa o endpoint e o botao antes de qualquer build |
| Apple rejeitar por "apenas WebView" (carregar URL remota) | Media-Alta | Alto | BLOQUEANTE | Sprint 2 garante `webDir: 'dist'` com assets locais |
| Play Store rejeitar por Data Safety incompleto | Media | Alto | BLOQUEANTE | Sprint 3 preenche Data Safety antes do submit |
| DUNS Number necessario se Jorge escolher conta Organization | Alta | Medio | Atrasante | Optar por conta Individual primeiro (ver Secao 10) |
| Codemagic apresentar problemas de configuracao dos certificados iOS | Alta | Medio | Tecnico | Reservar tempo extra; seguir documentacao oficial Codemagic + Capacitor |
| Migracao do JWT quebrar sessoes ativas de usuarios | Baixa | Alto | Tecnico | Fazer deploy fora do horario de pico; testar em staging antes |
| Secrets no `.env` nao configurados corretamente na VPS | Baixa | Alto | Tecnico | Validar que o container sobe corretamente apos a mudanca |
| Push Notifications nao aprovadas pela Apple no review | Baixa | Medio | Tecnico | Documentar o caso de uso nas Review Notes (ver Secao 11) |

---

## 10. Contexto tecnico

- **Produto**: Fiado Pro
- **URL de producao**: https://www.fiadopro.com.br
- **Stack**: React 18 + Vite (frontend), Node.js/Express + TypeScript (backend), PostgreSQL 16
- **Empacotamento mobile**: Capacitor — com `webDir: 'dist'` (assets locais, nao URL remota)
- **Codigo na VPS**: `/srv/projetos/clientes/fiado-pro/frontend/`
- **Pasta Android**: `/srv/projetos/clientes/fiado-pro/frontend/android/`
- **App ID**: `br.com.fiadopro.app`
- **Build iOS**: Codemagic (CI/CD em nuvem, sem necessidade de Mac)
- **Sistemas afetados**: Frontend (migracao JWT + plugins Capacitor), backend (httpOnly cookies + endpoint exclusao de conta), banco de dados (campo de consentimento + soft/hard delete de usuario), infraestrutura (docker-compose / .env)
- **Integracoes externas novas**: Codemagic (build iOS), Google Play Console, Apple App Store Connect, Firebase Cloud Messaging ou APNs (push notifications)

---

## 11. Decisao pendente — Conta Apple Developer

Jorge precisa decidir o tipo de conta antes de iniciar a Sprint 4:

| Tipo | Prazo para ativar | Publisher nas stores | Observacao |
|---|---|---|---|
| Individual | 1-2 dias | "Jorge [sobrenome]" | Mais rapido. Pode migrar para Organization depois |
| Organization | 2-4 semanas | "Tech 42 LTDA" | Requer DUNS Number — processo burocratico da Dun & Bradstreet |

**Recomendacao**: Comecar com conta Individual para nao atrasar o lancamento. Migrar para Organization em uma segunda fase quando o app ja estiver publicado.

---

## 12. Compliance

### LGPD

- [x] **Aplicavel.** O Fiado Pro armazena dados pessoais dos clientes dos lojistas (nome, telefone, historico de compras fiadas).
- Pagina de Politica de Privacidade: `https://www.fiadopro.com.br/privacidade` (a criar — Sprint 3)
- Pagina de Termos de Uso: `https://www.fiadopro.com.br/termos` (a criar — Sprint 3)
- Consentimento de coleta registrado no cadastro com timestamp (LGPD Art. 8) — Sprint 3
- Direito de exclusao de dados exercitavel de dentro do app (LGPD Art. 18) — Sprint 1
- E-mail de confirmacao de exclusao de dados enviado ao usuario — Sprint 1

### Google Play — Data Safety Section

Dados a declarar no formulario:

| Dado | Categoria | Criptografado em transito | Pode ser excluido |
|---|---|---|---|
| Nome do lojista | Informacoes pessoais | Sim | Sim |
| Telefone do lojista | Informacoes de contato | Sim | Sim |
| Historico de compras dos clientes fiados | Atividade financeira | Sim | Sim |

### Apple App Store — Privacy Labels

- Nome e telefone do lojista: categoria "Contact Info" — classificado como "Data Linked to You"
- Historico de fiados: categoria "Financial Info" — classificado como "Data Linked to You"

### Classificacao etaria

- iOS (App Store): 4+
- Android (Play Store): Everyone

### Categoria nas lojas

- **Business** (em ambas as stores)
- Nao usar "Finance" — evita revisao regulatoria adicional

### CVM175

- [ ] **Nao aplicavel.** Fiado Pro nao envolve recomendacao financeira.

---

## 13. Checklist de publicacao

Lista completa de artefatos que precisam estar prontos antes de submeter nas stores. Nao submeter enquanto houver item aberto.

### Assets visuais
- [ ] Icone 1024x1024px, fundo opaco (sem transparencia, sem arredondamento — as stores arredondam automaticamente)
- [ ] Screenshots Android: minimo 2, resolucao 1080x1920px
- [ ] Screenshots iOS: minimo 3, resolucao 1290x2796px
- [ ] Feature Graphic: 1024x500px (obrigatoria para Play Store)

### Textos e metadados
- [ ] Descricao curta escrita (maximo 80 caracteres)
- [ ] Descricao longa escrita (ate 4000 caracteres)
- [ ] URL da Politica de Privacidade: `https://www.fiadopro.com.br/privacidade`
- [ ] URL dos Termos de Uso: `https://www.fiadopro.com.br/termos`
- [ ] Review Notes escritas (ver texto sugerido abaixo)

### Formularios das lojas
- [ ] Data Safety (Play Store) preenchido com os dados declarados na Secao 12
- [ ] Privacy Labels (App Store) preenchidos com as categorias da Secao 12
- [ ] Classificacao etaria respondida (4+ iOS / Everyone Android)

### Tecnico — Bloqueantes de aprovacao
- [ ] Exclusao de conta implementada e testada (endpoint + botao no app)
- [ ] Push Notifications funcionando em dispositivo real
- [ ] Assets locais no Capacitor (`webDir: 'dist'`) — NUNCA URL remota
- [ ] JWT em httpOnly cookie (nao localStorage)
- [ ] `.env` com secrets (nao no docker-compose)
- [ ] Conta de teste criada para o revisor da Apple (login + senha funcional para review)

### Review Notes sugeridas para Apple

Texto a incluir no campo "Notes for Reviewer" no App Store Connect:

> "Fiado Pro uses native Push Notifications to alert merchants about overdue credits, Haptic Feedback for transaction confirmations, and network status management for offline scenarios. The app solves a specific informal credit management problem for small Brazilian merchants that would not be possible via website alone. Account deletion is available in Settings > Delete my account, as required by Guideline 5.1.1(v)."

---

## Historico de versoes

| Versao | Data | O que mudou |
|---|---|---|
| 1.0 | 2026-04-13 | Versao inicial |
| 2.0 | 2026-04-13 | Correcao critica: assets locais (nao URL remota); exclusao de conta obrigatoria (Apple 5.1.1(v)); features nativas movidas para dentro do escopo; compliance e legal detalhados; conta Apple Developer documentada; Review Notes Apple; riscos atualizados; sprints reorganizados em 4; checklist de publicacao adicionado (Secao 13) |
| 2.0.1 | 2026-04-13 | Ajustes Opus: Review Notes com menção a exclusão de conta (5.1.1(v)); conta de teste para revisor Apple adicionada ao checklist |
| 2.0.2 | 2026-04-21 | Seguranca — adicionado requisito Argon2 em Sprint 1 (state-of-the-art password hashing obrigatorio antes de publicar nas lojas) |

---

> **Proximo passo**: Jorge revisa e aprova este PRD v2.0. Com aprovacao confirmada, o Analista de Solucoes gera a SPEC tecnica com os 4 sprints detalhados.
