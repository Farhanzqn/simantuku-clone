// Output contract, independent of makeWorkbook/readWorkbook/checkedZip.
// XML syntax uses the shared bounded lexer; package/schema assertions are separate.
// Independent .NET/ExcelJS/Excel reads supplement this test (see E2-RENCANA).
import assert from 'node:assert/strict';
import {inflateRawSync} from 'node:zlib';
import {parseXml} from '../services/form-xml.js';
import {createHash} from 'node:crypto';
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const relns='http://schemas.openxmlformats.org/package/2006/relationships';
const office='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
const mime='application/vnd.openxmlformats-officedocument.spreadsheetml.';
const crc=b=>{let x=0xffffffff;for(const c of b){x^=c;for(let k=0;k<8;k++)x=(x>>>1)^((x&1)?0xedb88320:0);}return (x^0xffffffff)>>>0;};
const kids=(n,name)=>n?.children.filter(c=>c.name===name)??[];
const one=(n,name)=>{const list=kids(n,name);assert.equal(list.length,1,name);return list[0];};
const integer=(v,min,max)=>{assert.match(String(v),/^\d+$/);const n=Number(v);assert.ok(n>=min&&n<=max,`${v}: ${min}..${max}`);return n;};
export function assertDownload(headers,bytes,name){
 assert.ok(bytes.length>0);assert.equal(headers.get('x-template-sha256'),createHash('sha256').update(bytes).digest('hex'));
 assert.equal(headers.get('content-type'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 assert.equal(headers.get('content-disposition'),`attachment; filename="${name}-template.xlsx"`);
 assert.equal(headers.get('content-length'),String(bytes.length));
 assert.equal(headers.get('content-encoding'),null);assert.equal(headers.get('cache-control'),'no-store');
 assert.equal(bytes.subarray(0,4).toString('hex'),'504b0304');
}
export function assertTemplateStructure(b){
 assert.equal(b.readUInt32LE(0),0x04034b50);const end=b.length-22;
 assert.equal(b.readUInt32LE(end),0x06054b50);assert.equal(b.readUInt16LE(end+20),0);
 assert.equal(b.readUInt32LE(end+4),0);const count=b.readUInt16LE(end+10);
 assert.equal(b.readUInt16LE(end+8),count);assert.ok(count>=8&&count<=100);
 const offset=b.readUInt32LE(end+16);assert.equal(offset+b.readUInt32LE(end+12),end);
 const files=new Map();let p=offset,last=0;
 for(let i=0;i<count;i++){
  assert.equal(b.readUInt32LE(p),0x02014b50);
  const version=b.readUInt16LE(p+6),flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10);
  assert.ok([10,20].includes(version));assert.ok([0,8].includes(method));if(method===8)assert.equal(version,20);
  // Our generator never needs encryption, descriptor, ZIP64 or other flags/extras.
  assert.equal(flags&~0x800,0);assert.equal(b.readUInt16LE(p+30),0);assert.equal(b.readUInt16LE(p+34),0);
  const checksum=b.readUInt32LE(p+16),packed=b.readUInt32LE(p+20),size=b.readUInt32LE(p+24),n=b.readUInt16LE(p+28),local=b.readUInt32LE(p+42);
  const name=b.subarray(p+46,p+46+n).toString('utf8');
  assert.ok(!files.has(name));assert.match(name,/^[\w[\]./-]+\.(xml|rels)$/);assert.ok(!name.startsWith('/')&&!name.includes('..')&&!name.includes('//'));
  assert.equal(local,last);assert.equal(b.readUInt32LE(local),0x04034b50);
  assert.equal(b.readUInt16LE(local+4),version);assert.equal(b.readUInt16LE(local+6),flags);assert.equal(b.readUInt16LE(local+8),method);
  assert.equal(b.readUInt32LE(local+14),checksum);assert.equal(b.readUInt32LE(local+18),packed);assert.equal(b.readUInt32LE(local+22),size);
  assert.equal(b.readUInt16LE(local+26),n);assert.equal(b.readUInt16LE(local+28),0);
  assert.equal(b.subarray(local+30,local+30+n).toString('utf8'),name);
  const start=local+30+n,compressed=b.subarray(start,start+packed);
  const raw=method===8?inflateRawSync(compressed,{maxOutputLength:10*1024*1024}):compressed;
  assert.equal(raw.length,size);assert.equal(crc(raw),checksum,name+' CRC');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(raw);files.set(name,parseXml(text));
  last=start+packed;p+=46+n+b.readUInt16LE(p+30)+b.readUInt16LE(p+32);
 }
 assert.equal(p,end);assert.equal(last,offset);
 const types=files.get('[Content_Types].xml');assert.equal(types?.uri,'http://schemas.openxmlformats.org/package/2006/content-types');
 const defaults=new Map(kids(types,'Default').map(n=>[n.attrs.Extension,n.attrs.ContentType]));
 assert.equal(defaults.get('rels'),'application/vnd.openxmlformats-package.relationships+xml');assert.equal(defaults.get('xml'),'application/xml');
 const overrides=new Map(kids(types,'Override').map(n=>[n.attrs.PartName,n.attrs.ContentType]));
 assert.equal(overrides.size,kids(types,'Override').length);
 for(const path of overrides.keys())assert.ok(files.has(path.slice(1)),path);
 assert.equal(overrides.get('/xl/workbook.xml'),mime+'sheet.main+xml');assert.equal(overrides.get('/xl/styles.xml'),mime+'styles+xml');
 const relations=(file,base)=>{const root=files.get(file);assert.equal(root?.uri,relns);assert.equal(root.name,'Relationships');const ids=new Map();for(const r of root.children){assert.equal(r.uri,relns);assert.equal(r.name,'Relationship');assert.ok(!ids.has(r.attrs.Id));assert.ok(!r.attrs.TargetMode||r.attrs.TargetMode==='Internal');const path=r.attrs.Target.startsWith('/')?r.attrs.Target.slice(1):base+r.attrs.Target;assert.ok(files.has(path),path);ids.set(r.attrs.Id,{path,type:r.attrs.Type});}return ids;};
 const rootRels=relations('_rels/.rels',''),rels=relations('xl/_rels/workbook.xml.rels','xl/');
 assert.equal([...rootRels.values()].filter(r=>r.type===office+'officeDocument'&&r.path==='xl/workbook.xml').length,1);
 const book=files.get('xl/workbook.xml');assert.equal(book?.name,'workbook');assert.equal(book.uri,ns);
 const sheets=one(book,'sheets').children;assert.deepEqual(sheets.map(s=>s.attrs.name),['Petunjuk','Data','_meta']);assert.equal(sheets[2].attrs.state,'hidden');
 const styles=files.get('xl/styles.xml');assert.equal(styles?.name,'styleSheet');assert.equal(styles.uri,ns);
 const collections={};for(const name of ['fonts','fills','borders','cellStyleXfs','cellXfs']){const c=one(styles,name);assert.equal(Number(c.attrs.count),c.children.length,name);assert.ok(c.children.length>0);collections[name]=c.children;}
 for(const xf of [...collections.cellXfs,...collections.cellStyleXfs]){integer(xf.attrs.fontId,0,collections.fonts.length-1);integer(xf.attrs.fillId,0,collections.fills.length-1);integer(xf.attrs.borderId,0,collections.borders.length-1);if(xf.attrs.xfId!==undefined)integer(xf.attrs.xfId,0,collections.cellStyleXfs.length-1);}
 const shared=files.get('xl/sharedStrings.xml');if(shared){assert.equal(shared.uri,ns);assert.equal(shared.name,'sst');assert.equal(Number(shared.attrs.uniqueCount),kids(shared,'si').length);assert.equal(overrides.get('/xl/sharedStrings.xml'),mime+'sharedStrings+xml');assert.ok([...rels.values()].some(r=>r.type===office+'sharedStrings'&&r.path==='xl/sharedStrings.xml'));}
 const order='sheetPr dimension sheetViews sheetFormatPr cols sheetData sheetCalcPr sheetProtection protectedRanges scenarios autoFilter sortState dataConsolidate customSheetViews mergeCells phoneticPr conditionalFormatting dataValidations hyperlinks printOptions pageMargins pageSetup headerFooter rowBreaks colBreaks customProperties cellWatches ignoredErrors smartTags drawing legacyDrawing legacyDrawingHF picture oleObjects controls webPublishItems tableParts extLst'.split(' ');
 let strings=0;const ids=new Set();
 for(const sheet of sheets){assert.equal(sheet.uri,ns);assert.ok(sheet.attrs.name.length<=31&&!/[\\/?*\[\]:]/.test(sheet.attrs.name));assert.ok(!ids.has(sheet.attrs.sheetId));ids.add(sheet.attrs.sheetId);
  const id=Object.keys(sheet.attrs).find(k=>k.endsWith(':id')&&sheet.bindings[k.split(':')[0]]===office.slice(0,-1));const rel=rels.get(sheet.attrs[id]);assert.equal(rel?.type,office+'worksheet');assert.equal(overrides.get('/'+rel.path),mime+'worksheet+xml');
  const ws=files.get(rel.path);assert.equal(ws.name,'worksheet');assert.equal(ws.uri,ns);let previous=-1;
  for(const element of ws.children){assert.equal(element.uri,ns);const index=order.indexOf(element.name);assert.ok(index>=previous&&index>=0,rel.path+': '+element.name);previous=index;}
  let rowNo=0;for(const row of one(ws,'sheetData').children){assert.equal(row.name,'row');const r=integer(row.attrs.r,rowNo+1,1048576);rowNo=r;let col=0;
   for(const cell of row.children){assert.equal(cell.name,'c');const ref=/^([A-Z]{1,3})([1-9]\d*)$/.exec(cell.attrs.r);assert.ok(ref);assert.equal(Number(ref[2]),r);const c=[...ref[1]].reduce((a,x)=>a*26+x.charCodeAt(0)-64,0);assert.ok(c>col&&c<=16384);col=c;if(cell.attrs.s!==undefined)integer(cell.attrs.s,0,collections.cellXfs.length-1);
    if(cell.attrs.t==='s'){integer(one(cell,'v').text,0,kids(shared,'si').length-1);strings++;}
   }
  }
  const validation=kids(ws,'dataValidations')[0];if(validation)assert.equal(Number(validation.attrs.count),kids(validation,'dataValidation').length);
 }
 if(shared)assert.equal(Number(shared.attrs.count),strings);
 for(const [path,root]of files)if(path.startsWith('docProps/')){assert.ok(overrides.has('/'+path),path);assert.ok([...rootRels.values()].some(r=>r.path===path));assert.ok(root.uri);}
 assert.ok([...rels.values()].some(r=>r.type===office+'styles'&&r.path==='xl/styles.xml'));
 return {parts:files.size,sheets:sheets.length};
}
