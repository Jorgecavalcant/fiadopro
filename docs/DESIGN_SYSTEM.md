## Documentação Técnica: Design System Fiado Pro

Este documento estabelece as diretrizes visuais e técnicas do **Fiado Pro**, um *Smart Credit Tracker* desenvolvido para modernizar a gestão de crédito informal em pequenos estabelecimentos. O sistema prioriza **confiabilidade**, **agilidade** e uma estética **minimalista contemporânea**.

---

## 1. Design Tokens (Fundamentos)

Os tokens de design são os átomos do nosso sistema, garantindo consistência entre plataformas e facilidade de manutenção.

### 🎨 Cores (Color Palette)
A paleta foi selecionada para transmitir profissionalismo e segurança financeira, utilizando o contraste entre tons sóbrios e elementos vibrantes para guiar a ação do usuário.

| Categoria | Nome | HEX | RGB | Aplicação |
| :--- | :--- | :--- | :--- | :--- |
| **Primária** | `brand-indigo` | `#4F46E5` | `79, 70, 229` | Botões principais, branding, navegação ativa. |
| **Primária (Dark)**| `brand-deep` | `#312E81` | `49, 46, 129` | Headlines, estados de hover em botões primários. |
| **Secundária** | `accent-amber` | `#F59E0B` | `245, 158, 11` | Planos Pro, notificações importantes, badging de anúncios. |
| **Sucesso** | `semantic-green` | `#10B981` | `16, 185, 129` | Pagamentos confirmados, score excelente, lucro. |
| **Erro** | `semantic-red` | `#EF4444` | `239, 68, 68` | Dívidas em atraso, score baixo, ações destrutivas. |
| **Alerta** | `semantic-orange`| `#F97316` | `249, 115, 22` | Saldo a vencer, notificações de sistema. |
| **Fundo** | `surface-light` | `#F8FAFC` | `248, 250, 252` | Cor de fundo principal do app (Slate 50). |
| **Texto (Base)** | `text-main` | `#0F172A` | `15, 23, 42` | Corpo de texto, títulos secundários (Slate 900). |
| **Texto (Muted)** | `text-slate` | `#64748B` | `100, 116, 139` | Legendas, captions, informações de apoio. |

**Justificativa Psicológica:**
*   **Indigo:** Transmite estabilidade e tecnologia, essencial para uma ferramenta financeira.
*   **Amber:** Utilizado estrategicamente para destacar o "valor agregado" (Upgrade/Pro) sem a agressividade do vermelho.
*   **Slate:** Tons de cinza azulado mantém a interface "fria" e profissional, reduzindo a fadiga visual do lojista.

### 🔡 Tipografia
Utilizamos a **Inter** (Google Fonts), uma fonte sans-serif geométrica otimizada para legibilidade em telas pequenas e densidade de dados.

| Escala | Tamanho (px/rem) | Peso | Line-height | Uso |
| :--- | :--- | :--- | :--- | :--- |
| **H1 (Display)** | 32px / 2.0rem | Bold (700) | 1.2 | Títulos de Dashboard |
| **H2 (Section)** | 24px / 1.5rem | Bold (700) | 1.3 | Títulos de Seções |
| **Body (Default)**| 16px / 1.0rem | Regular (400) | 1.5 | Texto corrido e formulários |
| **Body (Bold)** | 16px / 1.0rem | Bold (700) | 1.5 | Destaques em listas |
| **Caption** | 12px / 0.75rem | Medium (500) | 1.4 | Metadados e legendas |
| **Overline** | 10px / 0.625rem | Bold (700) | 1.2 | Rótulos (All Caps, Tracking 10%) |

### 📐 Espaçamento e Grid
Baseado em um sistema de múltiplos de **8px**, garantindo alinhamento matemático e agilidade no dev.

*   `spacing-xs`: 4px
*   `spacing-sm`: 8px
*   `spacing-md`: 16px
*   `spacing-lg`: 24px (Padrão para margens internas de cards)
*   `spacing-xl`: 32px (Padrão para margens externas de containers)
*   `spacing-2xl`: 48px

### 🌑 Sombras e Bordas (Radii)
O Fiado Pro utiliza cantos altamente arredondados para um visual amigável e moderno.

*   **Borda Padrão:** `rounded-2xl` (16px) - Inputs e cards menores.
*   **Borda Destaque:** `rounded-3xl` (24px) - Cards de Dashboard e botões de ação.
*   **Sombra (Low):** `0 1px 3px 0 rgb(0 0 0 / 0.1)` - Elevação básica de componentes.
*   **Sombra (High):** `0 20px 25px -5px rgb(0 0 0 / 0.1)` - Modais e Sidebars móveis.

---

## 2. Biblioteca de Componentes (Atomic Design)

### Átomos

#### Botões (Buttons)
*   **Primário:** Fundo Indigo-600, Texto Branco, `rounded-2xl`. Estado *Hover* escurece para Indigo-700.
*   **Secundário:** Fundo Branco, Borda Slate-200, Texto Slate-700. Estado *Hover* muda para Indigo-50.
*   **Ghost:** Sem fundo ou borda. Apenas texto em Indigo-600 ou Slate-500.

#### Inputs (Campos de Texto)
*   **Default:** Borda Slate-200, Fundo Branco, `rounded-xl`.
*   **Focus:** Borda Indigo-600 com anel de foco suave (Ring) de 2px.
*   **Error:** Borda Red-500, Mensagem de erro em Red-600.

#### Ícones
*   Biblioteca Base: **Lucide React**.
*   Espessura (Stroke): 2px (Padrão) ou 1.5px para ícones grandes de seção.

### Moléculas e Organismos

#### 1. Card de Cliente/Devedor (Organismo)
Estrutura composta por:
*   **Avatar (Átomo):** Círculo com inicial do cliente em fundo Indigo-50.
*   **Info (Molécula):** Nome em Bold + Telefone (Caption).
*   **Status de Crédito (Molécula):** Valor em destaque (Red para dívida, Slate para saldo zero) + Badge de Score (Verde/Amarelo/Vermelho).
*   **Ações (Átomo):** Ícone Chevron para detalhamento.

#### 2. Header de Navegação (Organismo)
*   **Contexto:** Título da View atual.
*   **Ações Rápidas:** Seletor de Idioma e Menu de Perfil (Avatar + Nome).
*   **Estado:** Fixado no topo com fundo branco e `backdrop-blur`.

---

## 3. Acessibilidade e Diretrizes de Uso

### Regras WCAG
*   **Contraste:** Todos os textos sobre fundos brancos ou coloridos devem manter um contraste mínimo de **4.5:1** (AA).
*   **Links e Botões:** Área mínima de toque de **44px x 44px** para compatibilidade com dispositivos móveis (agilidade para o lojista no balcão).

### Do's (O que fazer)
*   ✅ Use espaços em branco generosos para separar informações financeiras densas.
*   ✅ Use cores semânticas (Verde/Vermelho) apenas para status de pagamento ou score.
*   ✅ Mantenha os títulos sempre diretos e curtos.

### Don'ts (O que NÃO fazer)
*   ❌ Não use o roxo/indigo da marca para mensagens de erro ou sucesso.
*   ❌ Não use sombras pesadas em muitos elementos simultaneamente (interfere na performance e limpeza visual).
*   ❌ Não utilize fontes menores que 12px para informações críticas de valor monetário.

---

## 4. Design Tokens (JSON Implementation)

```json
{
  "project": "Fiado Pro",
  "version": "1.0.0",
  "tokens": {
    "colors": {
      "primary": {
        "base": "#4F46E5",
        "dark": "#312E81",
        "light": "#EEF2FF"
      },
      "secondary": {
        "base": "#F59E0B",
        "light": "#FEF3C7"
      },
      "semantic": {
        "success": "#10B981",
        "error": "#EF4444",
        "warning": "#F97316",
        "info": "#3B82F6"
      },
      "neutral": {
        "surface": "#F8FAFC",
        "border": "#E2E8F0",
        "text": "#0F172A",
        "text_muted": "#64748B"
      }
    },
    "typography": {
      "family": "'Inter', sans-serif",
      "scales": {
        "h1": { "size": "32px", "weight": "700" },
        "h2": { "size": "24px", "weight": "700" },
        "body": { "size": "16px", "weight": "400" },
        "caption": { "size": "12px", "weight": "500" }
      }
    },
    "spacing": {
      "base": "8px",
      "scale": [4, 8, 16, 24, 32, 48, 64]
    },
    "radius": {
      "sm": "8px",
      "md": "12px",
      "lg": "16px",
      "xl": "24px",
      "full": "9999px"
    }
  }
}
```
