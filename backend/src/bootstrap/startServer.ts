import type { Express } from 'express';

export async function startServer(options: {
  app: Express;
  port: number;
  initialize: () => Promise<void>;
  afterListen?: () => void;
}) {
  await options.initialize();

  return options.app.listen(options.port, () => {
    console.log(`✅ Server running on http://localhost:${options.port}`);
    console.log(`   Health: http://localhost:${options.port}/api/health`);
    options.afterListen?.();
  });
}
