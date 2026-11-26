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
    setupFiles: ['./client/src/tests/setup.ts'],
    include: [
      'client/src/tests/**/*.test.ts',
      'client/src/tests/**/*.test.tsx',
      'server/tests/**/*.test.ts',
      'firestore.rules.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'server/src/lib/**/*.ts',
        'server/src/middleware/**/*.ts',
        'server/src/services/aqi/**/*.ts',
        'server/src/services/aqiService.ts',
        'server/src/services/fallback/**/*.ts',
        'server/src/services/gemini/**/*.ts',
        'server/src/services/geminiService.ts',
        'server/src/services/heuristicFallback.ts',
        'server/src/utils/aqi.ts',
        'client/src/utils/formatters.ts',
        'client/src/utils/healthCrypto.ts',
        'client/src/utils/locationStorage.ts',
        'client/src/utils/airQuality.ts',
        'client/src/utils/dashboardAqi.ts',
        'client/src/utils/personaGuidance.ts',
        'client/src/utils/smogImpact*.ts',
        'client/src/utils/smogAlternatives.ts',
        'client/src/components/ErrorBoundary.tsx',
        'client/src/components/ActionHub/**/*.tsx',
        'client/src/components/Routine/**/*.{ts,tsx}',
        'client/src/components/Voice/**/*.tsx',
      ],
    },
  },
});
