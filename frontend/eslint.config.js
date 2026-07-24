import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'android/**', 'ios/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      parserOptions: {
        project: false,
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      // Habilitamos só as 2 regras clássicas (as que a análise de arquitetura
      // apontou como críticas) em vez do preset "recommended" do v7, que
      // inclui regras orientadas ao React Compiler (ex.: set-state-in-effect)
      // que este projeto não usa e que sinalizam padrões normais de
      // fetch-on-mount como erro.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
      // Padrão legítimo no app: plugins nativos do Capacitor que podem não
      // existir no navegador (web) — ignorar silenciosamente é intencional.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // App.tsx é um monólito de ~4000 linhas com muitas props tipadas como
    // `any` (props de sub-componentes internos, integrações legadas). A Fase 2
    // do plano de profissionalização (docs/ANALISE-ARQUITETURA-IA-2026-07-24.md)
    // vai quebrar este arquivo em componentes/hooks próprios — tipar cada
    // `any` agora, isoladamente, duplicaria esforço e arrisca regressão num
    // app de produção sem o contexto completo daquele refactor. Rebaixado
    // para warning (visível, não bloqueia CI) até a Fase 2.
    files: ['src/App.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
