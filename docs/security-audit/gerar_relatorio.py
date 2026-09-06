# -*- coding: utf-8 -*-
"""
Gerador do Relatório de Auditoria de Segurança — Fiado Pro
Rodar dentro do venv: python gerar_relatorio.py
Saída: relatorio-auditoria-seguranca.pdf (na mesma pasta)
"""
import os
import re
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
    PageBreak, HRFlowable, KeepTogether
)
from reportlab.pdfgen import canvas as pdfcanvas

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_PDF = os.path.join(HERE, "relatorio-auditoria-seguranca.pdf")
IMG_DONUT = os.path.join(HERE, "_chart_donut.png")
IMG_BAR = os.path.join(HERE, "_chart_bar.png")

COLOR_CRITICA = "#B91C1C"
COLOR_ALTA = "#EA580C"
COLOR_MEDIA = "#D97706"
COLOR_BAIXA = "#2563EB"
COLOR_FORTE = "#059669"
COLOR_INFO = "#6B7280"

# ---------------------------------------------------------------------------
# DADOS DA AUDITORIA (consolidados do especialista-seguranca + auditoria-seguranca)
# ---------------------------------------------------------------------------

FINDINGS = [
    # (id, categoria, severidade, arquivo_linha, descricao_curta, detalhe)
    dict(id="1.1", categoria="1. Isolamento de dados (dono/tenant)", sev="Baixa",
         local="backend/src/routes/debts.ts:119-140",
         desc="PATCH /api/debts/:id não repete filtro de dono na query UPDATE final",
         detalhe=(
             "A checagem de posse é feita numa query separada "
             "(<font face='Courier'>SELECT id FROM debts WHERE id=$1 AND user_id=$2</font>), "
             "mas a query <font face='Courier'>UPDATE debts SET ... WHERE id=$1</font> não repete "
             "<font face='Courier'>AND user_id=$2</font> — diferente do padrão usado em customers.ts e "
             "transactions.ts, que sempre repetem o filtro de dono na própria escrita. Hoje não é "
             "explorável (mesmo handler síncrono, sem corrida real), mas quebra defesa em profundidade: "
             "um refactor futuro que separe as duas queries reintroduziria um IDOR de escrita real. "
             "Validado por segundo revisor em código real."
         )),
    dict(id="4.1", categoria="4. Chaves expostas", sev="Crítica",
         local="Histórico git — commit 8419b8dd (docs/FIADOPRO_LOG_002_BACKEND_SETUP_20260325.md, "
               "docs/FIADOPRO_TESTE_COMPLETO_20260325.md)",
         desc="Chaves reais do Google API (AIza...) vazadas no histórico do Git",
         detalhe=(
             "Confirmado via <font face='Courier'>gitleaks detect --source .</font> e "
             "<font face='Courier'>git log --all -p</font>: o histórico contém a chave real "
             "<font face='Courier'>AIza...Fo1k</font> (mascarada), substituída por placeholder no HEAD atual "
             "pelo commit 966a3f7 (parte dos PRs #30-#35). O HEAD atual já usa apenas placeholders "
             "(<font face='Courier'>AIzaSy_EXEMPLO_NAO_REAL_1/2</font>) — confirmado pelo segundo revisor. "
             "Porém o Git preserva o blob antigo permanentemente: qualquer clone ou acesso ao histórico "
             "do GitHub ainda expõe a chave real. É um vazamento HISTÓRICO, não presente no código atual — "
             "mas continua explorável enquanto a chave não for revogada/rotacionada no Google Cloud Console."
         )),
    dict(id="4.2", categoria="4. Chaves expostas", sev="Crítica",
         local="docs/FIADOPRO_LOG_002_BACKEND_SETUP_20260325.md:182 (presente no HEAD atual)",
         desc="Senha de banco de dados em texto claro em documentação",
         detalhe=(
             "A senha de banco de dados em texto claro (valor real suprimido deste relatório por "
             "segurança) está presente no arquivo AGORA, não só no histórico — confirmado pelo segundo revisor "
             "via grep direto no HEAD. Mais grave que o achado 4.1 por estar exposta no estado atual do "
             "repositório. Se essa senha foi/é usada em produção, é uma credencial de banco comprometida "
             "e precisa rotação imediata."
         )),
    dict(id="4.3", categoria="4. Chaves expostas", sev="Média",
         local=".env.example:12-16 e backend/.env.example:32-41",
         desc="Marcadores de merge conflict não resolvidos commitados",
         detalhe=(
             "Os arquivos de exemplo contêm literalmente "
             "<font face='Courier'>&lt;&lt;&lt;&lt;&lt;&lt;&lt; HEAD ... ======= ... &gt;&gt;&gt;&gt;&gt;&gt;&gt; "
             "origin/claude/feat-ia-openrouter</font> (e feat-asaas no backend). Não é uma chave exposta, "
             "mas quebra o boot do Docker Compose para quem copiar o .env.example como .env — confirmado "
             "por grep direto no HEAD pelo segundo revisor."
         )),
    dict(id="4.4", categoria="4. Chaves expostas", sev="Média",
         local="backend/src/utils/jwt.ts:3; docker-compose.yml:54",
         desc="Fallback hardcoded de JWT_SECRET sem checagem de startup",
         detalhe=(
             "<font face='Courier'>const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'</font>. "
             "docker-compose.yml referencia <font face='Courier'>${JWT_SECRET}</font> sem valor default, então "
             "se a env var não estiver setada na VPS, a aplicação sobe normalmente assinando tokens com um "
             "segredo público e previsível — falha silenciosa, sem erro no boot. Isso permitiria forjar sessão "
             "de qualquer usuário. Severidade elevada de Baixa para MÉDIA pelo segundo revisor: a probabilidade "
             "de ocorrer é baixa (ambiente já configurado), mas o impacto se ocorrer é alto."
         )),
    dict(id="4.5", categoria="4. Chaves expostas", sev="Alta",
         local="docker-compose.yml:31-32",
         desc="Porta do PostgreSQL (5434→5432) publicada no host",
         detalhe=(
             "<font face='Courier'>ports: - \"5434:5432\"</font> sem restringir a "
             "<font face='Courier'>127.0.0.1</font>. Isso publica a porta do banco potencialmente em "
             "<font face='Courier'>0.0.0.0:5434</font>, acessível de fora do container mesmo com a aplicação "
             "web atrás do Caddy. Só o container 'api' precisa acessar o DB (já resolvido pela rede interna "
             "'fiado-pro-rede'). Explorabilidade depende do firewall da VPS Hetzner não bloquear a porta — "
             "não verificável a partir do repositório (fora do escopo desta auditoria de código-fonte)."
         )),
    dict(id="4.6", categoria="4. Chaves expostas", sev="Informativa",
         local="frontend/src/App.tsx:127",
         desc="GOOGLE_CLIENT_ID hardcoded no frontend — não é uma falha",
         detalhe=(
             "Client ID do Google OAuth é público por design (só o Client Secret é sigiloso, e esse fica "
             "somente no backend). Nenhuma chave real encontrada no bundle do frontend. O CI já roda um "
             "grep pós-build específico para vazamento de chave no dist/assets/."
         )),
    dict(id="LGPD-1", categoria="4. Chaves expostas / LGPD", sev="Média",
         local="Schema do banco (tabela de usuários/clientes)",
         desc="CPF armazenado em texto claro no banco de dados",
         detalhe=(
             "Dado pessoal sensível (CPF) sem criptografia em repouso. Recomenda-se avaliar criptografia "
             "a nível de coluna ou hashing reversível conforme necessidade de uso, alinhado à LGPD. "
             "Não re-verificado pelo segundo revisor nesta rodada — recomenda-se confirmação em auditoria "
             "de schema dedicada."
         )),
    dict(id="5.1", categoria="5. Inputs sem tratamento (XSS)", sev="Baixa",
         local="backend/src/services/email.ts:36",
         desc="Interpolação de nome de usuário sem escape em template de e-mail HTML",
         detalhe=(
             "<font face='Courier'>&lt;p&gt;Ola, ${name}.&lt;/p&gt;</font> em "
             "sendAccountDeletionEmail e templates similares. full_name é validado só por "
             "<font face='Courier'>min(2).max(100)</font> em RegisterSchema, sem checagem de caracteres HTML. "
             "Um usuário poderia se cadastrar com HTML/JS no nome, injetado sem escape no e-mail enviado a "
             "si mesmo (self-XSS, impacto baixo pois a maioria dos webmails não executa JS). Confirmado "
             "pelo segundo revisor em código real."
         )),
]

STRENGTHS = [
    ("Queries 100% parametrizadas", "Nenhuma concatenação de string de usuário em SQL em toda a base revisada "
     "(rotas + services). Updates dinâmicos usam allowlist de campos via Zod, nunca chaves arbitrárias do body."),
    ("Validação com Zod em todos os boundaries", "Todo endpoint de escrita valida o body com schema Zod antes "
     "de tocar o banco."),
    ("JWT verificado com timing-safe compare", "backend/src/utils/jwt.ts usa crypto.timingSafeEqual na "
     "verificação de assinatura, resistente a timing attack."),
    ("Webhook Asaas protegido contra timing attack", "billing.ts implementa timingSafeEqualString, inclusive "
     "gastando tempo artificial quando os tamanhos diferem."),
    ("requireAdmin sempre revalida no banco", "Nunca confia em claim de role do JWT — consulta "
     "SELECT role FROM users a cada requisição administrativa, mitigando token antigo com role desatualizada."),
    ("Rate limiting em login/registro", "10 tentativas/15min em auth, 100 req/min globalmente — mitiga "
     "brute force básico."),
    ("Cookie de sessão httpOnly + secure + sameSite", "Token JWT nunca acessível via JavaScript no navegador."),
    ("Exclusão de conta com anonimização real (LGPD)", "E-mail, telefone, avatar e senha são efetivamente "
     "apagados/anonimizados na exclusão de conta, não apenas uma flag is_active=false."),
    ("forgot-password não vaza existência de e-mail", "Resposta idêntica exista ou não a conta, mitigando "
     "user enumeration."),
    ("Tokens de reset de senha robustos", "UUIDv4 (128 bits de entropia), uso único, com expiração, e "
     "invalidação de tokens antigos ao gerar um novo."),
    ("CORS restrito por origem configurável", "Sem wildcard * combinado com credentials:true."),
    ("Android com cleartext bloqueado", "usesCleartextTraffic=\"false\" no manifest, forçando HTTPS no app mobile."),
    ("CI com gitleaks + grep pós-build", "Pipeline já detecta segredos no histórico de novos commits e chaves "
     "no bundle do frontend — mostra maturidade recente do processo de segurança."),
    ("Isolamento de dados consistente (dono/tenant)", "debts, customers, transactions e inbox filtram "
     "consistentemente por owner_user_id/user_id em SELECT, UPDATE e DELETE — validado handler por handler."),
    ("Aprovação de transação sem self-approval", "transactions.ts impede que quem criou uma transação a "
     "aprove sozinho — só a contraparte vinculada pode aprovar/rejeitar."),
    ("Permissão de admin corretamente isolada do frontend", "Gate de UI (isAdmin) no App.tsx é só cosmético; "
     "toda rota /api/admin/* exige requireAuth + requireAdmin, revalidado no servidor."),
]

RECOMMENDATIONS = [
    ("P1", "Confirmar e, se necessário, rotacionar AGORA a senha do Postgres "
           "(achado 4.2 — valor exposto no HEAD atual, ver detalhe do achado) e as chaves Google API do histórico "
           "(achado 4.1), no Google Cloud Console."),
    ("P1", "Restringir a porta 5434 do Postgres em docker-compose.yml para 127.0.0.1:5434:5432, ou remover "
           "o binding externo — só o container da API precisa acessar o banco (achado 4.5)."),
    ("P2", "Adicionar checagem de startup que impede o backend de subir em produção sem JWT_SECRET definido, "
           "evitando o fallback hardcoded (achado 4.4)."),
    ("P2", "Corrigir os marcadores de merge conflict não resolvidos em .env.example e backend/.env.example "
           "(achado 4.3)."),
    ("P2", "Avaliar criptografia ou tokenização do CPF em repouso no banco de dados, alinhado à LGPD "
           "(achado LGPD-1)."),
    ("P3", "Adicionar filtro AND user_id=$N na query UPDATE de debts.ts por defesa em profundidade "
           "(achado 1.1)."),
    ("P3", "Escapar name/full_name antes de interpolar em templates de e-mail HTML (achado 5.1)."),
    ("P3", "Avaliar expurgo do histórico Git (git filter-repo/BFG) para remover definitivamente as chaves "
           "antigas — decisão do CEO, pois exige force-push coordenado e quebra clones existentes."),
]

ISSUES_MD = [
    dict(titulo="[Segurança][Crítico] Rotacionar senha do Postgres exposta em documentação",
         labels="security, critical, infra",
         corpo=(
             "**Problema:** A senha do banco de dados PostgreSQL aparece em texto claro no arquivo "
             "`docs/FIADOPRO_LOG_002_BACKEND_SETUP_20260325.md:182`, presente no HEAD atual do repositório "
             "(não apenas no histórico).\n\n"
             "**Por que é explorável:** Qualquer pessoa com acesso de leitura ao repositório (colaborador, "
             "vazamento de acesso, repositório tornado público por engano) consegue ler a senha do banco "
             "diretamente.\n\n"
             "**Evidência:**\ndocs/FIADOPRO_LOG_002_BACKEND_SETUP_20260325.md:182 — linha contendo a "
             "variável DB_PASSWORD com um valor em texto claro (valor real suprimido deste relatório "
             "por segurança; já confirmado por SSH direto na VPS que NÃO é a senha de produção "
             "atual).\n\n"
             "**Impacto:** Se essa senha foi/é usada em produção, é uma credencial de banco comprometida — "
             "acesso não autorizado a todos os dados de clientes armazenados.\n\n"
             "**Sugestão de correção:**\n1. Confirmar se a senha foi usada em produção.\n2. Se sim, rotacionar "
             "imediatamente no Postgres da VPS e no `.env` correspondente.\n3. Remover a senha do arquivo de "
             "documentação (substituir por placeholder).\n4. Adicionar regra de lint/CI para bloquear "
             "`DB_PASSWORD=` literal em arquivos `.md`.\n\n"
             "**Critérios de aceite:**\n- [ ] Senha rotacionada no Postgres de produção\n- [ ] `.env` da VPS "
             "atualizado\n- [ ] Arquivo de documentação corrigido (sem segredo real)\n- [ ] Verificação de "
             "que a aplicação continua funcionando após a rotação"
         )),
    dict(titulo="[Segurança][Crítico] Revogar chaves do Google API vazadas no histórico do Git",
         labels="security, critical, infra",
         corpo=(
             "**Problema:** O histórico do Git (commit `8419b8dd` e diffs subsequentes) contém chaves reais "
             "do Google Cloud API, hoje já substituídas por placeholders no HEAD atual "
             "(`docs/FIADOPRO_LOG_002_BACKEND_SETUP_20260325.md`, `docs/FIADOPRO_TESTE_COMPLETO_20260325.md`), "
             "mas ainda recuperáveis via `git log --all -p` ou pelo link direto do GitHub para o commit "
             "antigo.\n\n"
             "**Por que é explorável:** Git preserva blobs antigos permanentemente; remover do arquivo atual "
             "não remove do histórico. Qualquer clone completo do repositório expõe a chave real.\n\n"
             "**Evidência:** confirmado via `gitleaks detect --source .` e `git log --all -p` — chave real "
             "mascarada: `AIza...Fo1k`.\n\n"
             "**Impacto:** Uso indevido da API do Google associada à conta/projeto do Google Cloud da "
             "empresa, possível custo financeiro ou abuso de cota.\n\n"
             "**Sugestão de correção:**\n1. Confirmar no Google Cloud Console se a chave já foi revogada; "
             "se não, revogar/rotacionar agora.\n2. Avaliar expurgo do histórico Git via `git filter-repo` "
             "ou BFG Repo-Cleaner (decisão do CEO — exige force-push coordenado).\n\n"
             "**Critérios de aceite:**\n- [ ] Chave confirmada como revogada/rotacionada no Google Cloud "
             "Console\n- [ ] Decisão registrada sobre expurgo do histórico (fazer ou aceitar o risco residual)"
         )),
    dict(titulo="[Segurança][Alta] Restringir exposição da porta do PostgreSQL no host",
         labels="security, high, infra",
         corpo=(
             "**Problema:** `docker-compose.yml:31-32` publica a porta do Postgres no host "
             "(`\"5434:5432\"`) sem restringir à interface loopback.\n\n"
             "**Por que é explorável:** Se o firewall da VPS não bloquear explicitamente a porta 5434, o "
             "banco fica acessível de fora do container, bypassando toda a camada de aplicação/Caddy.\n\n"
             "**Evidência:**\n```yaml\nports:\n  - \"5434:5432\"\n```\n\n"
             "**Impacto:** Acesso direto ao banco de dados de fora da rede interna, caso o atacante tenha "
             "ou obtenha a senha do Postgres.\n\n"
             "**Sugestão de correção:** Alterar para `\"127.0.0.1:5434:5432\"` ou remover o binding externo — "
             "a rede interna `fiado-pro-rede` já permite que o container `api` acesse o banco sem exposição "
             "ao host.\n\n"
             "**Critérios de aceite:**\n- [ ] Porta do Postgres não acessível de fora do host\n- [ ] "
             "Aplicação continua funcionando normalmente após a mudança\n- [ ] Confirmação de que o "
             "firewall da VPS também bloqueia a porta como camada adicional"
         )),
    dict(titulo="[Segurança][Média] Corrigir configuração de JWT_SECRET, .env.example e criptografia de CPF",
         labels="security, medium",
         corpo=(
             "**Problema (agrupado):** Três itens médios de configuração/dados:\n"
             "1. `backend/src/utils/jwt.ts:3` tem fallback hardcoded "
             "(`'dev-secret-change-in-production'`) sem checagem de startup — se `JWT_SECRET` não estiver "
             "definido em produção, a aplicação sobe normalmente assinando tokens com segredo público.\n"
             "2. `.env.example` e `backend/.env.example` contêm marcadores de merge conflict não "
             "resolvidos (`<<<<<<<`, `=======`, `>>>>>>>`).\n"
             "3. CPF armazenado em texto claro no banco de dados (dado pessoal sensível, LGPD).\n\n"
             "**Por que é explorável:** (1) permite forjar sessão de qualquer usuário caso a env var falte; "
             "(2) quebra o boot de quem copiar o .env.example; (3) exposição de dado sensível em caso de "
             "vazamento do banco.\n\n"
             "**Evidência:**\n```ts\n// backend/src/utils/jwt.ts:3\nconst SECRET = process.env.JWT_SECRET "
             "|| 'dev-secret-change-in-production';\n```\n```\n// .env.example:12-16\n<<<<<<< HEAD\n"
             "ADMIN_EMAIL=admin@example.com\n=======\nOPENROUTER_API_KEY=\n>>>>>>> "
             "origin/claude/feat-ia-openrouter\n```\n\n"
             "**Sugestão de correção:**\n1. Adicionar checagem de startup: derrubar o processo se "
             "`JWT_SECRET` ausente em `NODE_ENV=production`.\n2. Resolver os marcadores de merge nos "
             "arquivos `.env.example`.\n3. Avaliar criptografia/tokenização do campo CPF no banco.\n\n"
             "**Critérios de aceite:**\n- [ ] Backend recusa subir em produção sem JWT_SECRET\n- [ ] "
             ".env.example válidos e sem marcadores de merge\n- [ ] Decisão registrada sobre criptografia "
             "do CPF (implementar ou justificar não fazer agora)"
         )),
    dict(titulo="[Segurança][Baixa] Defesa em profundidade: filtro de dono no UPDATE de debts.ts e "
                "escape de nome em e-mails",
         labels="security, low",
         corpo=(
             "**Problema (agrupado):**\n1. `backend/src/routes/debts.ts` (PATCH /:id) não repete o filtro "
             "`user_id` na query UPDATE final (a checagem de posse é feita numa query SELECT separada "
             "antes).\n2. `backend/src/services/email.ts:36` interpola `name`/`full_name` sem escape em "
             "template de e-mail HTML (ex: `sendAccountDeletionEmail`).\n\n"
             "**Por que é explorável:** (1) não é explorável hoje, mas é um padrão frágil que pode virar "
             "IDOR real num refactor futuro; (2) permite self-XSS de baixo impacto se o nome contiver HTML, "
             "explorável apenas em webmails que renderizam HTML/JS.\n\n"
             "**Evidência:**\n```ts\n// debts.ts — UPDATE sem AND user_id\nUPDATE debts SET ${setClause}, "
             "updated_at = NOW() WHERE id = $1 RETURNING *\n```\n```ts\n// email.ts:36\n<p>Ola, ${name}.</p>"
             "\n```\n\n"
             "**Sugestão de correção:**\n1. Adicionar `AND user_id = $N` na query UPDATE de debts.ts.\n"
             "2. Escapar `name`/`full_name` (função tipo `esc()`, já existe padrão similar no frontend) "
             "antes de interpolar em templates de e-mail HTML.\n\n"
             "**Critérios de aceite:**\n- [ ] Query UPDATE de debts.ts filtra por user_id\n- [ ] Templates "
             "de e-mail escapam variáveis de usuário antes da interpolação"
         )),
]

def md_to_html(text: str) -> str:
    """Converte um subconjunto simples de Markdown (usado nas issues) para HTML do reportlab."""
    # remove code fences ``` (keep content)
    text = text.replace("```ts", "").replace("```yaml", "").replace("```", "")
    # code spans `...`
    text = re.sub(r"`([^`]+)`", r'<font face="Courier" size="8">\1</font>', text)
    # bold **...**
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # checklist items "- [ ] xxx"
    text = re.sub(r"^- \[ \] (.+)$", r"&#9744; \1", text, flags=re.MULTILINE)
    # numbered/bulleted lists keep as-is, just break lines
    text = text.replace("\n", "<br/>")
    return text


SEVERITY_ORDER = ["Crítica", "Alta", "Média", "Baixa", "Informativa"]
SEVERITY_COLOR = {
    "Crítica": COLOR_CRITICA, "Alta": COLOR_ALTA, "Média": COLOR_MEDIA,
    "Baixa": COLOR_BAIXA, "Informativa": COLOR_INFO,
}

# ---------------------------------------------------------------------------
# GRÁFICOS
# ---------------------------------------------------------------------------

def make_donut():
    counts = {s: 0 for s in SEVERITY_ORDER}
    for f in FINDINGS:
        counts[f["sev"]] += 1
    labels = [s for s in SEVERITY_ORDER if counts[s] > 0]
    sizes = [counts[s] for s in labels]
    clrs = [SEVERITY_COLOR[s] for s in labels]

    fig, ax = plt.subplots(figsize=(4.6, 4.0), dpi=200)
    wedges, texts, autotexts = ax.pie(
        sizes, labels=None, colors=clrs, startangle=90,
        wedgeprops=dict(width=0.42, edgecolor="white", linewidth=2),
        autopct=lambda p: f"{int(round(p*sum(sizes)/100))}",
        pctdistance=0.79,
    )
    for at in autotexts:
        at.set_color("white")
        at.set_fontsize(11)
        at.set_fontweight("bold")
    ax.legend(wedges, [f"{l} ({c})" for l, c in zip(labels, sizes)],
              loc="center left", bbox_to_anchor=(1.0, 0.5), frameon=False, fontsize=9)
    ax.set_title("Achados por severidade", fontsize=12, fontweight="bold", pad=14)
    plt.tight_layout()
    plt.savefig(IMG_DONUT, transparent=True, bbox_inches="tight")
    plt.close()


def make_bar():
    cats = {}
    for f in FINDINGS:
        key = f["categoria"].split(".", 1)[0].strip()
        cats.setdefault(key, 0)
        cats[key] += 1
    order = sorted(cats.keys(), key=lambda x: int(x) if x.isdigit() else 99)
    labels = [f"Cat. {k}" for k in order]
    values = [cats[k] for k in order]

    fig, ax = plt.subplots(figsize=(6.0, 3.6), dpi=200)
    bars = ax.bar(labels, values, color="#334155", width=0.55)
    for b, v in zip(bars, values):
        ax.text(b.get_x() + b.get_width()/2, v + 0.05, str(v), ha="center",
                fontsize=10, fontweight="bold", color="#1f2937")
    ax.set_ylabel("Nº de achados")
    ax.set_title("Achados por categoria", fontsize=12, fontweight="bold", pad=12)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.set_ylim(0, max(values) + 1)
    plt.tight_layout()
    plt.savefig(IMG_BAR, transparent=True, bbox_inches="tight")
    plt.close()


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

REPORT_TITLE = "Relatório de Auditoria de Segurança — Fiado Pro"


def header_footer(canvas_obj: pdfcanvas.Canvas, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.setFillColor(colors.HexColor("#6B7280"))
    canvas_obj.drawString(2*cm, 1.2*cm, REPORT_TITLE)
    canvas_obj.drawRightString(A4[0] - 2*cm, 1.2*cm, f"Página {doc.page}")
    canvas_obj.setStrokeColor(colors.HexColor("#E5E7EB"))
    canvas_obj.line(2*cm, 1.5*cm, A4[0] - 2*cm, 1.5*cm)
    canvas_obj.restoreState()


def build_pdf():
    make_donut()
    make_bar()

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleBig", fontSize=22, leading=27, alignment=TA_CENTER,
                               textColor=colors.HexColor("#111827"), fontName="Helvetica-Bold",
                               spaceAfter=6))
    styles.add(ParagraphStyle(name="Subtitle", fontSize=12, leading=16, alignment=TA_CENTER,
                               textColor=colors.HexColor("#4B5563"), spaceAfter=4))
    styles.add(ParagraphStyle(name="H1", fontSize=16, leading=20, textColor=colors.HexColor("#111827"),
                               fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=8))
    styles.add(ParagraphStyle(name="H2", fontSize=12.5, leading=16, textColor=colors.HexColor("#1F2937"),
                               fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=6))
    styles.add(ParagraphStyle(name="Body", fontSize=9.5, leading=13.5,
                               textColor=colors.HexColor("#1F2937"), alignment=TA_LEFT))
    styles.add(ParagraphStyle(name="BodySmall", fontSize=8.7, leading=12,
                               textColor=colors.HexColor("#374151")))
    styles.add(ParagraphStyle(name="Mono", fontName="Courier", fontSize=8, leading=11,
                               textColor=colors.HexColor("#111827"),
                               backColor=colors.HexColor("#F3F4F6")))
    styles.add(ParagraphStyle(name="IssueTitle", fontSize=11, leading=14, fontName="Helvetica-Bold",
                               textColor=colors.HexColor("#111827"), spaceBefore=6, spaceAfter=4))

    doc = SimpleDocTemplate(
        OUT_PDF, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm,
        title=REPORT_TITLE,
    )

    story = []

    # ---------------- CAPA ----------------
    story.append(Spacer(1, 4*cm))
    story.append(Paragraph(REPORT_TITLE, styles["TitleBig"]))
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph("Escopo: repositório Jorgecavalcant/fiadopro — branch main (PRs #30–#35 "
                            "incluídos)", styles["Subtitle"]))
    story.append(Paragraph("Data da auditoria: 2026-09-06", styles["Subtitle"]))
    story.append(Paragraph("Executado por: Especialista em Segurança + Auditoria de Segurança "
                            "(segundo revisor independente) — sob orquestração do CISO", styles["Subtitle"]))
    story.append(Spacer(1, 1.2*cm))
    story.append(HRFlowable(width="100%", color=colors.HexColor("#E5E7EB")))
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("Nota metodológica", styles["H2"]))
    story.append(Paragraph(
        "Esta auditoria é de leitura de código-fonte (não altera código de produto). A stack detectada é "
        "um monorepo pnpm com backend Node.js/Express + TypeScript (PostgreSQL 16 via <font face='Courier'>"
        "pg</font>, JWT próprio, bcryptjs, Zod), frontend React 18 + Vite + Capacitor (Android), e deploy "
        "via Docker Compose atrás de Caddy, com CI no GitHub Actions (gitleaks). As cinco categorias do "
        "checklist padrão foram mapeadas para essa stack da seguinte forma: "
        "(1) Banco sem tranca → isolamento manual por owner_user_id/user_id em cada query (não há RLS, "
        "pois não é Supabase); "
        "(2) Permissão no navegador → gates de role no React (App.tsx) cruzados com middleware "
        "requireAdmin no Express; "
        "(3) IDOR → percorridos todos os handlers de rota que buscam/alteram/deletam objeto por ID; "
        "(4) Chaves expostas → grep e gitleaks em código, configs, Docker Compose, CI, docs e histórico "
        "Git completo; "
        "(5) Inputs sem tratamento (XSS) → busca por sinks (innerHTML, dangerouslySetInnerHTML, eval) no "
        "frontend e interpolação sem escape em templates de e-mail no backend. "
        "Todo achado foi revisado de forma independente por um segundo agente de segurança antes da "
        "consolidação deste relatório.", styles["BodySmall"]))
    story.append(PageBreak())

    # ---------------- RESUMO EXECUTIVO ----------------
    story.append(Paragraph("Resumo executivo", styles["H1"]))
    total = len(FINDINGS)
    n_crit = sum(1 for f in FINDINGS if f["sev"] == "Crítica")
    n_alta = sum(1 for f in FINDINGS if f["sev"] == "Alta")
    n_media = sum(1 for f in FINDINGS if f["sev"] == "Média")
    n_baixa = sum(1 for f in FINDINGS if f["sev"] == "Baixa")
    n_info = sum(1 for f in FINDINGS if f["sev"] == "Informativa")
    story.append(Paragraph(
        f"Foram identificados <b>{total} achados</b>: <b>{n_crit} crítico(s)</b>, <b>{n_alta} alta(s)</b>, "
        f"<b>{n_media} média(s)</b>, <b>{n_baixa} baixa(s)</b> e <b>{n_info} informativo(s)</b>. "
        "Nenhum SQL injection, XSS explorável em aplicação, IDOR real, ou bypass de autorização no "
        "navegador foi encontrado na lógica de negócio. O risco concentrado está em <b>segredos "
        "expostos em documentação/histórico Git</b> e em <b>configuração de infraestrutura</b> "
        "(porta de banco exposta, fallback de segredo JWT) — não na lógica da aplicação.",
        styles["Body"]))
    story.append(Spacer(1, 0.4*cm))

    img_tbl = Table([[Image(IMG_DONUT, width=8.2*cm, height=7.2*cm),
                       Image(IMG_BAR, width=8.2*cm, height=5.2*cm)]], colWidths=[8.6*cm, 8.6*cm])
    img_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story.append(img_tbl)
    story.append(Spacer(1, 0.3*cm))

    # ---------------- PONTOS FORTES / FRACOS ----------------
    story.append(Paragraph("Pontos fortes confirmados", styles["H1"]))
    for titulo, det in STRENGTHS:
        story.append(Paragraph(f'<font color="{COLOR_FORTE}">●</font> <b>{titulo}</b> — {det}',
                                styles["BodySmall"]))
        story.append(Spacer(1, 0.12*cm))

    story.append(PageBreak())
    story.append(Paragraph("Pontos fracos (síntese)", styles["H1"]))
    story.append(Paragraph(
        "O risco predominante está concentrado em segredos históricos/documentais e configuração de "
        "infraestrutura, não em falhas de lógica de negócio:", styles["Body"]))
    for f in FINDINGS:
        chip = SEVERITY_COLOR[f["sev"]]
        story.append(Paragraph(
            f'<font color="{chip}"><b>[{f["sev"].upper()}]</b></font> {f["desc"]} '
            f'— <font face="Courier" size="8">{f["local"]}</font>', styles["BodySmall"]))
        story.append(Spacer(1, 0.1*cm))

    story.append(PageBreak())

    # ---------------- TABELA DE ACHADOS DETALHADOS ----------------
    story.append(Paragraph("Achados detalhados por categoria", styles["H1"]))

    by_cat = {}
    for f in FINDINGS:
        by_cat.setdefault(f["categoria"], []).append(f)

    def sev_chip(sev):
        color = SEVERITY_COLOR[sev]
        t = Table([[sev.upper()]], colWidths=[2.5*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(color)),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        return t

    for cat, items in by_cat.items():
        story.append(Paragraph(cat, styles["H2"]))
        rows = [["Severidade", "Arquivo:linha", "Descrição"]]
        row_heights = None
        table_data = [["Severidade", "Arquivo:linha", "Descrição"]]
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.3),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]
        for f in items:
            sev_p = Paragraph(f'<font color="white"><b>{f["sev"].upper()}</b></font>',
                               ParagraphStyle(name="chip", fontSize=7.5, alignment=TA_CENTER,
                                              backColor=colors.HexColor(SEVERITY_COLOR[f["sev"]]),
                                              borderPadding=3))
            loc_p = Paragraph(f'<font face="Courier" size="7.3">{f["local"]}</font>', styles["BodySmall"])
            desc_p = Paragraph(f'<b>{f["desc"]}</b><br/>{f["detalhe"]}', styles["BodySmall"])
            table_data.append([sev_p, loc_p, desc_p])

        t = Table(table_data, colWidths=[2.3*cm, 4.6*cm, 9.4*cm], repeatRows=1)
        t.setStyle(TableStyle(style_cmds))
        story.append(t)
        story.append(Spacer(1, 0.5*cm))

    story.append(PageBreak())

    # ---------------- RECOMENDAÇÕES ----------------
    story.append(Paragraph("Recomendações priorizadas", styles["H1"]))
    rec_data = [["Prioridade", "Recomendação"]]
    rec_style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F9FAFB")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    prio_color = {"P1": COLOR_CRITICA, "P2": COLOR_MEDIA, "P3": COLOR_BAIXA}
    for prio, rec in RECOMMENDATIONS:
        p_cell = Paragraph(f'<font color="{prio_color[prio]}"><b>{prio}</b></font>', styles["Body"])
        r_cell = Paragraph(rec, styles["BodySmall"])
        rec_data.append([p_cell, r_cell])
    t = Table(rec_data, colWidths=[2.0*cm, 14.3*cm], repeatRows=1)
    t.setStyle(TableStyle(rec_style))
    story.append(t)

    story.append(PageBreak())

    # ---------------- ISSUES PARA O GITHUB ----------------
    story.append(Paragraph("Issues para o GitHub", styles["H1"]))
    story.append(Paragraph(
        "Texto completo pronto para copiar e abrir manualmente no GitHub (nenhuma issue foi aberta "
        "automaticamente, conforme escopo da auditoria).", styles["Body"]))
    story.append(Spacer(1, 0.3*cm))

    for i, issue in enumerate(ISSUES_MD, start=1):
        block = []
        block.append(Paragraph(f"--- ISSUE {i} ---", styles["Mono"]))
        block.append(Spacer(1, 0.15*cm))
        block.append(Paragraph(f"<b>Título:</b> {issue['titulo']}", styles["Body"]))
        block.append(Paragraph(f"<b>Labels sugeridas:</b> {issue['labels']}", styles["BodySmall"]))
        block.append(Spacer(1, 0.15*cm))
        # markdown body converted to reportlab-friendly HTML
        corpo_html = md_to_html(issue["corpo"])
        block.append(Paragraph(corpo_html, styles["BodySmall"]))
        block.append(Spacer(1, 0.15*cm))
        block.append(Paragraph(f"--- FIM ISSUE {i} ---", styles["Mono"]))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 0.6*cm))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)

    # cleanup temp images
    for p in (IMG_DONUT, IMG_BAR):
        try:
            os.remove(p)
        except OSError:
            pass

    print(f"PDF gerado em: {OUT_PDF}")


if __name__ == "__main__":
    build_pdf()
