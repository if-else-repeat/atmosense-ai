import js from '@eslint/js';

export default [
  {
    ignores: [
      'dist/**/*',
      'client/dist/**/*',
      'server/dist/**/*',
      'node_modules/**/*',
      '.playwright-cli/**/*',
      'dev-dist/**/*',
      '**/dev-dist/**/*',
      '**/*.ts',
      '**/*.tsx',
    ],
  },
  js.configs.recommended,
];
