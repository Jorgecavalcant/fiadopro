# PRD: Empacotamento Mobile — Fiado Pro

> **Produto**: Fiado Pro
> **Versao**: 1.0
> **Data**: 2026-04-13
> **Status**: [x] Rascunho  [ ] Em revisao  [ ] Aprovado
> **Autor**: Jorge (CEO) + Claude (Analista de Solucoes)

---

## 1. Problema

**Qual e o problema?**

O Fiado Pro existe hoje como uma aplicacao web acessivel pelo navegador. Para crescer e atingir o publico principal — donos de pequeno comercio de bairro (padeiros, acougues, mercearias) — o app precisa estar disponivel na Play Store (Android) e App Store (iOS). Esses comerciantes nao buscam "site no navegador". Eles baixam app.

**Por que resolver agora?**

A autenticacao esta completa e o produto ja funciona em producao. O proximo passo natural para viabilizar aquisicao de usuarios em escala e a presenca nas lojas de aplicativos. Sem isso, o canal de crescimento organico (busca nas stores) fica travado.

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
| Manter paridade funcional com a versao web | Nenhuma funcionalidade quebrada no app mobile |

---

## 3. Fora do escopo

- [ ] Funcionalidades nativas novas (push notifications, camera, GPS, biometria)
- [ ] Redesign da interface para mobile-first
- [ ] Splash screen animada ou onboarding especial para app
- [ ] In-app purchases ou pagamento dentro do app
- [ ] Versao iOS compilada localmente (sem Mac — sera via Codemagic)
- [ ] Publicacao na App Store da China ou outras lojas alternativas
- [ ] Testes automatizados de UI para mobile
- [ ] Correcao do dominio de e-mail transacional (Resend — fica para outro sprint)

**Por que**: O objetivo deste sprint e empacotar o que ja existe e publicar nas stores. Features novas e redesigns sao escopo de sprints futuros. Email transacional nao bloqueia o lancamento do app.

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
5. Como Jorge, eu quero gerar o APK Android pelo Android Studio no Windows, para publicar na Play Store sem precisar de servidor externo.
6. Como Jorge, eu quero gerar o build iOS pelo Codemagic (servico em nuvem), para publicar na App Store sem precisar de um computador Mac.

---

## 5. Requisitos funcionais

### 5.1 Android (Play Store)

1. O app deve ser empacotado usando o Capacitor ja instalado no projeto
2. O projeto Android (pasta `android/`) ja criado deve ser configurado corretamente com App ID `br.com.fiadopro.app`
3. O APK/AAB (Android App Bundle) deve ser gerado via Android Studio no Windows de Jorge
4. O app deve carregar a URL de producao do Fiado Pro dentro do WebView nativo
5. O icone do app, nome e versao devem estar configurados corretamente antes do envio
6. O app deve ser submetido via Google Play Console (conta a ser criada por Jorge, taxa unica de $25)

### 5.2 iOS (App Store via Codemagic)

1. O build iOS deve ser gerado pelo servico Codemagic (CI/CD em nuvem — nao requer Mac)
2. O projeto deve ser configurado com os certificados e provisioning profiles da Apple
3. O IPA (arquivo de instalacao iOS) deve ser gerado pelo Codemagic e enviado automaticamente para o TestFlight
4. Apos validacao no TestFlight, o app deve ser submetido para revisao da App Store
5. O app deve ser submetido via App Store Connect (conta Apple Developer a ser criada por Jorge, $99/ano)

### 5.3 Seguranca — obrigatorio antes do lancamento

6. O JWT de autenticacao deve ser movido do `localStorage` do navegador para `httpOnly cookies` — isso protege contra ataques XSS que roubam tokens de sessao
7. Os secrets do arquivo `docker-compose.yml` (senhas, chaves de API) devem ser movidos para variaveis de ambiente em arquivo `.env` — impede exposicao de credenciais no repositorio
8. O arquivo `.env` deve estar listado no `.gitignore` e nunca ser enviado ao repositorio

---

## 6. Requisitos nao-funcionais

### Seguranca

- JWT em `httpOnly cookie` elimina o principal vetor de ataque XSS contra sessoes de usuario
- Secrets em `.env` elimina risco de credenciais expostas em repositorios (GitHub, etc.)
- Nenhuma informacao sensivel de usuario (nome, telefone, dados de fiado) pode ser logada em texto simples

### Performance

- O app mobile deve carregar em no maximo 5 segundos em conexao 4G
- O WebView deve renderizar a interface sem travamentos visiveis ao scrollar

### Compatibilidade

- Android: versao minima Android 8.0 (API 26) — cobre mais de 95% dos dispositivos Android em uso no Brasil
- iOS: versao minima iOS 15 — cobre mais de 90% dos dispositivos iPhone em uso no Brasil

### LGPD

- O app coleta dados pessoais de clientes dos lojistas (nome, telefone, historico de fiado)
- A politica de privacidade ja existente no site deve ser linkada na pagina de cadastro do app nas stores
- Nenhum dado de usuario deve ser compartilhado com terceiros sem consentimento

---

## 7. Criterios de aceite

O sprint so estara concluido quando TODOS os itens abaixo estiverem verificados:

### Seguranca (bloqueia tudo — precisa estar pronto primeiro)
- [ ] JWT migrado de `localStorage` para `httpOnly cookie` e testado em producao
- [ ] Secrets removidos do `docker-compose.yml` e funcionando via `.env`
- [ ] `.env` confirmado no `.gitignore`

### Android
- [ ] Build AAB gerado sem erros pelo Android Studio
- [ ] App instalado e testado em dispositivo Android real (ou emulador)
- [ ] Login, listagem de clientes e lancamento de fiado funcionando no app
- [ ] App submetido ao Google Play Console e aprovado para publicacao

### iOS
- [ ] Build IPA gerado pelo Codemagic sem erros
- [ ] App disponivel no TestFlight para teste
- [ ] Login, listagem de clientes e lancamento de fiado funcionando no TestFlight
- [ ] App submetido ao App Store Connect e aprovado para publicacao

### Geral
- [ ] Nome do app nas stores: "Fiado Pro"
- [ ] Icone do app configurado (resolucao correta para cada store)
- [ ] Versao inicial: 1.0.0
- [ ] Descricao do app escrita e aprovada por Jorge

---

## 8. Dependencias e pre-requisitos

### O que Jorge precisa fazer manualmente (nao e codigo)

| Acao | Onde | Observacao |
|---|---|---|
| Criar conta Google Play Console | play.google.com/console | Taxa unica de $25 |
| Criar conta Apple Developer | developer.apple.com | $99/ano — renovacao anual |
| Criar conta no Codemagic | codemagic.io | Plano gratuito ja e suficiente para comecar |
| Preparar icone do app | — | Arquivo PNG 1024x1024px, fundo sem transparencia |
| Preparar screenshots do app | — | Play Store pede 2-8 screenshots; App Store pede pelo menos 3 |
| Escrever descricao do app | — | Curta (80 chars) e longa (4000 chars) para as stores |
| Instalar Android Studio | developer.android.com/studio | Para gerar o build Android no Windows |

### Pre-requisitos tecnicos (responsabilidade do time de dev)

- Capacitor ja instalado no projeto (confirmado)
- Pasta `android/` ja criada com projeto Gradle (confirmado)
- App ID `br.com.fiadopro.app` ja definido (confirmado)
- App rodando em producao e acessivel via HTTPS (obrigatorio para WebView)

---

## 9. Riscos identificados

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| Apple rejeitar o app por ser WebView puro | Media | Alto | Documentar bem o valor do app na descricao; ter funcionalidades claras para o usuario |
| Codemagic apresentar problemas de configuracao dos certificados iOS | Alta | Medio | Reservar tempo extra para configuracao; seguir documentacao oficial do Codemagic |
| Migracao do JWT quebrar sessoes ativas de usuarios | Baixa | Alto | Fazer deploy fora do horario de pico; testar exaustivamente em staging antes |
| Secrets no `.env` nao configurados corretamente na VPS | Baixa | Alto | Validar que o container sobe corretamente apos a mudanca antes de ir para producao |
| Versao minima de Android/iOS nao cobrir dispositivos do publico-alvo | Baixa | Medio | Ajustar versao minima se necessario apos pesquisa com comerciantes reais |

---

## 10. Contexto tecnico

- **Produto**: Fiado Pro
- **URL de producao**: https://www.fiadopro.com.br
- **Stack**: React 18 + Vite (frontend), Node.js/Express + TypeScript (backend), PostgreSQL 16
- **Empacotamento mobile**: Capacitor (ja instalado)
- **Codigo do app mobile na VPS**: `/srv/projetos/clientes/fiado-pro/frontend/`
- **Pasta Android**: `/srv/projetos/clientes/fiado-pro/frontend/android/`
- **App ID**: `br.com.fiadopro.app`
- **Build iOS**: Codemagic (CI/CD em nuvem, sem necessidade de Mac)
- **Sistemas afetados**: Frontend (migracao JWT), backend (endpoints de auth para suportar cookies), infraestrutura (docker-compose / .env)
- **Integracoes externas novas**: Codemagic (build iOS), Google Play Console, Apple App Store Connect

---

## 11. Compliance

- [x] **LGPD**: Aplicavel. O Fiado Pro armazena dados pessoais dos clientes dos lojistas (nome, telefone, historico de compras fiadas). A politica de privacidade deve ser referenciada nas stores. A migracao do JWT para cookie melhora a seguranca desses dados.
- [ ] **CVM175**: Nao aplicavel. Fiado Pro nao envolve recomendacao financeira.

---

## 12. Prioridade

- **Urgencia**: [x] Alta
- **Depende de**: Conta Google Play Console criada por Jorge + Conta Apple Developer criada por Jorge + Android Studio instalado + conta Codemagic criada
- **Bloqueia**: Aquisicao de usuarios via busca organica nas stores + campanha de anuncios com CTA de download

---

## Historico de versoes

| Versao | Data | O que mudou |
|---|---|---|
| 1.0 | 2026-04-13 | Versao inicial — criado pelo Analista de Solucoes |

---

> **Proximo passo**: Jorge revisa e aprova este PRD. Com aprovacao confirmada, o Analista de Solucoes gera a SPEC tecnica com os sprints detalhados.
