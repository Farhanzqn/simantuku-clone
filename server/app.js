import {ikuRoutes} from './routes/iku.js';
import {employmentRoutes} from './routes/employment.js';
import {safeNext,normalizedPagePath} from '../static-web/assets/js/navigation.js';
import {formExcelRoutes} from './routes/form-excel.js';
import {amiRoutes} from './routes/ami.js';
import {financeRoutes} from './routes/finance.js';
import {productivityRoutes} from './routes/productivity.js';
import {cooperationRoutes} from './routes/cooperation.js';
import {achievementRoutes} from './routes/achievements.js';
import {researchRoutes} from './routes/research.js';
import {ratioRoutes} from './routes/ratio.js';
import {accreditationRoutes} from './routes/accreditation.js';
import {passwordPolicy} from './services/password-policy.js';
import {formRoutes} from './routes/forms.js';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import {requestLog} from './middleware/request-log.js';
import {errorResponse,sendErrorPage} from './middleware/error-response.js';
import { fileURLToPath } from 'node:url';
import { createAppPool } from './services/db.js';
import { PgSessionStore } from './services/session-store.js';
import { csrf,HttpError } from './middleware/security.js';
import { authRoutes } from './routes/auth.js';
import { dataRoutes,verificationRoutes } from './routes/data.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { importRoutes } from './routes/imports.js';
import { adminRoutes,masterRoutes,qualityRoutes } from './routes/admin.js';
import { kpiMasterRoutes } from './routes/kpi-master.js';

export function createApp({pool=createAppPool(),publicDashboard=process.env.PUBLIC_DASHBOARD!=='false',secret=process.env.SESSION_SECRET,production=process.env.NODE_ENV==='production',loginLimit=10,passwordEnv=process.env,excelEnv=process.env}={}){
  if(!secret||secret.length<32)throw new Error('SESSION_SECRET minimal 32 karakter wajib.');
  const passwordChange=passwordPolicy(passwordEnv,production);
  const app=express();app.disable('x-powered-by');app.disable('etag');if(process.env.TRUST_PROXY==='loopback')app.set('trust proxy','loopback');
  app.use(helmet());
  app.use(requestLog);
  // Public error assets must remain readable when the session database is down.
  // Only the already-public assets directory and dedicated error files bypass session I/O.
  app.use('/assets',express.static(fileURLToPath(new URL('../static-web/assets/',import.meta.url)),{dotfiles:'deny',setHeaders:res=>res.setHeader('Cache-Control','no-store')}));
  app.get(/^\/errors\/(400|401|403|404|413|429|500|503)\.html$/, (req,res)=>sendErrorPage(req,res,Number(req.params[0])));
  app.get('/maintenance.html',(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(fileURLToPath(new URL('../static-web/maintenance.html',import.meta.url)));});
  const jsonBody=express.json({limit:'600kb'});app.use((req,res,next)=>/^\/api\/forms\/[^/]+\/(?:template|upload(?:\/cancel)?|apply)\/?$/i.test(req.path)?next():jsonBody(req,res,next));
  const store=new PgSessionStore(pool);app.locals.store=store;app.locals.pool=pool;
  app.use(session({name:'itpln.sid',store,secret,resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:production,maxAge:8*3600000}}));
  app.use(async(req,res,next)=>{res.set('cache-control','no-store');if(req.session.userId){
    const u=(await pool.query('SELECT * FROM users WHERE id=$1 AND aktif AND NOT is_system',[req.session.userId])).rows[0];
    if(u&&u.session_version===req.session.version)req.user={...u,must_change_password:u.must_change_password&&!passwordChange.skip};else await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
  }next();});
  app.use('/api',csrf);
  app.get('/api/health',(req,res)=>res.json({data:{status:'ok'}}));
  app.use('/api/auth',authRoutes(pool,loginLimit,passwordChange.skip));
  app.use('/api', (req,res,next)=>{if(req.user?.must_change_password&&!['GET','HEAD'].includes(req.method))throw new HttpError(403,'Ganti password terlebih dahulu.','PASSWORD_CHANGE_REQUIRED');next();});
  app.use('/api/dashboard',ratioRoutes(pool,publicDashboard));
  app.use('/api/dashboard',accreditationRoutes(pool,publicDashboard));
  app.use('/api/dashboard',researchRoutes(pool,publicDashboard));
  app.use('/api/dashboard',achievementRoutes(pool,publicDashboard));
  app.use('/api/dashboard',cooperationRoutes(pool,publicDashboard));
  app.use('/api/dashboard',productivityRoutes(pool,publicDashboard));
  app.use('/api/dashboard',amiRoutes(pool,publicDashboard));
  app.use('/api/dashboard',employmentRoutes(pool,publicDashboard));
  app.use('/api/dashboard',financeRoutes(pool,publicDashboard));
  app.use('/api/dashboard',ikuRoutes(pool,publicDashboard));
  app.use('/api/dashboard',dashboardRoutes(pool,publicDashboard));
  app.use('/api/master',masterRoutes(pool,publicDashboard));
  app.use('/api/forms',formExcelRoutes(pool,excelEnv));
  app.use('/api/forms',formRoutes(pool));
  app.use('/api/data',dataRoutes(pool));app.use('/api/verification',verificationRoutes(pool));
  app.use('/api/imports',importRoutes(pool));app.use('/api/admin',adminRoutes(pool));app.use('/api/quality-flags',qualityRoutes(pool,publicDashboard));
  app.use('/api',kpiMasterRoutes(pool,publicDashboard));
  app.use('/api',(req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Endpoint belum tersedia.',request_id:req.requestId}}));

  // Normalisasi sama seperti path berkas sebelum guard, termasuk URL terenkode.
  app.use(async(req,res,next)=>{
    const path=normalizedPagePath(req.path);if(!path)throw new HttpError(400,'Alamat tidak valid.');
    if(['/capaian-iku-fakultas.html','/capaian-iku-universitas.html'].includes(path))return res.redirect(302,'/monitoring-kpi.html'+req.url.slice(req.path.length));
    const input=path.startsWith('/input/'),admin=path.startsWith('/admin/'),verification=path==='/verifikasi.html';
    const internalPages={'/pegawai-formasi.html':['pegawai-internal','formasi'],'/keuangan.html':['keuangan'],'/ami.html':['ami'],'/statistik-tendik.html':['tendik'],'/monitoring-kpi.html':['kpi'],'/monitoring-iku.html':['iku'],'/kualitas-data.html':['data_quality_flag']};
    if(internalPages[path]){
      if(!req.user)throw new HttpError(401,'Modul ini memerlukan login.','LOGIN_REQUIRED');
      const policies=(await pool.query('SELECT aktif FROM visibilitas_modul WHERE kode_modul=ANY($1::text[])',[internalPages[path]])).rows;
      if(policies.length!==internalPages[path].length||policies.some(p=>!p.aktif))throw new HttpError(403,'Modul dinonaktifkan.');
    }
    const privatePage=!!internalPages[path]||['/ruang-unit.html','/ganti-password.html'].includes(path);
    if(!input&&!admin&&!verification&&!privatePage)return next();
    res.locals.privatePage=true;
    const target=safeNext(path+req.url.slice(req.path.length));
    if(!req.user)throw new HttpError(401,'Silakan masuk.','LOGIN_REQUIRED');
    if(admin&&req.user.role!=='admin')throw new HttpError(403,'Halaman hanya untuk admin.');
    if(verification&&!['admin','prp'].includes(req.user.role))throw new HttpError(403,'Halaman hanya untuk verifikator.');
    if(path==='/ruang-unit.html'&&req.user.role==='viewer')throw new HttpError(403,'Halaman hanya untuk unit.');
    if(input){
      const match=/^\/input\/(baa|ppa|bsdm|bpka|prp|pjm|lppm|bkm|kerjasama|bku)\.html$/.exec(path);
      if(!match||!['admin',match[1]].includes(req.user.role))throw new HttpError(403,'Halaman bukan milik unit Anda.');
      if(req.user.role!=='admin'){
        const units={bku:'keuangan',baa:'mahasiswa-aktif',ppa:'mahasiswa-baru',bsdm:'dosen',bpka:'tracer',prp:'kpi-capaian',pjm:'akreditasi',lppm:'penelitian',bkm:'prestasi',kerjasama:'kerjasama'};
        if(!(await pool.query('SELECT 1 FROM domain_unit d JOIN unit u ON u.id=d.unit_id WHERE d.domain=$1 AND d.unit_id=$2 AND u.aktif',[units[match[1]],req.user.unit_id])).rows.length)throw new HttpError(403,'Unit tidak sesuai.');
      }
    }
    if(req.user.must_change_password&&path!=='/ganti-password.html')return res.redirect(302,'/ganti-password.html?next='+encodeURIComponent(target));next();
  });
  app.use(express.static(fileURLToPath(new URL('../static-web/',import.meta.url)),{dotfiles:'deny',setHeaders(res){if(res.locals.privatePage||res.req.path==='/maintenance.html')res.setHeader('Cache-Control','no-store');}}));
  app.use((req,res,next)=>next(new HttpError(404,'Halaman tidak ditemukan.','NOT_FOUND')));
  app.use(errorResponse);return app;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const app=createApp();const pool=app.locals.pool;
  const role=(await pool.query('SELECT current_user AS name,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
  if(role.name!=='app_user'||role.rolsuper||role.rolcreatedb||role.rolcreaterole)throw new Error('Aplikasi hanya boleh berjalan dengan role app_user terbatas.');
  const server=app.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`API Satu Data ITPLN: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3000}`));
  server.requestTimeout=30000;server.headersTimeout=10000;
  server.setTimeout(30000,socket=>socket.destroy());
  const close=()=>server.close(async()=>{app.locals.store.close();await pool.end();process.exit(0);});process.on('SIGINT',close);process.on('SIGTERM',close);
}
