import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'client/dist/**',
      'server/dist/**',
      'node_modules/**',
      '.playwright-cli/**',
      'coverage/**',
      'dev-dist/**',
      '**/dev-dist/**',
      'public/**',
      'client/public/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'error',
    },
  },
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.vitest.ts',
      '**/*.vitest.tsx',
      'client/src/test/**',
    ],
    rules: {
      'no-console': 'off',
    },
  },
);
