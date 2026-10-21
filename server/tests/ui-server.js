// Harness khusus fixture UI; limit runtime tetap 10 pada server/app.js.
import {createApp} from '../app.js';
const app=createApp({loginLimit:50,excelEnv:{EXCEL_UPLOAD_PER_MINUTE:500,EXCEL_DOWNLOAD_PER_MINUTE:500,EXCEL_GLOBAL_PER_MINUTE:5000}}),pool=app.locals.pool;
const role=(await pool.query('SELECT current_user AS name,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
if(role.name!=='app_user'||role.rolsuper||role.rolcreatedb||role.rolcreaterole)throw Error('Harness harus memakai app_user terbatas.');
const server=app.listen(Number(process.env.PORT),'127.0.0.1',()=>console.log('API Satu Data ITPLN: UI test'));
const close=()=>server.close(async()=>{app.locals.store.close();await pool.end();process.exit(0);});process.on('SIGINT',close);process.on('SIGTERM',close);
