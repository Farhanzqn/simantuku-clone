import {zipSync,strToU8} from 'fflate';
import {inflateRawSync} from 'node:zlib';
import {parseXml,xmlRoot,xmlChildren,checkSpreadsheet,spreadsheetNS,relationshipsNS,officeNS,contentNS} from './form-xml.js';
export {parseXml} from './form-xml.js';
import {HttpError} from '../middleware/security.js';
const fail=message=>{throw new HttpError(422,message??'Berkas Excel korup atau format tidak didukung.');};
export const MAX_FILE=5*1024*1024;
// Cheap output guard after the worker; full package validation stays in the worker.
export function assertTemplateBytes(bytes){
 const invalid=()=>{throw new HttpError(503,'Template gagal dibuat atau tidak lengkap. Silakan coba lagi.','EXCEL_INVALID_OUTPUT');};
 if(!Buffer.isBuffer(bytes)||bytes.length<22||bytes.length>MAX_FILE)invalid();
 const end=bytes.length-22;
 if(bytes.readUInt32LE(0)!==0x04034b50||bytes.readUInt32LE(end)!==0x06054b50||bytes.readUInt16LE(end+20)!==0||bytes.readUInt32LE(end+12)+bytes.readUInt32LE(end+16)!==end)invalid();
 return bytes;
}
const decode=b=>new TextDecoder('utf-8',{fatal:true}).decode(b);
const xml=v=>String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const column=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
// Some independent writers include explicit empty ZIP directories. They carry
// no XML/content and still consume the package entry budget; never extract them.
const zipDirectories=new Set(['_rels/','xl/','xl/_rels/','xl/worksheets/','xl/theme/','docProps/']);
export function makeWorkbook(sheets){const files={
 '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
 '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"${s.hidden?' state="hidden"':''}/>`).join('')}</sheets></workbook>`,
 'xl/_rels/workbook.xml.rels':`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
 'xl/styles.xml':`<styleSheet xmlns="${ns}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE5E7EB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyProtection="1"><protection locked="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyProtection="1"><protection locked="0"/></xf></cellXfs></styleSheet>`};
 sheets.forEach((sheet,i)=>{files[`xl/worksheets/sheet${i+1}.xml`]=`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="20" customWidth="1"/><col min="2" max="2" width="38" customWidth="1"/><col min="3" max="30" width="25" customWidth="1"/></cols><sheetData>${sheet.rows.map((r,ri)=>`<row r="${ri+1}">${r.map((v,ci)=>`<c r="${column(ci)}${ri+1}" s="${ri===0||ci<(sheet.locked??0)?1:2}"${typeof v==='number'?'':' t="inlineStr"'}>${typeof v==='number'?`<v>${v}</v>`:`<is><t xml:space="preserve">${xml(v??'')}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData>${sheet.locked?'<sheetProtection sheet="1" objects="1" scenarios="1" selectLockedCells="0" selectUnlockedCells="0"/>':''}</worksheet>`;});
 return Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8('<?xml version="1.0" encoding="UTF-8"?>'+v)])),{level:6}));
}
const children=xmlChildren;
const child=(n,name)=>children(n,name)[0];
const checkExtra=(buffer,start,length)=>{const end=start+length;if(end>buffer.length)fail();while(start<end){if(start+4>end)fail();const id=buffer.readUInt16LE(start),size=buffer.readUInt16LE(start+2);if(id===1)fail('ZIP64 tidak didukung.');start+=4;if(start+size>end)fail('Extra field ZIP tidak valid.');start+=size;}};
const textContent=n=>n?(n.text+n.children.map(textContent).join('')):'';
export function checkedZip(buffer){if(buffer.length>MAX_FILE)throw new HttpError(413,'Berkas maksimal 5 MB.');if(buffer.length<22||buffer.readUInt32LE(0)!==0x04034b50)fail();
 let end=-1;for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0||end+22+buffer.readUInt16LE(end+20)!==buffer.length||buffer.readUInt16LE(end+4)||buffer.readUInt16LE(end+6))fail();
 const count=buffer.readUInt16LE(end+10),size=buffer.readUInt32LE(end+12),offset=buffer.readUInt32LE(end+16);if(!count||count>100||buffer.readUInt16LE(end+8)!==count||offset+size!==end)fail('ZIP melampaui batas atau bertipe ganda.');
 let pos=offset,total=0;const names=new Map(),ranges=[];
 for(let i=0;i<count;i++){if(pos+46>end||buffer.readUInt32LE(pos)!==0x02014b50)fail();const flags=buffer.readUInt16LE(pos+8),method=buffer.readUInt16LE(pos+10),compressed=buffer.readUInt32LE(pos+20),plain=buffer.readUInt32LE(pos+24),n=buffer.readUInt16LE(pos+28),extra=buffer.readUInt16LE(pos+30),comment=buffer.readUInt16LE(pos+32),local=buffer.readUInt32LE(pos+42);if(pos+46+n+extra+comment>end)fail();const name=decode(buffer.subarray(pos+46,pos+46+n));
  const version=buffer.readUInt16LE(pos+6);if(![10,20].includes(version)||method===8&&version!==20||buffer.readUInt16LE(pos+34)!==0||method===0&&(flags&6))fail('Versi/flag ZIP tidak didukung.');checkExtra(buffer,pos+46+n,extra);
  if(flags&~0x080e||![0,8].includes(method)||plain>10*1024*1024||plain/Math.max(1,compressed)>200||(total+=plain)>20*1024*1024)fail('ZIP bomb, enkripsi, atau kompresi tidak wajar.');
  const directory=zipDirectories.has(name);if(directory&&(method!==0||plain!==0||compressed!==0||buffer.readUInt32LE(pos+16)!==0||flags&~0x800))fail('Direktori ZIP harus kosong.');
  if(names.has(name)||name.includes('..')||name.includes('\\')||name.includes('//')||name.startsWith('/')||!directory&&!/^[-\w[\]. /]+\.(xml|rels)$/.test(name)||/vba|macro|activex|embeddings|externalLinks/i.test(name))fail('Paket bukan template XLSX yang aman.');names.set(name,{plain,crc:buffer.readUInt32LE(pos+16),directory});
  if(local+30>offset||buffer.readUInt32LE(local)!==0x04034b50||buffer.readUInt16LE(local+8)!==method||buffer.readUInt16LE(local+6)!==flags)fail();const ln=buffer.readUInt16LE(local+26),le=buffer.readUInt16LE(local+28),start=local+30+ln+le;if(start>offset||buffer.readUInt16LE(local+4)!==version)fail();checkExtra(buffer,local+30+ln,le);if(!(flags&8)&&(buffer.readUInt32LE(local+14)!==buffer.readUInt32LE(pos+16)||buffer.readUInt32LE(local+18)!==compressed||buffer.readUInt32LE(local+22)!==plain))fail('Header lokal ZIP berbeda dengan direktori.');if(start+compressed>offset||decode(buffer.subarray(local+30,local+30+ln))!==name)fail();Object.assign(names.get(name),{start,compressed,method,flags});ranges.push([local,start+compressed,name]);pos+=46+n+extra+comment;
 }
 if(pos!==end)fail();ranges.sort((a,b)=>a[0]-b[0]);if(ranges[0][0]!==0)fail();for(let i=0;i<ranges.length;i++){const finish=ranges[i][1],next=ranges[i+1]?.[0]??offset,gap=next-finish,d=names.get(ranges[i][2]);if(gap===0&&!(d.flags&8))continue;const p=gap===16&&buffer.readUInt32LE(finish)===0x08074b50?finish+4:finish;if(!(d.flags&8)||![12,16].includes(gap)||buffer.readUInt32LE(p)!==d.crc||buffer.readUInt32LE(p+4)!==d.compressed||buffer.readUInt32LE(p+8)!==d.plain)fail('Paket bertipe ganda atau ZIP tidak valid.');}
 const files=Object.create(null);for(const [name,d]of names){let b;try{const packed=buffer.subarray(d.start,d.start+d.compressed);if(d.method===0)b=packed;else{const result=inflateRawSync(packed,{maxOutputLength:Math.min(10*1024*1024,d.plain+1),info:true});if(result.engine.bytesWritten!==packed.length)fail();b=result.buffer;}}catch{fail('ZIP korup atau melebihi batas dekompresi.');}if(b.length!==d.plain||crc32(b)!==d.crc)fail('Ukuran atau checksum ZIP tidak valid.');if(!d.directory)files[name]=b;}return files;
}
function relationships(tree,base,files){
 xmlRoot(tree,'Relationships',relationshipsNS);const ids=new Map();
 for(const r of tree.children){if(r.uri!==relationshipsNS||r.name!=='Relationship'||!r.attrs.Id||ids.has(r.attrs.Id))fail();
  const mode=r.attrs.TargetMode;if(mode!==undefined&&mode!=='Internal')fail('Referensi eksternal tidak didukung.');
  const type=r.attrs.Type,allowed=['officeDocument','worksheet','styles','sharedStrings','theme','calcChain','extended-properties','custom-properties'].map(x=>officeNS+'/'+x);allowed.push('http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties');if(!allowed.includes(type))fail('Jenis relationship tidak didukung.');
  const target=r.attrs.Target;if(!target||target.includes('..')||target.includes('\\')||target.includes('//')||/[:%?#\x00-\x20]/.test(target))fail('Target relationship tidak valid.');
  const path=target.startsWith('/')?target.slice(1):base+target;if(!files[path])fail('Anggota relationship tidak tersedia.');ids.set(r.attrs.Id,{path,type});
 }return ids;
}
function contentTypes(tree){xmlRoot(tree,'Types',contentNS);
 const allowed=new Set(['application/xml','application/vnd.openxmlformats-package.relationships+xml','application/vnd.openxmlformats-package.core-properties+xml',...['sheet.main','worksheet','styles','sharedStrings','calcChain'].map(x=>'application/vnd.openxmlformats-officedocument.spreadsheetml.'+x+'+xml'),'application/vnd.openxmlformats-officedocument.theme+xml','application/vnd.openxmlformats-officedocument.extended-properties+xml','application/vnd.openxmlformats-officedocument.custom-properties+xml']);
 // ExcelJS emits this unused default even with no drawings. Actual VML parts
 // and drawing relationships remain forbidden by the ZIP/relationship allowlists.
 for(const c of tree.children){const unusedVml=c.name==='Default'&&c.attrs.Extension==='vml'&&c.attrs.ContentType==='application/vnd.openxmlformats-officedocument.vmlDrawing';if(c.uri!==contentNS||!['Default','Override'].includes(c.name)||!allowed.has(c.attrs.ContentType)&&!unusedVml)fail('Content type Excel tidak didukung; makro tidak diizinkan.');}
}
export function readWorkbook(buffer){try{const files=checkedZip(buffer),used=new Set(),read=(name,cellErrors=false)=>{if(!files[name])fail();used.add(name);return parseXml(decode(files[name]),{cellErrors});};
 contentTypes(read('[Content_Types].xml'));const packageRels=relationships(read('_rels/.rels'),'',files);if([...packageRels.values()].filter(r=>r.type===officeNS+'/officeDocument'&&r.path==='xl/workbook.xml').length!==1)fail();
 const book=checkSpreadsheet(xmlRoot(read('xl/workbook.xml'),'workbook',ns)),rels=relationships(read('xl/_rels/workbook.xml.rels'),'xl/',files);
 const shared=files['xl/sharedStrings.xml']?children(checkSpreadsheet(xmlRoot(read('xl/sharedStrings.xml',true),'sst',ns)),'si').map(n=>({value:textContent(n),error:n.error})):[];
 const out=Object.create(null);for(const sheet of children(child(book,'sheets'),'sheet')){
  const relationKey=Object.keys(sheet.attrs).find(k=>k.endsWith(':id')&&sheet.bindings[k.split(':')[0]]===officeNS),rel=rels.get(sheet.attrs[relationKey]);if(!rel||rel.type!==officeNS+'/worksheet')fail();
  if(!sheet.attrs.name||Object.hasOwn(out,sheet.attrs.name))fail();const tree=checkSpreadsheet(xmlRoot(read(rel.path,true),'worksheet',ns)),rows=[];let last=0;
  for(const row of children(child(tree,'sheetData'),'row')){const index=Number(row.attrs.r);if(!Number.isInteger(index)||index<1||index>502||index<=last)fail('Jumlah/urutan baris melampaui batas.');last=index;const values=[];
   for(const c of children(row,'c')){const ref=/^([A-Z]{1,2})(\d+)$/.exec(c.attrs.r??'');if(!ref||Number(ref[2])!==index)fail();const ci=[...ref[1]].reduce((n,x)=>n*26+x.charCodeAt(0)-64,0)-1;if(ci>30||values[ci]!==undefined)fail('Kolom tidak valid.');const formula=child(c,'f'),v=child(c,'v');let value=null,error=c.error;
    if(error){}else if(formula&&!v)error='Formula tanpa nilai cache; isi nilai biasa lalu unggah ulang.';
    else if(c.attrs.t==='inlineStr')value=textContent(child(c,'is'));
    else if(c.attrs.t==='s'){const n=Number(v?.text);if(!Number.isInteger(n)||shared[n]===undefined)fail();({value,error}=shared[n]);}
    else if(c.attrs.t==='e')error='Sel Excel mengandung error.';
    else if(v){value=v.text;if(!c.attrs.t||c.attrs.t==='n'){if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)||!Number.isFinite(Number(value)))error='Nilai numerik Excel tidak valid.';else value=Number(value);}}
    values[ci]={value:error?null:value,error};
   }rows[index-1]=values;
  }out[sheet.attrs.name]={rows,hidden:sheet.attrs.state==='hidden'||sheet.attrs.state==='veryHidden'};
 }
 // Auxiliary Excel parts are integrity-checked above, never parsed or interpreted.
 for(const name of Object.keys(files))if(!used.has(name)&&! /^(?:xl\/(?:styles|calcChain)\.xml|xl\/theme\/theme[0-9]+\.xml|docProps\/(?:core|app|custom)\.xml)$/.test(name))fail('Anggota Excel tidak didukung.');
 return out;}catch(e){if(e instanceof HttpError)throw e;fail();}}
export function multipartFile(req){const boundary=/boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(req.get('content-type')??'');const b=boundary?.[1]??boundary?.[2];if(!b||b.length>100||/[\r\n]/.test(b)||!Buffer.isBuffer(req.body))fail('Unggah satu berkas .xlsx.');
 const raw=req.body,start=Buffer.from('--'+b+'\r\n');let finish=Buffer.from('\r\n--'+b+'--');if(raw.subarray(-2).toString()==='\r\n')finish=Buffer.concat([finish,Buffer.from('\r\n')]);if(!raw.subarray(0,start.length).equals(start)||!raw.subarray(-finish.length).equals(finish))fail('Multipart tidak valid.');const split=raw.indexOf('\r\n\r\n',start.length);if(split<0||split>8192)fail();const headers=raw.subarray(start.length,split).toString('utf8'),name=/content-disposition: form-data;\s*name="file";\s*filename="([^"\r\n]+)"/i.exec(headers)?.[1];
 if(!name||!/^[-\w ()\u0080-\uffff]+\.xlsx$/i.test(name))fail('Hanya berkas .xlsx dengan satu ekstensi yang diterima.');const type=/content-type:\s*([^\r\n]+)/i.exec(headers)?.[1];if(!['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream'].includes(type?.toLowerCase()))fail('Tipe berkas harus XLSX.');const file=raw.subarray(split+4,raw.length-finish.length);if(file.includes(Buffer.from('\r\n--'+b)))fail('Unggah hanya satu berkas.');if(file.length>MAX_FILE)throw new HttpError(413,'Berkas maksimal 5 MB.');return file;
}
