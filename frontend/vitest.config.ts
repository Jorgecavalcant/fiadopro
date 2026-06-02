import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Testes de lógica pura — não precisam de DOM.
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
