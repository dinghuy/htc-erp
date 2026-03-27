import { app, bootApplication } from './src/app';

if (require.main === module) {
  bootApplication().catch((err) => {
    console.error('❌ Failed to start server:', err);
  });
}

export { app };
