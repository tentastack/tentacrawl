import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const ignores = [
  'node_modules/**',
  '.next/**',
  '**/.next/**',
  'dist/**',
  '**/dist/**',
  'coverage/**',
  '**/coverage/**',
  '.turbo/**',
  '.artifacts/**',
  '.screenshots/**',
  'packages/browser/sandbox/.screenshots/**',
  'playwright-report/**',
  'test-results/**',
  'apps/*/src/generated/**',
  'apps/web/src/generated/**',
  '**/generated/**',
  '**/*.d.ts',
  'apps/web/next-env.d.ts',
];

const frontendFiles = [
  'apps/web/**/*.{js,mjs,cjs,ts,tsx}',
  'packages/*/src/frontend/**/*.{js,mjs,cjs,ts,tsx}',
  'packages/ui/src/**/*.{js,mjs,cjs,ts,tsx}',
];

export default [
  { ignores },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
      'react/display-name': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: frontendFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },
];