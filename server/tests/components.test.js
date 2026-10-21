import {test} from 'node:test';
import './error-handling-cases.js';
import assert from 'node:assert/strict';
import {unzipSync,strFromU8} from 'fflate';
import {workbook} from '../../static-web/assets/js/excel.js';
import {selectedValue} from '../../static-web/assets/js/filter-bar.js';
import {formTransfer} from '../../static-web/assets/js/api.js';
import {makeWorkbook} from '../services/form-xlsx.js';
import {createHash} from 'node:crypto';
import {confirmedRows,submitDescription,confirmedPreview} from '../../static-web/assets/js/form-feedback.js';
import {serverFieldMessage} from '../../static-web/assets/js/validation-message.js';
test('Umpan balik: terjemahan hasil validator memakai batas server dan menolak pesan asing',()=>{
 assert.equal(serverFieldMessage('Too big: expected number to be <=2147483647'),'Nilai harus <= 2147483647.');
 assert.equal(serverFieldMessage('Too small: expected number to be >=0'),'Nilai harus >= 0.');
 assert.equal(serverFieldMessage('Too big: expected string to have <=2000 characters'),'Panjang teks maksimal 2000 karakter.');
 assert.equal(serverFieldMessage('Invalid input: expected int, received number'),'Harus berupa angka bulat.');
 assert.doesNotMatch(serverFieldMessage('SQL private sentinel <script>'),/SQL|sentinel|script/);
});

test('Umpan balik: status balasan server menentukan pesan, struktur invalid tidak menjadi sukses',()=>{
 const row={id:'12',row_version:2,status:'submitted'},response={data:[row]};
 assert.equal(submitDescription(confirmedRows(response,1,['submitted','approved'])),'Menunggu verifikasi PRP/admin');
 assert.equal(submitDescription([{...row,status:'approved'}]),'Data disimpan dan langsung disetujui');
 assert.match(submitDescription([row,{...row,status:'approved'}]),/1 baris menunggu.*1 baris langsung/);
 for(const data of [null,{},[],[{...row,status:'draft'}],[{...row,row_version:null}]])assert.throws(()=>confirmedRows({data,[Symbol.for('itpln.request-id')]:'feedback-id'},1,['submitted','approved']),e=>e.uncertain&&e.type==='response'&&e.requestId==='feedback-id');
 assert.throws(()=>confirmedRows(response,1,['draft']),e=>e.uncertain);
 assert.throws(()=>confirmedRows(response,[{id:'13'}],['submitted']),e=>e.uncertain);
 assert.equal(confirmedRows(response,[{id:'12'}],['submitted']).length,1);
});
test('Umpan balik: 422 mempertahankan field path aman tanpa pesan mentah',async()=>{
 const original=globalThis.fetch;try{globalThis.fetch=async()=>new Response(JSON.stringify({error:{code:'VALIDATION_ERROR',fields:[{field:'total',message:'private sentinel'},{field:'<script>',message:'bad'}]}}),{status:422,headers:{'content-type':'application/json','x-request-id':'feedback-id'}});
 const {request}=await import('../../static-web/assets/js/api.js');await assert.rejects(request('/feedback-field-fixture'),e=>{assert.deepEqual(e.fields,[{field:'total',message:'Isian ditolak server. Periksa nilai dan konteks baris ini.'}]);assert.equal(e.requestId,'feedback-id');assert.ok(!e.message.includes('sentinel'));return true;});
 }finally{globalThis.fetch=original;}
});

test('Unduhan: body sekali, tolak 200 kosong/HTML/ZIP terpotong/checksum salah sebelum Blob',async()=>{
 const original=globalThis.fetch,mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
 const bytes=makeWorkbook([{name:'Data',rows:[['aman']]}]),headers={'content-type':mime,'content-length':String(bytes.length),'x-template-sha256':createHash('sha256').update(bytes).digest('hex')};
 try{
  let response;globalThis.fetch=async()=>response=new Response(bytes,{headers});const blob=await formTransfer('/forms/mahasiswa-aktif/template');assert.equal(response.bodyUsed,true);assert.deepEqual(Buffer.from(await blob.arrayBuffer()),bytes);
  const corrupt=Buffer.from(bytes);corrupt[60]^=1;
  for(const [body,change]of [[null,{'content-length':'0'}],['<html>login</html>',{'content-type':'text/html'}],[bytes.subarray(0,30),{'content-length':'30'}],[bytes,{'content-length':'0'}],[bytes,{'x-template-sha256':'bad'}],[corrupt,{}]]){
   globalThis.fetch=async()=>new Response(body,{headers:{...headers,...change}});await assert.rejects(formTransfer('/forms/mahasiswa-aktif/template'),{code:'INVALID_TEMPLATE'});
  }
  globalThis.fetch=async()=>new Response('gateway unavailable',{status:503});await assert.rejects(formTransfer('/forms/mahasiswa-aktif/template'),{status:503});
  globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.error(Error('truncated transfer'));}}),{headers});await assert.rejects(formTransfer('/forms/mahasiswa-aktif/template'),{code:'INVALID_TEMPLATE'});
 }finally{globalThis.fetch=original;}
});
test('B1: XLSX valid berisi nilai terfilter, angka/nol/NULL dan teks aman',()=>{
 const bytes=workbook([['Program studi','Jumlah','Catatan'],['Prodi A',0,null],['Prodi B',1234,'<&" Indonesia'],['=HYPERLINK("x")',null,'belum tersedia']]);
 assert.deepEqual([...bytes.slice(0,2)],[80,75]);
 const files=unzipSync(bytes);assert.equal(Object.keys(files).length,5);
 const sheet=strFromU8(files['xl/worksheets/sheet1.xml']);
 assert.match(sheet,/<c r="B2"><v>0<\/v><\/c>/);assert.match(sheet,/<v>1234<\/v>/);assert.ok(!sheet.includes('r="C2"'));assert.ok(!sheet.includes('<f>'));
 assert.match(sheet,/&lt;&amp;&quot; Indonesia/);assert.match(sheet,/t="inlineStr"/);
 assert.match(strFromU8(files['xl/workbook.xml']),/name="Data ITPLN"/);
 assert.match(strFromU8(files['xl/_rels/workbook.xml.rels']),/Target="worksheets\/sheet1.xml"/);
});
test('B1: filter URL hanya menerima nilai master yang tersedia',()=>{
 const options=[['','Semua'],[1,'Satu'],[2,'Dua']];
 assert.equal(selectedValue(new URLSearchParams('prodi_id=2'),'prodi_id',options,1),'2');
 assert.equal(selectedValue(new URLSearchParams('prodi_id=999'),'prodi_id',options,1),'1');
 assert.equal(selectedValue(new URLSearchParams('prodi_id=<script>'),'prodi_id',options,1),'1');
});

import {accreditationSummary} from '../services/accreditation.js';
import {expiryLabel,safeCertificate,totalsConsistent} from '../../static-web/assets/js/accreditation-model.js';
test('Pimpinan sesi 2: rekap master, NULL, sumber tidak terpetakan dan duplikat tidak menggandakan total',()=>{
 const master=[{id:1,nama:'A',jenjang:'D3'},{id:2,nama:'B',jenjang:'S1'},{id:3,nama:'C',jenjang:'S1'}];
 const rows=[{cakupan:'prodi',prodi_id:'1',peringkat:'Baik'},{cakupan:'prodi',prodi_id:'1',peringkat:'Unggul'},{cakupan:'prodi',prodi_id:2,peringkat:'Baik'},{cakupan:'prodi',prodi_id:null,peringkat:'Unggul'}];
 const s=accreditationSummary(master,rows);assert.equal(s.total_master,3);assert.equal(s.total_rekap,3);assert.equal(s.tanpa_data,1);assert.equal(s.duplikat,1);assert.equal(s.jumlah_peringkat,1);assert.ok(totalsConsistent(s));assert.equal(s.prodi[2].peringkat,null);assert.ok(Math.abs(s.rekap_master.reduce((n,r)=>n+r.persentase,0)-100)<1e-8);
 assert.equal(totalsConsistent({...s,total_master:4}),false);assert.ok(totalsConsistent(accreditationSummary([],[])));
});
test('Pimpinan sesi 2: lencana batas 12 bulan kalender dan sertifikat aman',()=>{
 for(const [end,expected] of [[null,''],['2026-10-11','Masa berlaku sudah lewat'],['2026-10-12','Masa berlaku akan habis ≤12 bulan'],['2027-10-12','Masa berlaku akan habis ≤12 bulan'],['2027-10-13','']])assert.equal(expiryLabel(end,'2026-10-12'),expected);
 assert.equal(expiryLabel('2025-02-28','2024-02-29'),'Masa berlaku akan habis ≤12 bulan');assert.equal(expiryLabel('2025-03-01','2024-02-29'),'');
 for(const url of [null,'javascript:alert(1)','data:text/html,x','/missing'])assert.equal(safeCertificate(url),null);
 assert.equal(safeCertificate('https://example.org/a.pdf'),'https://example.org/a.pdf');
});

test('Umpan balik: pratinjau invalid memakai hasil tak pasti dan ID, tanpa merender sukses',()=>{
 const data={id:'preview',rows:[{row:2,code:'01',label:'Prodi',values:{total:null},warnings:[]}],issues:[],has_existing:false,overwritten_cells:0};assert.equal(confirmedPreview({data}),data);
 for(const bad of [{}, {...data,rows:null},{...data,issues:[{row:2}]},{...data,rows:[{row:2}]}])assert.throws(()=>confirmedPreview({data:bad,[Symbol.for('itpln.request-id')]:'preview-id'}),e=>e.uncertain&&e.requestId==='preview-id');
});

import {kpiBand,kpiCounts,filterKpi,kpiThresholds} from '../../static-web/assets/js/kpi-status.js';
import {ikuThresholds} from '../../static-web/assets/js/iku-schema.js';
test('KPI status: batas memakai ambang IKU bersama dan capaian server untuk arah terbalik',()=>{
 assert.equal(kpiThresholds,ikuThresholds);
 const rows=[69.9,70,99.9,100,167.57,null].map(persen_capaian=>({persen_capaian,arah:'lower_is_better',target_nilai:90,nilai_numerik:53.71}));
 assert.deepEqual(rows.map(r=>kpiBand(r.persen_capaian)),['danger','warning','warning','success','success','unknown']);
 assert.deepEqual(kpiCounts(rows),{success:2,warning:2,danger:1,unknown:1});
 assert.deepEqual(filterKpi(rows,'success'),[rows[3],rows[4]]);assert.equal(filterKpi(rows,''),rows);
 for(const value of [null,undefined,'',NaN])assert.equal(kpiBand(value),'unknown');
 assert.equal(kpiBand(0),'danger');assert.equal(kpiBand('70'),'warning');
});
