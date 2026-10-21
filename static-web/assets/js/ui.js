import {apiSource,request,format,numeric,period,loginUrl} from './api.js';
import {failure} from './error-ui.js';
export {failure} from './error-ui.js';
export function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined&&text!==null)node.textContent=text;if(cls)node.className=cls;return node;}
export function link(text,href){const node=el('a',text);node.href=href;return node;}
if(typeof window!=='undefined')window.addEventListener('session-expired',({detail})=>{let message=document.getElementById('session-expired');if(!message){message=el('div',null,'auth-message');message.id='session-expired';(document.querySelector('main')??document.body).prepend(message);}failure(message,detail??{status:401,message:'Sesi berakhir, silakan login lagi.'});});
export function actionButton(text,fn,cls='button'){
 const b=el('button',text,cls);b.type='button';b.addEventListener('click',async event=>{if(b.disabled)return;b.disabled=true;b.setAttribute('aria-busy','true');try{await fn(event);}finally{b.disabled=false;b.removeAttribute('aria-busy');}});return b;
}
export function renderKpiCards(container,cards){
  const grid=el('div',null,'kpi-cards');
  for(const {label,value,description,prefix='',suffix=''} of cards){
    const card=el('div',null,'kpi-card');
    const missing=numeric(value)===null;
    card.append(el('p',label,'kpi-label'),el('p',missing?'-':prefix+format(value)+suffix,'kpi-value'),el('p',description??'','kpi-description'));
    grid.append(card);
  }
  container.append(grid);return grid;
}
const charts=new WeakMap();
export function panel(id,title,description,{unframed=false}={}){const root=el('section',null,unframed?'data-summary':'data-panel');root.id=id;root.dataset.state='loading';const heading=el('div',null,'panel-heading');heading.append(el('h2',title));root.append(heading);if(description)root.append(el('p',description,'panel-description'));root.append(el('p','Memuat periode dan sumber…','panel-meta'),el('p','Memuat data…','panel-state'),el('div',null,'panel-content'));return root;}
export function state(root,mode,message){charts.get(root)?.destroy();charts.delete(root);root.dataset.state=mode;root.setAttribute('aria-busy',String(mode==='loading'));const status=root.querySelector('.panel-state');status.textContent=message??'';status.hidden=mode==='ready';status.setAttribute('role',mode==='error'?'alert':'status');root.querySelector('.panel-content').replaceChildren();}
export function metadata(root,response={},fallback='Periode belum tersedia'){
  const periods=[...new Set((response.data??[]).map(period).filter(Boolean))];
  const sources=response.meta?.sumber?.map(s=>s.dokumen+(s.nomor_tabel?' · Tabel '+s.nomor_tabel:'')).join('; ')||[...new Set((response.data??[]).map(r=>r.sumber).filter(Boolean))].join('; ')||'belum ada data terverifikasi';
  root.querySelector('.panel-meta').textContent=(periods.join('; ')||fallback)+' · Sumber: '+sources;
  for(const note of root.qualityNotes===false?[]:response.meta?.catatan_kualitas??[]){const a=link('Catatan kualitas data','kualitas-data.html#'+encodeURIComponent(note.kode));a.className='quality-note';a.title=note.pesan;a.append(el('span',note.pesan));root.querySelector('.panel-content').append(a);}
}
export function empty(root,message,context){state(root,'empty',message);metadata(root,{},context);}
export function error(root,err,context,retry){state(root,'error');metadata(root,{},context);failure(root.querySelector('.panel-state'),err,retry);}
export function exportButton(root,rows){const b=el('button','Download Excel','secondary download-excel');b.type='button';b.disabled=rows.length<=1;b.addEventListener('click',async()=>{b.disabled=true;try{if(root.apiPath)await request(root.apiPath);const {downloadExcel}=await import('./excel.js');downloadExcel([[root.querySelector('h2').textContent],[root.querySelector('.panel-meta').textContent],[],...rows],root.id);}catch(e){const message=el('p',null,'error-box');root.querySelector('.panel-content').append(message);failure(message,e,()=>b.click());}finally{b.disabled=rows.length<=1;}});return b;}
export function table(root,columns,rows,{details=false}={}){
  const wrap=el('div',null,'table-scroll'),t=el('table'),head=el('thead'),tr=el('tr');for(const col of columns){const th=el('th',col.label);th.scope='col';tr.append(th);}head.append(tr);t.append(head);const body=el('tbody');
  for(const row of rows){const tr=el('tr');for(const col of columns){const value=typeof col.value==='function'?col.value(row):row[col.key];const cell=el('td',col.number?format(value):value??'belum ada data');if(value instanceof Node)cell.replaceChildren(value);tr.append(cell);}body.append(tr);}t.append(body);wrap.append(t);
  const dashboard=!!document.body.dataset.page,tools=el('div',null,'data-tools'),dataCard=el('p','Total Data: '+format(rows.length),'total-data');
  if(dashboard){const selected=columns.filter(c=>c.export!==false);const exportRows=[selected.map(c=>c.label),...rows.map(row=>selected.map(c=>{const v=typeof c.value==='function'?c.value(row):row[c.key];return v instanceof Node?v.textContent:v??null;}))];tools.append(dataCard,exportButton(root,exportRows));}
  if(details){const d=el('details'),s=el('summary','Lihat data grafik');d.append(s,tools,wrap);root.querySelector('.panel-content').append(d);}else root.querySelector('.panel-content').append(tools,wrap);
}
export function plot(root,labels,datasets,type='bar'){
  charts.get(root)?.destroy();charts.delete(root);
  if(!labels.length||!datasets.some(d=>d.data.some(v=>numeric(v)!==null))){state(root,'empty','Belum ada data untuk grafik ini.');return;}
  let area=type==='area';const donut=type==='donut',wrap=el('div',null,'chart-container'),canvas=el('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',root.querySelector('h2').textContent+'. Rincian tersedia pada tabel data grafik.');wrap.append(canvas);root.querySelector('.panel-content').append(wrap);
  const colors=['#1565c0','#42a5f5','#14a5a3','#8b78d5','#eea648','#7aa4c9'];
  const center={id:'itplnTotal',afterDraw(chart){if(!donut)return;const arc=chart.getDatasetMeta(0).data[0];if(!arc)return;const total=chart.data.datasets[0].data.reduce((n,v)=>n+(numeric(v)??0),0),ctx=chart.ctx;ctx.save();ctx.textAlign='center';ctx.fillStyle='#657489';ctx.font='12px system-ui';ctx.fillText('Total',arc.x,arc.y-12);ctx.fillStyle='#1565c0';ctx.font='600 28px system-ui';ctx.fillText(format(total),arc.x,arc.y+22);ctx.restore();}};
  const draw=mode=>{charts.get(root)?.destroy();area=mode==='area';const horizontal=mode==='horizontal';
    const chart=new Chart(canvas,{
    type:donut?'doughnut':area||mode==='line'?'line':'bar',plugins:[center],
    data:{labels,datasets:datasets.map((d,i)=>({...d,
      backgroundColor:donut?labels.map((_,j)=>colors[j%colors.length]):area?'#1565c024':colors[i%colors.length],
      borderColor:donut?'#fff':colors[i%colors.length],borderWidth:donut?2:1,fill:area,tension:0.2
    }))},
    options:{responsive:true,maintainAspectRatio:false,animation:false,indexAxis:horizontal?'y':'x',...(donut?{cutout:'64%'}:{}),
      plugins:{legend:{display:donut||datasets.length>1,position:'bottom'},tooltip:{callbacks:{label:c=>{
        const total=c.dataset.data.reduce((n,v)=>n+(numeric(v)??0),0);
        return (c.dataset.label?c.dataset.label+': ':'')+format(donut?c.parsed:horizontal?c.parsed.x:c.parsed.y)+(donut&&total>0?' ('+format(100*c.parsed/total)+'%)':'');
      }}}},
      ...(donut?{}:{scales:horizontal?{x:{beginAtZero:true,ticks:{callback:v=>format(v)}},y:{ticks:{maxRotation:0,minRotation:0}}}:{y:{beginAtZero:true,ticks:{callback:v=>format(v)}},x:{ticks:{maxRotation:60,minRotation:0}}}})
    }
  });charts.set(root,chart);};
  const tools=el('div',null,'data-tools');if(!donut){const label=el('label','Tipe grafik'),select=el('select');select.setAttribute('aria-label','Tipe grafik '+root.querySelector('h2').textContent);for(const [v,t]of [['bar','Kolom'],['line','Garis'],['horizontal','Bar'],['area','Area']])select.append(new Option(t,v));select.value=['line','horizontal','area'].includes(type)?type:'bar';select.addEventListener('change',()=>draw(select.value));label.append(select);tools.append(label);}
  tools.append(exportButton(root,[['Kategori',...datasets.map(d=>d.label)],...labels.map((v,i)=>[v,...datasets.map(d=>d.data[i]??null)])]));root.querySelector('.panel-content').insertBefore(tools,wrap);draw(type);
  table(root,[{label:'Kategori',key:'kategori'},...datasets.map((d,i)=>({label:d.label,key:'v'+i,number:true}))],labels.map((kategori,i)=>Object.fromEntries([['kategori',kategori],...datasets.map((d,j)=>['v'+j,d.data[i]])])),{details:true});
}
export async function render(root,loader,draw,context){const sequence=(root.sequence??0)+1;root.sequence=sequence;state(root,'loading','Memuat data…');root.querySelector('.panel-meta').textContent=(context||'Periode yang dipilih')+' · Memuat sumber…';try{const response=await loader();if(root.sequence!==sequence)return;root.apiPath=response[apiSource];if(!response.data?.length){empty(root,response.meta?.message||'Belum ada data. Menunggu input unit terkait.',context);metadata(root,response,context);return;}state(root,'ready');metadata(root,response,context);draw(response);}catch(e){if(root.sequence===sequence)error(root,e,context);}}
