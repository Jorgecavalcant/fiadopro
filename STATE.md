# STATE — Fiado Pro
**Produto:** Fiado Pro — Smart Credit Tracker para pequenos comerciantes
**Ultima atualizacao:** 2026-10-29
**Atualizado por:** agent-manager (emoji do WhatsApp, sem merge)

---

## ONDE ESTAMOS AGORA
- **Sprint atual:** Sprint 5 — Publicacao na Google Play (FOCO). Apple/App Store adiada a pedido do CEO (nao pagar Apple Developer agora).
- **Fase RPI:** Implement — config tecnica Android CONCLUIDA e mergeada na `main` (PR #1, commit 32a67a7). Aguardando passos manuais do Jorge (alguns LOCAIS na maquina dele).
- **Status geral:** PR #37 já está na `main`. A migration 010 está em produção. O teste de exclusão de 27/10/2026 não chamou `DELETE /api/users/me`: a janela de confirmação cobria o modal da senha. A correção está na branch `claude/fix-excluir-conta`, sem merge.
- **Responsavel atual:** Jorge (revisar a PR da correção, fazer o deploy e repetir o teste com a conta de teste)

---

## HISTORICO DE ENTREGAS
| Sprint | Objetivo | Data conclusao | Validado por | Status |
|--------|----------|----------------|--------------|--------|
| MVP Frontend | React + TypeScript + Vite (SPA) | [verificar] | [verificar] | Concluido |
| MVP Backend | Node.js/Express + TypeScript + PostgreSQL 16 | [verificar] | [verificar] | Concluido |
| Auth — Google OAuth | Login com Google (ID token flow) | [verificar] | [verificar] | Concluido |
| Auth — Email/Senha | Cadastro, login, recuperacao de senha via Resend | [verificar] | [verificar] | Concluido |
| Dominio proprio | Migracao de `fiadopro.jcplanejamento.com.br` para `www.fiadopro.com.br` | 05/04/2026 | [verificar] | Concluido |
| Capacitor — Android/iOS | Instalacao do Capacitor em frontend/, pasta android/ gerada | 13/04/2026 | [verificar] | Concluido |
| Limpeza de dominio | Remocao de referencias ao dominio antigo em CORS, Caddy, email.ts; reorganizacao VPS | 13/04/2026 | [verificar] | Concluido |
| Sprint 1 — Seguranca | JWT → httpOnly cookie; secrets → .env; exclusao de conta (LGPD + Apple 5.1.1(v)) | 17/04/2026 | jc-agent-manager + QA smoke tests | Concluido |
| Sprint 2 — Features Nativas | 8 plugins Capacitor (v8.x): SplashScreen, StatusBar, Haptics, Toast, Network, App, Keyboard, PushNotifications (scaffolding) | 17/04/2026 | qa-lead (APROVADO) | Concluido |
| Sprint 3 — Compliance e Legal | /privacidade + /termos publicadas; migration consent_at/consent_ip; checkbox LGPD no cadastro; QA em producao | 17/04/2026 | jc-agent-manager + QA smoke tests | Concluido |
| Sprint 4 — Parte tecnica | capacitor.config.ts corrigido (#553C9A + StatusBar); .env.production criado; codemagic.yaml criado; .well-known/assetlinks.json + apple-app-site-association publicados; build + cap sync OK | 17/04/2026 | jc-agent-manager | Em andamento |

---

## DECISOES IMPORTANTES
| Decisao | Motivo | Data | Impacto |
|---------|--------|------|---------|
| Frontend: React + TypeScript + Vite (SPA) | Leveza, velocidade de build, compatibilidade com Capacitor para mobile | [verificar] | Empacotamento mobile sera via Capacitor |
| Backend: Node.js/Express + TypeScript | Consistencia com stack JC | [verificar] | — |
| JWT em httpOnly cookie (`fiado_token`) | Seguranca XSS — obrigatorio para app mobile | 17/04/2026 | Cookie SameSite=None; Secure=true — funciona com Capacitor |
| Google OAuth via ID token flow | Fluxo moderno e seguro | [verificar] | Google Client ID configurado em producao |
| Resend para emails transacionais | API simples, boa entregabilidade | [verificar] | Ainda enviando de `onboarding@resend.dev` — dominio proprio pendente |
| Dominio canonico: `www.fiadopro.com.br` | SEO e branding | 05/04/2026 | `fiadopro.com.br` redireciona 301 para www |
| Dominio antigo desativado | `fiadopro.jcplanejamento.com.br` removido do Caddyfile e OAuth | 05/04/2026 | Dominio antigo nao funciona mais |
| `dist/` na raiz e obrigatoria | Volume montado pelo nginx — nunca remover | 13/04/2026 | Sempre rodar `npm run build` antes de subir containers |
| LGPD obrigatoria | Dados de credito de clientes do comerciante sao sensiveis | [verificar] | Arquitetura de dados |
| Pro custa R$ 30,00. Enterprise existe sem venda nesta fase. | Uma fonte de preço no servidor. A tela já mostrava 30. O padrão antigo de 19,90 deixa de mandar na cobrança nova. | 29/10/2026 | Assinatura já criada no Asaas não é alterada. Checkout de Enterprise não abre. |

---

## STACK TECNICA ATUAL
- **Frontend:** React + TypeScript + Vite (SPA) — servido por Nginx na porta 10003
- **Dist frontend:** `/srv/projetos/clientes/fiado-pro/dist/`
- **Backend API:** Node.js/Express + TypeScript — porta 10004
- **Banco de dados:** PostgreSQL 16 — Docker `fiado-pro-db` — banco `fiado_pro` — porta 5434
- **Docker Compose:** `/srv/projetos/clientes/fiado-pro/docker-compose.yml`
- **Proxy reverso:** Caddy — `https://www.fiadopro.com.br`
- **Auth Google:** OAuth 2.0 ID token flow — Google Client ID `488168583801-r8pvtmis98qq12bonh2h1pkrp0rmt2v5.apps.googleusercontent.com` (projeto FiadoPro, conta Tech 42). Causa em 28/10/2026: o site ainda pedia token do projeto antigo `372313466474` e a API, já no ID novo, recusava. Correção: o site passa a usar o mesmo ID da API. O botão só funciona depois do deploy do frontend.
- **Auth Email:** JWT + Resend API — recuperacao de senha via tabela `password_reset_tokens`
- **Email remetente atual:** `onboarding@resend.dev` (dominio Resend padrao — PENDENTE verificacao do dominio proprio)
- **API_URL frontend:** `https://www.fiadopro.com.br/api`
- **CORS_ORIGIN backend:** `https://www.fiadopro.com.br,https://fiadopro.com.br`
- **Capacitor:** v8.3.0 — 8 plugins nativos instalados (splash-screen, status-bar, push-notifications, haptics, toast, app, keyboard, network) — android/ sincronizado via cap sync
- **Infra:** Hetzner VPS CX22 — `jorge@46.224.55.18`
- **Codigo local:** `D:\TECH42\PROJETOS\fiado-pro\app\`
- **Compliance:** LGPD obrigatoria

---

## PROXIMA SESSAO — CONTINUAR AQUI
> Leia este bloco PRIMEIRO antes de qualquer acao.

**Objetivo:** colocar o Fiado Pro ONLINE na **Google Play** (Apple adiada). Guia detalhado: `docs/ANDROID-BUILD.md`.

**Onde paramos:** a exclusão de conta foi testada em produção e a conta continuou ativa, porque a tela travava antes de chamar a API. A correção fecha a confirmação, pede a senha ou CANCELAR uma vez só e mostra o erro em português. Ainda não foi mergeada nem publicada.

**Próximo passo:** o Jorge revisa a PR da branch `claude/fix-excluir-conta`, faz o deploy e repete o teste com a conta de teste. A URL `/excluir-conta` só entra na ficha da Play depois do deploy. O SHA-256 do `assetlinks.json` é o certificado de assinatura da Play Console, não o da chave de upload.

**Fase RPI atual:** Implement — correção do fluxo de exclusão pronta para review. Falta o merge do CEO, o deploy e um novo teste da conta.

### CHECKLIST DE PUBLICACAO — GOOGLE PLAY (ordem)
| # | Passo | Quem | Local? | Ref |
|---|-------|------|--------|-----|
| 0 | **BLOQUEIO ATUAL:** concluir a **verificacao da conta de desenvolvedor** na Play Console (aviso "Conclua as verificacoes da conta para criar novos apps" — botao "Criar app" desabilitado). Menu: "Verificacao de desenvolvedor Android" / "Conta de desenvolvedor". Conta = Organizacao "Tech 42" (ID 5036461792737314690) | Jorge | nuvem | Play Console |
| 1 | Instalar Android Studio (JDK 17 + SDK 35). Validar 1o Gradle Sync (se erro, mandar log p/ agentes) | Jorge | **LOCAL** | ANDROID-BUILD.md |
| 2 | Gerar keystore `fiado-pro-release.jks` (senha no 1Password) | Jorge | **LOCAL** | SESSAO-SPRINT4 Etapa 4 |
| 3 | Criar `frontend/android/keystore.properties` (de .example) | Jorge | **LOCAL** | keystore.properties.example |
| 4 | Enviar o SHA-256 do certificado de assinatura da Play Console (não o da chave de upload) → agentes atualizam `assetlinks.json` | Jorge → agentes | repo+VPS | GUIA-KEYSTORE.md seção 7 |
| 5 | Gerar assets: icone 512/1024, splash, 4 screenshots, feature graphic 1024x500 | Jorge | **LOCAL** | ASSETS-SPEC.md |
| 6 | `npm run build && npx cap sync android && ./gradlew bundleRelease` → app-release.aab | Jorge | **LOCAL** | ANDROID-BUILD.md Passo 3 |
| 7 | (Opcional) Build na nuvem via Codemagic (config das env vars no UI) | Jorge | nuvem | ANDROID-BUILD.md (Codemagic) |
| 8 | Play Console: criar app, ficha, Data Safety, classificacao, privacidade | Jorge | nuvem | STORE-LISTING.md |
| 9 | Upload do AAB + enviar para analise | Jorge | nuvem | STORE-LISTING.md |

**Push/FCM (Firebase):** OPCIONAL no v1 — `google-services.json` aplicado condicionalmente. Adiar para update futuro.

**Apple/App Store:** ADIADA (CEO nao vai pagar agora). Quando retomar: conta Apple Developer $99 → Team ID → atualizar `apple-app-site-association` → build iOS via Codemagic.

### PREVISAO DE GO-LIVE (Google Play)
> **CONFIRMADO (03/06/2026):** conta de ORGANIZACAO ("Tech 42") — **Cenario A**. NAO ha exigencia de teste fechado de 14 dias.
- **Gate atual:** verificacao da conta de desenvolvedor pendente (passo 0). A Google costuma levar ~2-3 dias uteis (pode pedir documentos da empresa). Enquanto nao concluir, nao da pra criar o app.
- **Apos verificacao:** esforco local do Jorge (Android Studio + keystore + assets + ficha) ~2-4 dias uteis + analise da Google ~1-7 dias (tipico 1-3).
- **=> ESTIMATIVA: ONLINE em ~1 a 2 semanas** apos a verificacao da conta sair. Se a verificacao demorar, somar esse tempo.

---

## CONTA DE TESTE — REVISOR APPLE (Feature 3.4)

> Esta conta deve ser criada MANUALMENTE por Jorge apos o deploy da Sprint 3.

**Instrucoes:**
1. Acessar `https://www.fiadopro.com.br`
2. Criar conta com email: `revisor.apple@fiadopro.com.br`
3. Senha: definir senha forte e anotar no 1Password ou equivalente
4. Aceitar os Termos de Uso e Politica de Privacidade (marcar o checkbox)
5. Criar 5 clientes ficticios:
   - Ana Costa (tel: (11) 91111-1111)
   - Rui Pereira (tel: (11) 92222-2222)
   - Lucia Ferreira (tel: (11) 93333-3333)
   - Pedro Lima (tel: (11) 94444-4444)
   - Maria Souza (tel: (11) 95555-5555)
6. Criar 10 fiados em estados variados (pendente, pago, vencido) — distribuir entre os 5 clientes
7. Registrar pelo menos 3 pagamentos
8. Documentar as credenciais na secao "Review Notes" do App Store Connect (Sprint 4)

---

## BLOQUEIOS E PENDENCIAS ATIVAS
| # | Descricao | Responsavel | Prioridade | Data identificacao |
|---|-----------|-------------|------------|--------------------|
| 0 | ~~Migrar password hashing PBKDF2 → Argon2~~ **RESOLVIDO/INVALIDO (02/06/2026):** auditoria do codigo de producao (`backend/src/routes/auth.ts`) confirmou que o backend ja usa **bcryptjs cost 12** (OWASP-compliant). A nota original referia-se ao hashing legado do frontend/localStorage, nao ao backend. NAO e bloqueante para publicacao. | jc-agent-manager | RESOLVIDO | 02/06/2026 |
| 1 | Android Studio necessario para gerar AAB assinado na maquina do Jorge | Jorge | ALTO | 13/04/2026 |
| 2 | Dominio de email — `fiadopro.com.br` nao verificado no Resend | Jorge | ALTO | 05/04/2026 |
| 3 | Apple Store (iOS) — conta Apple Developer $99/ano pendente; usar Codemagic para build | Jorge | ALTO | 05/04/2026 |
| 4 | Firebase Cloud Messaging — criar projeto FCM e baixar google-services.json | Jorge | ALTO | 17/04/2026 |
| 5 | Conta Google Play Console — taxa de $25 pendente | Jorge | ALTO | 13/04/2026 |
| 6 | assetlinks.json — atualizar SHA-256 apos gerar keystore | jc-agent-manager | ALTO | 17/04/2026 |
| 7 | apple-app-site-association — atualizar TEAMID apos criar conta Apple Developer | jc-agent-manager | MEDIO | 17/04/2026 |
| 8 | Conta de teste revisor Apple — criar em www.fiadopro.com.br com dados ficticios | Jorge | ALTO | 17/04/2026 |
| 9 | Login nativo do Google no app Android. O botão web não funciona no WebView do Capacitor (origem `https://localhost`). | Jorge + agentes | MEDIO | 28/10/2026 |
| 10 | Revisar o CORS da API para o app Android. Hoje a API aceita `https://www.fiadopro.com.br` e `http://localhost:3000`. O app usa `https://localhost`. | agentes | MEDIO | 28/10/2026 |
| 11 | ~~Último administrador podia se bloquear ou encerrar a própria conta~~ **RESOLVIDO (29/10/2026):** a API recusa encerrar ou bloquear quando isso deixaria a plataforma sem administrador ativo. A tela desabilita o bloqueio na própria linha. | jc-agent-manager | RESOLVIDO | 29/10/2026 |
| 12 | Bloqueio com motivo e registro das ações do admin. A migration 011 ainda não rodou em produção. Só entra depois do merge, com backup do Postgres e um "pode" do Jorge. | Jorge | ALTO | 29/10/2026 |

---

## LOG DE SESSOES
| Data | Fase RPI | O que foi feito | Resultado | Proximo passo |
|------|----------|-----------------|-----------|---------------|
| [verificar] | Implement | MVP frontend + backend + PostgreSQL | Base do produto funcional | Implementar auth |
| [verificar] | Implement | Google OAuth + JWT auth | Login com Google funcionando | Implementar recuperacao de senha |
| [verificar] | Implement | Fluxo "Esqueceu a senha?" via Resend | Email de recuperacao funcionando | Migrar dominio |
| 05/04/2026 | Implement | Migracao de dominio para `www.fiadopro.com.br` | Produto acessivel no dominio proprio | Empacotar para lojas |
| 12/04/2026 | Research | Fase 1 — Plano Mestre: levantamento de estado | Estado documentado | Fase 4 — atualizar STATE.md |
| 13/04/2026 | Validate | Fase 4 — Plano Mestre: limpeza de dominio + Capacitor + reorganizacao VPS | CORS/Caddy/email.ts limpos, Capacitor instalado, VPS reorganizada | Criar PRD de empacotamento mobile |
| 13/04/2026 | Incident | Incidente 403 Forbidden — pasta `dist/` removida da raiz | Container nginx sem arquivos para servir — resolvido com `npm run build` + restart | Documentar processo obrigatorio de deploy |
| 17/04/2026 | Implement | Sprint 1 — Seguranca: JWT cookie + secrets .env + exclusao de conta | Todos os criterios de aceite validados por smoke tests em producao | Sprint 2 — Features Nativas |
| 17/04/2026 | Implement | Sprint 2 — Features Nativas: 8 plugins Capacitor instalados e integrados no App.tsx | QA aprovado, build ok, cap sync android ok, site 200 | Sprint 3 — Compliance |
| 17/04/2026 | Implement | Sprint 3 — Compliance e Legal: /privacidade + /termos + migration consent_at/consent_ip + checkbox LGPD no cadastro | QA aprovado em producao (HTTP 200, consent gravado no banco, 400 sem consent) | Sprint 4 — Empacotamento Mobile |
| 17/04/2026 | Implement | Sprint 4 (parte tecnica): capacitor.config.ts (#553C9A + StatusBar), .env.production, codemagic.yaml, .well-known publicados (JSON valido), build + cap sync android OK | Site 200, assets android sincronizados, endpoints .well-known retornando JSON | Sprint 4 — parte manual (Jorge) |
| 02/06/2026 | Implement | Sprint 5 — Prep de publicacao (agentes): auditoria de seguranca (bcrypt cost 12 confirmado, falso bloqueio Argon2 removido); pacote de conteudo das lojas (`docs/STORE-LISTING.md`); spec de assets (`docs/ASSETS-SPEC.md`); Vitest + 20 testes em `utils/credit.ts`; refator App.tsx para usar o modulo | 20/20 testes verdes; conteudo pronto para colar nos consoles | Jorge: contas/builds (Etapas 1-12 de SESSAO-SPRINT4) |
| 03/06/2026 | Implement | Sprint 5 — Foco Play Store (Google ja pago, Apple adiada): subir targetSdk/compileSdk 34→35 (exigencia Play), toolchain AGP 8.2.1→8.7.2 + Gradle 8.2.1→8.9 + google-services 4.4.2; signingConfig via `keystore.properties` (gitignored) + `keystore.properties.example`; versionName 1.0.0; guia `docs/ANDROID-BUILD.md` | Projeto Android nos padroes atuais da Play; AAB assinavel via `./gradlew bundleRelease` | Jorge: instalar Android Studio, gerar keystore, rodar build, enviar SHA-256 |
| 28/10/2026 | Implement | Login Google do site: `GOOGLE_CLIENT_ID` em `frontend/src/App.tsx` alinhado ao Client ID que a API já usa (projeto FiadoPro). VPS, .env, API e backend não foram alterados. | PR aberta, sem merge. O botão passa a funcionar só depois do deploy do frontend. | Jorge: merge, deploy, testar "Entrar com Google" em www.fiadopro.com.br |
| 29/10/2026 | Implement | Trava do último administrador: encerrar a própria conta e bloquear no painel são recusados quando sobraria zero administrador ativo. Teste de integração em banco local. VPS e banco de produção não foram alterados. | PR aberta, sem merge. | Jorge: revisar a PR |
| 29/10/2026 | Implement | Correção da PR #40. O GitHub recusou o envio porque a senha falsa do teste estava fixa no arquivo e o `pnpm-lock.yaml` não listava o banco de teste. A senha e o JWT de teste passam a ser gerados na hora. A trava e os testes continuam. | PR #40 atualizada, sem merge. | Jorge: revisar quando as verificações ficarem verdes |
| 29/10/2026 | Implement | Cards do Dashboard: o título e o valor em R$ passam a caber no card no celular, no tablet e no computador. O card PRO fica do mesmo tamanho dos outros. Só o visual. Sem migration e sem mudar dados. | PR aberta, sem merge. | Jorge: revisar a PR |
| 29/10/2026 | Implement | Bloqueio com motivo e registro das ações do admin. Só o bloqueio judicial segura a conta fora da exclusão de 30 dias. A migration foi testada no banco local. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. A migration em produção só depois do merge, com backup e um "pode". |
| 29/10/2026 | Implement | Encerrar a conta guarda e-mail, nome, telefone e senha por 30 dias, apaga CPF e Pix na hora, e a mesma pessoa ou o admin pode voltar na mesma conta. Ordem judicial não é cancelada. Migration 012 só no banco local. | PR aberta, sem merge. A reativação pelo Google só aceita a conta cujo e-mail é o mesmo do token. | Jorge: revisar e decidir o merge. A migration em produção só depois disso, com backup e um "pode". |
| 29/10/2026 | Implement | Visão geral no lugar da aba Métricas. Os seis números saem do servidor, com período e tipo. A exportação em PDF e planilha leva só esses números e fica registrada. Configurações e Relatórios saíram da tela; a tabela app_settings continua no banco. Produção não foi alterada. | PR aberta, sem merge. A biblioteca da planilha ficou na versão sem falha conhecida, e a dependência interna brace-expansion foi travada em 1.1.20. | Jorge: mergear a PR das contas encerradas antes desta. |
| 29/10/2026 | Implement | O deploy da visão geral quebrou porque o `package.json` do backend ganhou pdfkit, exceljs e @types/pdfkit e o `backend/package-lock.json` não acompanhou. O Docker usa `npm ci`. Regra: toda dependência nova no backend exige atualizar `backend/package-lock.json` com Node 20. O CI agora roda o mesmo `npm ci` do Docker. Produção não foi alterada nesta correção. | PR aberta, sem merge. | Jorge: revisar e mergear. O próximo deploy passa a instalar essas bibliotecas. |
| 29/10/2026 | Implement | A cobrança via WhatsApp mostrava � no lugar dos emojis porque o atalho wa.me redireciona e troca emoji de 4 bytes por U+FFFD. O link passou a usar api.whatsapp.com/send com encodeURIComponent do texto inteiro. Mesmos emojis e mesmo texto. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR |
| 29/10/2026 | Implement | Modelo de planos Free, Pro e Enterprise. O servidor cobra R$ 30 no Pro e não publica o preço do Enterprise. Concessão e promoção vencidas voltam sozinhas ao plano devido. Migration 013 só no banco local. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. A migration em produção só depois do merge, com backup. |
| 29/10/2026 | Implement | O servidor recusa o cliente acima do teto do plano e o relatório mais longo do que o plano permite. Free para em 20 clientes e 6 meses. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | O webhook do pagamento grava o id do evento. A repetição não muda a validade. O atraso não corta o período já pago. Erro na gravação não responde sucesso. Migration 014 só no banco local. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. A migration em produção só depois do merge, com backup. |
| 29/10/2026 | Implement | O pagamento passa por uma interface única. Hoje só o Asaas implementa. A regra de plano não chama o Asaas direto. Nenhum outro provedor foi ligado. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | O site mostra o preço do Pro que vem do servidor. Enterprise aparece sem preço e sem checkout. O aplicativo Android não leva preço, botão nem link de assinatura. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | O admin concede cortesia, teste de 14 dias (uma vez), cupom e promoção com prazo. Vencida, a pessoa volta ao plano pago ou ao Free. O registro guarda plano e validade, sem CPF, e-mail ou Pix. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | O cadastro pode pedir confirmação de e-mail por link, mas a opção nasce desligada. Conta antiga e login com Google continuam iguais. A migration 015 só adiciona coluna e tabela. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. A migration em produção só depois do merge, com backup. |
| 29/10/2026 | Implement | O pagamento mostra se o cliente deve ou se a loja deve. Quitar preenche a dívida. Valor a maior só entra com confirmação, no site e no servidor. Atraso conta só dívida com vencimento passado. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | A devolução aumenta o saldo e aproxima o crédito de zero. Abatimento diminui, como o pagamento. O acerto de lucro grava uma dívida no valor do crédito, ou só esconde o negativo na tela quando a estratégia é lucro. A sincronização pede a confirmação e segue para o próximo item. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | O mesmo celular não entra duas vezes na mesma loja. O servidor responde 409 e a tela abre o cadastro que já existe. Nome repetido só avisa. Não há índice único, para o deploy não quebrar se a produção já tiver número repetido. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | O log do celular repetido guarda só o código DUPLICATE_PHONE. A importação offline também recusa o número repetido. A resposta para o lojista continua mostrando o nome. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | Datas e horas aparecem em dd/mm/aaaa, no fuso de São Paulo. A ajuda usa o nome real dos botões. Dividir Conta ganha vencimento opcional e o botão de dividir igualmente. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | Salvar cliente no teste local levou 21, 4 e 4 ms antes e 38, 6 e 9 ms depois, com 20 clientes. O clique faz uma chamada. A sincronização não reenvia o que não mudou. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | Valor vazio ou zero e descrição vazia avisam em português junto ao campo. A data aparece em dd/mm/aaaa. O botão mostra Salvando... com o spinner. A máscara de moeda é só visual; o servidor continua recebendo número. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Implement | Devolução e Abatimento mostram o saldo atual. Devolver tudo e Abater tudo preenchem o valor que zera. Valor além disso pede confirmação. O aviso de saldo credor não tem botão. Acerto de lucro saiu da tela; o que já foi gravado continua. Pendência: corrigir o acerto de lucro numa PR própria, sem apagar o que já existe. Produção não foi alterada. | PR aberta, sem merge. | Jorge: revisar a PR. |
| 29/10/2026 | Proposta | Visual único e simulação da Fase 3 em docs/design-proposta. Nenhum arquivo de produção foi alterado. | PR aberta, sem merge. | Jorge: aprovar ou ajustar a proposta antes de qualquer tela nova. |

---

## DECISOES IMPORTANTES — SEGURANCA

**Decisao (02/06/2026)**: Manter **bcryptjs cost 12** no backend — NAO migrar para Argon2 antes do lancamento.
- **Auditoria**: `backend/src/routes/auth.ts` (registro e reset) e `backend/src/routes/users.ts` (exclusao) usam `bcrypt.hash(password, 12)` e `bcrypt.compare`. Nao ha PBKDF2/SHA-256 no backend de producao.
- **Por quê manter**: bcrypt com cost 12 e aceito pela OWASP Password Storage Cheat Sheet como state-of-the-art valido. Migrar para Argon2 agora exigiria dependencia nativa (`argon2`), complicando o build de producao e o pipeline, sem ganho de seguranca relevante para o estagio do produto.
- **Decisao futura (opcional, pos-lancamento)**: reavaliar Argon2id se/quando houver build com toolchain nativa estavel.
- **Status**: Decidido — NAO bloqueante.

---

## COBERTURA DE TESTES

**Status atual (02/06/2026):** Vitest configurado no frontend (`frontend/vitest.config.ts`, script `npm test`).
Lógica crítica de crédito extraída para `frontend/src/utils/credit.ts` (fonte única de verdade) e coberta por **20 testes passando** em `frontend/src/utils/credit.test.ts`:
- `calculateScore` — confiável, neutro, pontualidade, atraso >30d, saldo alto, clamp 0–1000, isolamento por cliente
- `computeRawBalance` — DEBT/PAYMENT/ABATIMENTO/REFUND, crédito (saldo negativo), vazio
- `buildChargeMessage` — devedor/crédito/em dia, Pix, lançamentos recentes, veto a tom agressivo
- `normalizeWhatsAppPhone` — DDI 55, idempotência, limpeza de não-dígitos

O `App.tsx` agora importa essas funções (refator sem mudança de comportamento). Próximo alvo: testes E2E de auth e persistência.

### Funcionalidades criticas priorizadas

| # | Funcionalidade | Tipo de teste | Prioridade |
|---|---------------|---------------|------------|
| 1 | `calculateScore` — algoritmo de score de credito do devedor | Unitario | ALTA |
| 2 | `customersWithBalance` — calculo de saldo devedor (DEBT/PAYMENT/ABATIMENTO/REFUND) | Unitario | ALTA |
| 3 | `handleShareWhatsApp` — geracao da mensagem de cobranca via WhatsApp | Unitario / E2E | ALTA |
| 4 | Persistencia no localStorage — save/load/corruption recovery | Integracao | ALTA |
| 5 | `hashPassword` / `legacyHashPassword` — hashing PBKDF2 e migracao | Unitario | ALTA |
| 6 | `isOverdue` — deteccao de vencimento de dividas | Unitario | MEDIA |
| 7 | `stats` — totais do dashboard (totalReceivable, activeDebtors, defaultRate) | Unitario | MEDIA |
| 8 | `canAddCustomer` / plano FREE — limite de clientes por plano | Unitario | MEDIA |
| 9 | `handleEmailLogin` / `handleRegister` — autenticacao por email/senha | E2E | MEDIA |
| 10 | `plan.expiresAt` — expiracao de plano Pro na leitura do localStorage | Integracao | MEDIA |

### 4 testes mais urgentes (proxima sprint)

0. **`hashPassword` / `verifyPassword` com Argon2** — Critica para seguranca. Testar: hash gerado e' diferente para mesma senha (salt aleatorio), verify retorna true com senha correta, false com senha errada. Tipo: unitario, sem dependencias.

1. **`calculateScore`** — E a logica central do Smart Credit Tracker. Tem muitas ramificacoes (pagamento antecipado, atrasado, saldo alto, ratio de pagamentos). Um bug aqui mostra score errado para o lojista tomar decisao de credito. Tipo: unitario puro, sem dependencias.

2. **`customersWithBalance` — calculo de saldo** — Qualquer erro aqui mostra valor errado de quem deve e quanto. E o numero mais visivel da tela principal. Tipo: unitario com fixtures de transactions.

3. **`handleShareWhatsApp` — mensagem de cobranca** — Se a mensagem sair errada (tom agressivo, valor errado, nome errado), o lojista perde o cliente. E o canal de cobranca principal do produto. Tipo: unitario validando o texto gerado para cada modo (GENTLE, credito, quite).

### Proxima acao
Configurar Vitest no projeto (compativel com Vite) e criar os 3 testes prioritarios acima antes do empacotamento mobile.
Referencia: `D:\TECH42\METODOLOGIA\10-CHECKLIST-QA.md`

---

## LINKS E REFERENCIAS
- **PRD atual:** a criar (sprint de empacotamento mobile)
- **SPEC atual:** a criar
- **Codigo producao (VPS):** `/srv/projetos/clientes/fiado-pro/`
- **Codigo local:** `D:\TECH42\PROJETOS\fiado-pro\app\`
- **Docker Compose producao:** `/srv/projetos/clientes/fiado-pro/docker-compose.yml`
- **URL producao:** `https://www.fiadopro.com.br`
- **LOGs de desenvolvimento:** `/srv/jc/documentacao/logs/`
- **Metodologia:** `D:\TECH42\METODOLOGIA\`
- **Protocolo RPI:** `D:\TECH42\METODOLOGIA\09-PROTOCOLO-RPI.md`
