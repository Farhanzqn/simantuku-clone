import {ikuCases} from './iku-cases.js';
import {peminatCases} from './pmb-peminat-cases.js';
import {bulkVerificationCases} from './bulk-verification-cases.js';
import {xlsxCompatibilityCases} from './xlsx-compatibility-cases.js';
import {simpleCases} from './excel-simple-cases.js';
import {getDomain,validate} from '../validators/domains.js';
import {makeWorkbook,readWorkbook} from '../services/form-xlsx.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { createPool,createAppPool } from '../services/db.js';
import { migrate } from '../../db/scripts/migrate.js';
import { seed } from '../../db/scripts/seed-home-public.js';
import { createApp } from '../app.js';
import {safeNext} from '../../static-web/assets/js/navigation.js';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {formDefinitions} from '../../static-web/assets/js/input-schema.js';

test('Fase 2: HTTP API dengan app_user dan PostgreSQL session',async t=>{
  const database=process.env.PGTEST_DATABASE;assert.ok(database?.endsWith('_test')&&database!==process.env.PGDATABASE);
  const owner=createPool(database);await migrate(owner);await seed(owner);
  // Suite memakai banyak akun fixture; uji rate limit tersendiri tetap memakai limit=1.
  const pool=createAppPool(database),app=createApp({pool,passwordEnv:{},excelEnv:{EXCEL_UPLOAD_PER_MINUTE:500,EXCEL_DOWNLOAD_PER_MINUTE:500,EXCEL_APPLY_PER_MINUTE:500,EXCEL_CANCEL_PER_MINUTE:500,EXCEL_GLOBAL_PER_MINUTE:5000},loginLimit:50,secret:randomBytes(48).toString('hex')});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`,run=randomUUID().replaceAll('-',''),pw=randomBytes(18).toString('hex'),users={};
  // Fixtures sendiri, tanpa mereset/mengubah user seed atau data development.
  for(const role of ['admin','prp','baa','bsdm','ppa','bpka','viewer','pjm','lppm','bkm','kerjasama','bku']){
    const unit=role==='kerjasama'?(await owner.query("SELECT unit_id AS id FROM domain_unit WHERE domain='kerjasama'")).rows[0].id:(await owner.query('SELECT id FROM unit WHERE kode=$1',[role.toUpperCase()])).rows[0]?.id??null;
    users[role]=(await owner.query(`INSERT INTO users(nama,email,password_hash,role,unit_id,must_change_password) VALUES($1,$2,$3,$4,$5,false) RETURNING id,email`,[role,`${role}-${run}@test.invalid`,await bcrypt.hash(pw,4),role,unit])).rows[0];
  }
  const academic=(await owner.query(`INSERT INTO periode_akademik(kode,tahun_ajaran,semester,urutan,aktif) VALUES($1,'2098/2099','Genap',(SELECT max(urutan)+1 FROM periode_akademik),false) RETURNING id`,['test-'+run])).rows[0].id;
  const report=(await owner.query(`INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,coalesce(max(tahun) FILTER(WHERE tahun>=2099),2098)+1,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id`,['test-'+run])).rows[0].id;
  const prodi=(await owner.query('SELECT id FROM prodi ORDER BY id LIMIT 1')).rows[0].id;
  function client(){return {cookie:'',csrf:null,async call(path,method='GET',body,token=true){if(method==='POST'&&/^\/verification\/.+\/(approve|reject)$/.test(path))body={review_note:'Catatan pengujian',...body};const headers={};if(this.cookie)headers.cookie=this.cookie;if(method!=='GET'){headers['content-type']='application/json';if(token&&this.csrf)headers['x-csrf-token']=this.csrf;}
    const response=await fetch(base+'/api'+path,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});const c=response.headers.get('set-cookie');if(c)this.cookie=c.split(';')[0];const data=await response.json();return {status:response.status,body:data,headers:response.headers};},
    async login(role){const a=await this.call('/auth/csrf');this.csrf=a.body.data.csrf;const r=await this.call('/auth/login','POST',{email:users[role].email,password:pw});assert.equal(r.status,200);this.csrf=r.body.data.csrf;return r;}};}
  const anonymous=client(),baa=client(),bsdm=client(),prp=client(),admin=client(),viewer=client(),bpka=client();
  try{
    await t.test('Role aplikasi tidak punya DDL, akses owner atau mutasi audit',async()=>{
      const role=(await pool.query('SELECT current_user AS u,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(role.u,'app_user');assert.equal(role.rolsuper,false);
      for(const sql of ['CREATE TABLE public.app_ddl_probe(id int)','CREATE TEMP TABLE app_temp_probe(id int)','UPDATE audit_log SET aksi=aksi','DELETE FROM audit_log','INSERT INTO audit_log(aksi,tabel) VALUES (\'tamper\',\'x\')','SELECT * FROM schema_migrations'])await assert.rejects(pool.query(sql),{code:'42501'});
    });
    await t.test('CSRF juga melindungi login; session tersimpan PG dan cookie aman',async()=>{
      await baa.call('/auth/csrf');const r=await baa.call('/auth/login','POST',{email:users.baa.email,password:pw},false);assert.equal(r.status,403);
      const login=await baa.login('baa');assert.match(login.headers.get('set-cookie'),/HttpOnly/i);assert.match(login.headers.get('set-cookie'),/SameSite=Lax/i);
      assert.equal(login.headers.get('x-content-type-options'),'nosniff');assert.ok(login.headers.get('content-security-policy'));
      assert.ok((await owner.query("SELECT count(*)::int AS n FROM session WHERE sess->>'userId'=$1",[String(users.baa.id)])).rows[0].n>0);
      await bsdm.login('bsdm');await admin.login('admin');await prp.login('prp');await viewer.login('viewer');await bpka.login('bpka');
      assert.equal((await baa.call('/data/mahasiswa-aktif','POST',{},false)).status,403);
      const malformed=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:'{"password":"rahasia-json-test"'});assert.equal(malformed.status,400);
      const errorText=await malformed.text();assert.ok(!errorText.includes('rahasia-json-test'));assert.ok(JSON.parse(errorText).error.request_id);
    });
    await t.test('Beranda: pengecualian tendik hanya total institusi approved/current',async()=>{
      const path='/dashboard/tendik-total',scoped=path+`?periode_laporan_id=${report}`;
      const read=async()=>{const r=await anonymous.call(scoped);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual(Object.keys(r.body),['data']);assert.deepEqual(Object.keys(r.body.data),['total']);return r.body.data.total;};
      const source=(await owner.query("SELECT jumlah FROM v_dashboard_pegawai_ringkasan WHERE kategori='tendik' AND periode_laporan_id=(SELECT id FROM periode_laporan WHERE kode='2026-S1')")).rows[0];
      assert.deepEqual((await anonymous.call(path)).body,{data:{total:source.jumlah}});
      assert.equal(await read(),null);
      for(const route of ['/dashboard/tendik','/dashboard/pegawai-internal','/dashboard/formasi','/dashboard/pegawai-formasi','/dashboard/pegawai-pergerakan'])assert.equal((await anonymous.call(route)).status,401,route);
      assert.equal((await anonymous.call(path+'?unit_id=1')).status,422);
      assert.equal((await anonymous.call(path+'?kategori=pkwt')).status,422);
      try{
      let row=(await bsdm.call('/data/pegawai-ringkasan','POST',{periode_laporan_id:report,periode_akademik_id:academic,kategori:'tendik',jumlah:null})).body.data;assert.ok(row?.id);
      assert.equal(await read(),null);
      row=(await bsdm.call(`/data/pegawai-ringkasan/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal(await read(),null);
      row=(await prp.call(`/verification/pegawai-ringkasan/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;assert.equal(await read(),null);
      let revision=(await bsdm.call(`/data/pegawai-ringkasan/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
      revision=(await bsdm.call(`/data/pegawai-ringkasan/${revision.id}`,'PATCH',{row_version:revision.row_version,jumlah:0})).body.data;
      revision=(await bsdm.call(`/data/pegawai-ringkasan/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;assert.equal(await read(),null);
      revision=(await prp.call(`/verification/pegawai-ringkasan/${revision.id}/approve`,'POST',{row_version:revision.row_version})).body.data;assert.equal(await read(),0);
      revision=(await bsdm.call(`/data/pegawai-ringkasan/${revision.id}/revision`,'POST',{row_version:revision.row_version})).body.data;
      revision=(await bsdm.call(`/data/pegawai-ringkasan/${revision.id}`,'PATCH',{row_version:revision.row_version,jumlah:137})).body.data;
      revision=(await bsdm.call(`/data/pegawai-ringkasan/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;assert.equal(await read(),0);
      revision=(await prp.call(`/verification/pegawai-ringkasan/${revision.id}/approve`,'POST',{row_version:revision.row_version})).body.data;assert.equal(await read(),137);
      assert.deepEqual((await viewer.call(scoped)).body,{data:{total:137}});
      const closed=createApp({pool,publicDashboard:false,secret:randomBytes(48).toString('hex')});const privateServer=closed.listen(0,'127.0.0.1');await new Promise(r=>privateServer.once('listening',r));
      try{assert.equal((await fetch(`http://127.0.0.1:${privateServer.address().port}/api${path}`)).status,401);}finally{closed.locals.store.close();await new Promise(r=>privateServer.close(r));}
      }finally{await owner.query("DELETE FROM pegawai_ringkasan WHERE periode_laporan_id=$1 AND kategori='tendik'",[report]);}
    });
    const ppaPeminat=client();await ppaPeminat.login('ppa');
    await peminatCases(t,{owner,pool,anonymous,ppa:ppaPeminat,baa,prp,report,academic});
    await bulkVerificationCases(t,{owner,pool,prp,admin,baa,anonymous,users,report});
    await ikuCases(t,{owner,base,anonymous,prp,baa,admin,viewer,report});
    await t.test('HTML privat redirect login, JSON tetap 401, tujuan aman dan cache privat no-store',async()=>{
      for(const path of ['/pegawai-formasi.html','/keuangan.html','/statistik-tendik.html','/ami.html','/monitoring-kpi.html','/kualitas-data.html','/input/baa.html','/verifikasi.html','/admin/users.html','/admin/audit.html']){
        const html=await fetch(base+path,{redirect:'manual',headers:{accept:'text/html'}});assert.equal(html.status,302,path);assert.equal(html.headers.get('location'),'/login.html?next='+encodeURIComponent(path));assert.equal(html.headers.get('cache-control'),'no-store');
        const json=await fetch(base+path,{redirect:'manual',headers:{accept:'application/json'}});assert.equal(json.status,401,path);assert.equal((await json.json()).error.code,'LOGIN_REQUIRED');assert.equal(json.headers.get('cache-control'),'no-store');
        const logged=await fetch(base+path,{headers:{cookie:admin.cookie,accept:'text/html'}});assert.equal(logged.status,200,path);assert.equal(logged.headers.get('cache-control'),'no-store',path);
      }
      const encoded=await fetch(base+'/pegawai-%66ormasi.html?tahun=2026',{headers:{accept:'text/html'},redirect:'manual'});assert.equal(encoded.status,302);assert.equal(new URL(encoded.headers.get('location'),base).searchParams.get('next'),'/pegawai-formasi.html?tahun=2026');
      const api=await fetch(base+'/api/dashboard/formasi',{headers:{accept:'text/html'},redirect:'manual'});assert.equal(api.status,401);assert.equal((await api.json()).error.code,'LOGIN_REQUIRED');assert.equal(api.headers.get('cache-control'),'no-store');
      for(const next of ['//evil.com','https://evil.com','/\\evil.com','/%2f%2fevil.com','/%5cevil.com'])assert.equal(safeNext(next),'/index.html');assert.equal(safeNext('/pegawai-formasi.html?tahun=2026'),'/pegawai-formasi.html?tahun=2026');
      // Header aset existing sudah no-store dari middleware global; jangan diubah.
      const asset=await fetch(base+'/assets/js/api.js');assert.equal(asset.status,200);assert.equal(asset.headers.get('cache-control'),'no-store');
    });
    await t.test('BAA dilarang tulis BSDM/PMB dan unit_id body ditolak',async()=>{
      assert.equal((await baa.call('/data/dosen','POST',{})).status,403);assert.equal((await baa.call('/data/mahasiswa-baru','POST',{})).status,403);
      assert.equal((await viewer.call('/data/mahasiswa-aktif','POST',{})).status,403);
      assert.equal((await baa.call('/data/mahasiswa-aktif','POST',{periode_laporan_id:report,periode_akademik_id:academic,prodi_id:prodi,total:10,perempuan:2,unit_id:999})).status,422);
      assert.equal((await baa.call('/data/mahasiswa-aktif','POST',{periode_laporan_id:report,periode_akademik_id:academic,prodi_id:prodi,status_mhs:'cuti',total:1,perempuan:2})).status,201);
    });
    let draft;
    await t.test('Draft/submitted/rejected tidak tampil dashboard, approved saja',async()=>{
      draft=(await baa.call('/data/mahasiswa-aktif','POST',{periode_laporan_id:report,periode_akademik_id:academic,prodi_id:prodi,total:10,perempuan:2})).body.data;assert.ok(draft?.id);
      const path=`/dashboard/mahasiswa?periode_laporan_id=${report}`;assert.deepEqual((await anonymous.call(path)).body.data,[]);
      assert.equal((await bsdm.call('/data/mahasiswa-aktif/'+draft.id)).status,404);
      draft=(await baa.call(`/data/mahasiswa-aktif/${draft.id}/submit`,'POST',{row_version:draft.row_version})).body.data;
      assert.deepEqual((await anonymous.call(path)).body.data,[]);
      draft=(await prp.call(`/verification/mahasiswa-aktif/${draft.id}/reject`,'POST',{row_version:draft.row_version,review_note:'Lengkapi data'})).body.data;
      assert.deepEqual((await anonymous.call(path)).body.data,[]);
      draft=(await baa.call(`/data/mahasiswa-aktif/${draft.id}`,'PATCH',{row_version:draft.row_version,total:11})).body.data;
      draft=(await baa.call(`/data/mahasiswa-aktif/${draft.id}/submit`,'POST',{row_version:draft.row_version})).body.data;
      draft=(await prp.call(`/verification/mahasiswa-aktif/${draft.id}/approve`,'POST',{row_version:draft.row_version})).body.data;assert.equal(draft.status,'approved');
      assert.equal((await anonymous.call(path)).body.data[0].total,11);
      const revision=(await baa.call(`/data/mahasiswa-aktif/${draft.id}/revision`,'POST',{row_version:draft.row_version})).body.data;
      assert.equal(revision.status,'draft');assert.equal((await anonymous.call(path)).body.data[0].total,11);
      assert.equal((await baa.call(`/data/mahasiswa-aktif/${revision.id}`,'PATCH',{row_version:999,total:999})).status,409);
      const submitted=(await baa.call(`/data/mahasiswa-aktif/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
      assert.equal((await baa.call(`/data/mahasiswa-aktif/${submitted.id}`,'PATCH',{row_version:submitted.row_version,total:999})).status,409);
      const approvals=await Promise.all([prp,admin].map(c=>c.call(`/verification/mahasiswa-aktif/${submitted.id}/approve`,'POST',{row_version:submitted.row_version})));
      assert.deepEqual(approvals.map(r=>r.status).sort(),[200,409]);
    });
    await t.test('Four-eyes, override admin beralasan dan audit khusus',async()=>{
      const indikator=(await owner.query('SELECT id FROM kpi_indikator ORDER BY id LIMIT 1')).rows[0].id;
      let row=(await prp.call('/data/kpi-input','POST',{periode_laporan_id:report,indikator_id:indikator,kode_input:run,nilai_numerik:198,satuan:'dosen',tanggal_snapshot:'2099-06-30'})).body.data;
      row=(await prp.call(`/data/kpi-input/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
      assert.equal((await prp.call(`/verification/kpi-input/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
      let own=(await admin.call('/data/kpi-input','POST',{periode_laporan_id:report,indikator_id:indikator,kode_input:'admin-'+run,nilai_numerik:1,satuan:'dosen',tanggal_snapshot:'2099-06-30'})).body.data;
      own=(await admin.call(`/data/kpi-input/${own.id}/submit`,'POST',{row_version:own.row_version})).body.data;
      assert.equal((await admin.call(`/verification/kpi-input/${own.id}/approve`,'POST',{row_version:own.row_version})).status,403);
      assert.equal((await admin.call(`/verification/kpi-input/${own.id}/approve`,'POST',{row_version:own.row_version,override:true})).status,403);
      const approved=await admin.call(`/verification/kpi-input/${own.id}/approve`,'POST',{row_version:own.row_version,override:true,override_reason:'Pengecualian terotorisasi untuk tes'});assert.equal(approved.status,200);
      const log=(await owner.query("SELECT aksi,is_override,override_reason FROM audit_log WHERE tabel='kpi_input' AND row_id=$1 ORDER BY id DESC LIMIT 1",[own.id])).rows[0];assert.equal(log.aksi,'approve_override');assert.equal(log.is_override,true);assert.ok(log.override_reason);
    });
    await t.test('Tanggal bisnis PMB tetap sama saat approval/revisi dan BAA hanya membaca approved',async()=>{
      const ppa=client();await ppa.login('ppa');
      let row=(await ppa.call('/data/mahasiswa-baru','POST',{periode_laporan_id:report,periode_akademik_id:academic,prodi_id:prodi,tahun_masuk:2099,tanggal_snapshot:'2099-06-30',target:20,realisasi_daftar_ulang:10})).body.data;
      assert.equal(row.tanggal_snapshot,'2099-06-30');assert.deepEqual((await baa.call(`/data/mahasiswa-baru?periode_laporan_id=${report}`)).body.data,[]);
      row=(await ppa.call(`/data/mahasiswa-baru/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
      row=(await prp.call(`/verification/mahasiswa-baru/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;
      assert.equal((await baa.call(`/data/mahasiswa-baru?periode_laporan_id=${report}`)).body.data.length,1);
      const revised=await ppa.call(`/data/mahasiswa-baru/${row.id}/revision`,'POST',{row_version:row.row_version});assert.equal(revised.status,200);assert.equal(revised.body.data.tanggal_snapshot,'2099-06-30');
    });
    await t.test('Modul internal menolak anonim pada halaman/API walaupun kebijakan keliru publik',async()=>{
      const modules=['tendik','keuangan','kpi','iku','ami','pegawai-internal','data_quality_flag'];
      const policies=(await owner.query('SELECT kode_modul,akses FROM visibilitas_modul WHERE kode_modul=ANY($1::text[])',[modules])).rows;
      assert.ok(policies.every(p=>p.akses==='authenticated'));assert.equal(policies.length,modules.length);
      try{
        await owner.query("UPDATE visibilitas_modul SET akses='public' WHERE kode_modul=ANY($1::text[])",[modules]);
        for(const path of ['/dashboard/keuangan','/dashboard/tendik','/dashboard/pegawai-internal','/dashboard/kpi','/dashboard/ami','/quality-flags']){
          const denied=await anonymous.call(path);assert.equal(denied.status,401,path);assert.equal(denied.headers.get('cache-control'),'no-store');assert.equal((await viewer.call(path)).status,200,path);
        }
        for(const path of ['/keuangan.html','/ke%75angan.html','/statistik-tendik.html','/statistik-%74endik.html','/STATISTIK-TENDIK.HTML','/ami.html','/monitoring-kpi.html','/kualitas-data.html'])assert.equal((await fetch(base+path,{redirect:'manual'})).status,401,path);
        assert.equal((await fetch(base+'/statistik-tendik.html',{headers:{cookie:viewer.cookie},redirect:'manual'})).status,200);
        const staff=await anonymous.call('/dashboard/pegawai');assert.equal(staff.status,200);assert.deepEqual(staff.body.data.map(x=>x.kategori).sort(),['dosen_tetap','dosen_tidak_tetap']);
      }finally{for(const p of policies)await owner.query('UPDATE visibilitas_modul SET akses=$1 WHERE kode_modul=$2',[p.akses,p.kode_modul]);}
      await admin.call('/admin/visibilitas-modul/tendik','PATCH',{aktif:false});
      try{assert.equal((await viewer.call('/dashboard/tendik')).status,403);assert.equal((await fetch(base+'/statistik-tendik.html',{headers:{cookie:viewer.cookie},redirect:'manual'})).status,403);}finally{await admin.call('/admin/visibilitas-modul/tendik','PATCH',{aktif:true});}
    });
    await t.test('D3: BSDM, privasi pegawai/formasi, NULL, reject dan revisi approved',async()=>{
      for(const path of ['/dashboard/formasi','/dashboard/pegawai-pergerakan','/dashboard/pegawai-formasi']){assert.equal((await anonymous.call(path)).status,401);assert.equal((await viewer.call(path)).status,200);}
      for(const path of ['/pegawai-formasi.html','/pegawai-%66ormasi.html'])assert.equal((await fetch(base+path,{redirect:'manual'})).status,401);
      assert.equal((await fetch(base+'/pegawai-formasi.html',{headers:{cookie:viewer.cookie},redirect:'manual'})).status,200);
      assert.equal((await fetch(base+'/input/bsdm.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      const summary=(await viewer.call('/dashboard/pegawai-formasi')).body.data;assert.deepEqual(summary.map(x=>[x.kategori,x.jumlah]),[['dosen_tetap',222],['dosen_tidak_tetap',55],['pkwt',68],['tendik',109]]);
      assert.deepEqual((await anonymous.call('/dashboard/pegawai')).body.data.map(x=>x.kategori).sort(),['dosen_tetap','dosen_tidak_tetap']);
      const policies=(await owner.query("SELECT kode_modul,akses FROM visibilitas_modul WHERE kode_modul IN ('formasi','pegawai-internal')")).rows;
      try{await owner.query("UPDATE visibilitas_modul SET akses='public' WHERE kode_modul IN ('formasi','pegawai-internal')");for(const path of ['/dashboard/formasi','/dashboard/pegawai-pergerakan','/dashboard/pegawai-formasi'])assert.equal((await anonymous.call(path)).status,401);assert.equal((await fetch(base+'/pegawai-formasi.html',{redirect:'manual'})).status,401);}finally{for(const p of policies)await owner.query('UPDATE visibilitas_modul SET akses=$1 WHERE kode_modul=$2',[p.akses,p.kode_modul]);}
      for(const [domain,kategori]of [['formasi','laporan-1'],['pegawai-pergerakan','masuk']]){
        assert.equal((await owner.query('SELECT perlu_verifikasi FROM definisi_formulir WHERE domain=$1',[domain])).rows[0].perlu_verifikasi,true);
        const path=`/dashboard/${domain}?periode_laporan_id=${report}&tahun=2099`,values={periode_laporan_id:report,tahun:2099,kategori,jumlah:8,...(domain==='formasi'?{target:null,capaian_laporan:null,evaluasi:null}:{})};
        assert.equal((await baa.call('/data/'+domain,'POST',values)).status,403);assert.equal((await viewer.call('/data/'+domain,'POST',values)).status,403);
        assert.equal((await bsdm.call('/data/'+domain,'POST',{...values,nip:'privat'})).status,422);assert.equal((await bsdm.call('/data/'+domain,'POST',{...values,unit_id:999})).status,422);assert.equal((await bsdm.call('/data/'+domain,'POST',{...values,jumlah:-1})).status,422);
        let row=(await bsdm.call('/data/'+domain,'POST',values)).body.data;assert.ok(row.id);assert.deepEqual((await viewer.call(path)).body.data,[]);
        row=(await bsdm.call(`/data/${domain}/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal(row.status,'submitted');assert.deepEqual((await viewer.call(path)).body.data,[]);
        row=(await prp.call(`/verification/${domain}/${row.id}/reject`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual((await viewer.call(path)).body.data,[]);
        row=(await bsdm.call(`/data/${domain}/${row.id}`,'PATCH',{row_version:row.row_version,jumlah:9})).body.data;
        row=(await bsdm.call(`/data/${domain}/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
        row=(await prp.call(`/verification/${domain}/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;assert.equal((await viewer.call(path)).body.data[0].jumlah,9);
        if(domain==='formasi'){assert.equal((await viewer.call(path)).body.data[0].target,null);assert.equal((await viewer.call(path)).body.data[0].capaian_hitung,null);}
        const approved=row;row=(await bsdm.call(`/data/${domain}/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
        row=(await bsdm.call(`/data/${domain}/${row.id}`,'PATCH',{row_version:row.row_version,jumlah:null})).body.data;row=(await bsdm.call(`/data/${domain}/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal((await viewer.call(path)).body.data[0].jumlah,9);
        row=(await prp.call(`/verification/${domain}/${row.id}/reject`,'POST',{row_version:row.row_version})).body.data;assert.equal((await viewer.call(path)).body.data[0].jumlah,9);
        row=(await bsdm.call(`/data/${domain}/${row.id}`,'PATCH',{row_version:row.row_version,jumlah:null})).body.data;row=(await bsdm.call(`/data/${domain}/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;row=(await prp.call(`/verification/${domain}/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;
        assert.equal((await viewer.call(path)).body.data[0].jumlah,null);assert.equal(row.versi,approved.versi+1);
      }
    });
    await t.test('D1: BKU, NULL, penurunan negatif, review/reject/revisi dan hanya approved',async()=>{
      const bku=client();await bku.login('bku');const path=`/dashboard/keuangan?periode_laporan_id=${report}`;
      assert.equal((await fetch(base+'/input/bku.html',{headers:{cookie:bku.cookie},redirect:'manual'})).status,200);assert.equal((await fetch(base+'/input/bku.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      assert.equal((await baa.call('/data/keuangan','POST',{})).status,403);assert.equal((await bsdm.call('/data/keuangan','POST',{})).status,403);
      const values={periode_laporan_id:report,tahun:2099,kategori:'arus-kas',realisasi:10,periode_sebelumnya:15,perubahan:-5};
      assert.equal((await bku.call('/data/keuangan','POST',{...values,realisasi:-1})).status,422);assert.equal((await bku.call('/data/keuangan','POST',{...values,capaian_laporan:30})).status,422);
      assert.equal((await bku.call('/data/keuangan','POST',{...values,nama_pegawai:'privat'})).status,422);
      let row=(await bku.call('/data/keuangan','POST',values)).body.data;assert.ok(row?.id);assert.equal(row.target,null);assert.deepEqual((await viewer.call(path)).body.data,[]);
      row=(await bku.call(`/data/keuangan/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual((await viewer.call(path)).body.data,[]);
      row=(await prp.call(`/verification/keuangan/${row.id}/reject`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual((await viewer.call(path)).body.data,[]);
      row=(await bku.call(`/data/keuangan/${row.id}`,'PATCH',{row_version:row.row_version,realisasi:11,perubahan:-4})).body.data;
      row=(await bku.call(`/data/keuangan/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;row=(await prp.call(`/verification/keuangan/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;
      let published=(await viewer.call(path)).body.data[0];assert.equal(Number(published.realisasi),11);assert.equal(Number(published.perubahan),-4);assert.equal(published.target,null);assert.equal(published.satuan,'Rp');assert.ok(!('approved_by' in published));
      let revision=(await bku.call(`/data/keuangan/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
      revision=(await bku.call(`/data/keuangan/${revision.id}`,'PATCH',{row_version:revision.row_version,realisasi:0,perubahan:-15})).body.data;
      revision=(await bku.call(`/data/keuangan/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
      assert.equal(Number((await viewer.call(path)).body.data[0].realisasi),11);
      revision=(await prp.call(`/verification/keuangan/${revision.id}/approve`,'POST',{row_version:revision.row_version})).body.data;
      published=(await viewer.call(path)).body.data[0];assert.equal(Number(published.realisasi),0);assert.equal(Number(published.perubahan),-15);assert.equal(revision.versi,2);
      assert.equal((await bku.call('/data/keuangan','POST',{...values,kategori:'contrat'})).status,422);
      assert.equal((await owner.query("SELECT perlu_verifikasi FROM definisi_formulir WHERE domain='keuangan'")).rows[0].perlu_verifikasi,true);
      const flags=(await viewer.call('/quality-flags?limit=100')).body.data.find(f=>f.kode==='keuangan-kpi-pendapatan-berbeda');assert.ok(flags.sumber.every(s=>s.satuan.startsWith('Rp')));
    });
    await t.test('D2: tiap perspektif KPI memakai approved, reject tetap dan four-eyes',async()=>{
      const path=`/dashboard/kpi?periode_laporan_id=${report}`,indicators=(await owner.query("SELECT DISTINCT ON(perspektif) id,perspektif FROM kpi_indikator WHERE jenis<>'tanggal' ORDER BY perspektif,id")).rows;
      assert.equal(indicators.length,4);let first;
      for(const indicator of indicators){
        const body={periode_laporan_id:report,indikator_id:indicator.id,tanggal_snapshot:'2099-06-30',nilai_numerik:10};
        assert.equal((await baa.call('/data/kpi-capaian','POST',body)).status,403);
        let row=(await prp.call('/data/kpi-capaian','POST',body)).body.data;assert.ok(row?.id);assert.ok(!(await viewer.call(path)).body.data.some(x=>x.perspektif===indicator.perspektif));
        row=(await prp.call(`/data/kpi-capaian/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
        assert.equal((await prp.call(`/verification/kpi-capaian/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
        row=(await admin.call(`/verification/kpi-capaian/${row.id}/reject`,'POST',{row_version:row.row_version})).body.data;assert.ok(!(await viewer.call(path)).body.data.some(x=>x.perspektif===indicator.perspektif));
        row=(await prp.call(`/data/kpi-capaian/${row.id}`,'PATCH',{row_version:row.row_version,nilai_numerik:11})).body.data;row=(await prp.call(`/data/kpi-capaian/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
        assert.ok(!(await viewer.call(path)).body.data.some(x=>x.perspektif===indicator.perspektif));
        row=(await admin.call(`/verification/kpi-capaian/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;if(!first)first=row;
      }
      assert.deepEqual((await viewer.call(path)).body.data.map(x=>x.perspektif).sort(),['A','B','C','D']);
      let revision=(await prp.call(`/data/kpi-capaian/${first.id}/revision`,'POST',{row_version:first.row_version})).body.data;
      revision=(await prp.call(`/data/kpi-capaian/${revision.id}`,'PATCH',{row_version:revision.row_version,nilai_numerik:12})).body.data;revision=(await prp.call(`/data/kpi-capaian/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
      assert.equal(Number((await viewer.call(path)).body.data.find(x=>x.perspektif==='A').nilai_numerik),11);
      await admin.call(`/verification/kpi-capaian/${revision.id}/approve`,'POST',{row_version:revision.row_version});assert.equal(Number((await viewer.call(path)).body.data.find(x=>x.perspektif==='A').nilai_numerik),12);
      assert.equal(Number((await viewer.call('/dashboard/kpi')).body.data.find(x=>x.indikator_kode==='C9').nilai_numerik),59.6);
    });
    await t.test('Visibilitas module/global dipaksa, summary tidak bocorkan flags/KPI',async()=>{
      assert.equal((await anonymous.call('/dashboard/kpi')).status,401);assert.equal((await anonymous.call('/quality-flags')).status,401);assert.equal((await viewer.call('/dashboard/kpi')).status,200);
      const summary=(await anonymous.call('/dashboard/summary')).body.data;assert.ok(!('flags' in summary)&&!('kpi' in summary));
      await admin.call('/admin/visibilitas-modul/dosen','PATCH',{akses:'authenticated'});
      try {assert.equal((await anonymous.call('/dashboard/dosen')).status,401);}finally{await admin.call('/admin/visibilitas-modul/dosen','PATCH',{akses:'public'});}
      const privateApp=createApp({pool,passwordEnv:{},publicDashboard:false,secret:randomBytes(48).toString('hex')}),s=privateApp.listen(0,'127.0.0.1');await new Promise(resolve=>s.once('listening',resolve));
      try{assert.equal((await fetch(`http://127.0.0.1:${s.address().port}/api/dashboard/mahasiswa`)).status,401);}finally{privateApp.locals.store.close();await new Promise(resolve=>s.close(resolve));}
    });
    await t.test('Fase 3: angkatan/pegawai approved, privasi kategori pegawai, metadata dan halaman privat',async()=>{
      const cohorts=await anonymous.call('/dashboard/mahasiswa-angkatan');assert.equal(cohorts.status,200);assert.equal(cohorts.body.data.length,78);assert.equal(cohorts.body.data.reduce((n,r)=>n+r.total,0),5080);assert.equal(cohorts.body.meta.sumber[0].nomor_tabel,'2.5');
      const employees=await anonymous.call('/dashboard/pegawai');assert.equal(employees.status,200);assert.deepEqual(employees.body.data.map(r=>r.kategori).sort(),['dosen_tetap','dosen_tidak_tetap']);assert.deepEqual(employees.body.data.map(r=>r.jumlah).sort((a,b)=>a-b),[55,222]);
      assert.equal((await anonymous.call('/dashboard/pegawai-internal')).status,401);assert.equal((await anonymous.call('/dashboard/pegawai?kategori=tendik')).status,422);
      const internal=await viewer.call('/dashboard/pegawai-internal');assert.equal(internal.status,200);assert.deepEqual(internal.body.data.map(r=>r.jumlah).sort((a,b)=>a-b),[68,109]);
      assert.equal((await baa.call('/data/pegawai-ringkasan','POST',{})).status,403);
      const draft=await bsdm.call('/data/pegawai-ringkasan','POST',{periode_laporan_id:report,periode_akademik_id:academic,kategori:'dosen_tetap',jumlah:999});assert.equal(draft.status,201);
      assert.deepEqual((await anonymous.call(`/dashboard/pegawai?periode_laporan_id=${report}`)).body.data,[]);
      const kpi=await viewer.call('/dashboard/kpi');assert.equal(kpi.status,200);assert.ok(kpi.body.data.every(r=>!('skor_berbobot' in r)&&!('bobot' in r)));
      const pmb=await anonymous.call('/dashboard/mahasiswa-baru');assert.ok(pmb.body.meta.catatan_kualitas.some(n=>n.kode==='pmb-definisi-berbeda'&&n.pesan.includes('61,95%')));
      const faculty=await fetch(base+'/capaian-iku-fakultas.html',{redirect:'manual'});assert.equal(faculty.status,302);assert.equal(faculty.headers.get('location'),'/monitoring-kpi.html');
      const page=await fetch(base+'/monitoring-kpi.html',{redirect:'manual'});assert.equal(page.status,401);assert.equal(page.headers.get('location'),null);
      const authPage=await fetch(base+'/monitoring-kpi.html',{redirect:'manual',headers:{cookie:viewer.cookie}});assert.equal(authPage.status,200);
    });
    await t.test('CSV preview error per baris, commit atomik/idempotent dan rollback audit',async()=>{
      const bad=await admin.call('/imports/mahasiswa-aktif/preview','POST',{periode_laporan_id:report,periode_akademik_id:academic,csv:`prodi_id,total,perempuan\n${prodi},-1,5`});assert.equal(bad.status,200);assert.equal(bad.body.data.errors.length,1);
      assert.equal((await admin.call(`/imports/${bad.body.data.batch_id}/commit`,'POST',{})).status,409);
      const nextProdi=(await owner.query('SELECT id FROM prodi ORDER BY id OFFSET 1 LIMIT 1')).rows[0].id;
      const good=await admin.call('/imports/mahasiswa-aktif/preview','POST',{periode_laporan_id:report,periode_akademik_id:academic,csv:`prodi_id,total,perempuan\n${nextProdi},4,1`});assert.equal(good.body.data.errors.length,0);
      const commit=await admin.call(`/imports/${good.body.data.batch_id}/commit`,'POST',{});assert.equal(commit.status,200);
      assert.equal((await admin.call(`/imports/${good.body.data.batch_id}/commit`,'POST',{})).body.data.already_committed,true);
      const logs=(await owner.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n;
      const fail=await baa.call('/data/mahasiswa-aktif/bulk-draft','POST',{rows:[{periode_laporan_id:report,periode_akademik_id:academic,prodi_id:(await owner.query('SELECT id FROM prodi ORDER BY id OFFSET 2 LIMIT 1')).rows[0].id,total:7,perempuan:1},{periode_laporan_id:report,periode_akademik_id:academic,prodi_id:999999,total:7,perempuan:1}]});assert.equal(fail.status,422);
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM audit_log')).rows[0].n,logs);
    });
    await t.test('Tracer CSV menyimpan tanda minus sebagai NULL; preview memeriksa referensi',async()=>{
      const preview=await admin.call('/imports/tracer/preview','POST',{periode_laporan_id:report,csv:`prodi_id,tahun_lulus,kerja_kurang_3_bulan,kerja_lebih_3_bulan,sesuai_bidang,wirausaha,studi_lanjut\n${prodi},2099,-,-,-,-,-`});
      assert.equal(preview.body.data.errors.length,0);
      const commit=await admin.call(`/imports/${preview.body.data.batch_id}/commit`,'POST',{});assert.equal(commit.status,200);
      const row=commit.body.data.rows[0];for(const k of ['kerja_kurang_3_bulan','kerja_lebih_3_bulan','sesuai_bidang','wirausaha','studi_lanjut'])assert.equal(row[k],null);
      const bad=await admin.call('/imports/mahasiswa-aktif/preview','POST',{periode_laporan_id:report,periode_akademik_id:academic,csv:'prodi_id,total,perempuan\n999999,1,0'});assert.equal(bad.body.data.can_commit,false);assert.match(bad.body.data.errors[0].message,/prodi_id/);
    });
    await t.test('Fase 4: RBAC halaman dan forms, NULL, warning, konflik dan riwayat',async()=>{
      for(const [client,role]of [[baa,'baa'],[bsdm,'bsdm'],[bpka,'bpka'],[prp,'prp']]){
        for(const target of ['baa','ppa','bsdm','bpka','prp'])assert.equal((await fetch(base+'/input/'+target+'.html',{headers:{cookie:client.cookie},redirect:'manual'})).status,target===role?200:403);
        assert.equal((await fetch(base+'/admin/users.html',{headers:{cookie:client.cookie},redirect:'manual'})).status,403);
      }
      assert.equal((await fetch(base+'/input/%62sdm.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      assert.equal((await fetch(base+'/%69nput/bsdm.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      assert.equal((await fetch(base+'/%61dmin/users.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      assert.equal((await fetch(base+'/verifikasi.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      for(const [client,denied]of [[baa,'dosen'],[bsdm,'mahasiswa-aktif'],[bpka,'mahasiswa-baru'],[prp,'mahasiswa-aktif'],[viewer,'tracer']])assert.equal((await client.call('/forms/'+denied+'/draft','POST',{rows:[]})).status,403);
      assert.equal((await baa.call('/imports/mahasiswa-aktif/preview','POST',{})).status,403);
      const baseRow={periode_laporan_id:report,periode_akademik_id:academic,prodi_id:prodi,status_mhs:'nonaktif',total:null,perempuan:4};
      let result=await baa.call('/forms/mahasiswa-aktif/draft','POST',{rows:[{values:baseRow}]});assert.equal(result.status,200,JSON.stringify(result.body));let row=result.body.data[0];assert.equal(row.total,null);
      result=await baa.call('/forms/mahasiswa-aktif/draft','POST',{rows:[{id:row.id,row_version:row.row_version,values:{...baseRow,total:1}}]});assert.equal(result.status,200);const updated=result.body.data[0];
      assert.equal((await baa.call('/forms/mahasiswa-aktif/draft','POST',{rows:[{id:row.id,row_version:row.row_version,values:baseRow}]})).status,409);
      assert.ok((await owner.query("SELECT id FROM data_quality_flag WHERE tabel='mahasiswa_aktif' AND row_id=$1 AND NOT resolved",[row.id])).rows.length);
      assert.equal((await baa.call('/forms/mahasiswa-aktif'+`?periode_laporan_id=${report}&periode_akademik_id=${academic}`)).status,200);
      const submitted=(await baa.call(`/data/mahasiswa-aktif/${row.id}/submit`,'POST',{row_version:updated.row_version})).body.data;
      assert.equal((await baa.call(`/verification/mahasiswa-aktif/${row.id}/approve`,'POST',{row_version:submitted.row_version})).status,403);
      const diff=await prp.call(`/verification/mahasiswa-aktif/${row.id}/diff`);assert.ok(diff.body.data.flags.length);
      assert.equal((await prp.call(`/verification/mahasiswa-aktif/${row.id}/approve`,'POST',{row_version:submitted.row_version,review_note:''})).status,422);
      assert.equal((await prp.call(`/verification/mahasiswa-aktif/${row.id}/approve`,'POST',{row_version:submitted.row_version,review_note:'Diperiksa, warning sumber dipertahankan'})).status,200);
      const history=await baa.call('/data/mahasiswa-aktif/'+row.id);assert.ok(history.body.meta.events.some(e=>e.status==='approved'&&e.nama==='prp'));
      assert.equal((await admin.call('/admin/audit?mulai=2099-01-01T00%3A00%3A00%2B07%3A00')).status,200);
    });
    await t.test('Fase 4: Target RKA melalui four-eyes dan nilai approved',async()=>{
      const target=(await owner.query('SELECT id FROM rka_target ORDER BY id LIMIT 1')).rows[0].id;
      let r=await prp.call('/forms/rka-target/draft','POST',{rows:[{values:{periode_laporan_id:report,rka_target_id:target,angka:123,catatan:'Target untuk pengujian'}}]});assert.equal(r.status,200,JSON.stringify(r.body));let row=r.body.data[0];
      row=(await prp.call(`/data/rka-target/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
      assert.equal((await prp.call(`/verification/rka-target/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
      const diff=await admin.call(`/verification/rka-target/${row.id}/diff`);assert.ok(diff.body.data.prior.angka);
      assert.equal((await admin.call(`/verification/rka-target/${row.id}/approve`,'POST',{row_version:row.row_version,review_note:'Disetujui'})).status,200);
      assert.equal(Number((await prp.call('/rka-target')).body.data.find(x=>x.id===target).angka),123);
    });
    await t.test('Fase 5A: semua bacaan mahasiswa approved konsisten; draft, submitted dan reject tetap privat',async()=>{
      const filters=`?periode_laporan_id=${report}&periode_akademik_id=${academic}`;
      const paths=['/dashboard/mahasiswa','/dashboard/summary','/dashboard/prodi','/dashboard/mahasiswa-angkatan'].map(p=>p+filters);
      const snapshot=async()=>Promise.all(paths.map(async path=>{const r=await anonymous.call(path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('etag'),null);return r.body;}));
      let approved=(await owner.query("SELECT * FROM mahasiswa_aktif WHERE periode_laporan_id=$1 AND status_mhs='aktif' AND is_current_approved",[report])).rows[0];
      const before=await snapshot();
      let row=(await baa.call(`/data/mahasiswa-aktif/${approved.id}/revision`,'POST',{row_version:approved.row_version})).body.data;
      row=(await baa.call(`/data/mahasiswa-aktif/${row.id}`,'PATCH',{row_version:row.row_version,total:20,perempuan:4})).body.data;
      assert.deepEqual(await snapshot(),before);
      row=(await baa.call(`/data/mahasiswa-aktif/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual(await snapshot(),before);
      row=(await prp.call(`/verification/mahasiswa-aktif/${row.id}/reject`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual(await snapshot(),before);
      row=(await baa.call(`/data/mahasiswa-aktif/${row.id}`,'PATCH',{row_version:row.row_version,total:20})).body.data;
      row=(await baa.call(`/data/mahasiswa-aktif/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
      const result=await prp.call(`/verification/mahasiswa-aktif/${row.id}/approve`,'POST',{row_version:row.row_version});assert.equal(result.status,200);
      const after=await snapshot();assert.equal(after[0].data.find(r=>r.status_mhs==='aktif').perempuan,4);assert.equal(after[1].data.mahasiswa.total,20);assert.equal(Number(after[1].data.mahasiswa.perempuan),4);assert.equal(Number(after[1].data.mahasiswa.persen_perempuan),20);assert.equal(Number(after[2].data.find(r=>String(r.id)===String(prodi)).mahasiswa),20);assert.equal(after[3].meta.rekonsiliasi.mahasiswa_aktif,20);
      let cohort=(await baa.call('/data/mahasiswa-angkatan','POST',{periode_laporan_id:report,periode_akademik_id:academic,prodi_id:prodi,angkatan:2098,total:20})).body.data;
      assert.deepEqual((await anonymous.call(paths[3])).body.data,[]);
      cohort=(await baa.call(`/data/mahasiswa-angkatan/${cohort.id}/submit`,'POST',{row_version:cohort.row_version})).body.data;
      assert.deepEqual((await anonymous.call(paths[3])).body.data,[]);
      assert.equal((await prp.call(`/verification/mahasiswa-angkatan/${cohort.id}/approve`,'POST',{row_version:cohort.row_version})).status,200);
      assert.equal((await anonymous.call(paths[3])).body.meta.rekonsiliasi.selisih,0);
    });
    await t.test('Fase 5A: pengaturan hanya admin, auto-approved diaudit dan revisi meningkat',async()=>{
      const path='/admin/formulir/mahasiswa-aktif';
      assert.equal((await baa.call('/admin/formulir')).status,403);assert.equal((await baa.call(path,'PATCH',{perlu_verifikasi:false})).status,403);
      assert.equal((await admin.call(path,'PATCH',{perlu_verifikasi:false})).status,200);
      try{
        assert.equal((await baa.call('/forms/meta')).body.data.domains.find(d=>d.name==='mahasiswa-aktif').perlu_verifikasi,false);
        const current=(await owner.query("SELECT * FROM mahasiswa_aktif WHERE periode_laporan_id=$1 AND status_mhs='aktif' AND is_current_approved",[report])).rows[0];
        let row=(await baa.call(`/data/mahasiswa-aktif/${current.id}/revision`,'POST',{row_version:current.row_version})).body.data;
        row=(await baa.call(`/data/mahasiswa-aktif/${row.id}`,'PATCH',{row_version:row.row_version,total:21})).body.data;
        const result=await baa.call(`/data/mahasiswa-aktif/${row.id}/submit`,'POST',{row_version:row.row_version});assert.equal(result.status,200);row=result.body.data;
        assert.equal(row.status,'approved');assert.equal(row.versi,current.versi+1);assert.equal(row.review_note,'auto-approved');assert.equal(String(row.approved_by),String(users.baa.id));
        assert.equal((await anonymous.call(`/dashboard/summary?periode_laporan_id=${report}&periode_akademik_id=${academic}`)).body.data.mahasiswa.total,21);
        assert.ok((await owner.query("SELECT 1 FROM audit_log WHERE tabel='mahasiswa_aktif' AND row_id=$1 AND aksi='auto-approved'",[row.id])).rows.length);
        assert.ok((await owner.query("SELECT 1 FROM audit_log WHERE tabel='definisi_formulir' AND user_id=$1 AND aksi='form_policy_update' AND nilai_baru->>'perlu_verifikasi'='false'",[users.admin.id])).rows.length);
        await assert.rejects(pool.query("UPDATE definisi_formulir SET perlu_verifikasi=true WHERE domain='mahasiswa-aktif'"),{code:'42501'});
      }finally{assert.equal((await admin.call(path,'PATCH',{perlu_verifikasi:true})).status,200);}
    });
    await t.test('Fase 5A: auto-approved lulusan memakai denominasi terkini tanpa menerbitkan ulang data BPKA',async()=>{
      let l=(await baa.call('/data/lulusan','POST',{periode_laporan_id:report,periode_akademik_id:null,cakupan:'institusi',prodi_id:null,tahun_lulus:2099,periode_wisuda:null,jumlah:20})).body.data;
      l=(await baa.call(`/data/lulusan/${l.id}/submit`,'POST',{row_version:l.row_version})).body.data;l=(await prp.call(`/verification/lulusan/${l.id}/approve`,'POST',{row_version:l.row_version})).body.data;
      let r=(await bpka.call('/data/tracer-ringkasan','POST',{periode_laporan_id:report,tahun_lulus:2099,lulusan_institusi_id:l.id,responden:10,data_sementara:true})).body.data;
      r=(await bpka.call(`/data/tracer-ringkasan/${r.id}/submit`,'POST',{row_version:r.row_version})).body.data;r=(await prp.call(`/verification/tracer-ringkasan/${r.id}/approve`,'POST',{row_version:r.row_version})).body.data;
      assert.equal((await admin.call('/admin/formulir/lulusan','PATCH',{perlu_verifikasi:false})).status,200);
      try{let v=(await baa.call(`/data/lulusan/${l.id}/revision`,'POST',{row_version:l.row_version})).body.data;v=(await baa.call(`/data/lulusan/${v.id}`,'PATCH',{row_version:v.row_version,jumlah:30})).body.data;
        const approved=await baa.call(`/data/lulusan/${v.id}/submit`,'POST',{row_version:v.row_version});assert.equal(approved.status,200);assert.equal(approved.body.data.status,'approved');
        const summary=(await anonymous.call(`/dashboard/tracer?periode_laporan_id=${report}&tahun=2099`)).body.meta.ringkasan[0];assert.equal(summary.jumlah_lulusan,30);assert.equal(Number(summary.cakupan_persen),33.33);
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM tracer_ringkasan WHERE periode_laporan_id=$1',[report])).rows[0].n,1);
      }finally{await admin.call('/admin/formulir/lulusan','PATCH',{perlu_verifikasi:true});}
    });
    await t.test('B2: rasio hanya memakai pasangan approved; reject tetap, revisi mengubah denominator',async()=>{
      const path=`/dashboard/rasio-dosen-mahasiswa?periode_laporan_id=${report}&periode_akademik_id=${academic}&prodi_id=${prodi}`;
      const read=async()=>{const r=await anonymous.call(path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');return r.body;};
      const before=await read();assert.equal(before.data[0].dosen,null);assert.equal(before.data[0].mahasiswa_per_dosen,null);
      assert.equal((await baa.call('/data/dosen','POST',{})).status,403);
      let row=(await bsdm.call('/data/dosen','POST',{periode_laporan_id:report,periode_akademik_id:academic,prodi_id:prodi,total:3})).body.data;assert.ok(row?.id);
      assert.deepEqual(await read(),before);
      row=(await bsdm.call(`/data/dosen/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual(await read(),before);
      row=(await prp.call(`/verification/dosen/${row.id}/reject`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual(await read(),before);
      row=(await bsdm.call(`/data/dosen/${row.id}`,'PATCH',{row_version:row.row_version,total:3})).body.data;
      row=(await bsdm.call(`/data/dosen/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
      row=(await prp.call(`/verification/dosen/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;
      let result=await read();assert.equal(Number(result.data[0].mahasiswa_per_dosen),7);assert.equal(result.meta.institusi.mahasiswa_per_dosen,7);
      let revision=(await bsdm.call(`/data/dosen/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
      revision=(await bsdm.call(`/data/dosen/${revision.id}`,'PATCH',{row_version:revision.row_version,total:7})).body.data;assert.equal(Number((await read()).data[0].mahasiswa_per_dosen),7);
      revision=(await bsdm.call(`/data/dosen/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
      assert.equal((await prp.call(`/verification/dosen/${revision.id}/approve`,'POST',{row_version:revision.row_version})).status,200);
      assert.equal(Number((await read()).data[0].mahasiswa_per_dosen),3);
      const zero=(await bsdm.call(`/data/dosen/${revision.id}/revision`,'POST',{row_version:(await owner.query('SELECT row_version FROM dosen_prodi WHERE id=$1',[revision.id])).rows[0].row_version})).body.data;
      const patch=(await bsdm.call(`/data/dosen/${zero.id}`,'PATCH',{row_version:zero.row_version,total:0})).body.data;
      const submitted=(await bsdm.call(`/data/dosen/${zero.id}/submit`,'POST',{row_version:patch.row_version})).body.data;
      assert.equal((await prp.call(`/verification/dosen/${zero.id}/approve`,'POST',{row_version:submitted.row_version})).status,200);
      assert.equal((await read()).data[0].mahasiswa_per_dosen,null);
      assert.equal((await anonymous.call(path+'&unexpected=1')).status,422);
      await owner.query("UPDATE visibilitas_modul SET akses='authenticated' WHERE kode_modul='rasio-dosen-mahasiswa'");
      try{assert.equal((await anonymous.call(path)).status,401);assert.equal((await viewer.call(path)).status,200);}
      finally{await owner.query("UPDATE visibilitas_modul SET akses='public' WHERE kode_modul='rasio-dosen-mahasiswa'");}
    });
    await t.test('B3: PJM input, diff/expiry internal, approve/reject/revisi, default review dan seed audited',async()=>{
      const pjm=client();await pjm.login('pjm');
      for(const [c,url,status] of [[baa,'/input/pjm.html',403],[pjm,'/input/baa.html',403],[pjm,'/input/pjm.html',200]])assert.equal((await fetch(base+url,{headers:{cookie:c.cookie},redirect:'manual'})).status,status);
      assert.equal((await baa.call('/data/akreditasi','POST',{})).status,403);
      assert.equal((await pjm.call('/forms/meta')).body.data.domains.find(d=>d.name==='akreditasi').perlu_verifikasi,true);
      const seed=(await owner.query("SELECT * FROM akreditasi_revisi WHERE periode_laporan_id=(SELECT id FROM periode_laporan WHERE kode='2026-S1') AND is_current_approved")).rows;assert.equal(seed.length,19);assert.equal(seed.filter(x=>x.prodi_id===null).length,2);
      for(const row of seed){assert.equal(row.versi,1);assert.equal(row.row_version,3);assert.equal(row.berlaku_mulai,null);assert.deepEqual((await owner.query("SELECT nilai_baru->>'status' AS status FROM audit_log WHERE tabel='akreditasi_revisi' AND row_id=$1 AND aksi='seed_approved' ORDER BY id",[row.id])).rows.map(x=>x.status),['draft','submitted','approved']);}
      const seedRead=await anonymous.call('/dashboard/akreditasi?tahun=2026');assert.equal(seedRead.status,200);
      assert.equal(seedRead.body.meta.total_master,19);assert.equal(seedRead.body.meta.total_rekap,19);assert.equal(seedRead.body.meta.tanpa_data,2);assert.equal(seedRead.body.meta.belum_terpetakan,2);assert.equal(seedRead.body.meta.jumlah_peringkat,4);
      assert.equal(seedRead.body.meta.rekap_master.reduce((n,r)=>n+r.jumlah,0),19);
      assert.equal((await anonymous.call('/dashboard/akreditasi?tahun=1999')).status,422);
      const absent=await anonymous.call('/dashboard/akreditasi?tahun=2200');assert.deepEqual(absent.body.data,[]);assert.equal(absent.body.meta.tanpa_data,19);
      const path=`/dashboard/akreditasi?periode_laporan_id=${report}`,read=async()=>{const r=await anonymous.call(path);assert.equal(r.status,200);return r.body;};assert.deepEqual((await read()).data,[]);
      let row=(await pjm.call('/data/akreditasi','POST',{periode_laporan_id:report,butir:'institusi',cakupan:'institusi',nama_sumber:'ITPLN',peringkat:'Baik',berlaku_sampai:'2026-06-30'})).body.data;assert.ok(row?.id);assert.deepEqual((await read()).data,[]);
      row=(await pjm.call(`/data/akreditasi/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal(row.status,'submitted');assert.deepEqual((await read()).data,[]);
      assert.equal((await pjm.call(`/verification/akreditasi/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
      const diff=await prp.call(`/verification/akreditasi/${row.id}/diff`);assert.ok(diff.body.data.flags.some(x=>x.pesan.includes('Masa berlaku')));
      row=(await prp.call(`/verification/akreditasi/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;const before=await read();assert.equal(before.meta.institusi[0].peringkat,'Baik');assert.ok(!JSON.stringify(before).includes('Masa berlaku'));assert.ok(!('approved_by' in before.data[0]));
      let revision=(await pjm.call(`/data/akreditasi/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
      revision=(await pjm.call(`/data/akreditasi/${revision.id}`,'PATCH',{row_version:revision.row_version,peringkat:'Unggul',berlaku_sampai:null})).body.data;assert.deepEqual(await read(),before);
      revision=(await pjm.call(`/data/akreditasi/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
      revision=(await prp.call(`/verification/akreditasi/${revision.id}/reject`,'POST',{row_version:revision.row_version})).body.data;assert.deepEqual(await read(),before);
      revision=(await pjm.call(`/data/akreditasi/${revision.id}`,'PATCH',{row_version:revision.row_version,peringkat:'Unggul'})).body.data;
      revision=(await pjm.call(`/data/akreditasi/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
      assert.equal((await prp.call(`/verification/akreditasi/${revision.id}/approve`,'POST',{row_version:revision.row_version})).status,200);assert.equal((await read()).meta.institusi[0].peringkat,'Unggul');
      await admin.call('/admin/formulir/akreditasi','PATCH',{perlu_verifikasi:false});
      try{let next=(await pjm.call('/data/akreditasi','POST',{periode_laporan_id:report,butir:'internasional',cakupan:'internasional',nama_sumber:'ITPLN',peringkat:'Terakreditasi'})).body.data;const r=await pjm.call(`/data/akreditasi/${next.id}/submit`,'POST',{row_version:next.row_version});assert.equal(r.body.data.status,'approved');assert.equal((await read()).meta.internasional.length,1);}
      finally{await admin.call('/admin/formulir/akreditasi','PATCH',{perlu_verifikasi:true});}
    });
    await t.test('B4: LPPM/RBAC, NULL dana, semua domain berubah hanya setelah approve, reject tetap',async()=>{
      const lppm=client();await lppm.login('lppm');
      assert.equal((await fetch(base+'/input/lppm.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      assert.equal((await fetch(base+'/input/lppm.html',{headers:{cookie:lppm.cookie},redirect:'manual'})).status,200);
      assert.equal((await fetch(base+'/input/baa.html',{headers:{cookie:lppm.cookie},redirect:'manual'})).status,403);
      for(const name of ['penelitian','hki','pkm']){
        const path=`/dashboard/${name}?periode_laporan_id=${report}&tahun=2099`,read=async()=>{const r=await anonymous.call(path);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');return r.body;};
        assert.equal((await baa.call('/data/'+name,'POST',{})).status,403);
        assert.equal((await lppm.call('/forms/meta')).body.data.domains.find(d=>d.name===name).perlu_verifikasi,true);
        assert.deepEqual((await read()).data,[]);
        const value=name==='hki'?{kategori:'paten',target:4,diajukan:2,disetujui:1}:{kategori:'internal',target:4,realisasi:1,dana:null};
        let row=(await lppm.call('/data/'+name,'POST',{periode_laporan_id:report,tahun:2099,...value})).body.data;assert.ok(row?.id);assert.deepEqual((await read()).data,[]);
        row=(await lppm.call(`/data/${name}/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal(row.status,'submitted');assert.deepEqual((await read()).data,[]);
        assert.equal((await lppm.call(`/verification/${name}/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
        row=(await prp.call(`/verification/${name}/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;const before=await read();assert.equal(before.data.length,1);assert.ok(!('approved_by' in before.data[0]));if(name!=='hki')assert.equal(before.data[0].dana,null);
        let revision=(await lppm.call(`/data/${name}/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
        const change=name==='hki'?{disetujui:2}:{realisasi:2,dana:1234.5};
        revision=(await lppm.call(`/data/${name}/${revision.id}`,'PATCH',{row_version:revision.row_version,...change})).body.data;assert.deepEqual(await read(),before);
        revision=(await lppm.call(`/data/${name}/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
        revision=(await prp.call(`/verification/${name}/${revision.id}/reject`,'POST',{row_version:revision.row_version})).body.data;assert.deepEqual(await read(),before);
        revision=(await lppm.call(`/data/${name}/${revision.id}`,'PATCH',{row_version:revision.row_version,...change})).body.data;
        revision=(await lppm.call(`/data/${name}/${revision.id}/submit`,'POST',{row_version:revision.row_version})).body.data;
        assert.equal((await prp.call(`/verification/${name}/${revision.id}/approve`,'POST',{row_version:revision.row_version})).status,200);
        const after=await read();assert.equal(after.data[0][name==='hki'?'disetujui':'realisasi'],2);if(name!=='hki')assert.equal(Number(after.data[0].dana),1234.5);
        assert.deepEqual((await anonymous.call(path.replace('2099','2098'))).body.data,[]);
        assert.equal((await lppm.call('/data/'+name,'POST',{periode_laporan_id:report,tahun:2099,kategori:'nama-dosen',nama:'pribadi'})).status,422);
        await owner.query(`DELETE FROM ${name}_revisi WHERE periode_laporan_id=$1`,[report]);
      }
    });
    await t.test('B5: BKM/RBAC, draft/submitted/reject tersembunyi, revisi approved mengubah dashboard',async()=>{
      const bkm=client();await bkm.login('bkm');
      assert.equal((await fetch(base+'/input/bkm.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      assert.equal((await fetch(base+'/input/bkm.html',{headers:{cookie:bkm.cookie},redirect:'manual'})).status,200);
      assert.equal((await bkm.call('/data/penelitian','POST',{})).status,403);assert.equal((await baa.call('/data/prestasi','POST',{})).status,403);
      assert.equal((await bkm.call('/forms/meta')).body.data.domains.find(d=>d.name==='prestasi').perlu_verifikasi,true);
      const path=`/dashboard/prestasi?periode_laporan_id=${report}&tahun=2099&prodi_id=${prodi}`,read=async()=>(await anonymous.call(path)).body;
      let row=(await bkm.call('/data/prestasi','POST',{periode_laporan_id:report,tahun:2099,prodi_id:prodi,jumlah_mahasiswa:10,nasional:8,regional:null,internasional:2,pkm_dikti:null})).body.data;assert.ok(row?.id);assert.deepEqual((await read()).data,[]);
      row=(await bkm.call(`/data/prestasi/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual((await read()).data,[]);
      assert.equal((await bkm.call(`/verification/prestasi/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
      row=(await prp.call(`/verification/prestasi/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;
      const before=await read();assert.equal(before.meta.totals.nasional,8);assert.equal(before.data[0].regional,null);
      let rev=(await bkm.call(`/data/prestasi/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
      rev=(await bkm.call(`/data/prestasi/${rev.id}`,'PATCH',{row_version:rev.row_version,nasional:9})).body.data;assert.deepEqual(await read(),before);
      rev=(await bkm.call(`/data/prestasi/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;assert.deepEqual(await read(),before);
      rev=(await prp.call(`/verification/prestasi/${rev.id}/reject`,'POST',{row_version:rev.row_version})).body.data;assert.deepEqual(await read(),before);
      rev=(await bkm.call(`/data/prestasi/${rev.id}`,'PATCH',{row_version:rev.row_version,nasional:9})).body.data;
      rev=(await bkm.call(`/data/prestasi/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;
      assert.equal((await prp.call(`/verification/prestasi/${rev.id}/approve`,'POST',{row_version:rev.row_version})).status,200);assert.equal((await read()).meta.totals.nasional,9);
      assert.equal((await bkm.call('/data/prestasi','POST',{periode_laporan_id:report,tahun:2099,prodi_id:prodi,nim:'rahasia'})).status,422);
    });
    await t.test('C1: master tanpa kode, RBAC, review, revisi, reject dan visibilitas kerja sama',async()=>{
      const unit=client();await unit.login('kerjasama');
      assert.equal((await fetch(base+'/input/kerjasama.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);assert.equal((await fetch(base+'/input/kerjasama.html',{headers:{cookie:unit.cookie},redirect:'manual'})).status,200);
      assert.equal((await baa.call('/data/kerjasama','POST',{})).status,403);assert.equal((await unit.call('/data/prestasi','POST',{})).status,403);
      assert.equal((await unit.call('/forms/meta')).body.data.domains.find(d=>d.name==='kerjasama').perlu_verifikasi,true);
      const path=`/dashboard/kerjasama?periode_laporan_id=${report}&tahun=2099`,read=async()=>(await anonymous.call(path)).body;
      let row=(await unit.call('/data/kerjasama','POST',{periode_laporan_id:report,tahun:2099,kategori:'kelembagaan',jumlah:10,selesai:2,berjalan:8})).body.data;assert.ok(row?.id);assert.deepEqual((await read()).data,[]);
      row=(await unit.call(`/data/kerjasama/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual((await read()).data,[]);
      assert.equal((await unit.call(`/verification/kerjasama/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
      row=(await prp.call(`/verification/kerjasama/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;
      const before=await read();assert.equal(before.data[0].jumlah,10);assert.equal(before.data[0].mitra_institusi,null);assert.ok(!Object.hasOwn(before.data[0],'approved_by'));
      let rev=(await unit.call(`/data/kerjasama/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;
      rev=(await unit.call(`/data/kerjasama/${rev.id}`,'PATCH',{row_version:rev.row_version,jumlah:11})).body.data;assert.deepEqual(await read(),before);
      rev=(await unit.call(`/data/kerjasama/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;assert.deepEqual(await read(),before);
      rev=(await prp.call(`/verification/kerjasama/${rev.id}/reject`,'POST',{row_version:rev.row_version})).body.data;assert.deepEqual(await read(),before);
      rev=(await unit.call(`/data/kerjasama/${rev.id}`,'PATCH',{row_version:rev.row_version,jumlah:11})).body.data;rev=(await unit.call(`/data/kerjasama/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;
      assert.equal((await prp.call(`/verification/kerjasama/${rev.id}/approve`,'POST',{row_version:rev.row_version})).status,200);assert.equal((await read()).data[0].jumlah,11);
      assert.equal((await unit.call('/data/kerjasama','POST',{periode_laporan_id:report,tahun:2099,kategori:'nama-individu',nama:'pribadi'})).status,422);
      assert.equal((await anonymous.call('/dashboard/kerjasama?tahun=1999')).status,422);
      const closed=createApp({pool,publicDashboard:false,passwordEnv:{},secret:randomBytes(48).toString('hex')}),s=closed.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));try{assert.equal((await fetch(`http://127.0.0.1:${s.address().port}/api/dashboard/kerjasama`)).status,401);}finally{closed.locals.store.close();await new Promise(r=>s.close(r));}
    });
    await t.test('C2: BSDM agregat unik, review/revisi/reject, flags lama dan target nol',async()=>{
      const name='produktivitas-dosen',path=`/dashboard/${name}?periode_laporan_id=${report}&tahun=2099`,read=async()=>(await anonymous.call(path)).body;
      assert.equal((await baa.call('/data/'+name,'POST',{})).status,403);assert.equal((await bsdm.call('/forms/meta')).body.data.domains.find(d=>d.name===name).perlu_verifikasi,true);
      let row=(await bsdm.call('/data/'+name,'POST',{periode_laporan_id:report,tahun:2099,kategori:'publikasi',target:10,realisasi:8,capaian_laporan:80})).body.data;assert.ok(row?.id);assert.deepEqual((await read()).data,[]);
      row=(await bsdm.call(`/data/${name}/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.deepEqual((await read()).data,[]);
      assert.equal((await bsdm.call(`/verification/${name}/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
      const diff=(await prp.call(`/verification/${name}/${row.id}/diff`)).body.data;assert.equal(diff.flags.filter(f=>f.kode.endsWith('produktivitas-berbeda')).length,3);
      row=(await prp.call(`/verification/${name}/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;const before=await read();assert.equal(Number(before.data[0].realisasi),8);assert.equal(Number(before.data[0].capaian_hitung),80);assert.ok(!Object.hasOwn(before,'flags'));
      let rev=(await bsdm.call(`/data/${name}/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;rev=(await bsdm.call(`/data/${name}/${rev.id}`,'PATCH',{row_version:rev.row_version,realisasi:9})).body.data;assert.deepEqual(await read(),before);
      rev=(await bsdm.call(`/data/${name}/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;assert.deepEqual(await read(),before);
      rev=(await prp.call(`/verification/${name}/${rev.id}/reject`,'POST',{row_version:rev.row_version})).body.data;assert.deepEqual(await read(),before);
      rev=(await bsdm.call(`/data/${name}/${rev.id}`,'PATCH',{row_version:rev.row_version,target:0,realisasi:9})).body.data;rev=(await bsdm.call(`/data/${name}/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;assert.equal((await prp.call(`/verification/${name}/${rev.id}/approve`,'POST',{row_version:rev.row_version})).status,200);const after=await read();assert.equal(Number(after.data[0].realisasi),9);assert.equal(after.data[0].capaian_hitung,null);
      assert.equal((await bsdm.call('/data/'+name,'POST',{periode_laporan_id:report,tahun:2099,kategori:'penelitian',target:105,realisasi:3})).status,422);assert.equal((await bsdm.call('/data/'+name,'POST',{periode_laporan_id:report,tahun:2099,kategori:'sitasi',nama_dosen:'pribadi'})).status,422);
    });
    await t.test('D0: form lulusan institusi, ringkasan tracer dan input KPI merevisi lewat review',async()=>{
      const bm=(await bpka.call('/forms/meta')).body.data,pm=(await prp.call('/forms/meta')).body.data;assert.ok(bm.domains.some(x=>x.name==='tracer-ringkasan'));assert.ok(pm.domains.some(x=>x.name==='kpi-input'));assert.ok(pm.kpi_inputs.some(x=>x.kode_input==='dosen_tetap_nidn_non_pln'));assert.equal((await baa.call('/forms/tracer-ringkasan?periode_laporan_id='+report)).status,403);assert.equal((await bpka.call('/forms/kpi-input?periode_laporan_id='+report)).status,403);
      const form=async(c,name,values,row)=>{const r=await c.call('/forms/'+name+'/draft','POST',{rows:[{...(row?{id:row.id,row_version:row.row_version}:{}),values}]});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data[0];};
      const lv={periode_laporan_id:report,periode_akademik_id:null,cakupan:'institusi',prodi_id:null,tahun_lulus:2101,periode_wisuda:null,jumlah:200,ipk_rata:null,masa_studi_rata:null};let l=await form(baa,'lulusan',lv);l=(await baa.call(`/data/lulusan/${l.id}/submit`,'POST',{row_version:l.row_version})).body.data;l=(await prp.call(`/verification/lulusan/${l.id}/approve`,'POST',{row_version:l.row_version})).body.data;
      assert.ok((await bpka.call('/forms/meta')).body.data.lulusan_institusi.some(x=>String(x.id)===String(l.id)));
      const rv={periode_laporan_id:report,periode_akademik_id:null,tahun_lulus:2101,lulusan_institusi_id:l.id,responden:20,kerja_kurang_3_bulan_sumber:null,kerja_lebih_3_bulan_sumber:null,sesuai_bidang_sumber:null,wirausaha_sumber:null,studi_lanjut_sumber:null,data_sementara:true};let row=await form(bpka,'tracer-ringkasan',rv);
      const read=async()=>(await anonymous.call('/dashboard/tracer?periode_laporan_id='+report+'&tahun=2101')).body.meta.ringkasan;assert.equal((await read()).length,0);row=(await bpka.call(`/data/tracer-ringkasan/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal((await read()).length,0);row=(await prp.call(`/verification/tracer-ringkasan/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;assert.equal((await read())[0].responden,20);
      let rev=await form(bpka,'tracer-ringkasan',{...rv,responden:40,data_sementara:false},row);assert.equal((await read())[0].responden,20);rev=(await bpka.call(`/data/tracer-ringkasan/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;rev=(await prp.call(`/verification/tracer-ringkasan/${rev.id}/reject`,'POST',{row_version:rev.row_version})).body.data;assert.equal((await read())[0].responden,20);rev=await form(bpka,'tracer-ringkasan',{...rv,responden:40,data_sementara:false},rev);rev=(await bpka.call(`/data/tracer-ringkasan/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;assert.equal((await prp.call(`/verification/tracer-ringkasan/${rev.id}/approve`,'POST',{row_version:rev.row_version})).status,200);assert.equal((await read())[0].responden,40);assert.equal((await read())[0].data_sementara,false);
      const input=pm.kpi_inputs.find(x=>x.kode_input==='dosen_tetap_nidn_non_pln'),official=(await owner.query('SELECT id,nilai_numerik FROM kpi_capaian WHERE indikator_id=$1 AND is_current_approved',[input.indikator_id])).rows;
      let k=await form(prp,'kpi-input',{periode_laporan_id:report,periode_akademik_id:null,indikator_id:input.indikator_id,kode_input:input.kode_input,satuan:input.satuan,tanggal_snapshot:'2101-06-30',nilai_numerik:198});k=(await prp.call(`/data/kpi-input/${k.id}/submit`,'POST',{row_version:k.row_version})).body.data;assert.equal((await prp.call(`/verification/kpi-input/${k.id}/approve`,'POST',{row_version:k.row_version})).status,403);assert.equal((await admin.call(`/verification/kpi-input/${k.id}/approve`,'POST',{row_version:k.row_version})).status,200);assert.deepEqual((await owner.query('SELECT id,nilai_numerik FROM kpi_capaian WHERE indikator_id=$1 AND is_current_approved',[input.indikator_id])).rows,official);
    });
    await t.test('C3: AMI wajib login, PJM, NULL, revisi dan hanya approved',async()=>{
      for(const path of ['/ami.html','/a%6di.html','/AMI.HTML'])assert.equal((await fetch(base+path,{redirect:'manual'})).status,401);
      assert.equal((await anonymous.call('/dashboard/ami')).status,401);
      assert.equal((await viewer.call('/dashboard/ami')).status,200);
      assert.equal((await fetch(base+'/ami.html',{headers:{cookie:viewer.cookie}})).status,200);
      assert.equal((await fetch(base+'/input/pjm.html',{headers:{cookie:baa.cookie},redirect:'manual'})).status,403);
      assert.equal((await baa.call('/data/ami','POST',{})).status,403);
      const pjm=client();await pjm.login('pjm');assert.equal((await fetch(base+'/input/pjm.html',{headers:{cookie:pjm.cookie}})).status,200);
      assert.equal((await owner.query("SELECT perlu_verifikasi FROM definisi_formulir WHERE domain='ami'")).rows[0].perlu_verifikasi,true);
      const read=async()=>{const r=await viewer.call('/dashboard/ami?periode_laporan_id='+report+'&tahun=2099');assert.equal(r.headers.get('cache-control'),'no-store');return r.body;};
      let result=await pjm.call('/data/ami','POST',{periode_laporan_id:report,tahun:2099,kategori:'entitas-01',skor_standar:400,realisasi:100,capaian_laporan:25,jumlah_standar:67,kesenjangan:20,persen_kesenjangan:29.85,status_sumber:null});assert.equal(result.status,201);let row=result.body.data;
      assert.equal((await read()).data.length,0);row=(await pjm.call(`/data/ami/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal((await read()).data.length,0);
      assert.equal((await pjm.call(`/verification/ami/${row.id}/approve`,'POST',{row_version:row.row_version})).status,403);
      const diff=(await prp.call(`/verification/ami/${row.id}/diff`)).body.data;assert.ok(diff.flags.some(x=>x.kode==='ami-istilah-kesenjangan-awal'));
      row=(await prp.call(`/verification/ami/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;const before=await read();assert.equal(Number(before.data[0].realisasi),100);assert.equal(before.data[0].status_sumber,null);assert.match(before.meta.catatan,/bukan audit formal/);assert.equal(before.meta.rekap[3].jumlah_hitung,1);
      let rev=(await pjm.call(`/data/ami/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;rev=(await pjm.call(`/data/ami/${rev.id}`,'PATCH',{row_version:rev.row_version,realisasi:360,capaian_laporan:90,kesenjangan:0,persen_kesenjangan:0})).body.data;assert.deepEqual(await read(),before);
      rev=(await pjm.call(`/data/ami/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;assert.deepEqual(await read(),before);rev=(await prp.call(`/verification/ami/${rev.id}/reject`,'POST',{row_version:rev.row_version})).body.data;assert.deepEqual(await read(),before);
      rev=(await pjm.call(`/data/ami/${rev.id}`,'PATCH',{row_version:rev.row_version,capaian_laporan:90})).body.data;rev=(await pjm.call(`/data/ami/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;assert.equal((await prp.call(`/verification/ami/${rev.id}/approve`,'POST',{row_version:rev.row_version})).status,200);const after=await read();assert.equal(Number(after.data[0].realisasi),360);assert.equal(after.data[0].status_sumber,null);assert.equal(after.meta.ringkasan[0].kesiapan,90);assert.equal(after.meta.ringkasan[0].kesenjangan,0);assert.equal(after.meta.rekap[0].jumlah_hitung,1);
      assert.equal((await pjm.call('/data/ami','POST',{periode_laporan_id:report,tahun:2099,kategori:'rekap-80',jumlah_prodi:1,realisasi:3})).status,422);
      assert.equal((await pjm.call('/data/ami','POST',{periode_laporan_id:report,tahun:2099,kategori:'entitas-02',jumlah_prodi:1})).status,422);
      assert.equal((await pjm.call('/data/ami','POST',{periode_laporan_id:report,tahun:2099,kategori:'entitas-02',nama_auditor:'pribadi',minor:1})).status,422);assert.equal((await viewer.call('/dashboard/ami?nama_auditor=x')).status,422);
    });
    await t.test('Buang draft generik: revisi/baru, RBAC, versi, transaksi, riwayat dan audit metadata',async()=>{
      anonymous.csrf=(await anonymous.call('/auth/csrf')).body.data.csrf;
      const otherProdi=(await owner.query('SELECT id FROM prodi ORDER BY id DESC LIMIT 1')).rows[0].id;
      for(const [name,c,key]of [['mahasiswa-aktif',baa,{prodi_id:otherProdi,status_mhs:'cuti',periode_akademik_id:academic}],['formasi',bsdm,{kategori:'laporan-50',tahun:2199,periode_akademik_id:null}]]){
        const values={periode_laporan_id:report,...key,...(name==='formasi'?{jumlah:20,target:30}:{total:20,perempuan:10})},path='/data/'+name+'/discard-drafts';
        let row=(await c.call('/data/'+name,'POST',values)).body.data;assert.ok(row?.id);const body={confirmed:true,rows:[{id:row.id,row_version:row.row_version}]};
        assert.equal((await anonymous.call(path,'POST',body)).status,401);assert.equal((await c.call(path,'POST',body,false)).status,403);assert.equal((await (name==='formasi'?baa:bsdm).call(path,'POST',body)).status,403);assert.equal((await c.call(path,'POST',{...body,confirmed:false})).status,422);
        const originalUnit=(await owner.query('SELECT unit_id FROM users WHERE id=$1',[users[name==='formasi'?'bsdm':'baa'].id])).rows[0].unit_id;
        try{const foreignUnit=(await owner.query('SELECT unit_id FROM users WHERE id=$1',[users[name==='formasi'?'baa':'bsdm'].id])).rows[0].unit_id;await owner.query('UPDATE users SET unit_id=$1 WHERE id=$2',[foreignUnit,users[name==='formasi'?'bsdm':'baa'].id]);assert.equal((await c.call(path,'POST',body)).status,403);}finally{await owner.query('UPDATE users SET unit_id=$1 WHERE id=$2',[originalUnit,users[name==='formasi'?'bsdm':'baa'].id]);}
        assert.equal((await c.call(path,'POST',{...body,rows:[{id:row.id,row_version:row.row_version+1}]})).status,409);
        assert.equal((await c.call(path,'POST',body)).status,200);const form=(await c.call('/forms/'+name+'?periode_laporan_id='+report+(name==='formasi'?'':'&periode_akademik_id='+academic))).body;assert.ok(!form.data.some(x=>x.id===row.id));assert.ok(form.meta.discarded.some(x=>x.id===row.id));assert.ok((await c.call('/data/'+name+'/'+row.id)).body.meta.events.some(x=>x.status==='discarded'));assert.equal((await c.call('/data/'+name+'/'+row.id,'PATCH',{row_version:row.row_version+1})).status,409);
        row=(await c.call('/data/'+name,'POST',values)).body.data;assert.equal(row.versi,2);row=(await c.call(`/data/${name}/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;assert.equal((await c.call(path,'POST',{confirmed:true,rows:[{id:row.id,row_version:row.row_version}]})).status,409);
        row=(await prp.call(`/verification/${name}/${row.id}/approve`,'POST',{row_version:row.row_version})).body.data;assert.equal((await c.call(path,'POST',{confirmed:true,rows:[{id:row.id,row_version:row.row_version}]})).status,409);
        const table=name==='formasi'?'formasi_revisi':'mahasiswa_aktif',snapshot=(await owner.query(`SELECT * FROM ${table} WHERE is_current_approved ORDER BY id`)).rows;
        const dashboardPath='/dashboard/'+(name==='formasi'?'formasi':'mahasiswa')+'?periode_laporan_id='+report,dashboardBefore=await c.call(dashboardPath);assert.equal(dashboardBefore.status,200);
        let rev=(await c.call(`/data/${name}/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;const changed=await c.call(`/data/${name}/${rev.id}`,'PATCH',{row_version:rev.row_version,...(name==='formasi'?{jumlah:2}:{total:2,perempuan:1})});rev=changed.body.data;
        assert.equal((await c.call(path,'POST',{confirmed:true,rows:[{id:rev.id,row_version:rev.row_version},{id:row.id,row_version:row.row_version}]})).status,409);assert.equal((await c.call('/data/'+name+'/'+rev.id)).body.data.status,'draft','bulk rollback atomik');
        assert.equal((await c.call(path,'POST',{confirmed:true,rows:[{id:rev.id,row_version:rev.row_version}]})).status,200);assert.deepEqual((await owner.query(`SELECT * FROM ${table} WHERE is_current_approved ORDER BY id`)).rows,snapshot);
        assert.deepEqual((await c.call(dashboardPath)).body,dashboardBefore.body,'Endpoint dashboard tidak berubah saat draft dibuang');
        const latest=(await c.call('/forms/'+name+'?periode_laporan_id='+report+(name==='formasi'?'':'&periode_akademik_id='+academic))).body.data.find(x=>x.id===row.id);assert.equal(latest[name==='formasi'?'jumlah':'total'],20);
        rev=(await c.call(`/data/${name}/${row.id}/revision`,'POST',{row_version:row.row_version})).body.data;rev=(await c.call(`/data/${name}/${rev.id}/submit`,'POST',{row_version:rev.row_version})).body.data;rev=(await prp.call(`/verification/${name}/${rev.id}/reject`,'POST',{row_version:rev.row_version})).body.data;assert.equal((await c.call(path,'POST',{confirmed:true,rows:[{id:rev.id,row_version:rev.row_version}]})).status,409);
      }
      const events=(await owner.query("SELECT nilai_baru,nilai_lama FROM audit_log WHERE aksi='draft_discard' AND user_id=ANY($1::bigint[])",[[users.baa.id,users.bsdm.id]])).rows;assert.ok(events.length>=4);assert.ok(events.every(x=>x.nilai_baru.form&&x.nilai_baru.jumlah_baris>0&&!('total' in x.nilai_lama)&&!('jumlah' in x.nilai_baru)));
    });
    for(const [name,role,count,extra,academicRequired] of simpleCases)await t.test('E2: '+name+' '+(extra.cakupan??'')+' parser, izin unit dan draft',async()=>{
      const c=client();await c.login(role);
      const fresh=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,coalesce(max(tahun) FILTER(WHERE tahun>=2099),2098)+1,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id",['e2-'+name+'-'+(extra.cakupan??'')+'-'+run])).rows[0].id;
      const d=getDomain(name),def=formDefinitions[name],q=new URLSearchParams({periode:fresh,...(academicRequired?{periode_akademik_id:academic}:{}),...extra}),path='/forms/'+name;
      const upload=async(who,bytes)=>{const body=new FormData();body.append('file',new Blob([bytes]),'data.xlsx');const r=await fetch(base+'/api'+path+'/upload?'+q,{method:'POST',headers:{cookie:who.cookie,'x-csrf-token':who.csrf},body});return {status:r.status,body:await r.json()};};
      const policy=(await owner.query('SELECT perlu_verifikasi FROM definisi_formulir WHERE domain=$1',[name])).rows[0].perlu_verifikasi;
      try{
        const page='/input/'+role+'.html';
        const html=await fetch(base+page,{redirect:'manual',headers:{accept:'text/html'}});
        assert.equal(html.status,302);assert.equal(html.headers.get('location'),'/login.html?next='+encodeURIComponent(page));
        assert.equal(html.headers.get('cache-control'),'no-store');
        assert.equal((await fetch(base+page,{redirect:'manual',headers:{accept:'application/json'}})).status,401);
        assert.equal((await anonymous.call(path+'?'+q)).status,401);
        for(const who of [anonymous,viewer]){
          const expected=who===anonymous?401:403;
          assert.equal((await who.call(path+'/template?'+q)).status,expected);
          assert.equal((await upload(who,Buffer.from('invalid'))).status,expected);
          for(const suffix of ['/apply','/upload/cancel'])assert.equal((await who.call(path+suffix,'POST',{preview_id:randomUUID()})).status,expected);
        }
        // Correct role with wrong unit must still fail the domain ownership query.
        const original=(await owner.query('SELECT unit_id FROM users WHERE id=$1',[users[role].id])).rows[0].unit_id;
        try{await owner.query('UPDATE users SET unit_id=(SELECT id FROM unit WHERE kode=$1) WHERE id=$2',[role==='baa'?'BSDM':'BAA',users[role].id]);assert.equal((await c.call(path+'/template?'+q)).status,403);assert.equal((await upload(c,Buffer.from('invalid'))).status,403);for(const suffix of ['/apply','/upload/cancel'])assert.equal((await c.call(path+suffix,'POST',{preview_id:randomUUID()})).status,403);}
        finally{await owner.query('UPDATE users SET unit_id=$1 WHERE id=$2',[original,users[role].id]);}
        const response=await fetch(base+'/api'+path+'/template?'+q,{headers:{cookie:c.cookie}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
        const book=readWorkbook(Buffer.from(await response.arrayBuffer()));assert.deepEqual(Object.keys(book),['Petunjuk','Data','_meta']);assert.equal(book._meta.hidden,true);assert.equal(book.Data.rows.length,count+1);
        const sheets=Object.entries(book).map(([name,sheet])=>({name,hidden:sheet.hidden,rows:sheet.rows.map(row=>row.map(cell=>cell.value))}));
        const workbook=change=>{const copy=structuredClone(sheets);change(copy[1].rows);return makeWorkbook(copy);};
        const good=workbook(rows=>{rows[1][2]=12;});
        const missing=await upload(c,workbook(rows=>rows[0].pop()));assert.equal(missing.status,422);
        // At 1e18, +1 rounds back to the valid boundary in IEEE-754.
        const outside=def.columns[0].max*2;
        assert.ok(outside>def.columns[0].max);
        for(const invalid of ['bukan angka',-1,outside, ...(def.columns[0].integer?[1.5]:[])]){
          const result=await upload(c,workbook(rows=>{rows[1][2]=invalid;}));assert.equal(result.status,200);assert.ok(result.body.data.issues.some(x=>x.row===2));assert.ok(!result.body.data.rows.some(x=>x.row===2));
          
        }
        const duplicate=await upload(c,workbook(rows=>{if(count===1)rows.push(rows[1]);else rows[2][0]=rows[1][0];}));
        if(count===1)assert.equal(duplicate.status,422);else{assert.equal(duplicate.status,200);assert.equal(duplicate.body.data.issues.filter(x=>x.message.includes('duplikat')).length,2);}
        // Even auto-approval policy never publishes an Excel apply.
        assert.equal((await admin.call('/admin/formulir/'+name,'PATCH',{perlu_verifikasi:false})).status,200);
        const preview=await upload(c,good);assert.equal(preview.status,200,JSON.stringify(preview.body));assert.deepEqual(preview.body.data.issues,[]);assert.equal(preview.body.data.rows.length,count);
        for(const row of preview.body.data.rows)assert.deepEqual(validate(d,row.values),row.values);
        for(const invalid of ['bukan angka',-1,outside])assert.throws(()=>validate(d,{...preview.body.data.rows[0].values,[def.columns[0].key]:invalid}));
        assert.equal((await owner.query('SELECT count(*)::int AS n FROM '+d.table+' WHERE periode_laporan_id=$1',[fresh])).rows[0].n,0);
        const applied=await c.call(path+'/apply','POST',{preview_id:preview.body.data.id});assert.equal(applied.status,200,JSON.stringify(applied.body));assert.equal(applied.body.data.length,count);assert.ok(applied.body.data.every(row=>row.status==='draft'&&!row.is_current_approved));assert.equal(Number(applied.body.data[0][def.columns[0].key]),12);
        if(extra.cakupan==='institusi')assert.equal(applied.body.data[0].prodi_id,null);
        assert.equal((await c.call(path+'/apply','POST',{preview_id:preview.body.data.id})).status,409);
        const cancel=await upload(c,good);assert.equal((await c.call(path+'/upload/cancel','POST',{preview_id:cancel.body.data.id})).status,200);
      }finally{
        assert.equal((await admin.call('/admin/formulir/'+name,'PATCH',{perlu_verifikasi:policy})).status,200);
        await owner.query('DELETE FROM '+d.table+' WHERE periode_laporan_id=$1',[fresh]);await owner.query('DELETE FROM periode_laporan WHERE id=$1',[fresh]);
      }
    });
    await t.test('E1: template registry, preview, RBAC/CSRF, error sel, draft/revisi tanpa publikasi',async()=>{
      anonymous.csrf=(await anonymous.call('/auth/csrf')).body.data.csrf;
      const edit=(bytes,fn)=>{const f=Object.fromEntries(Object.entries(unzipSync(bytes)).map(([k,v])=>[k,strFromU8(v)]));fn(f);return Buffer.from(zipSync(Object.fromEntries(Object.entries(f).map(([k,v])=>[k,strToU8(v)])),{level:6}));};
      const upload=async(c,name,q,bytes,filename='data.xlsx',csrf=true)=>{const data=new FormData();data.append('file',new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),filename);const r=await fetch(base+'/api/forms/'+name+'/upload?'+q,{method:'POST',headers:{cookie:c.cookie,...(csrf?{'x-csrf-token':c.csrf}:{})},body:data});return {status:r.status,body:await r.json()};};
      const setCell=(f,ref,value)=>{f['xl/worksheets/sheet2.xml']=f['xl/worksheets/sheet2.xml'].replace(new RegExp('<c r="'+ref+'".*?</c>'),'<c r="'+ref+'" t="inlineStr"><is><t>'+value+'</t></is></c>');};
      for(const [name,c,n]of [['mahasiswa-aktif',baa,19],['formasi',bsdm,50]]){
        const q=new URLSearchParams({periode:report,...(name==='formasi'?{tahun:2099}:{periode_akademik_id:academic,status_mhs:'nonaktif'})}).toString(),path='/api/forms/'+name+'/template?'+q;
        assert.equal((await fetch(base+path)).status,401);assert.equal((await fetch(base+path,{headers:{cookie:(name==='formasi'?baa:bsdm).cookie}})).status,403);
        const template=await fetch(base+path,{headers:{cookie:c.cookie}});assert.equal(template.status,200);assert.equal(template.headers.get('cache-control'),'no-store');const bytes=Buffer.from(await template.arrayBuffer()),xml=strFromU8(unzipSync(bytes)['xl/worksheets/sheet2.xml']);assert.equal((xml.match(/<row /g)??[]).length,n+1);for(const col of formDefinitions[name].columns)assert.ok(xml.includes(col.label));assert.match(xml,/r="A2" s="1"/);
        assert.equal((await upload(c,name,q,bytes,'data.xlsx',false)).status,403);assert.equal((await upload(name==='formasi'?baa:bsdm,name,q,bytes)).status,403);assert.equal((await upload(anonymous,name,q,bytes)).status,401);
        for(const filename of ['data.csv','data.xlsm'])assert.equal((await upload(c,name,q,bytes,filename)).status,422);
        assert.equal((await upload(c,name,q,Buffer.alloc(5*1024*1024+1))).status,413);assert.equal((await upload(c,name,q,Buffer.from('corrupt'))).status,422);
        const old=edit(bytes,f=>{f['xl/worksheets/sheet3.xml']=f['xl/worksheets/sheet3.xml'].replace('<v>1</v>','<v>0</v>');});assert.match((await upload(c,name,q,old)).body.error.message,/lama/);
        const oldHash=edit(bytes,f=>{f['xl/worksheets/sheet3.xml']=f['xl/worksheets/sheet3.xml'].replace(/>[a-f0-9]{64}</,'>'+('0'.repeat(64))+'<');});assert.equal((await upload(c,name,q,oldHash)).status,422);
        const inputs=['abc','-1','=1+1','@SUM(A1)','-','0','1.234',null];
        const bad=edit(bytes,f=>{inputs.forEach((v,i)=>{if(v!==null)setCell(f,'C'+(i+2),v);});setCell(f,'A10','unknown');const code=/<c r="A11".*?<t[^>]*>(.*?)<\/t>/.exec(f['xl/worksheets/sheet2.xml'])[1];setCell(f,'A12',code);});
        const parsed=await upload(c,name,q,bad);assert.equal(parsed.status,200);assert.ok(parsed.body.data.issues.length>=7);assert.equal((await c.call('/forms/'+name+'/apply','POST',{preview_id:parsed.body.data.id})).status,422);
        const rows=parsed.body.data.rows,key=name==='formasi'?'jumlah':'total';assert.equal(rows.find(x=>x.row===6).values[key],null);assert.equal(rows.find(x=>x.row===7).values[key],0);assert.equal(rows.find(x=>x.row===8).values[key],1234);assert.equal(rows.find(x=>x.row===9).values[key],null);
        const partial=await c.call('/forms/'+name+'/apply','POST',{preview_id:parsed.body.data.id,valid_only:true,confirm_overwrite:true});assert.equal(partial.status,200);assert.ok(partial.body.data.every(x=>x.status==='draft'));
        const table=name==='formasi'?'formasi_revisi':'mahasiswa_aktif',where=name==='formasi'?"tahun=2099":"status_mhs='nonaktif'",before=(await owner.query(`SELECT count(*)::int AS n FROM ${table} WHERE periode_laporan_id=$1 AND ${where}`,[report])).rows[0].n;
        const good=edit(bytes,f=>{setCell(f,'C2','12');setCell(f,'D2','5');if(name==='formasi')setCell(f,'F2','@SUM(ini teks)');});
        let p=await upload(c,name,q,good);assert.equal(p.status,200);assert.deepEqual(p.body.data.issues,[]);assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${table} WHERE periode_laporan_id=$1 AND ${where}`,[report])).rows[0].n,before,'preview tidak menulis tabel domain');
        const approved=await owner.query(`SELECT * FROM ${table} WHERE periode_laporan_id=$1 AND ${where} AND is_current_approved ORDER BY id`,[report]);
        const policy=(await owner.query('SELECT perlu_verifikasi FROM definisi_formulir WHERE domain=$1',[name])).rows[0];assert.equal((await admin.call('/admin/formulir/'+name,'PATCH',{perlu_verifikasi:false})).status,200);
        let applied;try{applied=await c.call('/forms/'+name+'/apply','POST',{preview_id:p.body.data.id,confirm_overwrite:true});assert.equal(applied.status,200,JSON.stringify(applied.body));assert.equal(applied.body.data.length,n);assert.ok(applied.body.data.every(x=>x.status==='draft'&&!x.is_current_approved));}finally{await admin.call('/admin/formulir/'+name,'PATCH',{perlu_verifikasi:policy.perlu_verifikasi});}
        assert.deepEqual((await owner.query(`SELECT * FROM ${table} WHERE periode_laporan_id=$1 AND ${where} AND is_current_approved ORDER BY id`,[report])).rows,approved.rows,'approved tidak berubah');assert.equal((await c.call('/forms/'+name+'/apply','POST',{preview_id:p.body.data.id,confirm_overwrite:true})).status,409);
        p=await upload(c,name,q,good);assert.ok(p.body.data.has_existing);assert.equal((await c.call('/forms/'+name+'/apply','POST',{preview_id:p.body.data.id})).status,409);assert.equal((await c.call('/forms/'+name+'/apply','POST',{preview_id:p.body.data.id,confirm_overwrite:true})).status,200);
        // Satu draft diterbitkan dengan alur review existing; upload berikutnya hanya membuat revisi draft.
        let row=(await owner.query(`SELECT * FROM ${table} WHERE id=$1`,[applied.body.data[0].id])).rows[0];
        row=(await c.call(`/data/${name}/${row.id}/submit`,'POST',{row_version:row.row_version})).body.data;
        assert.equal(row.status,'submitted');p=await upload(c,name,q,good);assert.ok(p.body.data.issues.some(x=>x.column==='Status'));assert.equal((await c.call('/forms/'+name+'/apply','POST',{preview_id:p.body.data.id,confirm_overwrite:true})).status,422);
        const review=await prp.call(`/verification/${name}/${row.id}/approve`,'POST',{row_version:row.row_version});assert.equal(review.status,200);const snapshot=(await owner.query(`SELECT * FROM ${table} WHERE id=$1`,[row.id])).rows[0];
        p=await upload(c,name,q,edit(good,f=>setCell(f,'C2','13')));assert.equal((await c.call('/forms/'+name+'/apply','POST',{preview_id:p.body.data.id})).status,409);const revision=await c.call('/forms/'+name+'/apply','POST',{preview_id:p.body.data.id,confirm_overwrite:true});assert.equal(revision.status,200);assert.equal(revision.body.data[0].status,'draft');assert.equal(revision.body.data[0].versi,snapshot.versi+1);assert.deepEqual((await owner.query(`SELECT * FROM ${table} WHERE id=$1`,[row.id])).rows[0],snapshot);
      }
      const events=(await owner.query("SELECT aksi,nilai_baru FROM audit_log WHERE user_id=ANY($1::bigint[]) AND tabel='form_excel'",[[users.baa.id,users.bsdm.id]])).rows;for(const action of ['template_download','template_upload','template_apply'])assert.ok(events.some(x=>x.aksi===action));assert.ok(events.every(x=>!JSON.stringify(x).includes('@SUM')));
    });
    await xlsxCompatibilityCases(t,{base,admin,baa,owner,report,academic});
    await t.test('Fase 5A: dev skip dihormati login, halaman dan write; flag database tidak diubah',async()=>{
      await owner.query('UPDATE users SET must_change_password=true WHERE id=$1',[users.baa.id]);
      const saved={node:process.env.NODE_ENV,skip:process.env.DEV_SKIP_PASSWORD_CHANGE};let dev;
      try{process.env.NODE_ENV='development';process.env.DEV_SKIP_PASSWORD_CHANGE='true';dev=createApp({pool,secret:randomBytes(48).toString('hex')});}
      finally{if(saved.node===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=saved.node;if(saved.skip===undefined)delete process.env.DEV_SKIP_PASSWORD_CHANGE;else process.env.DEV_SKIP_PASSWORD_CHANGE=saved.skip;}
      const server=dev.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}`;
      try{let r=await fetch(url+'/api/auth/csrf'),cookie=r.headers.get('set-cookie').split(';')[0],token=(await r.json()).data.csrf;
        r=await fetch(url+'/api/auth/login',{method:'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':token},body:JSON.stringify({email:users.baa.email,password:pw})});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];const login=(await r.json()).data;assert.equal(login.user.must_change_password,false);
        assert.equal((await fetch(url+'/input/baa.html',{headers:{cookie},redirect:'manual'})).status,200);
        r=await fetch(url+'/api/data/dosen',{method:'POST',headers:{cookie,'content-type':'application/json','x-csrf-token':login.csrf},body:'{}'});assert.equal((await r.json()).error.code,'REQUEST_REJECTED');assert.equal(r.status,403);
        assert.equal((await owner.query('SELECT must_change_password FROM users WHERE id=$1',[users.baa.id])).rows[0].must_change_password,true);
      }finally{dev.locals.store.close();await new Promise(r=>server.close(r));await owner.query('UPDATE users SET must_change_password=false WHERE id=$1',[users.baa.id]);}
    });
    await t.test('Ganti password mencabut session lain dan gate wajib ganti ditegakkan',async()=>{
      const other=client();await other.login('bsdm');
      await owner.query('UPDATE users SET must_change_password=true WHERE id=$1',[users.bsdm.id]);
      assert.equal((await bsdm.call('/data/dosen','POST',{})).body.error.code,'PASSWORD_CHANGE_REQUIRED');
      const result=await bsdm.call('/auth/change-password','POST',{old_password:pw,new_password:randomBytes(18).toString('hex')});assert.equal(result.status,200);bsdm.csrf=result.body.data.csrf;
      assert.equal((await bsdm.call('/auth/me')).status,200);assert.equal((await other.call('/auth/me')).status,401);
    });
    await t.test('Rate limit menolak percobaan login berulang',async()=>{
      const limited=createApp({pool,passwordEnv:{},loginLimit:1,secret:randomBytes(48).toString('hex')}),s=limited.listen(0,'127.0.0.1');await new Promise(resolve=>s.once('listening',resolve));
      try{const url=`http://127.0.0.1:${s.address().port}/api/auth`,tokenResponse=await fetch(url+'/csrf'),token=(await tokenResponse.json()).data.csrf;
        const headers={'content-type':'application/json','x-csrf-token':token,cookie:tokenResponse.headers.get('set-cookie').split(';')[0]},body=JSON.stringify({email:'unknown@test.invalid',password:pw});
        assert.equal((await fetch(url+'/login',{method:'POST',headers,body})).status,401);assert.equal((await fetch(url+'/login',{method:'POST',headers,body})).status,429);
      }finally{limited.locals.store.close();await new Promise(resolve=>s.close(resolve));}
    });
    await t.test('Logout/role change cabut session, tanpa hash/password di audit',async()=>{
      assert.equal((await admin.call(`/admin/users/${users.viewer.id}`,'PATCH',{aktif:false})).status,200);assert.equal((await viewer.call('/auth/me')).status,401);
      assert.equal((await baa.call('/auth/logout','POST',{})).status,200);assert.equal((await baa.call('/auth/me')).status,401);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM audit_log WHERE nilai_baru ? 'password_hash' OR nilai_lama ? 'password_hash'")).rows[0].n,0);
    });
  }finally{
    app.locals.store.close();await new Promise(resolve=>server.close(resolve));await pool.end();
    // Bersihkan hanya fixture invocation ini pada DB _test; audit append-only tetap dipertahankan.
    await owner.query('DELETE FROM pmb_peminat WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM import_batch WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM kpi_input WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM kpi_capaian WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM rka_revisi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM pegawai_ringkasan WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM tracer_ringkasan WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM lulusan WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM tracer_study WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM mahasiswa_angkatan WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM mahasiswa_baru WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM dosen_prodi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM akreditasi_revisi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM prestasi_revisi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM kerjasama_revisi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM produktivitas_dosen_revisi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM ami_revisi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM keuangan_revisi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM formasi_revisi WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM pergerakan_pegawai_revisi WHERE periode_laporan_id=$1',[report]);
    for(const name of ['penelitian','hki','pkm'])await owner.query(`DELETE FROM ${name}_revisi WHERE periode_laporan_id=$1`,[report]);
    await owner.query('DELETE FROM iku_capaian WHERE periode_laporan_id=$1',[report]);
    await owner.query('DELETE FROM periode_laporan WHERE id=$1 AND kode=$2',[report,'test-'+run]);
    await owner.query('DELETE FROM periode_akademik WHERE id=$1 AND kode=$2',[academic,'test-'+run]);
    await owner.query('UPDATE users SET aktif=false,session_version=session_version+1 WHERE id=ANY($1::bigint[])',[Object.values(users).map(u=>u.id)]);
    await owner.end();
  }
});
