import 'dotenv/config';
import { startServer } from './server/src/index.ts';

startServer().catch((error: unknown) => {
  console.error('Failed to start AtmoSense AI server:', error);
  process.exit(1);
});
