import { createPool, reportError } from '../../server/services/db.js';
const pool=createPool();
try {
  if(process.env.APP_DB_USER!=='app_user' || (process.env.APP_DB_PASSWORD||'').length<16) throw new Error('APP_DB_USER harus app_user; APP_DB_PASSWORD minimal 16 karakter.');
  // ALTER ROLE tidak menerima parameter. quote_literal server menghindari interpolasi input mentah.
  const q=(await pool.query('SELECT quote_literal($1) AS password',[process.env.APP_DB_PASSWORD])).rows[0].password;
  await pool.query(`ALTER ROLE app_user LOGIN PASSWORD ${q}`);
  console.log('Password role app_user dipasang dari env; nilai tidak dicetak. Role PostgreSQL global: dev/test memakai password yang sama.');
} catch(e) {reportError(e);} finally {await pool.end();}
