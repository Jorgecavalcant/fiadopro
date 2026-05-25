# FIADOPRO_LOG_001 — Deploy Inicial na VPS

**Data:** 23/03/2026
**Projeto:** Fiado Pro — Smart Credit Tracker
**Status:** ✅ Online e acessível
**URL:** https://fiadopro.jcplanejamento.com.br

---

## Resumo

Deploy completo da aplicação Fiado Pro na VPS Hetzner.
App rodando como SPA estática servida por Nginx via Docker, com HTTPS automático pelo Caddy + Let's Encrypt.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Vite 6 + React 18 + TypeScript |
| IA | Google Gemini API (client-side) |
| UI | Tailwind CSS + Lucide Icons + Recharts |
| Build | `npm run build` → pasta `dist/` |
| Servidor | Nginx:alpine (Docker) |
| Proxy reverso | Caddy 2 (HTTPS automático) |

---

## Estrutura na VPS

```
/srv/projetos/clientes/fiado-pro/
├── dist/                        ← build Vite (arquivos estáticos servidos)
│   ├── index.html
│   └── assets/
│       └── index-BLfRrod-.js
├── docs/
│   └── FIADOPRO_LOG_001_DEPLOY_INICIAL_20260323.md  ← este arquivo
├── data/                        ← reservado para dados futuros
├── logs/                        ← reservado para logs futuros
├── docker-compose.yml
└── nginx.conf
```

---

## Infraestrutura

### Porta e container

| Serviço | Container | Porta externa | Porta interna |
|---------|-----------|--------------|---------------|
| web | `fiado-pro-web` | `10003` | `80` |

### DNS

| Registro | Tipo | Valor |
|----------|------|-------|
| `fiadopro.jcplanejamento.com.br` | A | `46.224.55.18` |

### Certificado SSL

- Emitido por: Let's Encrypt (produção)
- Gerenciado por: Caddy (renovação automática)
- Desafio usado: `tls-alpn-01`

---

## Problemas encontrados e soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| SCP travou transferindo node_modules | `node_modules` foi incluído no envio | Interrompido; enviado apenas a pasta `dist/` (build pronto) |
| Branch `main` não encontrada no push | Git criou branch como `master` | Usar `git push -u origin master` |
| Container `unhealthy` | Healthcheck usava `localhost` (falha no Alpine) | Corrigido para `127.0.0.1` |
| Nginx retornando 403 | Pasta `dist/` com permissão `700` (só dono) | `chmod -R 755 dist/` |
| ERR_SSL_PROTOCOL_ERROR | Caddy ainda emitindo certificado | Reiniciado o container Caddy; cert emitido em ~30s |

---

## Arquivos de configuração

### docker-compose.yml (resumo)
```yaml
services:
  web:
    image: nginx:alpine
    container_name: fiado-pro-web
    ports:
      - "10003:80"
    volumes:
      - ./dist:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:80"]
```

### nginx.conf (resumo)
```nginx
location / {
    try_files $uri $uri/ /index.html;  # SPA — todas as rotas → index.html
}
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### Entrada no Caddyfile
```
# Fiado Pro — FIADOPRO_LOG_001 — 23/03/2026
fiadopro.jcplanejamento.com.br {
    encode gzip
    reverse_proxy 127.0.0.1:10003
}
```

---

## Como atualizar o app (fluxo atual)

```powershell
# 1. Windows — gerar novo build
cd "C:\Users\jorge\Desktop\🚀 MEUS PROJETOS\Outros Projetos\FIADO PRO\app"
npm run build

# 2. Enviar dist para VPS
scp -r dist jorge@46.224.55.18:/srv/projetos/clientes/fiado-pro/

# 3. Corrigir permissões (necessário após cada envio)
# (rodar na VPS)
chmod -R 755 /srv/projetos/clientes/fiado-pro/dist/

# 4. Container reinicia sozinho (restart: always)
# Não precisa de rebuild
```

---

## Próximos passos registrados

- [ ] Subir projeto para GitHub (`Jorgecavalante/fiado-pro`) com `.gitignore` correto
- [ ] Melhorias e refinamentos no app (levantadas pelo Jorge após primeiro acesso)
- [ ] Apps mobile: iOS e Android (etapa futura)
- [ ] Automatizar permissões no deploy (script ou ajuste no SCP)

---

## Convenção de protocolo

| Projeto | Protocolo | Localização dos logs |
|---------|-----------|---------------------|
| JC Ecosistema | `JC_LOG_NNN` | `/srv/jc/documentacao/logs/` |
| Fiado Pro | `FIADOPRO_LOG_NNN` | `/srv/projetos/clientes/fiado-pro/docs/` |
| AgroCredit | `AGROCREDIT_LOG_NNN` | `/srv/projetos/clientes/agrocredit/docs/` |

---

*Próximo log: FIADOPRO_LOG_002 (melhorias no app)*
