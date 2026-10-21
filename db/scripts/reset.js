import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createPool, transaction, reportError } from '../../server/services/db.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';

const database = process.env.PGDATABASE;
if (process.env.NODE_ENV !== 'development' || !database?.endsWith('_dev') || !['localhost','127.0.0.1'].includes(process.env.PGHOST || '127.0.0.1')) {
  throw new Error('Reset hanya NODE_ENV=development, host lokal dan database berakhiran _dev.');
}
if (!stdin.isTTY) throw new Error('Reset membutuhkan terminal interaktif dan konfirmasi manual.');
const prompt = createInterface({ input: stdin, output: stdout });
const answer = await prompt.question(`Semua data schema public ${database} akan dihapus. Ketik RESET ${database}: `);
prompt.close();
if (answer !== `RESET ${database}`) { console.log('Reset dibatalkan.'); process.exit(0); }
const pool = createPool();
try {
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(16020261)');
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
  });
  await migrate(pool);
  await seed(pool);
  console.log('Reset pengembangan selesai.');
} catch (error) { reportError(error); }
finally { await pool.end(); }
