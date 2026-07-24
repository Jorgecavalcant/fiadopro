# Política de Segurança — Fiado Pro

O Fiado Pro trata dados de crédito ("fiado") de pequenos comerciantes e de
seus clientes/devedores — dados financeiros e pessoais sensíveis sob a LGPD
(Lei Geral de Proteção de Dados). Levamos relatos de vulnerabilidade a sério.

## Como reportar uma vulnerabilidade

**Não abra uma issue pública** para relatar uma vulnerabilidade de segurança.

Envie um e-mail para **security@tech42.com.br (a confirmar — endereço
dedicado ainda não configurado; até lá, use o contato de suporte do produto:
suportejc.planejamento@gmail.com)** com:

- Descrição da vulnerabilidade e impacto potencial
- Passos para reproduzir (ou prova de conceito, se aplicável)
- Versão/ambiente onde foi observada (produção, staging)

Trabalhamos com **melhor esforço** para responder e corrigir — não há SLA
formal de tempo de resposta definido até o momento. Vulnerabilidades críticas
(exposição de dados financeiros/pessoais, bypass de autenticação, RCE)
recebem prioridade.

## Escopo

Consideramos vulnerabilidade de segurança neste projeto qualquer falha que
possa levar a:

- Acesso não autorizado a dados de clientes/devedores (nome, telefone,
  histórico de dívidas, valores) — dados protegidos pela LGPD
- Bypass de autenticação/autorização (login, JWT, recuperação de senha,
  OAuth Google)
- Exposição de segredos (chaves de API, credenciais de banco, JWT secret)
  em código, logs ou no bundle público do frontend
- Injeção (SQL, XSS) ou falsificação de requisição (CSRF)
- Falhas nos webhooks de pagamento (Asaas) que permitam forjar
  confirmação de pagamento/assinatura Pro

Problemas de UI/UX, bugs funcionais sem impacto de segurança ou dados, e
relatórios de disponibilidade (uptime) não são tratados como vulnerabilidade
de segurança — use os canais normais de suporte para esses casos.

## Práticas de segurança já em vigor

- **Scan de segredos em todo PR e push em `main`**: o workflow `Validate`
  (`.github/workflows/validate.yml`) roda `gitleaks` contra o histórico do
  diff. Ferramentas adicionais de scan de segredos (ex.: GitGuardian) podem
  ser adotadas no futuro — nenhuma está confirmada como ativa hoje além do
  gitleaks em CI.
- **Nenhuma chave de API no bundle do frontend**: os workflows de CI e de
  deploy (`validate.yml`, `deploy.yml`, `deploy-staging.yml`) rodam uma
  checagem automatizada que falha o build se detectar padrões de chave
  (Google/Gemini, OpenRouter) no bundle gerado. Essa checagem existe porque
  já houve um incidente real de vazamento de chave (Gemini) corrigido
  anteriormente no projeto — a checagem no bundle é a barreira que previne
  recorrência.
- **Segredos via ambiente, nunca hardcoded**: credenciais de banco, JWT
  secret, chaves de OAuth/Google, Resend e Asaas são injetadas via variáveis
  de ambiente no `docker-compose.yml`/`docker-compose.staging.yml`, nunca
  commitadas no repositório.
- **Senhas com hash forte**: autenticação por e-mail/senha usa `bcryptjs`
  com cost 12 (compatível com a recomendação OWASP).
- **Sessão via cookie `httpOnly`**: o token JWT é entregue em cookie
  `httpOnly`/`Secure`, reduzindo exposição a XSS.
- **Backups antes de deploy**: o processo de deploy da VPS mantém rotina de
  backup do volume de dados antes de mudanças relevantes de infraestrutura.
- **Ambiente de staging isolado**: `docker-compose.staging.yml` roda em
  containers, rede, volume e portas próprios, expostos apenas em
  `127.0.0.1` atrás do proxy reverso — mudanças são validadas em staging
  antes de chegar em produção.

## Divulgação responsável

Pedimos que você nos dê tempo razoável para investigar e corrigir antes de
divulgar publicamente a vulnerabilidade. Agradecemos relatos responsáveis.
