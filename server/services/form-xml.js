import {HttpError} from '../middleware/security.js';
const fail=()=>{throw new HttpError(422,'XML Excel tidak valid atau melampaui batas.');};
export const spreadsheetNS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const relationshipsNS='http://schemas.openxmlformats.org/package/2006/relationships';
export const officeNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const contentNS='http://schemas.openxmlformats.org/package/2006/content-types';
const valid=n=>n===9||n===10||n===13||n>=32&&n<=0xd7ff||n>=0xe000&&n<=0xfffd||n>=0x10000&&n<=0x10ffff;
const basic={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
const cellMessage='Sel mengandung karakter XML yang tidak didukung; hapus karakter tersebut lalu unggah ulang.';
// Every input character is visited once; entity lookahead is bounded to 12 characters.
export function decodeXml(s,{entities=true,onInvalid}={}){
 const parts=[];let start=0;
 for(let i=0;i<s.length;){const begin=i;let n=s.codePointAt(i);i+=n>0xffff?2:1;
  if(entities&&n===38){let end=i;while(end<s.length&&end-i<12&&s[end]!==';'){if(s[end]==='&'||s[end]==='<')fail();end++;}if(s[end]!==';')fail();
   const e=s.slice(i,end);let value;if(Object.hasOwn(basic,e))value=basic[e];else{if(!/^#(?:[0-9]{1,7}|x[0-9a-fA-F]{1,6})$/.test(e))fail();n=e[1]==='x'?parseInt(e.slice(2),16):Number(e.slice(1));if(valid(n))value=String.fromCodePoint(n);else if(onInvalid){onInvalid();value='';}else fail();}
   parts.push(s.slice(start,begin),value);i=end+1;start=i;
  }else if(!valid(n)){if(!onInvalid)fail();onInvalid();parts.push(s.slice(start,begin));start=i;}
 }
 parts.push(s.slice(start));return parts.join('');
}
export function parseXml(text,{cellErrors=false}={}){
 if(text.length>10*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(text))fail();
 const root={name:'root',children:[],text:'',bindings:{xml:'http://www.w3.org/XML/1998/namespace'}},stack=[root];let i=0,count=0;
 const whitespace=()=>{while(i<text.length&&/[\x20\t\r\n]/.test(text[i]))i++;};
 const name=()=>{const start=i;while(i<text.length&&/[\w:.-]/.test(text[i])){if(i-start>=128)fail();i++;}const value=text.slice(start,i);if(!/^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/.test(value))fail();return value;};
 const invalidHandler=()=>{const owner=cellErrors&&stack.findLast(n=>n.uri===spreadsheetNS&&['c','si'].includes(n.name));return owner?()=>{owner.error=cellMessage;}:undefined;};
 const append=(s,entities)=>{stack.at(-1).text+=decodeXml(s,{entities,onInvalid:invalidHandler()});};
 while(i<text.length){if(text[i]!=='<'){const end=text.indexOf('<',i),stop=end<0?text.length:end;const s=text.slice(i,stop);if(s.includes(']]>'))fail();append(s,true);i=stop;continue;}
  if(text.startsWith('<?xml ',i)&&i===0){const end=text.indexOf('?>',i);if(end<0||end>256)fail();decodeXml(text.slice(i,end),{entities:false});i=end+2;continue;}
  if(text.startsWith('<!--',i)){const end=text.indexOf('-->',i);if(end<0)fail();const comment=text.slice(i+4,end);if(comment.includes('--'))fail();decodeXml(comment,{entities:false});i=end+3;continue;}
  if(text.startsWith('<![CDATA[',i)){const end=text.indexOf(']]>',i);if(end<0||stack.length===1)fail();append(text.slice(i+9,end),false);i=end+3;continue;}
  i++;if(text[i]==='/'){i++;const closing=name();whitespace();if(text[i++]!=='>'||stack.length<2||stack.pop().qualified!==closing)fail();continue;}
  if(++count>100000||stack.length>32)fail();const qualified=name(),attrs=Object.create(null);let attributes=0,self=false;
  while(i<text.length){const before=i;whitespace();if(text[i]==='>'){i++;break;}if(text[i]==='/'&&text[i+1]==='>'){i+=2;self=true;break;}if(i===before||++attributes>64)fail();
   const key=name();if(Object.hasOwn(attrs,key))fail();whitespace();if(text[i++]!=='=')fail();whitespace();const quote=text[i++];if(quote!=='"'&&quote!=="'")fail();const start=i;
   while(i<text.length&&text[i]!==quote){if(text[i]==='<'||i-start>=8192)fail();i++;}if(i>=text.length)fail();const raw=text.slice(start,i++);attrs[key]=decodeXml(raw);
  }
  if(text[i-1]!=='>')fail();const bindings=Object.assign(Object.create(null),stack.at(-1).bindings);
  for(const [key,value]of Object.entries(attrs)){if(key==='xmlns')bindings['']=value;else if(key.startsWith('xmlns:')){const prefix=key.slice(6);if(prefix==='xmlns'||!value||prefix==='xml'&&value!==root.bindings.xml)fail();bindings[prefix]=value;}}
  const resolve=(q,attribute=false)=>{const p=q.split(':');if(p.length===2){if(!bindings[p[0]])fail();return bindings[p[0]];}return attribute?'':bindings['']??'';};
  const uri=resolve(qualified),expanded=new Set();for(const key of Object.keys(attrs)){if(key==='xmlns'||key.startsWith('xmlns:'))continue;const k=resolve(key,true)+'|'+key.split(':').at(-1);if(expanded.has(k))fail();expanded.add(k);}
  const node={qualified,name:qualified.split(':').at(-1),uri,attrs,bindings,children:[],text:''};stack.at(-1).children.push(node);if(!self)stack.push(node);
 }
 if(stack.length!==1||root.children.length!==1||root.text.trim())fail();return root.children[0];
}
export function xmlRoot(tree,name,uri){if(tree.name!==name||tree.uri!==uri)fail();return tree;}
export const xmlChildren=(node,name)=>node?.children.filter(c=>c.name===name&&c.uri===node.uri)??[];
export function checkSpreadsheet(tree){const core=new Set(['workbook','sheets','sheet','worksheet','sheetData','row','c','v','f','is','t','r','sst','si']);const walk=n=>{if(core.has(n.name)&&n.uri!==spreadsheetNS)fail();for(const c of n.children)walk(c);};walk(tree);return tree;}
