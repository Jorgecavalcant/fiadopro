# SESSÃO — Sprint 4: Publicação nas Lojas (Fiado Pro)

> **Cole este documento no início de uma nova conversa com o Claude Code.**
> Esta sessão cobre a parte manual da Sprint 4 — Jorge executa as etapas, os agentes auxiliam quando necessário.

> **🧙 Para decisões técnicas complexas durante a execução** (ex.: erro de build, dúvida sobre keystore, escolha entre opções de upload), o agente deve consultar o `conselheiro-dev` (Opus) via Agent tool com `subagent_type: "conselheiro-dev"`. Ele orienta sem executar.

---

## CONTEXTO PARA O AGENTE

Você é o JC Agent Manager da Tech 42. Esta é uma sessão de **Implementação (Fase I do Protocolo RPI)** para o **Fiado Pro**, Sprint 4 — parte manual: publicação nas lojas.

**Antes de qualquer ação, leia:**
- `D:\TECH42\PROJETOS\fiado-pro\STATE.md`
- `D:\TECH42\PROJETOS\fiado-pro\docs\SPEC-empacotamento-mobile-v1.0.md` (seção Sprint 4)

**VPS:** `jorge@46.224.55.18` | Código: `/srv/projetos/clientes/fiado-pro/`
**Capacitor appId:** `br.com.fiadopro.app` | Cor primária: `#553C9A`

**O que já está pronto (NÃO refazer):**
- Sprints 1, 2 e 3 concluídas (JWT cookie, 8 plugins Capacitor, LGPD compliance)
- `capacitor.config.ts` corrigido com cor `#553C9A` e StatusBar
- `.env.production`, `codemagic.yaml`, `.well-known/assetlinks.json` (placeholder SHA-256) e `.well-known/apple-app-site-association` (placeholder TEAMID) publicados em produção
- Build + `cap sync android` executados — 8 plugins sincronizados

**O que esta sessão precisa concluir:** Etapas 1 a 11 abaixo.

---

## REGRAS DA SESSÃO

1. Jorge executa cada etapa; os agentes orientam e executam comandos na VPS quando necessário
2. Após cada etapa marcada com 🤖 **"avisar agentes"**, Jorge para e informa o resultado para os agentes atualizarem arquivos na VPS
3. Atualizar STATE.md ao final em dois lugares: local (`D:\TECH42\PROJETOS\fiado-pro\STATE.md`) e VPS (`/srv/projetos/clientes/fiado-pro/docs/STATE.md`)
4. NUNCA remover a pasta `dist/` na raiz da VPS
5. Deploy obrigatório após mudanças na VPS:
   ```
   cd /srv/projetos/clientes/fiado-pro/frontend && npm run build
   docker compose -f /srv/projetos/clientes/fiado-pro/docker-compose.yml up -d
   ```

---

## PLANO DE EXECUÇÃO EM MICRO TAREFAS

### ETAPA 1 — Firebase (Push Notifications)
**Objetivo:** Criar projeto Firebase e obter o arquivo `google-services.json` para ativar push notifications no Android.

- [ ] **1.1** Acessar https://console.firebase.google.com e fazer login com a conta Google da Tech 42
- [ ] **1.2** Clicar em "Criar um projeto" → Nome: `Fiado Pro` → desativar Google Analytics (desnecessário) → Criar projeto
- [ ] **1.3** Dentro do projeto, clicar no ícone Android (`)`) para adicionar um app Android
- [ ] **1.4** Preencher:
  - **Package name:** `br.com.fiadopro.app` ← exatamente este, sem espaços
  - **App nickname:** `Fiado Pro Android`
  - **Debug signing certificate SHA-1:** deixar em branco por agora
- [ ] **1.5** Clicar "Registrar app"
- [ ] **1.6** Na tela seguinte, clicar "Baixar google-services.json" e salvar o arquivo em `D:\TECH42\PROJETOS\fiado-pro\`
- [ ] **1.7** Pular as próximas telas ("Adicionar SDK Firebase" e "Verificar instalação") — clicar "Próximo" até finalizar
- [ ] **1.8** No menu lateral do Firebase, ir em **Build > Cloud Messaging** → anotar o **Server Key** (ou configurar Firebase Admin SDK)

🤖 **Avisar agentes:** "Tenho o google-services.json baixado em D:\TECH42\PROJETOS\fiado-pro\ — me ajude a enviar para a VPS e rodar o cap sync"

*Os agentes vão executar:*
```bash
# Enviar para VPS (executar no PowerShell do Windows):
scp D:\TECH42\PROJETOS\fiado-pro\google-services.json jorge@46.224.55.18:/srv/projetos/clientes/fiado-pro/frontend/android/app/

# Na VPS: rodar cap sync para incorporar o google-services.json
cd /srv/projetos/clientes/fiado-pro/frontend && npm run build && npx cap sync android
```

---

### ETAPA 2 — Android Studio
**Objetivo:** Instalar o Android Studio para compilar o app Android.

- [ ] **2.1** Acessar https://developer.android.com/studio e baixar a versão para Windows
- [ ] **2.2** Instalar com as opções padrão (incluir Android SDK, Android Virtual Device)
- [ ] **2.3** Abrir o Android Studio pela primeira vez → aceitar licenças → aguardar download dos SDKs (~10-15 min)
- [ ] **2.4** Confirmar que o Android Studio abriu a tela de boas-vindas sem erros

---

### ETAPA 3 — Baixar pasta android/ da VPS
**Objetivo:** Trazer o projeto Android para a máquina do Jorge para compilar localmente.

🤖 **Pedir aos agentes para executar:** "Me ajude a baixar a pasta android/ da VPS"

*Os agentes vão executar o comando — ou Jorge executa diretamente no PowerShell:*
```powershell
scp -r jorge@46.224.55.18:/srv/projetos/clientes/fiado-pro/frontend/android D:\TECH42\PROJETOS\fiado-pro\android
```

- [ ] **3.1** Executar o comando acima no PowerShell
- [ ] **3.2** Confirmar que a pasta `D:\TECH42\PROJETOS\fiado-pro\android\` existe e tem arquivos dentro

---

### ETAPA 4 — Gerar Keystore (assinatura do app)
**Objetivo:** Criar a "chave de assinatura" que identifica o Fiado Pro nas lojas. Esta chave é permanente — perder ela significa não conseguir mais atualizar o app.

> ⚠️ **CRÍTICO:** Guardar o arquivo `.jks` e a senha no 1Password imediatamente após criar. NUNCA enviar para o GitHub.

- [ ] **4.1** Abrir o **Prompt de Comando** (cmd) ou PowerShell como Administrador
- [ ] **4.2** Navegar para a pasta onde guardar o keystore:
  ```
  cd D:\TECH42\PROJETOS\fiado-pro
  ```
- [ ] **4.3** Executar o comando para criar o keystore:
  ```
  keytool -genkey -v -keystore fiado-pro-release.jks -alias fiado-pro -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] **4.4** Responder as perguntas:
  - **Senha do keystore:** criar senha forte → anotar no 1Password como "Keystore Fiado Pro"
  - **Primeiro e último nome:** Jorge (ou nome da empresa)
  - **Unidade organizacional:** Tech 42
  - **Organização:** Tech 42 LTDA
  - **Cidade:** [sua cidade]
  - **Estado:** [seu estado, ex: SP]
  - **País:** BR
  - Confirmar com `s` ou `yes`
- [ ] **4.5** Confirmar que o arquivo `D:\TECH42\PROJETOS\fiado-pro\fiado-pro-release.jks` foi criado
- [ ] **4.6** Obter o SHA-256 do keystore:
  ```
  keytool -list -v -keystore D:\TECH42\PROJETOS\fiado-pro\fiado-pro-release.jks -alias fiado-pro
  ```
- [ ] **4.7** Copiar a linha que começa com `SHA256:` (ex: `SHA256: AB:CD:EF:...`)

🤖 **Avisar agentes:** "Tenho o SHA-256 do keystore: [colar o valor aqui] — me ajude a atualizar o assetlinks.json na VPS"

*Os agentes vão atualizar `/srv/projetos/clientes/fiado-pro/frontend/public/.well-known/assetlinks.json` com o SHA-256 real e rodar `npm run build`.*

---

### ETAPA 5 — Google Play Console
**Objetivo:** Criar a conta para publicar o app Android.

- [ ] **5.1** Acessar https://play.google.com/console e fazer login com a conta Google da Tech 42
- [ ] **5.2** Pagar a taxa única de **USD $25** com cartão de crédito
- [ ] **5.3** Preencher os dados da conta de desenvolvedor (nome, endereço)
- [ ] **5.4** Aguardar aprovação (geralmente imediata ou em até 48h)

---

### ETAPA 6 — Conta Apple Developer
**Objetivo:** Criar a conta para publicar o app iOS.

- [ ] **6.1** Acessar https://developer.apple.com e fazer login com o Apple ID da Tech 42
- [ ] **6.2** Clicar em "Enroll" → selecionar "Organization" ou "Individual" conforme preferir
- [ ] **6.3** Pagar a taxa anual de **USD $99**
- [ ] **6.4** Aguardar aprovação (pode levar de 1 a 5 dias úteis)
- [ ] **6.5** Após aprovação: acessar https://appstoreconnect.apple.com → anotar o **Team ID** (aparece no canto superior direito ou em Account > Membership)

🤖 **Avisar agentes:** "Tenho o Team ID da Apple: [colar o valor] — me ajude a atualizar o apple-app-site-association na VPS"

*Os agentes vão atualizar `/srv/projetos/clientes/fiado-pro/frontend/public/.well-known/apple-app-site-association` substituindo `TEAMID` pelo valor real e rodar `npm run build`.*

---

### ETAPA 7 — Conta de Teste — Revisor Apple
**Objetivo:** Criar uma conta funcional no app para o revisor da Apple testar durante a análise.

- [ ] **7.1** Acessar https://www.fiadopro.com.br
- [ ] **7.2** Criar conta com:
  - **Email:** `revisor.apple@fiadopro.com.br`
  - **Senha:** criar senha forte → guardar no 1Password como "Conta Teste Revisor Apple Fiado Pro"
  - **Marcar o checkbox** de aceite dos termos (obrigatório)
- [ ] **7.3** Criar **5 clientes fictícios:**
  1. Ana Costa — (11) 91111-1111
  2. Rui Pereira — (11) 92222-2222
  3. Lucia Ferreira — (11) 93333-3333
  4. Pedro Lima — (11) 94444-4444
  5. Maria Souza — (11) 95555-5555
- [ ] **7.4** Criar **10 fiados** distribuídos entre os clientes, em estados variados:
  - Pelo menos 3 pendentes, 3 pagos, 2 vencidos, 2 à vencer em breve
- [ ] **7.5** Registrar **3 pagamentos** (confirmar pagamento em fiados já criados)
- [ ] **7.6** Verificar que o login, listagem e fluxos principais funcionam com essa conta

---

### ETAPA 8 — Assets Visuais
**Objetivo:** Criar todos os materiais visuais obrigatórios para as lojas.

> Dica: usar DALL-E, Midjourney ou Canva para criar o ícone. Para screenshots, capturar do site em modo mobile (Chrome DevTools → Toggle Device Toolbar).

**Ícone do app:**
- [ ] **8.1** Criar ícone com o prompt:
  > *"Minimalist app icon for a small business credit tracking app called 'Fiado Pro'. Purple background (#553C9A), white clean icon depicting a handshake or a small shop ledger. Flat design, no gradients, no text, suitable for app store. 1024x1024px."*
- [ ] **8.2** Salvar como PNG 1024x1024px, **fundo opaco** (sem transparência, sem bordas arredondadas)
- [ ] **8.3** Salvar em `D:\TECH42\PROJETOS\fiado-pro\assets\icon-1024.png`

**Splash Screen:**
- [ ] **8.4** Criar versão Android: 1080x1920px — fundo roxo `#553C9A`, logo centralizado
- [ ] **8.5** Criar versão iOS: 1290x2796px — mesma composição
- [ ] **8.6** Salvar em `D:\TECH42\PROJETOS\fiado-pro\assets\`

**Screenshots (capturar do site):**
- [ ] **8.7** Abrir Chrome → ir para https://www.fiadopro.com.br → F12 → Toggle Device Toolbar → selecionar resolução 1080x1920
- [ ] **8.8** Fazer login e capturar 4 telas:
  1. Lista de clientes (tela principal)
  2. Detalhes de um cliente com fiados
  3. Tela de adicionar fiado
  4. Dashboard / resumo
- [ ] **8.9** Salvar screenshots em `D:\TECH42\PROJETOS\fiado-pro\assets\screenshots\`

**Feature Graphic (apenas Play Store):**
- [ ] **8.10** Criar imagem 1024x500px — fundo `#553C9A`, logo + texto "Controle o fiado do seu negócio"
- [ ] **8.11** Salvar em `D:\TECH42\PROJETOS\fiado-pro\assets\feature-graphic.png`

---

### ETAPA 9 — Build Android (AAB)
**Objetivo:** Gerar o arquivo do app Android assinado para enviar à Play Store.

- [ ] **9.1** Abrir Android Studio → `File > Open` → selecionar `D:\TECH42\PROJETOS\fiado-pro\android`
- [ ] **9.2** Aguardar o Gradle sync completar (pode demorar 5-10 min na primeira vez)
- [ ] **9.3** Se aparecer aviso de JDK: usar o JDK incluído no Android Studio (JDK 17)
- [ ] **9.4** Confirmar que `google-services.json` está em `android/app/google-services.json` (foi copiado na Etapa 1)
- [ ] **9.5** Ir em: `Build > Generate Signed Bundle / APK`
- [ ] **9.6** Selecionar **Android App Bundle** → Next
- [ ] **9.7** Em "Key store path": navegar até `D:\TECH42\PROJETOS\fiado-pro\fiado-pro-release.jks`
- [ ] **9.8** Preencher:
  - Key store password: [senha criada na Etapa 4]
  - Key alias: `fiado-pro`
  - Key password: [mesma senha]
- [ ] **9.9** Build variant: **release** → clicar Finish
- [ ] **9.10** Aguardar build (5-15 min)
- [ ] **9.11** O AAB estará em: `android/app/release/app-release.aab`
- [ ] **9.12** Testar no dispositivo Android real antes de enviar:
  - Conectar celular com depuração USB ativada
  - No Android Studio: Run → selecionar o celular → testar login, clientes e fiados

---

### ETAPA 10 — Build iOS (Codemagic)
**Objetivo:** Gerar o app iOS sem precisar de Mac, usando o serviço Codemagic na nuvem.

**Pré-requisito:** Conta Apple Developer aprovada (Etapa 6)

**Criar repositório GitHub:**
- [ ] **10.1** Acessar https://github.com/new → criar repositório **privado** chamado `fiado-pro`
- [ ] **10.2** NÃO inicializar com README

🤖 **Pedir aos agentes:** "Me ajude a enviar o código da VPS para o GitHub — repositório: [URL do repositório criado]"

*Os agentes vão executar na VPS:*
```bash
cd /srv/projetos/clientes/fiado-pro
git init
git remote add origin https://github.com/[seu-usuario]/fiado-pro.git
git add .
git commit -m "feat: Fiado Pro Sprint 4 — pronto para publicação"
git push -u origin main
```

**Configurar Codemagic:**
- [ ] **10.3** Acessar https://codemagic.io → criar conta com o GitHub
- [ ] **10.4** Conectar o repositório `fiado-pro`
- [ ] **10.5** Selecionar "React Native / Capacitor" como tipo de projeto
- [ ] **10.6** Ir em Settings > Environment variables e adicionar:
  - `APP_STORE_CONNECT_API_KEY` (gerar em App Store Connect > Users > Keys)
  - `APP_STORE_CONNECT_ISSUER_ID` (mesmo lugar, copiar o Issuer ID)
- [ ] **10.7** Configurar certificados iOS: seguir o guia em https://docs.codemagic.io/code-signing/ios-code-signing
- [ ] **10.8** Iniciar o build pelo workflow `ios-release` (definido no `codemagic.yaml` já criado)
- [ ] **10.9** Aguardar build (~20-40 min)
- [ ] **10.10** O IPA será enviado automaticamente para o **TestFlight**
- [ ] **10.11** Baixar o app TestFlight no iPad/iPhone → instalar o Fiado Pro → testar login, clientes e fiados

---

### ETAPA 11 — Publicar Play Store
**Objetivo:** Submeter o Fiado Pro para análise no Google Play.

- [ ] **11.1** Acessar https://play.google.com/console → entrar na conta criada na Etapa 5
- [ ] **11.2** Clicar em "Criar app" → preencher:
  - Nome: `Fiado Pro`
  - Idioma padrão: Português (Brasil)
  - Tipo: App (não Jogo)
  - Gratuito ou pago: Gratuito
- [ ] **11.3** Preencher a seção **Presença na Play Store:**
  - Título: `Fiado Pro`
  - Descrição curta (até 80 caracteres): `Controle o fiado do seu comércio com inteligência`
  - Descrição longa (até 4000 caracteres): descrever o produto para os compradores
  - Ícone: fazer upload do arquivo `icon-1024.png` (Etapa 8)
  - Feature Graphic: fazer upload do `feature-graphic.png` (Etapa 8)
  - Screenshots: fazer upload das screenshots Android (Etapa 8)
- [ ] **11.4** Preencher **Classificação do conteúdo:** responder o questionário → resultado esperado: Everyone
- [ ] **11.5** Preencher **Público-alvo:** adultos (18+)
- [ ] **11.6** Preencher **Data safety:**
  - Dados coletados: nome e email do lojista
  - Dados de terceiros (clientes do lojista): nome, telefone, histórico de crédito
  - Finalidade: funcionalidade do app
  - Compartilhamento: nenhum com terceiros
- [ ] **11.7** Em **Política de Privacidade:** inserir `https://www.fiadopro.com.br/privacidade`
- [ ] **11.8** Fazer upload do AAB em: `Produção > Criar nova versão > Fazer upload do arquivo .aab`
  - Arquivo: `D:\TECH42\PROJETOS\fiado-pro\android\app\release\app-release.aab`
- [ ] **11.9** Revisar e **Enviar para análise**

---

### ETAPA 12 — Publicar App Store
**Objetivo:** Submeter o Fiado Pro para análise na Apple App Store.

- [ ] **12.1** Acessar https://appstoreconnect.apple.com → fazer login
- [ ] **12.2** Clicar em "Meus apps" → "+" → "Novo app"
  - Plataforma: iOS
  - Nome: `Fiado Pro`
  - Idioma principal: Português (Brasil)
  - Bundle ID: selecionar `br.com.fiadopro.app` (criado pelo Codemagic)
  - SKU: `fiado-pro-001`
- [ ] **12.3** Preencher **Informações do app:**
  - Subtítulo: `Controle de fiado para seu comércio`
  - Categoria primária: Business
  - Descrição: descrever o produto
  - Palavras-chave: `fiado, crédito, comércio, lojista, controle, dívida`
  - URL de suporte: `https://www.fiadopro.com.br`
  - URL de política de privacidade: `https://www.fiadopro.com.br/privacidade`
- [ ] **12.4** Fazer upload das screenshots iOS (Etapa 8)
- [ ] **12.5** Em **App Review Information:**
  - Informações de contato: nome e email
  - Notes (copiar exatamente):
    > "Fiado Pro uses native Push Notifications to alert merchants about overdue credits, Haptic Feedback for transaction confirmations, and network status management for offline scenarios. The app solves a specific informal credit management problem for small Brazilian merchants that would not be possible via website alone. Account deletion is available in Settings > Delete my account, as required by Guideline 5.1.1(v)."
  - Sign-in required: **Sim**
    - Username: `revisor.apple@fiadopro.com.br`
    - Password: [senha criada na Etapa 7]
- [ ] **12.6** Em **App Privacy:** preencher Privacy Labels:
  - Dados usados para rastrear: Nenhum
  - Dados vinculados a você: Email, Nome
  - Dados não vinculados a você: Histórico de uso
- [ ] **12.7** Classificação etária: **4+**
- [ ] **12.8** Selecionar o build do TestFlight (Etapa 10)
- [ ] **12.9** Clicar **"Enviar para análise"**

---

### ETAPA 13 — Atualizar STATE.md
**Objetivo:** Registrar o resultado da sprint em ambos os lugares.

🤖 **Pedir aos agentes:** "Sprint 4 concluída — me ajude a atualizar o STATE.md com o resultado das publicações"

---

## INFORMAÇÕES DE REFERÊNCIA RÁPIDA

| Item | Valor |
|------|-------|
| Package / Bundle ID | `br.com.fiadopro.app` |
| Cor primária | `#553C9A` |
| VPS | `jorge@46.224.55.18` |
| URL produção | `https://www.fiadopro.com.br` |
| URL privacidade | `https://www.fiadopro.com.br/privacidade` |
| URL termos | `https://www.fiadopro.com.br/termos` |
| Alias keystore | `fiado-pro` |
| Conta teste revisor | `revisor.apple@fiadopro.com.br` |
| Keystore local | `D:\TECH42\PROJETOS\fiado-pro\fiado-pro-release.jks` |
| Pasta android local | `D:\TECH42\PROJETOS\fiado-pro\android\` |
| AAB gerado em | `android\app\release\app-release.aab` |

## DEPENDÊNCIAS ENTRE ETAPAS

```
Etapa 1 (Firebase) ──────────────────────────► Etapa 9 (Build Android)
Etapa 2 (Android Studio) ────────────────────► Etapa 9 (Build Android)
Etapa 3 (SCP android/) ──────────────────────► Etapa 9 (Build Android)
Etapa 4 (Keystore) ──────────────────────────► Etapa 9 (Build Android) + Etapa 11 (Play Store)
Etapa 5 (Play Console) ──────────────────────► Etapa 11 (Publicar Play Store)
Etapa 6 (Apple Developer) ───────────────────► Etapa 10 (Codemagic/iOS)
Etapa 7 (Conta teste revisor) ───────────────► Etapa 12 (App Store)
Etapa 8 (Assets visuais) ────────────────────► Etapa 11 + Etapa 12
Etapa 9 (Build AAB) ─────────────────────────► Etapa 11 (Play Store)
Etapa 10 (Build iOS) ────────────────────────► Etapa 12 (App Store)
```

**Etapas que podem ser feitas em paralelo:**
- 1 + 2 + 5 + 6 + 7 + 8 (todas independentes entre si)
- 3 + 4 (depois de 1 e 2 estarem em andamento)
