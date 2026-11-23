// ESLint (flat config). Roda no GitHub Actions (job "lint"), junto com o Prettier.
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  { ignores: ['build/**', 'out/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  // Código que roda no navegador (visualizador e callbacks do Playwright)
  { files: ['viewer/**/*.js', 'tools/screenshots.mjs'], languageOptions: { globals: { ...globals.browser } } },
  prettier,
];
