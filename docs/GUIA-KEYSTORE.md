# Guia para criar e guardar a chave de upload do Fiado Pro

Este guia ensina, passo a passo, a criar a chave de upload do app em um Mac. Faça cada etapa com calma. Não rode este guia como um script automático.

A keystore é uma chave usada para enviar atualizações do app. Ela não transforma o Fiado Pro em banco, serviço de empréstimo ou consultoria financeira: o Fiado Pro é uma ferramenta de organização.

## 1. Abra o Terminal

No Mac, abra o aplicativo Terminal.

## 2. Vá até a pasta do app para Android

Execute:

```bash
cd frontend/android/app
```

## 3. Crie a keystore

Execute o comando abaixo. Se o `keytool` não estiver disponível no Terminal, use o que acompanha o Android Studio:

```bash
"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" -genkeypair -v -keystore fiado-pro-release.jks -alias fiadopro-release -keyalg RSA -keysize 2048 -validity 10000
```

O `keytool` vai pedir uma senha e alguns dados. Crie uma senha forte e guarde-a em local seguro. Não use uma senha óbvia. Não compartilhe a senha neste guia, em mensagens ou no Git.

A ferramenta também poderá pedir uma senha para a chave. Se escolher uma senha diferente da senha da keystore, guarde as duas.

Ao terminar, o arquivo criado será:

```text
frontend/android/app/fiado-pro-release.jks
```

## 4. Configure as propriedades

Volte para a pasta `frontend/android`:

```bash
cd ..
```

Copie o arquivo de exemplo:

```bash
cp keystore.properties.example keystore.properties
```

Abra `keystore.properties` em um editor de texto. Preencha os campos com os dados da keystore:

```properties
storeFile=fiado-pro-release.jks
storePassword=SUA_SENHA_DA_KEYSTORE
keyAlias=fiadopro-release
keyPassword=SUA_SENHA_DA_CHAVE
```

Substitua os textos de exemplo pelas senhas que você escolheu. Não copie esses exemplos como se fossem senhas. Salve o arquivo.

## 5. Confira a impressão digital SHA-256

Volte à pasta que contém a keystore:

```bash
cd app
```

Execute:

```bash
"/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" -list -v -keystore fiado-pro-release.jks -alias fiadopro-release
```

O comando pedirá a senha no Terminal. Anote a impressão digital SHA-256 exibida. Guarde essa impressão da chave de upload. Ela não entra no `assetlinks.json`.

Envie somente o SHA-256 quando ele for solicitado. Nunca envie a senha.

## 6. Guarde a keystore e as senhas

Guarde a senha e uma cópia do arquivo `.jks` no 1Password e em um backup fora deste computador.

Não mande o arquivo `.jks` por e-mail nem o coloque no GitHub. Os arquivos `.jks`, `.keystore` e `keystore.properties` já estão no `.gitignore`, mas confira sempre o que será enviado antes de fazer uma alteração no repositório.

Perder a chave de upload pode atrapalhar a atualização do app.

## 7. Entenda a assinatura pela Play Console

Na Play Console, aceite o Play App Signing. A chave que você criou é a chave de upload, usada para enviar o app. A Google guarda a chave que assina o app para os usuários. O SHA-256 do `assetlinks.json` é o certificado de assinatura do app mostrado na Play Console, não o SHA-256 da chave de upload.

## 8. Prepare os dados para o GitHub Actions, se necessário

Os nomes dos secrets usados são:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Para obter o conteúdo em base64 no Mac, estando na pasta `frontend/android/app`, execute:

```bash
base64 -i fiado-pro-release.jks
```

Guarde a saída em local seguro e cadastre-a como secret do GitHub Actions. Não cole a saída no Git nem em arquivos do repositório.

## 9. Gere o pacote localmente, se necessário

Na pasta `frontend/android`, execute:

```bash
./gradlew bundleRelease
```

O pacote será gerado em:

```text
app/build/outputs/bundle/release/app-release.aab
```
