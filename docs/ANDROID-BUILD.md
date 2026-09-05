# Build Android (AAB) — Fiado Pro / Google Play

> Como gerar o **Android App Bundle (.aab)** assinado para enviar à Play Store.
> Foco: Play Store primeiro (a conta Google já está paga). iOS/Apple fica para depois.

## Pré-requisitos
- **Android Studio** instalado (traz JDK 17 e o Android SDK 35).
- Pasta `frontend/android/` (já no repositório).
- Keystore `.jks` (gerar conforme a Etapa 4 de `SESSAO-SPRINT4-PUBLICACAO-LOJAS.md`).

> **Push/FCM é opcional no v1.** O `google-services.json` é aplicado de forma
> condicional no `app/build.gradle` — **dá para publicar a primeira versão sem
> Firebase**. As notificações push entram numa atualização futura.

## Toolchain (já configurada neste commit)
| Componente | Versão | Por quê |
|---|---|---|
| Gradle | 8.9 | Suporta AGP 8.7 / SDK 35 |
| Android Gradle Plugin | 8.7.2 | Compila contra API 35 |
| compileSdk / targetSdk | 35 | **Exigência do Google Play** p/ apps novos (Android 15) |
| minSdk | 22 | Cobre praticamente todos os aparelhos em uso |

> Na primeira abertura no Android Studio, o Gradle vai baixar a 8.9 e o SDK 35
> (pode pedir para instalar o "Android 15 / API 35" — aceite). Se aparecer
> qualquer erro de sync, **me mande a mensagem exata** que eu ajusto a versão.

## Passo 1 — Configurar a assinatura (uma vez)
1. Copie `frontend/android/app/fiado-pro-release.jks` (seu keystore) para dentro de `frontend/android/app/`.
2. Em `frontend/android/`, copie `keystore.properties.example` para `keystore.properties` e preencha:
   ```properties
   storeFile=fiado-pro-release.jks
   storePassword=...sua senha...
   keyAlias=fiadopro-release
   keyPassword=...sua senha...
   ```
   > `keystore.properties` e `*.jks` estão no `.gitignore` — não vão para o GitHub.

## Passo 2 — Atualizar os web assets e sincronizar
Na pasta `frontend/`:
```bash
npm install
npm run build           # gera ../dist
npx cap sync android    # copia web assets + plugins para o android/
```

## Passo 3 — Gerar o AAB assinado
**Opção A — Linha de comando (recomendado, reproduzível):**
```bash
cd frontend/android
./gradlew bundleRelease          # Windows: gradlew.bat bundleRelease
# Saída: app/build/outputs/bundle/release/app-release.aab
```
Com o `keystore.properties` configurado, esse AAB já sai **assinado**.

**Opção B — Android Studio:**
`Build > Generate Signed Bundle / APK > Android App Bundle`, apontando para o `.jks`.

## Passo 4 — Após gerar o keystore: atualizar o assetlinks.json
Pegue o SHA-256 do keystore:
```bash
keytool -list -v -keystore app/fiado-pro-release.jks -alias fiadopro-release
```
Copie a linha `SHA256:` e **me mande** — eu atualizo
`frontend/public/.well-known/assetlinks.json` (hoje com placeholder) e refaço o build.
Isso habilita o App Links (abrir links do site dentro do app) e valida a propriedade do domínio.

## Passo 5 — Subir na Play Console
Use o conteúdo pronto em `docs/STORE-LISTING.md` e os assets de `docs/ASSETS-SPEC.md`.
Upload do `app-release.aab` em **Produção > Criar nova versão**.

---
## Alternativa — Build na nuvem (GitHub Actions, sem Android Studio)

> **Migrado do Codemagic (2026-09).** Decisão do CEO: reduzir terceiros com
> acesso ao keystore de assinatura. O workflow `codemagic.yaml` continua no
> repositório só como referência histórica (marcado obsoleto no topo do
> arquivo) — **não é mais usado**.

O workflow `.github/workflows/android-release.yml` gera o AAB assinado na
nuvem, via `workflow_dispatch` manual (não publica na Play Store — o `.aab`
sai como artifact do próprio workflow run, para download e upload manual).

**Secrets a configurar em Settings → Secrets and variables → Actions** (repo `fiadopro`):

| Secret | O que é | Como obter |
|---|---|---|
| `ANDROID_KEYSTORE_BASE64` | o `.jks` em **base64** | `base64 -i fiado-pro-release.jks` (copiar a saída) |
| `ANDROID_KEYSTORE_PASSWORD` | senha do keystore | a definida ao gerar o keystore |
| `ANDROID_KEY_ALIAS` | `fiadopro-release` | alias do keystore |
| `ANDROID_KEY_PASSWORD` | senha da chave | normalmente igual à do keystore |

O workflow decodifica o keystore, escreve o `keystore.properties`, roda
`./gradlew bundleRelease`, verifica ausência de chaves de API expostas no
bundle e sobe o `.aab` como artifact do run. O upload na Play Console
continua manual (Passo 5 acima).

---
### Checklist rápido
- [ ] `keystore.properties` criado e preenchido (não versionar)
- [ ] `.jks` em `android/app/`
- [ ] `npm run build && npx cap sync android`
- [ ] `./gradlew bundleRelease` gerou o `.aab` assinado
- [ ] SHA-256 enviado para atualizar o `assetlinks.json`
- [ ] Ficha da loja preenchida (`STORE-LISTING.md`) + assets enviados
