import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { roles,requireLogin,parse,validId,HttpError,visibility } from '../middleware/security.js';
import { withActor } from '../services/data.js';
import { domains } from '../validators/domains.js';
const id=z.union([z.string().regex(/^[1-9]\d*$/),z.number().int().positive()]);
const nullableId=id.nullable();const text=z.string().trim().min(1).max(2000);
const password=z.string().min(12).max(72).refine(s=>Buffer.byteLength(s)<=72,'Maksimal 72 byte');
const userRoles=z.enum(['admin','viewer','baa','ppa','bsdm','bpka','bku','bkm','lppm','pjm','prp','kerjasama']);
const userFields={nama:text,email:z.string().email().transform(s=>s.toLowerCase()),role:userRoles,unit_id:nullableId,aktif:z.boolean()};
export function adminRoutes(pool){const r=Router();r.use(roles('admin'));
  r.get('/formulir',async(req,res)=>res.json({data:(await pool.query('SELECT * FROM definisi_formulir ORDER BY domain')).rows}));
  r.patch('/formulir/:domain',async(req,res)=>{const b=parse(z.object({perlu_verifikasi:z.boolean()}).strict(),req.body);
    const out=await withActor(pool,req,'form_policy_update',async c=>(await c.query('UPDATE definisi_formulir SET perlu_verifikasi=$2,updated_by=$3 WHERE domain=$1 RETURNING *',[req.params.domain,b.perlu_verifikasi,req.user.id])).rows[0]);
    if(!out)throw new HttpError(404,'Formulir tidak tersedia.');res.json({data:out});});
  r.get('/users',async(req,res)=>res.json({data:(await pool.query('SELECT id,nama,email,role,unit_id,aktif,must_change_password,last_login FROM users WHERE NOT is_system ORDER BY id LIMIT 200')).rows}));
  r.post('/users',async(req,res)=>{const b=parse(z.object({...userFields,password}).strict(),req.body);
    await validUser(pool,b);const hash=await bcrypt.hash(b.password,12);
    res.status(201).json({data:await withActor(pool,req,'user_create',async c=>(await c.query(`INSERT INTO users(nama,email,role,unit_id,aktif,password_hash) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,nama,email,role,unit_id,aktif`,[b.nama,b.email,b.role,b.unit_id,b.aktif,hash])).rows[0])});});
  r.patch('/users/:id',async(req,res)=>{const b=parse(z.object(userFields).partial().strict(),req.body);if(!Object.keys(b).length)throw new HttpError(422,'Tidak ada perubahan.');
    res.json({data:await withActor(pool,req,'user_update',async c=>{
      const old=(await c.query('SELECT * FROM users WHERE id=$1 AND NOT is_system FOR UPDATE',[validId(req.params.id)])).rows[0];if(!old)throw new HttpError(404,'User tidak tersedia.');await validUser(c,{...old,...b});
      if(String(old.id)===String(req.user.id)&&(b.aktif===false||b.role&&b.role!=='admin'))throw new HttpError(409,'Tidak dapat menonaktifkan/menurunkan role sendiri.');
      const keys=Object.keys(b);return (await c.query(`UPDATE users SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')},session_version=session_version+1 WHERE id=$${keys.length+1} AND NOT is_system RETURNING id,nama,email,role,unit_id,aktif`,[...Object.values(b),old.id])).rows[0];
    })});});
  r.post('/users/:id/reset-password',async(req,res)=>{const b=parse(z.object({password}).strict(),req.body),hash=await bcrypt.hash(b.password,12);
    const result=await withActor(pool,req,'password_reset',async c=>(await c.query('UPDATE users SET password_hash=$2,must_change_password=true,session_version=session_version+1 WHERE id=$1 AND NOT is_system RETURNING id',[validId(req.params.id),hash])).rows[0]);
    if(!result)throw new HttpError(404,'User tidak tersedia.');res.json({data:result});});
  r.get('/audit',async(req,res)=>{const b=parse(z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().nonnegative().default(0),user_id:id.optional(),tabel:text.optional(),mulai:z.iso.datetime({offset:true}).optional(),selesai:z.iso.datetime({offset:true}).optional()}).strict(),req.query);
    res.json({data:(await pool.query('SELECT * FROM audit_log WHERE ($1::bigint IS NULL OR user_id=$1) AND ($2::text IS NULL OR tabel=$2) AND ($5::timestamptz IS NULL OR waktu>=$5) AND ($6::timestamptz IS NULL OR waktu<=$6) ORDER BY id DESC LIMIT $3 OFFSET $4',[b.user_id??null,b.tabel??null,b.limit,b.offset,b.mulai??null,b.selesai??null])).rows});});
  const configs={
    units:['unit',z.object({kode:z.string().regex(/^[A-Z][A-Z0-9_]*$/).nullable(),nama:text,nama_terkonfirmasi:z.boolean(),aktif:z.boolean()}).strict()],
    'domain-units':['domain_unit',z.object({unit_id:id}).strict()],
    'visibilitas-modul':['visibilitas_modul',z.object({akses:z.enum(['public','authenticated']),aktif:z.boolean()}).strict()]};
  for(const [path,[table,schema]] of Object.entries(configs)){
    r.get('/'+path,async(req,res)=>res.json({data:(await pool.query(`SELECT * FROM ${table} ORDER BY ${table==='domain_unit'?'domain':'id'}`)).rows}));
    if(path==='units')r.post('/'+path,async(req,res)=>{const b=parse(schema,req.body),keys=Object.keys(b);res.status(201).json({data:await withActor(pool,req,'unit_create',async c=>(await c.query(`INSERT INTO unit(${keys}) VALUES(${keys.map((_,i)=>`$${i+1}`)}) RETURNING *`,Object.values(b))).rows[0])});});
    r.patch('/'+path+'/:key',async(req,res)=>{const b=parse(schema.partial(),req.body);if(!Object.keys(b).length)throw new HttpError(422,'Tidak ada perubahan.');
      const key=path==='domain-units'?'domain':path==='visibilitas-modul'?'kode_modul':'id',value=key==='id'?validId(req.params.key):req.params.key;
      const keys=Object.keys(b);const out=await withActor(pool,req,'config_update',async c=>(await c.query(`UPDATE ${table} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} ${table==='visibilitas_modul'?',updated_by=$'+(keys.length+2):''} WHERE ${key}=$${keys.length+1} RETURNING *`,[...Object.values(b),value,...(table==='visibilitas_modul'?[req.user.id]:[])])).rows[0]);
      if(!out)throw new HttpError(404,'Konfigurasi tidak ditemukan.');res.json({data:out});});
  }return r;
}
async function validUser(pool,b){if(!['admin','viewer'].includes(b.role)&&!b.unit_id)throw new HttpError(422,'Role unit membutuhkan unit_id.');
  if(b.unit_id&&!((await pool.query('SELECT id FROM unit WHERE id=$1 AND aktif',[b.unit_id])).rows.length))throw new HttpError(422,'Unit tidak aktif.');}
export function masterRoutes(pool,globalPublic){const r=Router();
  const configs={prodi:['prodi',['admin','baa'],z.object({kode:text,urutan:z.number().int().positive(),nama:text,jenjang:z.enum(['D3','S1','S2','PROFESI']),kode_dikti:text.nullable().optional(),fakultas:text.nullable().optional(),aktif:z.boolean().default(true)}).strict()],
    'periode-akademik':['periode_akademik',['admin'],z.object({kode:text,tahun_ajaran:text,semester:z.enum(['Gasal','Genap']),urutan:z.number().int().positive(),mulai:z.iso.date().nullable().optional(),selesai:z.iso.date().nullable().optional(),aktif:z.boolean()}).strict()],
    'periode-laporan':['periode_laporan',['admin'],z.object({kode:text,tahun:z.number().int().min(2000),semester:z.enum(['S1','S2']),mulai:z.iso.date(),selesai:z.iso.date(),urutan:z.number().int().positive(),aktif:z.boolean()}).strict()]};
  for(const [path,[table,allowed,schema]] of Object.entries(configs)){
    r.get('/'+path,visibility(pool,globalPublic,['prodi']),async(req,res)=>res.json({data:(await pool.query(`SELECT * FROM ${table} ORDER BY urutan`)).rows}));
    for(const method of ['post','patch'])r[method]('/'+path+(method==='patch'?'/:id':''),roles(...allowed),async(req,res)=>{
      const b=parse(method==='post'?schema:schema.partial(),req.body),keys=Object.keys(b);if(!keys.length)throw new HttpError(422,'Tidak ada perubahan.');
      const out=await withActor(pool,req,'master_'+method,async c=>{if(method==='post')return (await c.query(`INSERT INTO ${table}(${keys}) VALUES(${keys.map((_,i)=>`$${i+1}`)}) RETURNING *`,Object.values(b))).rows[0];
        return (await c.query(`UPDATE ${table} SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${keys.length+1} RETURNING *`,[...Object.values(b),validId(req.params.id)])).rows[0];});if(!out)throw new HttpError(404,'Master tidak ditemukan.');res.status(method==='post'?201:200).json({data:out});});
  }return r;
}
export function qualityRoutes(pool,globalPublic){const r=Router();r.use(visibility(pool,globalPublic,['data_quality_flag']),requireLogin);
  r.get('/',async(req,res)=>{const b=parse(z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().nonnegative().default(0),resolved:z.enum(['true','false']).optional(),unit_id:id.optional(),tabel:text.optional()}).strict(),req.query);
    const published=Object.values(domains).map(d=>`EXISTS(SELECT 1 FROM ${d.table} x WHERE f.tabel='${d.table}' AND x.id=f.row_id AND x.status='approved' AND x.is_current_approved)`).join(' OR ');
    res.json({data:(await pool.query(`SELECT f.id,f.kode,f.tabel,f.row_id,f.pesan,f.severity,f.resolved,f.created_at,
    jsonb_build_object('dokumen',primary_source.dokumen,'nomor_tabel',primary_source.nomor_tabel,'halaman_pdf',primary_source.halaman_pdf,'halaman_cetak',primary_source.halaman_cetak) AS sumber_utama,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('sumber',s.kode,'nilai',fs.nilai_numerik,'satuan',fs.satuan,'halaman_pdf',s.halaman_pdf,'halaman_cetak',s.halaman_cetak)) FROM data_quality_flag_sumber fs JOIN sumber_data s ON s.id=fs.sumber_id WHERE fs.flag_id=f.id),'[]'::jsonb) AS sumber
    FROM data_quality_flag f LEFT JOIN sumber_data primary_source ON primary_source.id=f.sumber_id WHERE (f.row_id IS NULL OR ${published}) AND ($1::boolean IS NULL OR f.resolved=$1) AND ($2::bigint IS NULL OR f.unit_id=$2) AND ($3::text IS NULL OR f.tabel=$3) ORDER BY f.id LIMIT $4 OFFSET $5`,[b.resolved===undefined?null:b.resolved==='true',b.unit_id??null,b.tabel??null,b.limit,b.offset])).rows,meta:{limit:b.limit,offset:b.offset}});});
  r.post('/:id/resolve',roles('admin','prp'),async(req,res)=>{const b=parse(z.object({note:text}).strict(),req.body);const out=await withActor(pool,req,'quality_resolve',async c=>(await c.query('UPDATE data_quality_flag SET resolved=true,resolved_by=$2,resolved_at=now(),resolution_note=$3 WHERE id=$1 RETURNING id,resolved',[validId(req.params.id),req.user.id,b.note])).rows[0]);if(!out)throw new HttpError(404,'Flag tidak ditemukan.');res.json({data:out});});return r;
}
