// Reglas de calidad para todo el monorepo: TypeScript estricto en la API, la web y el paquete compartido,
// y las reglas de React (hooks bien usados) solo en la web.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/api/drizzle/**', '**/*.tsbuildinfo', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Una variable que empieza con _ se deja sin usar a propósito.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/shared/**/*.ts', '**/*.config.{js,ts}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  {
    // Los scripts de la API (migrar, sembrar la demo, arrancar) sí escriben en consola.
    files: ['apps/api/src/main.ts', 'apps/api/src/db/migrar.ts', 'apps/api/src/demo/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // El punto de entrada y el proveedor de sesión (componente + su hook) son excepciones conocidas.
    files: ['apps/web/src/main.tsx', 'apps/web/src/sesion.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
