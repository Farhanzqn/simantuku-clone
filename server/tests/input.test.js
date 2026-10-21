import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCell,formDefinitions,warnings} from '../../static-web/assets/js/input-schema.js';
import {difference} from '../../static-web/assets/js/api.js';
test('Tempel spreadsheet: ribuan, whitespace, kosong, nol dan sel invalid',()=>{
 const c=formDefinitions['mahasiswa-aktif'].columns[0];
 for(const value of ['1.234','1,234','1 234',' 1\u00a0234 '])assert.equal(parseCell(value,c).value,1234);
 assert.equal(parseCell('',c).value,null);assert.equal(parseCell('  ',c).value,null);assert.equal(parseCell('0',c).value,0);
 for(const value of ['bukan angka','1x','-1','1.2','Infinity','12.34.56'])assert.ok(parseCell(value,c).error);
 const ipk=formDefinitions.lulusan.columns[1];assert.equal(parseCell('3,75',ipk).value,3.75);assert.equal(parseCell('3.75',ipk).value,3.75);assert.ok(parseCell('4,1',ipk).error);
});
test('Anomali menjadi warning; nilai NULL tidak dibandingkan sebagai nol',()=>{
 assert.equal(warnings('mahasiswa-aktif',{total:1,perempuan:2}).length,1);assert.equal(warnings('mahasiswa-aktif',{total:null,perempuan:2}).length,0);
 assert.equal(warnings('dosen',{total:2,tenaga_pengajar:1,asisten_ahli:1,lektor:1,lektor_kepala:0,guru_besar:0}).length,1);
 assert.equal(warnings('mahasiswa-baru',{target:10,realisasi_daftar_ulang:100}).length,1);
});
test('D1: perubahan negatif/accounting; kolom lain tetap nonnegatif',()=>{
 const c=formDefinitions.keuangan.columns.find(x=>x.key==='perubahan');
 for(const value of ['(5.310.639.000)','-5.310.639.000',' -5 310 639 000 '])assert.equal(parseCell(value,c).value,-5310639000);
 assert.equal(parseCell('(45.994.239.000)',c).value,-45994239000);assert.equal(parseCell('-1,25',c).value,-1.25);assert.equal(parseCell('',c).value,null);assert.equal(parseCell('0',c).value,0);
 for(const value of ['(x)','--5','-','(1)(2)'])assert.ok(parseCell(value,c).error);
 assert.ok(parseCell('(5)',formDefinitions.keuangan.columns[0]).error);assert.ok(parseCell('-5',formDefinitions.keuangan.columns[0]).error);
});
test('Turunan grafik menjaga data belum lengkap dan tidak membuat angka negatif',()=>{
 assert.equal(difference([{total:10,s3:null}],'total','s3'),null);assert.equal(difference([{total:10,s3:12}],'total','s3'),null);assert.equal(difference([{total:10,s3:3}],'total','s3'),7);
});


test('Fase 5A: ringkasan gender memakai baris yang sama dan NULL tetap tidak lengkap',async()=>{
 const {studentSummary}=await import('../../static-web/assets/js/student-summary.js');
 assert.deepEqual(studentSummary([{total:20,perempuan:4}]),{total:20,perempuan:4,laki:16,persen_perempuan:20});
 assert.equal(studentSummary([{total:20,perempuan:null}]).persen_perempuan,null);
 assert.equal(studentSummary([]).total,null);
});
test('Fase 5A: skip password default mati; hanya development, production memperingatkan',async()=>{
 const {passwordPolicy}=await import('../services/password-policy.js');const logs=[];
 assert.equal(passwordPolicy({NODE_ENV:'development'}).skip,false);
 assert.equal(passwordPolicy({NODE_ENV:'development',DEV_SKIP_PASSWORD_CHANGE:'true'}).skip,true);
 assert.equal(passwordPolicy({NODE_ENV:'test',DEV_SKIP_PASSWORD_CHANGE:'true'}).skip,false);
 assert.equal(passwordPolicy({NODE_ENV:'production',DEV_SKIP_PASSWORD_CHANGE:'true'},true,m=>logs.push(m)).skip,false);
 assert.equal(passwordPolicy({NODE_ENV:'development',DEV_SKIP_PASSWORD_CHANGE:'true'},true,m=>logs.push(m)).skip,false);
 assert.equal(logs.length,2);
});
