import assert from 'node:assert/strict';

export async function kpiStatusUiCases({t,call,evaluate,wait,goto,set,capture,pause}){
 const ready=()=>wait("document.querySelectorAll('#page-content .data-panel[data-state=ready]').length===4 && document.querySelector('#kpi-status-summary [data-band]')");
 await t.test('KPI status: data server arah terbalik, legenda, sumber dan filter lokal',async()=>{
  await goto('/monitoring-kpi.html');await ready();
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#perspektif-A th')).map(n=>n.textContent)"),['No/Kode','Indikator','Target','Aktual','Capaian vs target','Keterangan','Snapshot','Detail']);
  assert.equal(await evaluate("document.querySelector('[data-kode=A3] .kpi-achievement').textContent"),'167,57%');
  assert.equal(await evaluate("document.querySelector('[data-kode=A4] .kpi-achievement').textContent"),'55,46%');
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#kpi-status-summary [data-count]')).map(n=>Number(n.dataset.count))"),[8,4,11,5]);
  assert.equal(await evaluate("!!document.querySelector('.section-hero [name=status_capaian]')"),true);
  assert.equal(await evaluate("Array.from(document.querySelectorAll('#page-content .data-panel')).every(p=>p.textContent.includes('tanpa skor berbobot')&&p.querySelector('.panel-meta').textContent.includes('Sumber:'))"),true);
  await evaluate("window.kpiFetch=window.fetch;window.kpiRequests=0;window.fetch=(...args)=>{window.kpiRequests++;return window.kpiFetch(...args)}");
  try{
   for(const [band,total]of [['success',8],['warning',4],['danger',11],['unknown',5],['',28]]){
    await set('status_capaian',band);await wait(`document.querySelectorAll('#page-content tbody tr').length===${total}`);
    assert.equal(await evaluate('window.kpiRequests'),0);
    if(band)assert.equal(await evaluate(`Array.from(document.querySelectorAll('.kpi-achievement')).every(e=>e.classList.contains('kpi-${band}'))`),true);
    assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#kpi-status-summary [data-count]')).map(n=>Number(n.dataset.count))"),[8,4,11,5]);
    assert.equal(await evaluate("document.querySelectorAll('.total-data').length"),4);assert.equal(await evaluate("document.querySelectorAll('.download-excel').length"),4);
   }
  }finally{await evaluate('window.fetch=window.kpiFetch');}
 });
 await t.test('KPI status: batas, NULL, teks/ikon, kontras AA, Detail nonaktif dan reflow',async()=>{
  await evaluate(`window.kpiBoundaryFetch=window.fetch;window.fetch=async(...args)=>{const r=await window.kpiBoundaryFetch(...args);if(!String(args[0]).includes('/api/dashboard/kpi'))return r;const body=await r.json();[69.9,70,99.9,100,167.57,null].forEach((value,i)=>body.data[i].persen_capaian=value);body.data[0].indikator_nama='<img src=x onerror=alert(1)>';return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}})};document.querySelector('.filters').requestSubmit()`);
  await wait("document.querySelector('[data-kode=A1] .kpi-achievement')?.textContent==='69,9%'");
  try{
   const expected=[['danger','69,9%','Belum tercapai','×'],['warning','70%','Mendekati','!'],['warning','99,9%','Mendekati','!'],['success','100%','Tercapai','✓'],['success','167,57%','Tercapai','✓'],['unknown','-','Belum dinilai','−']];
   assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#perspektif-A tbody tr')).map(tr=>[tr.children[4].className.split('kpi-').pop(),tr.children[4].textContent,tr.querySelector('.kpi-status-label span:last-child').textContent,tr.querySelector('.kpi-status-icon').textContent])"),expected);
   assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#kpi-status-summary [data-count]')).map(n=>Number(n.dataset.count))"),[8,6,8,6]);
   assert.equal(await evaluate("document.querySelector('[data-kode=A1] img')===null && document.querySelector('[data-kode=A1]').textContent.includes('<img')"),true);
   for(const width of [1440,360]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===360});await pause(500);
    const result=await evaluate(`(()=>{
     const lum=color=>color.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
     const cells=[...document.querySelectorAll('.kpi-achievement')],ratios=cells.map(e=>{const c=getComputedStyle(e),a=lum(c.color),b=lum(c.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
     return {overflow:document.documentElement.scrollWidth>innerWidth,ratios,colors:[...new Set(cells.map(e=>getComputedStyle(e).backgroundColor))],disabled:[...document.querySelectorAll('.kpi-detail')].every(b=>b.disabled&&b.getAttribute('aria-disabled')==='true'&&b.title==='Detail segera tersedia'),heights:[...document.querySelectorAll('.filters select,.filters button,.download-excel,.kpi-detail')].map(e=>e.getBoundingClientRect().height),local:[...document.querySelectorAll('.table-scroll')].every(e=>getComputedStyle(e).overflowX==='auto'&&e.tabIndex===0),serif:getComputedStyle(document.querySelector('.kpi-overview h2')).fontFamily};
    })()`);
    assert.equal(result.overflow,false,width+' overflow');assert.equal(result.local,true);assert.equal(result.disabled,true);assert.ok(result.heights.every(h=>h>=48));assert.equal(result.colors.length,4);assert.match(result.serif,/Georgia/);assert.ok(Math.min(...result.ratios)>=4.5);t.diagnostic(width+' contrast minimum '+Math.min(...result.ratios).toFixed(2));
    await evaluate("document.querySelector('.table-scroll').focus()");assert.equal(await evaluate("document.activeElement.classList.contains('table-scroll')"),true);
    if(width===360){await call('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39});await pause(250);assert.equal(await evaluate("document.querySelector('.table-scroll').scrollLeft>0"),true);}
    const before=await evaluate('location.href');await evaluate("document.querySelector('.kpi-detail').click()");assert.equal(await evaluate('location.href'),before);
    await evaluate("document.activeElement.blur();window.scrollTo(0,0)");await pause(100);await capture('kpi-status-'+width);
   }
   await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
   assert.equal(await evaluate("getComputedStyle(document.querySelector('.kpi-overview')).animationName"),'none');
   await call('Emulation.setEmulatedMedia',{features:[]});
  }finally{await evaluate('window.fetch=window.kpiBoundaryFetch');}
 });
 await t.test('KPI status: loading, kosong, error/retry tanpa ringkasan lama',async()=>{
  await goto('/monitoring-kpi.html');await ready();
  const second=await evaluate("Array.from(document.querySelector('[name=periode_laporan_id]').options).find(o=>o.textContent.includes('Semester II')).value");
  await set('periode_laporan_id',second);await wait("document.querySelectorAll('.data-panel[data-state=empty]').length===4");
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#kpi-status-summary [data-count]')).map(n=>Number(n.dataset.count))"),[0,0,0,0]);
  await evaluate("window.kpiErrorFetch=window.fetch;window.fetch=(...args)=>String(args[0]).includes('/api/dashboard/kpi')?new Promise(resolve=>window.kpiReject=()=>resolve(new Response(JSON.stringify({error:{code:'SERVER_ERROR',message:'Gagal pada fixture'}}),{status:500,headers:{'content-type':'application/json'}}))):window.kpiErrorFetch(...args);document.querySelector('.filters').requestSubmit()");
  await wait("document.querySelectorAll('.data-panel[data-state=loading]').length===4");assert.equal(await evaluate("document.querySelectorAll('#kpi-status-summary [data-count]').length"),0);
  await wait('!!window.kpiReject');await evaluate('window.kpiReject()');await wait("document.querySelectorAll('.data-panel[data-state=error]').length===4");
  assert.equal(await evaluate("document.querySelectorAll('#page-content tbody tr').length"),0);assert.equal(await evaluate("document.querySelectorAll('#kpi-status-summary [data-count]').length"),0);
  assert.equal(await evaluate("document.querySelector('.data-panel .panel-state button').textContent"),'Coba lagi');
  await evaluate("window.fetch=window.kpiErrorFetch;document.querySelector('.data-panel .panel-state button').click()");await wait("document.querySelectorAll('.data-panel[data-state=empty]').length===4");
  await goto('/monitoring-kpi.html');await ready();
 });
}
