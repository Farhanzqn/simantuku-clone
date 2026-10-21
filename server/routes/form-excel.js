import express,{Router} from 'express';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireLogin,parse,HttpError} from '../middleware/security.js';
import {getDomain,validate} from '../validators/domains.js';
import {authorizeDomain,withActor,createDraft,patchDraft,revision,validateReferences} from '../services/data.js';
import {formDefinitions,parseCell,warnings} from '../../static-web/assets/js/input-schema.js';
import {excelForms} from '../../static-web/assets/js/excel-schema.js';
import {multipartFile,MAX_FILE,assertTemplateBytes} from '../services/form-xlsx.js';
import {excelConfig,excelGate,excelWorker} from '../services/excel-resources.js';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function templateHash(name){const d=getDomain(name),def=formDefinitions[name];return digest({name,version:excelForms[name]?.version,keys:d.keys,context:excelForms[name]?.context,columns:def.columns,entities:def.categories??'master-prodi'});}
const checkAbort=req=>{if(req.excelSignal?.aborted)throw new HttpError(503,'Permintaan Excel dibatalkan.','EXCEL_ABORTED');};
// Check both sides of each awaited query, including queries inside shared draft helpers.
const guarded=(db,req,transaction=false)=>({query:async(...args)=>{
 // Rollback must remain possible after abort. Once COMMIT is sent, its atomic result stands.
 if(transaction&&args[0]==='ROLLBACK')return db.query(...args);
 checkAbort(req);const result=await db.query(...args);
 if(!transaction||args[0]!=='COMMIT')checkAbort(req);return result;
}});
export function formExcelRoutes(pool,env=process.env){const r=Router(),config=excelConfig(env),gate=excelGate(config);
 const work=(req,task,input)=>excelWorker(task,input,{...config,signal:req.excelSignal,requestId:req.requestId});
 const actor=async(req,action,fn)=>{checkAbort(req);return withActor({connect:async()=>{const client=await pool.connect();return {...guarded(client,req,true),release:()=>client.release()};}},req,action,async c=>{await c.query("SELECT set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true)",[String(config.statement),String(config.lock)]);const result=await fn(c);checkAbort(req);return result;});};
 // Own body parsing, handler, rejection audit and rollback in one lifetime.
 const run=(...steps)=>async(req,res,next)=>{try{checkAbort(req);req.owner=await authorizeDomain(guarded(pool,req),req.user,req.domain,true);for(const step of steps){checkAbort(req);if(step.length===3)await new Promise((resolve,reject)=>step(req,res,error=>error?reject(error):resolve()));else await step(req,res);}}
  catch(err){if(req.path.endsWith('/upload')&&!req.excelUploadAudited&&!req.excelSignal.aborted){try{const ctx=req.excelContext??(await context(req)).ctx;await actor(req,'template_upload',c=>audit(c,'template_upload',req,ctx,{rows:0,errors:1,result:'rejected'}));}catch{ /* Preserve original validation error; no raw file enters logs. */ }}next(err);}
  finally{req.excelRelease();}};
 r.use(requireLogin);
 r.param('form',async(req,res,next,name)=>{if(!excelForms[name])throw new HttpError(404,'Template formulir ini belum tersedia.');req.domain=getDomain(name);if(req.user.role!==req.domain.role&&req.user.role!=='admin')throw new HttpError(403,'Template hanya untuk pemilik formulir.');next();});
 async function context(req){const db=guarded(pool,req),config=excelForms[req.domain.name],raw={...req.query};if(raw.periode){raw.periode_laporan_id=raw.periode;delete raw.periode;}
  const shape={periode_laporan_id:z.coerce.number().int().positive()};if(config.context.includes('periode_akademik_id'))shape.periode_akademik_id=z.coerce.number().int().positive();if(config.context.includes('tahun'))shape.tahun=z.coerce.number().int().min(2000).max(2200);if(config.context.includes('status_mhs'))shape.status_mhs=z.enum(['aktif','cuti','nonaktif']).default('aktif');
  for(const key of ['tahun_masuk','tahun_lulus'])if(config.context.includes(key))shape[key]=z.coerce.number().int().min(2000).max(2200);
  if(config.context.includes('tanggal_snapshot'))shape.tanggal_snapshot=req.domain.shape.tanggal_snapshot;
  if(config.entities==='lulusan'){
   shape.cakupan=req.domain.shape.cakupan;
   shape.periode_wisuda=req.domain.shape.periode_wisuda;
   shape.periode_akademik_id=z.coerce.number().int().positive().nullable().default(null);
  }
  const ctx=parse(z.object(shape).strict(),raw);
  if(config.entities==='lulusan'&&(ctx.cakupan==='institusi'&&ctx.periode_akademik_id!==null||ctx.cakupan==='prodi'&&(!ctx.periode_akademik_id||!ctx.periode_wisuda)))throw new HttpError(422,'Pilih cakupan, periode akademik dan wisuda yang sesuai.');
  const report=(await db.query('SELECT * FROM periode_laporan WHERE id=$1',[ctx.periode_laporan_id])).rows[0];if(!report)throw new HttpError(422,'Periode laporan tidak dikenal.');let academic;
  if(ctx.periode_akademik_id){academic=(await db.query('SELECT * FROM periode_akademik WHERE id=$1',[ctx.periode_akademik_id])).rows[0];if(!academic)throw new HttpError(422,'Periode akademik tidak dikenal.');}
  const def=formDefinitions[req.domain.name],entities=config.entities==='lulusan'&&ctx.cakupan==='institusi'?[{code:'institusi',label:'Institusi ITPLN (bukan rincian prodi)',values:{prodi_id:null}}]:['prodi','lulusan'].includes(config.entities)?(await db.query('SELECT id,kode,nama FROM prodi WHERE aktif ORDER BY urutan')).rows.map(p=>({code:p.kode,label:p.nama,values:{prodi_id:p.id}})):def.categories.map(([code,label])=>({code,label,values:{kategori:code}}));
  return {ctx,entities,label:report.kode+(academic?' · '+academic.semester+' '+academic.tahun_ajaran:'')};
 }
 async function current(c,req,values){const d=req.domain,args=d.keys.map(k=>values[k]);return (await c.query(`SELECT * FROM ${d.table} WHERE unit_id=$${args.length+1} AND ${d.keys.map((k,i)=>`${k} IS NOT DISTINCT FROM $${i+1}`).join(' AND ')} AND (is_current_approved OR status IN ('draft','submitted','rejected')) ORDER BY CASE WHEN status='approved' THEN 1 ELSE 0 END,id DESC FOR UPDATE`,[...args,req.owner])).rows;}
 const audit=(c,action,req,ctx,details)=>c.query('SELECT record_form_excel_event($1,$2)',[action,{form:req.domain.name,periode:Object.fromEntries(Object.entries(ctx).map(([key,value])=>key==='periode_wisuda'?['periode_wisuda_hash',digest(value)]:[key,value])),version:excelForms[req.domain.name].version,schema_hash:templateHash(req.domain.name),...details}]);
 r.get('/:form/template',gate('template'),run(async(req,res)=>{const {ctx,entities,label}=await context(req),def=formDefinitions[req.domain.name],hash=templateHash(req.domain.name),version=excelForms[req.domain.name].version;
  const bytes=await work(req,'generate',[{name:'Petunjuk',rows:[['Petunjuk',def.title],['Periode',label],['Konteks',JSON.stringify(ctx)],['Cakupan dan satuan',def.help],['Aturan','Kosong ≠ 0. Tanda - berarti kosong/NULL. Nol tetap 0.'],['Angka','Angka Excel atau teks Indonesia: 1.234,50. Desimal hanya pada kolom yang mengizinkan.'],['Contoh','Jumlah: 12; capaian: 59,60. Contoh ini bukan data dan jangan ditambahkan sebagai baris.'],['Kunci','Kode dan nama terkunci/abu-abu. Jangan ubah header, _meta, atau menambah kode.'],['Formula','Tidak dieksekusi. Hanya nilai cache dibaca; formula tanpa cache ditolak. Isi nilai biasa dianjurkan.'],['Alur','Unggah → pratinjau → Terapkan ke draft. Tidak pernah otomatis submit/approved.'],...def.columns.map(c=>[c.label,c.text?'Teks mentah, bukan formula':c.integer?'Bilangan bulat nonnegatif; satuan sesuai label dan petunjuk form':c.label.includes('%')?'Satuan persen; nilai laporan apa adanya':'Satuan sesuai label; desimal diperbolehkan'])]},{name:'Data',locked:2,rows:[['Kode','Nama',...def.columns.map(c=>c.label)],...entities.map(e=>[e.code,e.label,...def.columns.map(()=>null)])]},{name:'_meta',hidden:true,rows:[['form',req.domain.name],['version',version],['schema_hash',hash],['context',JSON.stringify(ctx)]]}]);
  assertTemplateBytes(bytes);await actor(req,'template_download',c=>audit(c,'template_download',req,ctx,{rows:entities.length,result:'generated'}));checkAbort(req);res.set('X-Template-SHA256',createHash('sha256').update(bytes).digest('hex')).type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').attachment(req.domain.name+'-template.xlsx').send(bytes);
 }));
 r.post('/:form/upload',gate('upload'),run(express.raw({type:'multipart/form-data',limit:MAX_FILE+16384}),async(req,res)=>{
  const {ctx,entities}=await context(req),name=req.domain.name,def=formDefinitions[name];req.excelContext=ctx;
  const book=await work(req,'parse',multipartFile(req));
  const meta=Object.fromEntries((book._meta?.rows??[]).filter(Boolean).map(row=>[row[0]?.value,row[1]?.value]));
  if(!book._meta?.hidden||Object.keys(book).length!==3||!book.Petunjuk||!book.Data||meta.form!==name||Number(meta.version)!==excelForms[name].version||meta.schema_hash!==templateHash(name))throw new HttpError(422,'Template lama atau skema tidak cocok, unduh ulang template.');
  let uploaded;try{uploaded=JSON.parse(meta.context);}catch{throw new HttpError(422,'Periode template tidak valid, unduh ulang.');}if(digest(uploaded)!==digest(ctx))throw new HttpError(422,'Periode template berbeda dengan pilihan form, unduh ulang.');
  const header=book.Data.rows[0]?.map(c=>c?.value);if(JSON.stringify(header)!==JSON.stringify(['Kode','Nama',...def.columns.map(c=>c.label)]))throw new HttpError(422,'Header template berubah, unduh ulang.');
  // Saving in desktop writers can retain styled empty rows and omit other rows.
  // Count actual input rows; the parser still bounds every physical row to 502.
  const hasContent=cells=>cells?.some(c=>c?.error||c?.value!==null&&c?.value!==undefined&&String(c.value).trim()!=='');
  const source=book.Data.rows.slice(1),populated=source.filter(hasContent).length;if(!populated||populated>entities.length)throw new HttpError(422,'Jumlah baris template tidak sesuai batas master.');
  const codes=new Map();for(const cells of source){if(!hasContent(cells))continue;const code=String(cells[0]?.value??'');codes.set(code,(codes.get(code)??0)+1);}
  const rows=[],issues=[];
  for(let index=0;index<source.length;index++){const cells=source[index];if(!hasContent(cells))continue;const number=index+2,code=String(cells[0]?.value??''),entity=entities.find(e=>e.code===code),errors=[];
   const add=(col,message)=>errors.push({row:number,column:col,message});if(!entity)add('Kode','Kode tidak dikenal.');if(codes.get(code)>1)add('Kode','Kode duplikat; semua baris duplikat ditolak.');if(cells[0]?.error)add('Kode',cells[0].error);if(cells.length>def.columns.length+2)add('Kolom','Kolom di luar template tidak diizinkan.');
   const values={...ctx,periode_akademik_id:ctx.periode_akademik_id??null,...entity?.values};
   for(const [i,col]of def.columns.entries()){const cell=cells[i+2],raw=cell?.value;if(cell?.error){add(col.label,cell.error);continue;}const parsed=raw===null||raw===undefined||String(raw).trim()==='-'?{value:null}:typeof raw==='number'&&!col.text&&!col.date?{value:raw}:parseCell(raw,col);if(parsed.error)add(col.label,parsed.error);else values[col.key]=parsed.value;}
   if(!errors.length)try{const checked=validate(req.domain,values);await validateReferences(guarded(pool,req),req.domain,checked);rows.push({row:number,code,label:entity.label,values:checked});}catch(e){checkAbort(req);if(!(e instanceof HttpError))throw new HttpError(503,'Validasi sementara tidak tersedia. Coba lagi.','EXCEL_VALIDATION_UNAVAILABLE');for(const field of e.fields??[{field:'Baris',message:e.message}])add(def.columns.find(c=>c.key===field.field)?.label??field.field,field.message);}
   issues.push(...errors);
  }
  const preview=await actor(req,'template_upload',async c=>{await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['excel-preview:'+req.user.id+':'+name]);let overwritten=0;const snapshot={};for(const row of rows){const old=await current(c,req,row.values);snapshot[row.code]=old.map(x=>[x.id,x.row_version,x.status]);row.before=Object.fromEntries(def.columns.map(col=>[col.key,old[0]?.[col.key]??null]));row.overwritten_cells=old.length?def.columns.filter(col=>String(row.before[col.key]??'')!==String(row.values[col.key]??'')).length:0;overwritten+=row.overwritten_cells;row.warnings=warnings(name,row.values);if(old.some(x=>x.status==='submitted')){issues.push({row:row.row,column:'Status',message:'Data submitted terkunci. Tunggu review sebelum menerapkan.'});row.blocked=true;}}
   await c.query("UPDATE form_upload_preview SET status='expired',rows='[]'::jsonb,issues='[]'::jsonb,snapshot='{}'::jsonb WHERE user_id=$1 AND domain=$2 AND status='preview' AND (expires_at<=now() OR id IN (SELECT id FROM form_upload_preview WHERE user_id=$1 AND domain=$2 AND status='preview' AND expires_at>now() ORDER BY created_at DESC,id DESC OFFSET 2))",[req.user.id,name]);
   const id=randomUUID();await c.query('INSERT INTO form_upload_preview(id,user_id,domain,context,schema_hash,rows,issues,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,req.user.id,name,ctx,templateHash(name),JSON.stringify(rows),JSON.stringify(issues),snapshot]);await audit(c,'template_upload',req,ctx,{rows:source.length,valid:rows.filter(x=>!x.blocked).length,errors:issues.length,warnings:rows.reduce((n,x)=>n+x.warnings.length,0),overwritten_cells:overwritten,result:'preview'});return {id,rows,issues,overwritten_cells:overwritten,has_existing:Object.values(snapshot).some(x=>x.length)};});
  req.excelUploadAudited=true;
  res.json({data:preview});
 }));
 r.post('/:form/apply',gate('apply'),run(express.json({limit:'600kb'}),async(req,res)=>{const body=parse(z.object({preview_id:z.string().uuid(),valid_only:z.boolean().default(false),confirm_overwrite:z.boolean().default(false)}).strict(),req.body);
  const out=await actor(req,'template_apply',async c=>{const p=(await c.query('SELECT * FROM form_upload_preview WHERE id=$1 AND user_id=$2 AND domain=$3 FOR UPDATE',[body.preview_id,req.user.id,req.domain.name])).rows[0];if(!p||p.status!=='preview'||new Date(p.expires_at)<=new Date())throw new HttpError(409,'Pratinjau kedaluwarsa/sudah diterapkan. Unggah ulang.');if(p.schema_hash!==templateHash(req.domain.name))throw new HttpError(409,'Template lama, unduh ulang.');if(p.issues.length&&!body.valid_only)throw new HttpError(422,'Ada error. Pilih secara eksplisit hanya baris valid atau batalkan.');const rows=p.rows.filter(x=>!x.blocked);if(!rows.length)throw new HttpError(422,'Tidak ada baris valid untuk diterapkan.');
   const result=[];for(const row of rows){await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[req.domain.name+JSON.stringify(req.domain.keys.map(k=>row.values[k]))]);const old=await current(c,req,row.values);if(digest(old.map(x=>[x.id,x.row_version,x.status]))!==digest(p.snapshot[row.code]))throw new HttpError(409,'Data berubah sejak pratinjau. Unggah ulang untuk membandingkan.');if(old.length&&!body.confirm_overwrite)throw new HttpError(409,'Konfirmasi diperlukan sebelum menimpa sel draft atau membuat revisi approved.');if(old.some(x=>x.status==='submitted'))throw new HttpError(409,'Data submitted terkunci.');
    let draft=old[0];if(draft?.status==='approved')draft=await revision(c,req.domain,req,draft.id,draft.row_version);result.push(draft?await patchDraft(c,req.domain,req,draft.id,{...row.values,row_version:draft.row_version}):await createDraft(c,req.domain,req,row.values));
   }await c.query("UPDATE form_upload_preview SET status='applied',rows='[]'::jsonb,issues='[]'::jsonb,snapshot='{}'::jsonb WHERE id=$1 AND user_id=$2",[p.id,req.user.id]);await audit(c,'template_apply',req,p.context,{rows:result.length,errors:p.issues.length,result:'draft'});return result;});res.json({data:out});
 }));
 r.post('/:form/upload/cancel',gate('cancel'),run(express.json({limit:'600kb'}),async(req,res)=>{
  const b=parse(z.object({preview_id:z.string().uuid()}).strict(),req.body);
  await actor(req,'template_cancel',async c=>{const p=(await c.query('SELECT * FROM form_upload_preview WHERE id=$1 AND user_id=$2 AND domain=$3 FOR UPDATE',[b.preview_id,req.user.id,req.domain.name])).rows[0];if(!p)throw new HttpError(404,'Pratinjau tidak ditemukan.');if(p.status!=='preview')throw new HttpError(409,'Pratinjau sudah tidak aktif.');await c.query("UPDATE form_upload_preview SET status='cancelled',rows='[]',issues='[]',snapshot='{}' WHERE id=$1",[p.id]);await audit(c,'template_cancel',req,p.context,{rows:p.rows.length,result:'cancelled'});});res.json({data:{cancelled:true}});
 }));
 return r;
}
