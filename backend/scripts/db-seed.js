require('ts-node/register');

const { v4: uuidv4 } = require('uuid');

const { initDb, getDb } = require('../sqlite-db.ts');
const { seedDatabase } = require('../src/persistence/sqlite/seed.ts');

(async () => {
  await initDb();
  await seedDatabase(getDb(), { createId: uuidv4 });
  console.log('OK');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
