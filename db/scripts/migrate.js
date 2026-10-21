import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPool, transaction, reportError } from '../../server/services/db.js';

export async function migrate(pool, directory = new URL('../migrations/', import.meta.url)) {
  const files = (await readdir(directory)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(16020261)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nama text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = new Map((await client.query('SELECT nama, checksum FROM schema_migrations')).rows.map(r => [r.nama, r.checksum]));
    for (const name of applied.keys()) {
      if (!files.includes(name)) throw new Error(`Migration terpasang tidak ditemukan: ${name}`);
    }
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      const hash = createHash('sha256').update(sql).digest('hex');
      if (applied.has(name)) {
        if (applied.get(name) !== hash) throw new Error(`Checksum migration berubah: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(nama,checksum) VALUES ($1,$2)', [name, hash]);
      console.log(`Migration: ${name}`);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  try { await migrate(pool); console.log('Migrasi selesai.'); }
  catch (error) { reportError(error); }
  finally { await pool.end(); }
}
