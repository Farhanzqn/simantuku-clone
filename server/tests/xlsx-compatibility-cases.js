import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {excelForms} from '../../static-web/assets/js/excel-schema.js';
import {templateHash} from '../routes/form-excel.js';
import {readWorkbook} from '../services/form-xlsx.js';
import {assertDownload,assertTemplateStructure} from './xlsx-structure.js';
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export async function externalFixture(name,context){
 // Only bind metadata to this invocation's isolated _test period. Worksheet,
 // styles, cell representations and relationships come from an external writer.
 const files=unzipSync(await readFile(new URL('./fixtures/external/'+name,import.meta.url)));
 let replacements=0;
 for(const [path,bytes]of Object.entries(files))if(path.endsWith('.xml')){
  let s=strFromU8(bytes);if(s.includes('FIXTURE_CONTEXT')){s=s.replace('FIXTURE_CONTEXT',xml(JSON.stringify(context)));replacements++;}
  s=s.replace('FIXTURE_SCHEMA_HASH',templateHash('mahasiswa-aktif'));files[path]=strToU8(s);
 }
 assert.equal(replacements,1);return Buffer.from(zipSync(files,{level:0}));
}
export async function xlsxCompatibilityCases(t,{base,admin,baa,owner,report,academic}){
 const directory='.runtime/xlsx-diag/api';await mkdir(directory,{recursive:true});const paths=[];
 await t.test('XLSX: header HTTP dan struktur ZIP/OOXML seluruh 10 form + lulusan institusi',async()=>{
  const headers=[];
  for(const [name,config]of Object.entries(excelForms))for(const cakupan of name==='lulusan'?['prodi','institusi']:['prodi']){
   const all={periode_laporan_id:report,periode_akademik_id:academic,status_mhs:'aktif',tahun:2099,tahun_masuk:2099,tahun_lulus:2099,tanggal_snapshot:'2099-06-30',cakupan,periode_wisuda:'Uji interoperabilitas'};
   if(cakupan==='institusi'){delete all.periode_akademik_id;delete all.periode_wisuda;}
   const ctx=Object.fromEntries(config.context.filter(k=>all[k]!==undefined).map(k=>[k,all[k]]));
   const res=await fetch(base+'/api/forms/'+name+'/template?'+new URLSearchParams(ctx),{headers:{cookie:admin.cookie,'accept-encoding':'identity'}});
   assert.equal(res.status,200);const bytes=Buffer.from(await res.arrayBuffer());assertDownload(res.headers,bytes,name);assertTemplateStructure(bytes);
   const file=directory+'/'+name+(name==='lulusan'?'-'+cakupan:'')+'-template.xlsx';await writeFile(file,bytes);paths.push(file);
   headers.push({file,size:bytes.length,magic:bytes.subarray(0,4).toString('hex'),headers:Object.fromEntries([...res.headers].filter(([k])=>k!=='set-cookie'))});
  }
  assert.equal(paths.length,11);await writeFile(directory+'/responses.json',JSON.stringify(headers,null,2));
 });
 await t.test('XLSX: pembaca independen openpyxl (opsional)',async t=>{
  const candidates=process.env.PYTHON_BINARY?[[process.env.PYTHON_BINARY,[]]]:[['py',['-3']],['python',[]],['python3',[]]];
  const command=candidates.find(([exe,args])=>spawnSync(exe,[...args,'-c','import openpyxl'],{windowsHide:true,timeout:5000,encoding:'utf8'}).status===0);
  if(!command){t.skip('Python + openpyxl tidak tersedia; gunakan PYTHON_BINARY. Bukti ExcelJS/Excel desktop dicatat terpisah.');return;}
  const [exe,args]=command,result=spawnSync(exe,[...args,'server/tests/xlsx-openpyxl.py',...paths],{windowsHide:true,timeout:30000,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.error?.message);t.diagnostic(result.stdout.trim());
 });
 await t.test('XLSX: pembaca independen ExcelJS scratch (opsional)',async t=>{
  let ExcelJS;try{ExcelJS=(await import('../../.runtime/xlsx-diag/scratch/node_modules/exceljs/excel.js')).default;}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;t.skip('ExcelJS scratch tidak tersedia; tidak dipasang sebagai dependency proyek.');return;}
  // ExcelJS omits protection when it equals the OOXML default (locked=true).
  for(const file of paths){const book=new ExcelJS.Workbook();await book.xlsx.readFile(file);assert.deepEqual(book.worksheets.map(s=>s.name),['Petunjuk','Data','_meta']);assert.equal(book.getWorksheet('_meta').state,'hidden');assert.equal(book.getWorksheet('Data').sheetProtection.sheet,true);assert.equal(book.getWorksheet('Data').getCell('A2').protection?.locked??true,true);assert.equal(book.getWorksheet('Data').getCell('C2').protection.locked,false);}
 });
 await t.test('XLSX: upload penulis eksternal shared/inline/str, sparse/styled empty rows, absolute/relative, save-as Excel; apply hanya draft',async()=>{
  const ctx={periode_laporan_id:Number(report),periode_akademik_id:Number(academic),status_mhs:'cuti'};
  const q=new URLSearchParams(ctx),sql='SELECT * FROM mahasiswa_aktif WHERE periode_laporan_id=$1 ORDER BY id';
  for(const file of ['exceljs-shared-relative.xlsx','exceljs-inline-absolute.xlsx','excel16-resaved.xlsx']){
   const bytes=await externalFixture(file,ctx),book=readWorkbook(bytes);assert.equal(book.Data.rows[1][2].value,12);assert.equal(book._meta.hidden,true);
   const before=(await owner.query(sql,[report])).rows,approved=before.filter(x=>x.is_current_approved);
   const body=new FormData();body.append('file',new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),file);
   const res=await fetch(base+'/api/forms/mahasiswa-aktif/upload?'+q,{method:'POST',headers:{cookie:baa.cookie,'x-csrf-token':baa.csrf},body});const result=await res.json();assert.equal(res.status,200,JSON.stringify(result));
   assert.deepEqual(result.data.issues,[],file);assert.equal(result.data.rows[0].values.total,12);assert.equal(result.data.rows[1].values.total,0);assert.equal(result.data.rows[1].row,file.startsWith('exceljs')?4:3);
   assert.deepEqual((await owner.query(sql,[report])).rows,before,'preview does not write domain');
   const applied=await baa.call('/forms/mahasiswa-aktif/apply','POST',{preview_id:result.data.id,confirm_overwrite:true});assert.equal(applied.status,200,JSON.stringify(applied.body));assert.ok(applied.body.data.every(r=>r.status==='draft'&&!r.is_current_approved));
   assert.deepEqual((await owner.query(sql,[report])).rows.filter(x=>x.is_current_approved),approved);
  }
 });
}
