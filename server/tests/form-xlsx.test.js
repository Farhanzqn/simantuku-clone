import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {makeWorkbook,readWorkbook,parseXml,multipartFile,MAX_FILE} from '../services/form-xlsx.js';
export function editWorkbook(bytes,change){const files=unzipSync(bytes);const texts=Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strFromU8(v)]));change(texts);return Buffer.from(zipSync(Object.fromEntries(Object.entries(texts).map(([k,v])=>[k,strToU8(v)])),{level:6}));}
test('Kompatibilitas: direktori hanya kosong/allowlist; deklarasi VML pasif saja; baris fisik tetap dibatasi',()=>{
 const pack=change=>{const files=unzipSync(sample());change(files);return Buffer.from(zipSync(files,{level:0}));};
 assert.ok(readWorkbook(pack(f=>{f['xl/']=new Uint8Array();})).Data);
 for(const [name,value]of [['xl/','payload'],['unknown/',''],['xl/../',''],['xl/drawings/vmlDrawing1.vml','<xml/>']])assert.throws(()=>readWorkbook(pack(f=>{f[name]=strToU8(value);})),name);
 const vml='<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>';
 const passive=pack(f=>{f['[Content_Types].xml']=strToU8(strFromU8(f['[Content_Types].xml']).replace('</Types>',vml+'</Types>'));});assert.ok(readWorkbook(passive).Data);
 assert.throws(()=>readWorkbook(editWorkbook(passive,f=>{f['xl/_rels/workbook.xml.rels']=f['xl/_rels/workbook.xml.rels'].replace('</Relationships>','<Relationship Id="vml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="worksheets/sheet2.xml"/></Relationships>');})),/relationship/);
 assert.throws(()=>readWorkbook(editWorkbook(sample(),f=>{f['xl/worksheets/sheet2.xml']=f['xl/worksheets/sheet2.xml'].replace('</sheetData>','<row r="503"><c r="C503" s="2"/></row></sheetData>');})),/baris/);
});
const sample=()=>makeWorkbook([{name:'Petunjuk',rows:[['Aturan','Kosong ≠ 0']]},{name:'Data',locked:2,rows:[['Kode','Nama','Jumlah'],['01','Unit',null],['02','Lain',0]]},{name:'_meta',hidden:true,rows:[['version',1]]}]);
test('XLSX: roundtrip UTF-8, sheet tersembunyi, kunci abu-abu terkunci dan nol',()=>{const bytes=sample(),book=readWorkbook(bytes),files=unzipSync(bytes);assert.equal(book._meta.hidden,true);assert.equal(book.Data.rows[1][2].value,'');assert.equal(book.Data.rows[2][2].value,0);assert.match(strFromU8(files['xl/styles.xml']),/FFE5E7EB/);assert.match(strFromU8(files['xl/worksheets/sheet2.xml']),/<sheetProtection/);assert.match(strFromU8(files['xl/worksheets/sheet2.xml']),/r="A2" s="1"/);assert.match(strFromU8(files['xl/worksheets/sheet2.xml']),/r="C2" s="2"/);assert.equal(book.Petunjuk.rows[0][1].value,'Kosong ≠ 0');});
test('XLSX: formula tidak dieksekusi; cache dibaca; teks formula tetap mentah',()=>{const bytes=editWorkbook(sample(),f=>{f['xl/worksheets/sheet2.xml']=f['xl/worksheets/sheet2.xml'].replace(/<c r="C2".*?<\/c>/,'<c r="C2"><f>1+1</f><v>2</v></c>');});assert.equal(readWorkbook(bytes).Data.rows[1][2].value,2);const noCache=editWorkbook(bytes,f=>{f['xl/worksheets/sheet2.xml']=f['xl/worksheets/sheet2.xml'].replace('<v>2</v>','');});assert.match(readWorkbook(noCache).Data.rows[1][2].error,/cache/);for(const value of ['=1+1','@SUM(A1)','-teks','+teks'])assert.equal(readWorkbook(makeWorkbook([{name:'Data',rows:[[value]]}])).Data.rows[0][0].value,value);});
test('XLSX: korup, polyglot, DTD, macro, eksternal, ZIP bomb dan batas ditolak',()=>{for(const bad of [Buffer.from('not zip'),Buffer.concat([sample(),Buffer.from('HTML')]),Buffer.alloc(MAX_FILE+1)])assert.throws(()=>readWorkbook(bad));for(const extra of ['<!DOCTYPE x [<!ENTITY e SYSTEM "file:///secret">]><x/>','<x TargetMode="External"/>','<x>macroEnabled</x>','<x>'+('a'.repeat(1000000))+'</x>'])assert.throws(()=>readWorkbook(editWorkbook(sample(),f=>{f['xl/extra.xml']=extra;})));assert.throws(()=>parseXml('<x><y></x>'));assert.throws(()=>parseXml('<x a="1" a="2"/>'));const crc=sample();crc[50]^=1;assert.throws(()=>readWorkbook(crc));});
test('Multipart: satu XLSX, akhiran browser; tolak csv/xlsm/ekstensi ganda dan ukuran',()=>{const req=(name,bytes=sample(),ending='')=>({get:()=> 'multipart/form-data; boundary=abc',body:Buffer.concat([Buffer.from('--abc\r\nContent-Disposition: form-data; name="file"; filename="'+name+'"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'),bytes,Buffer.from('\r\n--abc--'+ending)])});assert.deepEqual(multipartFile(req('data.xlsx')),sample());assert.deepEqual(multipartFile(req('data.xlsx',sample(),'\r\n')),sample());for(const n of ['file.csv','file.xlsm','file.csv.xlsx'])assert.throws(()=>multipartFile(req(n)));assert.throws(()=>multipartFile(req('data.xlsx',Buffer.alloc(MAX_FILE+1))));});
test('XLSX: ukuran dekompresi palsu dan batas baris ditolak',()=>{const bytes=sample();for(let i=0;i<bytes.length-46;i++)if(bytes.readUInt32LE(i)===0x02014b50){bytes.writeUInt32LE(1,i+24);break;}assert.throws(()=>readWorkbook(bytes));assert.throws(()=>readWorkbook(editWorkbook(sample(),f=>{f['xl/worksheets/sheet2.xml']=f['xl/worksheets/sheet2.xml'].replace('<row r="2">','<row r="9999">');})));});


test('E1-01: entity linear, batas atribut sebelum decoding, anggota tak dirujuk cepat',async()=>{
 const {decodeXml}=await import('../services/form-xml.js');
 for(const n of [20000,40000,80000]){
  const f=unzipSync(sample());f['xl/unused.xml']=strToU8('<r a="'+'&'.repeat(n)+'"/>');const bytes=Buffer.from(zipSync(f,{level:0}));
  const start=performance.now();assert.throws(()=>readWorkbook(bytes));assert.ok(performance.now()-start<100,'Penolakan anggota tidak dirujuk harus <100 ms');
  assert.throws(()=>parseXml('<r a="'+'&'.repeat(n)+'"/>'));
 }
 for(const s of ['&','&&','&bogus;','&#x110000;','&#0;','&#xD800;'])assert.throws(()=>decodeXml(s));
 assert.equal(decodeXml('&amp;&lt;&gt;&quot;&apos;&#65;&#x1F600;'),'&<>"\'A\u{1f600}');
 assert.throws(()=>parseXml('<r a="'+'a'.repeat(8193)+'"/>'));
 assert.throws(()=>parseXml('<r '+Array.from({length:65},(_,i)=>'a'+i+'="v"').join(' ')+'/>'));
 const measure=n=>{const s='&amp;'.repeat(n/5),times=[];for(let k=0;k<6;k++){const t=performance.now();assert.equal(decodeXml(s).length,n/5);times.push(performance.now()-t);}return Math.min(...times);};
 measure(80000);const a=measure(20000),b=measure(40000),c=measure(80000);assert.ok(c<100&&c<=a*6+5&&b<=a*4+5,'Decoder tidak boleh kuadratik');
});

test('E1-05: karakter XML invalid menjadi error sel; metadata dan namespace asing ditolak',()=>{
 for(const value of ['\u0000','<![CDATA[\u0000]]>','&#0;','&#xFFFF;']){
  const data=editWorkbook(sample(),f=>{f['xl/worksheets/sheet2.xml']=f['xl/worksheets/sheet2.xml'].replace(/<c r="C2".*?<\/c>/,'<c r="C2" t="inlineStr"><is><t>'+value+'</t></is></c>');});
  const book=readWorkbook(data);assert.match(book.Data.rows[1][2].error,/karakter XML/);assert.equal(book.Data.rows[1][2].value,null);assert.equal(book.Data.rows[2][2].value,0);
 }
 for(const x of ['<r>\u0000</r>','<r><![CDATA[\u0000]]></r>','<r a="\u0000"/>','<r>&#xFFFF;</r>'])assert.throws(()=>parseXml(x));
 assert.throws(()=>readWorkbook(editWorkbook(sample(),f=>{f['xl/worksheets/sheet2.xml']=f['xl/worksheets/sheet2.xml'].replace('http://schemas.openxmlformats.org/spreadsheetml/2006/main','urn:foreign');})));
 assert.throws(()=>readWorkbook(editWorkbook(sample(),f=>{f['xl/worksheets/sheet2.xml']=f['xl/worksheets/sheet2.xml'].replace('<sheetData>','<sheetData xmlns="urn:foreign">');})));
 for(const rel of ['_rels/.rels','xl/_rels/workbook.xml.rels'])assert.throws(()=>readWorkbook(editWorkbook(sample(),f=>{f[rel]=f[rel].replace('<Relationship Id=','<Relationship TargetMode="Ext&#101;rnal" Id=');})),/eksternal/);
 assert.throws(()=>readWorkbook(editWorkbook(sample(),f=>{f['[Content_Types].xml']=f['[Content_Types].xml'].replace('spreadsheetml.sheet.main','spreadsheetml.macro&#69;nabled');})));
});

test('E1-04: header lokal, ZIP64, extra field, versi dan flag ZIP ditolak',()=>{
 for(const offset of [14,18,22]){const b=sample();b.writeUInt32LE(123456,offset);assert.throws(()=>readWorkbook(b),/Header lokal/);}
 for(const offset of [4]){const b=sample();b.writeUInt16LE(45,offset);assert.throws(()=>readWorkbook(b));}
 const extraFile=(extra)=>{const original=Buffer.from(zipSync({'a.xml':strToU8('<r/>')},{level:0})),central=original.readUInt32LE(original.length-6),at=30+original.readUInt16LE(26),b=Buffer.concat([original.subarray(0,at),extra,original.subarray(at)]);b.writeUInt16LE(extra.length,28);b.writeUInt32LE(central+extra.length,b.length-6);return b;};
 const zip64=Buffer.alloc(20);zip64.writeUInt16LE(1);zip64.writeUInt16LE(16,2);assert.throws(()=>readWorkbook(extraFile(zip64)),/ZIP64/);
 const malformed=Buffer.alloc(4);malformed.writeUInt16LE(0x5455);malformed.writeUInt16LE(8,2);assert.throws(()=>readWorkbook(extraFile(malformed)),/Extra field/);
 const flags=sample(),central=flags.readUInt32LE(flags.length-6);flags.writeUInt16LE(1,6);flags.writeUInt16LE(1,central+8);assert.throws(()=>readWorkbook(flags));
 const version=sample(),vcentral=version.readUInt32LE(version.length-6);version.writeUInt16LE(45,vcentral+6);assert.throws(()=>readWorkbook(version),/Versi/);
});

test('A4: workbook disimpan Microsoft Excel asli dengan theme/styles/docProps/calcChain',async()=>{
 const {readFile}=await import('node:fs/promises');const bytes=await readFile(new URL('./fixtures/excel-e1.xlsx',import.meta.url)),files=unzipSync(bytes);
 for(const part of ['xl/styles.xml','xl/theme/theme1.xml','docProps/core.xml','docProps/app.xml','xl/calcChain.xml','xl/sharedStrings.xml'])assert.ok(files[part]);
 const book=readWorkbook(bytes);assert.equal(book.Data.rows[1][0].value,'01');assert.equal(book.Data.rows[1][2].value,12);assert.equal(book.Data.rows[2][2].value,0);assert.equal(book._meta.hidden,true);
 // Auxiliary parts are not interpreted. Their ZIP CRC/size are still checked.
 files['xl/styles.xml']=strToU8('<not-parsed a="'+'&'.repeat(80000)+'"/>');assert.equal(readWorkbook(Buffer.from(zipSync(files,{level:0}))).Data.rows[1][2].value,12);
});
