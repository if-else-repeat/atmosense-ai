import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, '.'),
      '@client': path.resolve(import.meta.dirname, 'client/src'),
      '@server': path.resolve(import.meta.dirname, 'server/src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./client/src/test/setup.ts'],
    include: [
      'client/src/**/*.vitest.ts',
      'client/src/**/*.vitest.tsx',
      'client/src/tests/**/*.test.ts',
      'client/src/tests/**/*.test.tsx',
      'server/src/**/*.vitest.ts',
      'server/tests/**/*.test.ts',
      'firestore.rules.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'server/lib/**/*.ts',
        'server/middleware/**/*.ts',
        'server/src/services/aqiService.ts',
        'server/src/services/geminiEngineService.ts',
        'server/src/services/heuristicFallback.ts',
        'client/src/utils/formatters.ts',
        'client/src/components/Routine/**/*.tsx',
        'client/src/components/Voice/**/*.tsx',
      ],
    },
  },
});
