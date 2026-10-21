import 'dotenv/config';
import pg from 'pg';
// DATE adalah tanggal bisnis, jangan bergeser karena timezone Windows/UTC.
pg.types.setTypeParser(1082,value=>value);

export function createPool(database = process.env.PGDATABASE) {
  if (!database || !process.env.PGUSER || !process.env.PGPASSWORD) {
    throw new Error('Isi PGDATABASE, PGUSER dan PGPASSWORD di .env.');
  }
  return new pg.Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    database, user: process.env.PGUSER, password: process.env.PGPASSWORD,
    max: 5, connectionTimeoutMillis: 10000,
    options: '-c timezone=Asia/Jakarta',
    application_name: 'satu-data-itpln',
  });
}

export function createAppPool(database=process.env.PGDATABASE) {
  if(process.env.APP_DB_USER!=='app_user' || !process.env.APP_DB_PASSWORD) throw new Error('Konfigurasi APP_DB_USER=app_user dan APP_DB_PASSWORD wajib; tidak fallback ke pemilik schema.');
  return new pg.Pool({host:process.env.PGHOST||'127.0.0.1',port:Number(process.env.PGPORT||5432),database,
    user:process.env.APP_DB_USER,password:process.env.APP_DB_PASSWORD,max:10,connectionTimeoutMillis:10000,
    options:'-c timezone=Asia/Jakarta -c statement_timeout=10000 -c lock_timeout=3000 -c idle_in_transaction_session_timeout=15000',application_name:'satu-data-itpln-api'});
}

export async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export function reportError(error) {
  // Jangan mencetak connection string, query parameter/password atau PG detail.
  console.error(`Operasi database gagal (${error.code || error.name}). ${error.safeMessage || 'Periksa konfigurasi dan constraint; tidak ada rahasia dicetak.'}`);
  process.exitCode = 1;
}
