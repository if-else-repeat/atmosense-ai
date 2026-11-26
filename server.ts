import 'dotenv/config';
import { startServer } from './server/src/index.ts';
import { logger } from './server/src/utils/logger.ts';

startServer().catch((error: unknown) => {
  logger.error('Failed to start AtmoSense AI server', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
