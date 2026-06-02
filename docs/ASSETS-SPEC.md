# Especificação de Assets Visuais — Fiado Pro

> Tudo que precisa ser **criado por você** (Canva, DALL-E, Figma) e enviado às lojas.
> Cor primária da marca: **`#553C9A`** (roxo). Fundo dos ícones: opaco, sem transparência.
> Salvar tudo em `assets/` (local). **Não versionar binários grandes no Git** sem necessidade.

---

## 1. ÍCONE DO APP

| Loja | Tamanho | Formato | Regras |
|---|---|---|---|
| Apple App Store | 1024×1024 px | PNG | Sem transparência, sem cantos arredondados (a Apple arredonda), sem texto pequeno |
| Google Play (loja) | 512×512 px | PNG 32-bit | Sem transparência |
| Ícone embutido (Android/iOS) | gerado pelo Capacitor a partir do 1024 | — | usar `@capacitor/assets` (ver seção 5) |

**Prompt sugerido (DALL-E / Midjourney):**
```
Minimalist app icon for a small business credit-tracking app called "Fiado Pro".
Solid purple background (#553C9A). A clean white symbol of a small shop ledger /
notebook with a checkmark, OR a friendly handshake. Flat design, no gradients,
no text, centered, generous padding, suitable for an app store icon. 1024x1024px.
```

---

## 2. SPLASH SCREEN

| Plataforma | Tamanho | Composição |
|---|---|---|
| Android | 1080×1920 px | Fundo `#553C9A`, logo branco centralizado (ocupando ~40% da largura) |
| iOS | 1290×2796 px | Mesma composição |

> O `capacitor.config.ts` já está com `backgroundColor #553C9A`. Mantenha o logo
> centralizado e com bastante margem para não cortar em telas variadas.

---

## 3. SCREENSHOTS

Capturar do site em modo mobile: Chrome → F12 → **Toggle Device Toolbar** →
logar com a conta de teste → capturar as telas abaixo.

**Telas a capturar (4, na ordem de impacto):**
1. Lista de clientes com saldos (tela principal)
2. Detalhe de um cliente com o histórico de fiados
3. Tela de registrar uma venda no fiado
4. Resumo/Dashboard (total a receber, clientes ativos)

**Tamanhos exigidos:**

| Loja | Dispositivo | Resolução | Quantidade |
|---|---|---|---|
| Apple | iPhone 6.7" (obrigatório) | 1290×2796 px | mín. 3, recomendo 4 |
| Apple | iPhone 6.5" (opcional) | 1242×2688 px | — |
| Google | Telefone | mín. 1080×1920 px | mín. 2, recomendo 4 |

> Dica: para a Apple, o screenshot de **6.7"** é o único obrigatório; os demais
> tamanhos a Apple escala automaticamente.

---

## 4. FEATURE GRAPHIC (somente Google Play)

| Campo | Valor |
|---|---|
| Tamanho | 1024×500 px |
| Formato | PNG ou JPG, sem transparência |
| Composição | Fundo `#553C9A`, logo + texto curto: **"Controle o fiado do seu negócio"** |

---

## 5. GERAÇÃO AUTOMÁTICA DOS ÍCONES NATIVOS (recomendado)

Em vez de gerar manualmente cada densidade do Android, use a ferramenta oficial
do Capacitor a partir de um único ícone 1024 e um splash:

```bash
# Na pasta frontend/, com os arquivos assets/icon.png (1024) e assets/splash.png (2732x2732)
npm i -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor '#553C9A' --splashBackgroundColor '#553C9A'
npx cap sync
```

Isso gera automaticamente todas as densidades de ícone e splash para Android e iOS.

---

## 6. CHECKLIST DE ENTREGA DE ASSETS

- [ ] `assets/icon-1024.png` (1024×1024, fundo opaco)
- [ ] `assets/icon-512.png` (512×512, para a loja Google)
- [ ] `assets/splash-android-1080x1920.png`
- [ ] `assets/splash-ios-1290x2796.png`
- [ ] `assets/feature-graphic-1024x500.png`
- [ ] `assets/screenshots/` (4 telas, nos tamanhos da seção 3)
- [ ] Ícones nativos gerados via `@capacitor/assets` + `cap sync`
</content>
