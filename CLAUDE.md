# Fiado Pro — regras do repositório

O container de produção instala o backend com `npm ci` a partir de `backend/package-lock.json`. O pnpm da raiz não entra nessa imagem.

Toda dependência nova no backend exige atualizar `backend/package-lock.json` no mesmo commit. O comando, com Node 20 (o mesmo do Docker):

```bash
cd backend
npm install --package-lock-only --ignore-scripts
```

`--ignore-scripts` evita o `prepare` do husky, que não tem o binário instalado nesse modo. O CI (passo "Backend — npm ci (igual ao Docker)") e o Dockerfile rodam `npm ci` de verdade e falham se o `package.json` e o lock estiverem fora de sincronia.
