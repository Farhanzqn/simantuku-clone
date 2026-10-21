import {kpiStatusUiCases} from './kpi-status-ui-cases.js';
import {formFeedbackUiCases} from './form-feedback-ui-cases.js';
import {homeSummaryUiCases} from './home-summary-ui-cases.js';
import {errorHandlingUiCases} from './error-handling-ui-cases.js';
import {simpleCases} from './excel-simple-cases.js';
import {bulkVerificationUiCases} from './bulk-verification-ui-cases.js';
import {excelEntryCases} from './excel-entry-cases.js';
import {getDomain} from '../validators/domains.js';
import {formDefinitions} from '../../static-web/assets/js/input-schema.js';
import {unzipSync,strFromU8,strToU8,zipSync} from 'fflate';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile,access,readdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import bcrypt from 'bcrypt';
import {createPool} from '../services/db.js';
import {migrate} from '../../db/scripts/migrate.js';
import {seed} from '../../db/scripts/seed-home-public.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('Fase 3: Edge desktop/mobile, API native dan akses publik/session',async t=>{
  const database=process.env.PGTEST_DATABASE;assert.ok(database?.endsWith('_test')&&database!==process.env.PGDATABASE);
  const owner=createPool(database);await migrate(owner);await seed(owner);
  const run=randomUUID(),password=randomBytes(18).toString('hex'),newPassword=randomBytes(18).toString('hex'),users=[];
  for(const role of ['viewer','bsdm','baa','prp','admin','ppa','bpka']){const row=(await owner.query(`INSERT INTO users(nama,email,password_hash,role,unit_id,must_change_password) VALUES($1,$2,$3,$4,(SELECT id FROM unit WHERE kode=$5),$6) RETURNING id,email`,['UI '+role,`ui-${role}-${run}@test.invalid`,await bcrypt.hash(password,4),role,role.toUpperCase(),role==='bsdm'])).rows[0];users.push(row);}
  const base='http://127.0.0.1:31937',api=spawn(process.execPath,['server/tests/ui-server.js'],{windowsHide:true,env:{...process.env,PGDATABASE:database,PORT:'31937',PUBLIC_DASHBOARD:'true',DEV_SKIP_PASSWORD_CHANGE:'false'},stdio:['ignore','pipe','pipe']});
  let browser,socket;
  try{
    await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('API startup timeout')),10000);api.once('exit',()=>{clearTimeout(timer);fail(new Error('API startup failed'));});api.stdout.on('data',b=>{if(String(b).includes('API Satu Data ITPLN:')){clearTimeout(timer);ok();}});});
    let executable=process.env.EDGE_BINARY;for(const path of ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'])if(!executable){try{await access(path);executable=path;}catch{}}
    assert.ok(executable,'Instal Microsoft Edge atau isi EDGE_BINARY.');await mkdir('.runtime/phase3',{recursive:true});
    browser=spawn(executable,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=31938','--user-data-dir='+resolve('.runtime/phase3/edge-'+run),'about:blank'],{windowsHide:true,stdio:'ignore'});
    let pages;for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:31938/json/list',{signal:AbortSignal.timeout(500)})).json();if(pages.length)break;}catch{}await pause(100);}assert.ok(pages?.length,'Edge DevTools tersedia.');
    socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((ok,fail)=>{socket.addEventListener('open',ok,{once:true});socket.addEventListener('error',fail,{once:true});});
    let sequence=0;const pending=new Map(),exceptions=[],csp=[],dialogs=[];
    socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.fail(new Error(m.error.message)):p.ok(m.result);}}if(m.method==='Page.javascriptDialogOpening')dialogs.push(m.params.message);if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails.text);if(m.method==='Log.entryAdded'&&/Content Security Policy|Refused to/.test(m.params.entry.text))csp.push(m.params.entry.text);});
    const call=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence,timer=setTimeout(()=>fail(new Error('CDP timeout: '+method)),7000);pending.set(id,{ok:r=>{clearTimeout(timer);ok(r);},fail:e=>{clearTimeout(timer);fail(e);}});socket.send(JSON.stringify({id,method,params}));});
    const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value;};
    const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(100);}throw new Error('UI timeout: '+expression);};
    // Page.navigate selesai sebelum DOM baru siap; hindari mengisi formulir login lama.
    const goto=async path=>{const marker=randomUUID();await evaluate(`document.documentElement.dataset.uiNavigation=${JSON.stringify(marker)}`);await call('Page.navigate',{url:base+path});await wait(`document.documentElement?.dataset.uiNavigation!==${JSON.stringify(marker)} && document.readyState==='complete'`);};
    const ready=id=>wait(`document.getElementById(${JSON.stringify(id)})?.dataset.state==='ready'`);
    const chart=id=>evaluate(`Chart.getChart(document.querySelector('#${id} canvas')).data`);
    const set=async(name,value)=>{await evaluate(`(()=>{const e=document.querySelector('[name=${JSON.stringify(name)}]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
    const login=async(user,pw)=>{await wait("!!document.querySelector('#auth-form [name=email]')");const target=await evaluate("import('/assets/js/api.js').then(m=>m.safeNext(new URLSearchParams(location.search).get('next')))");await evaluate(`document.querySelector('[name=email]').value=${JSON.stringify(user.email)};document.querySelector('[name=password]').value=${JSON.stringify(pw)};document.querySelector('#auth-form').requestSubmit()`);if(user!==users[1]||pw===newPassword){const path=new URL(target,base).pathname;await wait('location.pathname==='+JSON.stringify(path));assert.equal(await evaluate('location.pathname'),path);}};
    const capture=async name=>{const metrics=await call('Page.getLayoutMetrics');const width=metrics.cssContentSize.width,height=Math.min(metrics.cssContentSize.height,8000);await writeFile('.runtime/phase3/'+name+'.png',Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height,scale:1}})).data,'base64'));};
    await call('Page.enable');await call('Runtime.enable');await call('Log.enable');await call('Network.enable');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    // Real browser download: never replace Blob URLs or anchor clicks.
    const ExcelJS=(await import('../../.runtime/xlsx-diag/scratch/node_modules/exceljs/excel.js')).default;
    const downloadRoot=resolve('.runtime/xlsx-diag/browser-'+run);await mkdir(downloadRoot,{recursive:true});
    await call('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:downloadRoot,eventsEnabled:true});
    const downloads=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Browser.downloadWillBegin')downloads.set(m.params.guid,{...m.params});if(m.method==='Browser.downloadProgress')Object.assign(downloads.get(m.params.guid)??{},m.params);});
    const downloadTemplate=async(domain,selector='#template-upload button')=>{
      const previous=new Set(downloads.keys());
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
      // Inline links may wrap on 360px; click a text fragment, not the empty union.
      const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getClientRects()[0];return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
      await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
      let download;for(let i=0;i<150;i++){download=[...downloads.values()].find(d=>!previous.has(d.guid));if(download?.state==='completed'||download?.state==='canceled')break;await pause(100);}
      assert.equal(download?.state,'completed',domain+': browser must finish saving');
      assert.equal(download.suggestedFilename,domain+'-template.xlsx');assert.ok(download.receivedBytes>0,domain+': download must not be 0 B');
      const file=download.guid,bytes=await readFile(resolve(downloadRoot,file));assert.ok(bytes.length>0);assert.equal(bytes.subarray(0,4).toString('hex'),'504b0304');assert.equal(bytes.length,download.receivedBytes);
      const book=new ExcelJS.Workbook();await book.xlsx.load(bytes);assert.deepEqual(book.worksheets.map(s=>s.name),['Petunjuk','Data','_meta']);assert.equal(book.getWorksheet('_meta').state,'hidden');
      t.diagnostic(domain+': saved '+bytes.length+' bytes; PK; ExcelJS OK');return bytes;
    };
    await t.test('Input BAA: tipografi, kontras AA, reflow 1440/360 dan reduced motion',async()=>{
      await goto('/login.html');await login(users[2],password);await goto('/input/baa.html');await wait("!!document.querySelector('#entry-table tbody tr')");
      for(const width of [1440,360]){
        await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===360});await pause(700);
        const appearance=await evaluate(`(()=>{
          const rgb=s=>s.match(/[\\d.]+/g).slice(0,3).map(Number),lum=c=>rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
          const background=e=>{for(;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent')return c;}return 'rgb(255,255,255)';};
          const contrast=(e,pseudo)=>{const a=lum(getComputedStyle(e,pseudo).color),b=lum(background(e));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
          const fields=[...document.querySelectorAll('.filters select,.entry-table input')],text=[...document.querySelectorAll('.filters label,.entry-table th,.entry-table td,.input-help,.template-upload small')];
          return {overflow:document.documentElement.scrollWidth>innerWidth,tableOverflow:document.querySelector('.entry-scroll').scrollWidth>document.querySelector('.entry-scroll').clientWidth,
            contrast:Math.min(...[...fields,...text].map(e=>contrast(e))),placeholder:Math.min(...fields.map(e=>contrast(e,'::placeholder'))),
            ink:fields.every(e=>getComputedStyle(e).color==='rgb(11, 27, 43)'),font:Math.min(...fields.map(e=>parseFloat(getComputedStyle(e).fontSize))),height:Math.min(...fields.map(e=>e.getBoundingClientRect().height)),
            serif:getComputedStyle(document.querySelector('h1')).fontFamily,labels:[...document.querySelectorAll('td[data-label]')].every(e=>getComputedStyle(e,'::before').content===JSON.stringify(e.dataset.label))};
        })()`);
        assert.equal(appearance.overflow,false,'Page '+width);assert.equal(appearance.tableOverflow,width===360,'Local table scroll '+width);
        assert.ok(appearance.contrast>=4.5,JSON.stringify(appearance));assert.ok(appearance.placeholder>=4.5);assert.equal(appearance.ink,true);
        assert.ok(appearance.font>=15);assert.ok(appearance.height>=48);assert.match(appearance.serif,/Georgia/);if(width===360)assert.equal(appearance.labels,false);
        t.diagnostic('BAA '+width+': minimum contrast '+appearance.contrast.toFixed(2)+':1');
        await mkdir('.runtime/ui-pre',{recursive:true});await writeFile('.runtime/ui-pre/baa-after-'+width+'.png',Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
        await evaluate("document.querySelector('.entry-scroll').scrollIntoView({block:'start'})");await capture('baa-table-after-'+width);await evaluate('scrollTo(0,0)');
      }
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      assert.equal(await evaluate("[...document.querySelectorAll('.filters,.template-upload')].every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).transform==='none')"),true);
      await call('Emulation.setEmulatedMedia',{features:[]});await call('Network.clearBrowserCookies');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    });
    await t.test('Navbar bersama, dropdown keyboard, kunci anonim dan hamburger 360px',async()=>{
      for(const file of (await readdir('static-web')).filter(f=>f.endsWith('.html')&&!['capaian-iku-fakultas.html','maintenance.html'].includes(f)))assert.ok((await readFile('static-web/'+file,'utf8')).includes('assets/js/navbar.js'),file+' memakai sumber navbar bersama');
      await goto('/');await wait("document.querySelector('#navbar')?.dataset.auth==='anonymous'");
      assert.equal(await evaluate("document.querySelector('.nav-login').textContent"),'Masuk →');
      assert.ok((await evaluate("document.querySelector('.nav-brand').textContent")).includes('Dashboard Data PRP ITPLN'));
      assert.equal(await evaluate("document.querySelector('.nav-brand').getAttribute('href')"),'/index.html');
      assert.equal(await evaluate("document.querySelector('.nav-home').getAttribute('href')"),'/index.html');
      assert.equal(await evaluate("document.querySelector('.nav-home').getAttribute('aria-current')"),'page');
      assert.equal(await evaluate("document.querySelector('.home-eyebrow').textContent"),'Institut Teknologi PLN · YPK PLN');
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#main-menu > .nav-item > .nav-link')).map(e=>e.textContent)"),['Beranda','Mahasiswa \u25be','SDM \u25be','Akademik & Mutu \u25be','Tridharma \u25be','Dashboard Pimpinan \u25be','Administrasi \u25be']);
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.nav-section h2')).map(e=>e.textContent)"),[]);
      assert.equal(await evaluate("document.querySelectorAll('#dashboard-data-menu a').length"),5);
      assert.equal(await evaluate("document.querySelectorAll('#navbar a[href*=fakultas]').length"),0);
      await call('Page.bringToFront');
      const key=async(key,code,number)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,windowsVirtualKeyCode:number,...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:key===' '?{text:' ',unmodifiedText:' '}:{})});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,windowsVirtualKeyCode:number});};
      await evaluate("document.querySelector('[aria-controls=dashboard-data-menu]').focus()");await key('Enter','Enter',13);
      assert.equal(await evaluate("document.querySelector('[aria-controls=dashboard-data-menu]').getAttribute('aria-expanded')"),'true');
      await key('ArrowDown','ArrowDown',40);assert.equal(await evaluate('document.activeElement.textContent'),'Statistik Mahasiswa');
      await key('ArrowDown','ArrowDown',40);assert.equal(await evaluate('document.activeElement.textContent'),'Mahasiswa Baru');
      await key('Escape','Escape',27);assert.equal(await evaluate("document.activeElement.getAttribute('aria-controls')"),'dashboard-data-menu');
      await evaluate("document.querySelector('[aria-controls=iku-menu]').focus()");await key(' ','Space',32);
      assert.equal(await evaluate("document.querySelector('[aria-controls=iku-menu]').getAttribute('aria-expanded')"),'true');
      assert.equal(await evaluate("document.querySelector('#iku-menu').getBoundingClientRect().right<=window.innerWidth"),true,'Dropdown IKU tetap di dalam viewport desktop');
      const locked=await evaluate("Array.from(document.querySelectorAll('[data-requires-login]')).map(a=>({href:a.href,label:a.getAttribute('aria-label'),lock:!!a.querySelector('.nav-lock')}))");
      assert.ok(locked.every(a=>a.href.includes('/login.html?next=')&&a.lock&&a.label.includes('perlu login')));

      assert.equal(await evaluate("Array.from(document.querySelectorAll('#navbar img,.footer-logo')).every(i=>i.complete&&i.naturalWidth>0)"),true);
      const destinations=await evaluate("Array.from(new Set(Array.from(document.querySelectorAll('#main-menu a[data-destination]')).map(a=>'/'+a.dataset.destination)))");for(const href of destinations)assert.ok([200,302,401].includes((await fetch(base+href,{redirect:'manual'})).status),href);
      await evaluate("document.querySelector('.nav-search input').value='Keuangan';document.querySelector('.nav-search input').dispatchEvent(new Event('input'))");
      assert.equal(await evaluate("document.querySelector('#menu-search-results a').dataset.destination"),'keuangan.html');assert.equal(await evaluate("!!document.querySelector('#menu-search-results .nav-lock')"),true);
      await evaluate("document.querySelector('.nav-search input').focus()");await key('ArrowDown','ArrowDown',40);assert.equal(await evaluate("document.activeElement.dataset.destination"),'keuangan.html');await key('Escape','Escape',27);
      assert.equal(await evaluate("document.querySelector('#menu-search-results').hidden"),true);
      await capture('navbar-desktop');
      await evaluate("document.querySelector('[data-destination=\"monitoring-kpi.html\"]').click()");await wait("location.pathname==='/login.html'&&new URLSearchParams(location.search).get('next')==='/monitoring-kpi.html'");
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});await goto('/');await wait("document.querySelector('#navbar')?.dataset.auth==='anonymous'");
      await evaluate("document.querySelector('.nav-toggle').focus()");await key('Enter','Enter',13);
      assert.equal(await evaluate("document.querySelector('.nav-home').getBoundingClientRect().width>0"),true);
      for(const id of ['dashboard-data-menu','sdm-menu','mutu-menu','tridharma-menu','iku-menu']){await evaluate(`document.querySelector('[aria-controls=${id}]').click()`);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,id+' mobile tanpa overflow');}
      await capture('navbar-mobile');await key('Escape','Escape',27);assert.equal(await evaluate("document.querySelector('[aria-controls=iku-menu]').getAttribute('aria-expanded')"),'false');await key('Escape','Escape',27);assert.equal(await evaluate("document.querySelector('.nav-toggle').getAttribute('aria-expanded')"),'false');
      await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    });
    await t.test('Beranda enam grafik asli, fakultas/tren kosong, periode dan sumber',async()=>{
      await goto('/');await wait("document.querySelector('#dashboard-status')?.dataset.state==='ready' && document.querySelectorAll('.data-panel[data-state=loading]').length===0");
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.home-card-value')).map(e=>e.textContent)"),['222','5.080','19','109','21.172','1.100','17','-']);
      assert.equal((await chart('angkatan')).datasets[0].data.reduce((a,b)=>a+b,0),5080);assert.equal((await chart('jafung')).datasets[0].data.reduce((a,b)=>a+b,0),223);
      assert.deepEqual((await chart('pegawai')).datasets[0].data.sort((a,b)=>a-b),[55,222]);assert.deepEqual((await chart('pendidikan')).datasets[0].data,[77,145]);assert.deepEqual((await chart('status')).labels,['aktif']);
      assert.equal(await evaluate("document.querySelector('#tren').dataset.state"),'empty');assert.equal(await evaluate("document.querySelector('#dosen-fakultas').dataset.state"),'empty');
      assert.ok((await evaluate("document.querySelector('#jafung .quality-note').title")).includes('223 vs dosen 222'));
      assert.ok((await evaluate('document.body.innerText')).includes('per Juni 2026'));assert.ok((await evaluate('document.body.innerText')).includes('Tabel 2.5'));
      assert.equal(await evaluate("document.querySelectorAll('.home-cluster').length"),2);
      assert.equal(await evaluate("document.querySelectorAll('.home-card .home-kpi-icon svg').length"),8);
      assert.equal(await evaluate("!!document.querySelector('.home-hero .filters [name=periode_laporan_id]')"),true);
      assert.equal(await evaluate("document.querySelector('#home-chart-badge').textContent"),'6 grafik tersedia');
      assert.equal(await evaluate("document.querySelector('#home-cluster-badge').textContent"),'2 klaster');
      assert.equal(await evaluate("document.querySelector('#home-period-badge').textContent"),'Periode data 2026-S1');
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.home-cluster-count')).map(x=>x.textContent)"),['3 grafik \u00b7 5 panel','3 grafik \u00b7 4 panel']);
      assert.equal(await evaluate("Array.from(document.querySelectorAll('#home-quick-links a')).every(x=>!!document.querySelector(x.getAttribute('href')))"),true);
      assert.equal(await evaluate("document.querySelectorAll('.footer-links a').length"),3);
      assert.equal(await evaluate("document.querySelector('.footer-copyright').textContent"),'\u00a9 2026 Farhanzqn');
      assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);assert.equal(await evaluate("document.querySelector('#angkatan').parentElement.classList.contains('panel-grid')"),true);await capture('home-desktop');
      for(const width of [1280,1440,1920,2560,768,360]){
        await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
        await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const layout=await evaluate(`(()=>{const edges=e=>{const r=e.getBoundingClientRect(),c=getComputedStyle(e);return [r.left+parseFloat(c.paddingLeft),r.right-parseFloat(c.paddingRight)]};const main=edges(document.querySelector('.page-main'));const aligned=['.nav-top','.itpln-footer'].every(s=>edges(document.querySelector(s)).every((v,i)=>Math.abs(v-main[i])<1));const cards=Array.from(document.querySelectorAll('.home-hero,#dashboard-cards,.home-cluster')).every(e=>{const r=e.getBoundingClientRect();return Math.abs(r.left-main[0])<1&&Math.abs(r.right-main[1])<1});return {aligned,cards,overflow:document.documentElement.scrollWidth>innerWidth,max:getComputedStyle(document.querySelector('.page-main')).maxWidth,gap:getComputedStyle(document.querySelector('.panel-grid')).gap,height:document.querySelector('.chart-container').getBoundingClientRect().height,columns:getComputedStyle(document.querySelector('.panel-grid')).gridTemplateColumns.split(' ').length}})()`);
        assert.equal(layout.aligned,true,'Header/footer sejajar '+width);assert.equal(layout.cards,true,'Hero/KPI/klaster sejajar '+width);
        assert.equal(layout.overflow,false,'Tanpa overflow '+width);assert.equal(layout.max,'1680px');assert.equal(layout.gap,width<=640?'16px':'24px');
        assert.equal(layout.height,width===360?300:340,'Tinggi kanvas tetap');assert.equal(layout.columns,width===360?1:2);
        const cardLayout=await evaluate("(()=>{const root=document.querySelector('.home-cards'),r=[...root.children].map(e=>e.getBoundingClientRect());return {columns:getComputedStyle(root).gridTemplateColumns.split(' ').length,rows:new Set(r.map(x=>Math.round(x.top))).size,equal:r.every(x=>Math.abs(x.width-r[0].width)<1)}})()");
        assert.equal(cardLayout.columns,width<=1000?2:4);assert.equal(cardLayout.rows,width<=1000?4:2);assert.equal(cardLayout.equal,true);
        await mkdir('.runtime/home-summary',{recursive:true});await writeFile('.runtime/home-summary/canvas-after-'+width+'.json',JSON.stringify(await evaluate("[...document.querySelectorAll('.chart-container canvas')].map(c=>({id:c.closest('.data-panel').id,width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height}))")));
        if([1440,360].includes(width)){
          await capture('home-summary-'+width);
          const clip=await evaluate("(()=>{const r=document.querySelector('#dashboard-cards').getBoundingClientRect();return {x:0,y:Math.floor(r.top+scrollY)-8,width:innerWidth,height:Math.ceil(r.height)+16,scale:1}})()");
          await writeFile('.runtime/home-summary/cards-'+width+'.png',Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip})).data,'base64'));
        }
      }
      await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});

      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      assert.equal(await evaluate("Array.from(document.querySelectorAll('.hero-lights i,.official-logo,.hero-orbit span')).every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).transform==='none')"),true,'Reduced motion menghentikan gerak dan miring');
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.hero-orbit'),'::before').animationName"),'none');
      await call('Emulation.setEmulatedMedia',{features:[]});
    });
    await homeSummaryUiCases(t,{owner,base,users,password,call,evaluate,wait,goto,ready,login,capture});
    await t.test('Filter mahasiswa, Bar/Donut/Area, kosong, error dan retry',async()=>{
      await goto('/statistik-mahasiswa.html');await ready('mahasiswa-chart');assert.equal((await chart('mahasiswa-chart')).datasets[0].data.reduce((a,b)=>a+b,0),5080);
      await ready('mahasiswa-summary');await ready('mahasiswa-gender');await ready('mahasiswa-jenjang');await ready('mahasiswa-angkatan');
      assert.equal(await evaluate("document.querySelectorAll('.chart-grid').length"),0);assert.equal(await evaluate("document.querySelector('#mahasiswa-chart .chart-container').getBoundingClientRect().height"),340);
      assert.ok((await evaluate("document.querySelector('#mahasiswa-summary').textContent")).includes('1.494'));
      assert.deepEqual((await chart('mahasiswa-gender')).datasets[0].data,[1494,3586]);
      const prodi=await evaluate("document.querySelector('[name=prodi_id]').options[1].value");await set('prodi_id',prodi);await ready('mahasiswa-chart');assert.equal((await chart('mahasiswa-chart')).datasets[0].data[0],418);
      await set('status','cuti');await wait("document.querySelector('#mahasiswa-chart').dataset.state==='empty'");
      await set('prodi_id','');await set('status','aktif');await ready('mahasiswa-chart');await set('tipe','donut');await ready('mahasiswa-chart');assert.equal(await evaluate("Chart.getChart(document.querySelector('#mahasiswa-chart canvas')).config.type"),'doughnut');
      await set('jenjang','S1');await ready('mahasiswa-chart');assert.equal((await chart('mahasiswa-chart')).labels.length,12);
      await set('jenjang','');const oldReport=await evaluate("document.querySelector('[name=periode_laporan_id]').value");const nextReport=await evaluate("document.querySelector('[name=periode_laporan_id]').options[1].value");await set('periode_laporan_id',nextReport);await wait("document.querySelector('#mahasiswa-chart').dataset.state==='empty'");assert.ok((await evaluate("document.querySelector('#mahasiswa-chart .panel-meta').textContent")).includes('Semester II'));await set('periode_laporan_id',oldReport);await ready('mahasiswa-chart');
      await set('tipe','area');await ready('mahasiswa-chart');assert.equal(await evaluate("Chart.getChart(document.querySelector('#mahasiswa-chart canvas')).config.type"),'line');
      await evaluate("window.savedFetch=window.fetch;window.fetch=()=>Promise.reject(new TypeError('Network'));document.querySelector('.filters').requestSubmit()");await wait("document.querySelector('#mahasiswa-chart').dataset.state==='error'");
      await evaluate("window.fetch=window.savedFetch;document.querySelector('.filters').requestSubmit()");await ready('mahasiswa-chart');
    });
    await t.test('B1: URL bisa dibagikan, Total Data, tipe grafik dan XLSX terfilter',async()=>{
      await goto('/statistik-mahasiswa.html');await ready('mahasiswa-table');const prodi=await evaluate("document.querySelector('[name=prodi_id]').options[1].value");await set('prodi_id',prodi);await ready('mahasiswa-table');
      assert.equal(await evaluate("new URLSearchParams(location.search).get('prodi_id')"),prodi);const shared=await evaluate('location.pathname+location.search');await goto(shared);await ready('mahasiswa-chart');assert.equal((await chart('mahasiswa-chart')).labels.length,1);
      assert.ok((await evaluate("document.querySelector('#mahasiswa-table .total-data').textContent")).includes('1'));
      await evaluate("(()=>{const s=document.querySelector('#mahasiswa-chart select');s.value='horizontal';s.dispatchEvent(new Event('change'));})()");assert.equal(await evaluate("Chart.getChart(document.querySelector('#mahasiswa-chart canvas')).options.indexAxis"),'y');
      await evaluate("(()=>{const s=document.querySelector('#mahasiswa-chart select');s.value='line';s.dispatchEvent(new Event('change'));})()");assert.equal(await evaluate("Chart.getChart(document.querySelector('#mahasiswa-chart canvas')).config.type"),'line');
      await evaluate("window.exportBlob=null;window.oldBlobURL=URL.createObjectURL;window.oldAnchorClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{window.exportBlob=b;return 'blob:test-export'};HTMLAnchorElement.prototype.click=function(){window.exportName=this.download};document.querySelector('#mahasiswa-table .download-excel').click()");
      await wait('!!window.exportBlob');const bytes=await evaluate('exportBlob.arrayBuffer().then(b=>Array.from(new Uint8Array(b)))');const files=unzipSync(new Uint8Array(bytes)),sheet=strFromU8(files['xl/worksheets/sheet1.xml']);assert.ok(sheet.includes('<v>418</v>'));assert.ok(sheet.includes('<v>39</v>'));assert.ok(!sheet.includes('password_hash'));assert.match(await evaluate('window.exportName'),/\.xlsx$/);
      await evaluate("URL.createObjectURL=window.oldBlobURL;HTMLAnchorElement.prototype.click=window.oldAnchorClick");
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    });
    await t.test('PMB, prodi dan tiga domain kosong tanpa data contoh',async()=>{
      await goto('/mahasiswa-baru.html');await ready('pmb-chart');assert.equal(await evaluate("document.querySelector('#pmb-chart').getBoundingClientRect().width===document.querySelector('#pmb-table').getBoundingClientRect().width"),true);const datasets=(await chart('pmb-chart')).datasets;assert.deepEqual(datasets.map(d=>d.data.reduce((a,b)=>a+b,0)),[2030,1678]);assert.ok((await evaluate('document.body.innerText')).includes('61,95%'));
      assert.ok((await evaluate("document.querySelector('.quality-note').href")).includes('pmb-definisi-berbeda'));
      await goto('/daftar-prodi.html');await ready('prodi-table');assert.equal(await evaluate("document.querySelectorAll('#prodi-table tbody tr').length"),19);
      await goto('/lulusan.html');await ready('lulusan-institusi');await ready('tracer-summary');assert.ok((await evaluate("document.querySelector('#lulusan-institusi').textContent")).includes('1.100'));assert.ok((await evaluate("document.querySelector('#tracer-summary').textContent")).includes('328'));
      for(const name of ['kinerja-pt','beban-mengajar','rekognisi-dosen']){await goto('/'+name+'.html');await wait("document.querySelector('#empty-domain')?.dataset.state==='empty'");assert.ok((await evaluate('document.body.innerText')).includes('Belum ada data, menunggu input unit terkait'));}
    });
    await t.test('Redirect fakultas/login, KPI viewer dan sumber flag',async()=>{
      const faculty=await fetch(base+'/capaian-iku-fakultas.html',{redirect:'manual'});assert.equal(faculty.status,302);assert.equal(faculty.headers.get('location'),'/monitoring-kpi.html');
      assert.equal((await fetch(base+'/monitoring-kpi.html',{redirect:'manual'})).status,401);
      await goto('/login.html?next=https%3A%2F%2Fevil.com');await wait("location.pathname==='/login.html' && !!document.querySelector('#auth-form')");await login(users[0],password);
      await goto('/monitoring-kpi.html');await wait("location.pathname==='/monitoring-kpi.html' && document.querySelectorAll('.data-panel[data-state=ready]').length===4");
      assert.equal(await evaluate("document.querySelectorAll('.data-panel tbody tr').length"),28);assert.equal(await evaluate("Array.from(document.querySelectorAll('th')).some(e=>/bobot|skor/i.test(e.textContent))"),false);
      assert.deepEqual(await evaluate("['A','B','C','D'].map(p=>document.querySelectorAll('#perspektif-'+p+' tbody tr').length)"),[6,7,10,5]);
      assert.equal(await evaluate("['A','B','C','D'].every(p=>!!document.querySelector('#perspektif-'+p+' .total-data') && !!document.querySelector('#perspektif-'+p+' .download-excel'))"),true);
      await wait("document.querySelector('#navbar').textContent.includes('Catatan Kualitas')");assert.ok(!(await evaluate("document.querySelector('#navbar').textContent")).includes('Verifikasi / Unit'));
      await goto('/kualitas-data.html#kpi-jafung-dua-sumber');await ready('quality-table');const text=await evaluate('document.body.innerText');assert.ok(text.includes('59,60%')&&text.includes('58,08%')&&text.includes('PDF 147'));
    });
    await kpiStatusUiCases({t,call,evaluate,wait,goto,set,capture,pause});
    await t.test('IKU desktop/360px: 19 indikator, angka sumber, flags, filter dan keyboard',async()=>{
      for(const width of [1440,360]){
        await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
        await goto('/monitoring-iku.html');await ready('iku-panel');
        assert.equal(await evaluate("document.querySelectorAll('#iku-table tr[data-kode]').length"),19);
        assert.equal(await evaluate("document.querySelectorAll('#iku-table .iku-quality').length"),4);
        assert.equal(await evaluate("document.querySelectorAll('#iku-summary .kpi-card').length"),4);
        assert.ok((await evaluate("document.querySelector('[data-kode=\"IKU 3\"]').textContent")).includes('0,905'));
        assert.ok((await evaluate("document.querySelector('[data-kode=\"IKU 1 b.\"]').textContent")).includes('195,6%'));
        assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
        await evaluate("document.querySelector('#iku-table').focus()");assert.equal(await evaluate('document.activeElement.id'),'iku-table');
        assert.equal(await evaluate("getComputedStyle(document.querySelector('#iku-table .iku-label')).whiteSpace"),'normal');
        await evaluate('window.scrollTo(0,0)');await capture('pimpinan-iku-'+width);
        await set('periode','T1');await wait("document.querySelector('#iku-panel').dataset.state==='empty'");
        assert.equal(await evaluate("document.querySelectorAll('#iku-table tr[data-kode]').length"),0);
        await set('periode','T2');await ready('iku-panel');
        await set('tahun','2000');await wait("document.querySelector('#iku-panel').dataset.state==='empty'");
        await set('tahun','2026');await ready('iku-panel');
      }
      await evaluate("window.ikuFetch=window.fetch;window.fetch=(url,...args)=>String(url).includes('/api/dashboard/iku')?Promise.reject(new Error('Jaringan uji terputus')):window.ikuFetch(url,...args);document.querySelector('#iku-reload').click()");
      await wait("document.querySelector('#iku-panel').dataset.state==='error'");assert.equal(await evaluate("document.querySelectorAll('#iku-table tr[data-kode]').length"),0);
      await evaluate("window.fetch=window.ikuFetch;document.querySelector('#iku-reload').click()");await ready('iku-panel');
      await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    });
    await t.test('Tendik wajib login, dosen agregat publik, tabel dan grafik 360px',async()=>{
      for(const path of ['/statistik-tendik.html','/api/dashboard/tendik','/kualitas-data.html'])assert.equal((await fetch(base+path,{redirect:'manual'})).status,401);
      const publicStaff=await fetch(base+'/api/dashboard/pegawai');assert.equal(publicStaff.status,200);assert.deepEqual((await publicStaff.json()).data.map(x=>x.kategori).sort(),['dosen_tetap','dosen_tidak_tetap']);
      await goto('/statistik-tendik.html');await ready('tendik-table');await ready('tendik-chart');
      assert.equal(await evaluate("document.querySelectorAll('#tendik-table tbody tr').length"),19);
      assert.deepEqual((await chart('tendik-chart')).datasets.map(d=>d.data.reduce((n,v)=>n+(v??0),0)),[21,9]);
      assert.ok((await evaluate('document.body.innerText')).includes('Tabel 1.5'));assert.equal(await evaluate("document.querySelectorAll('#tendik-table .download-excel').length"),1);
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('tendik-mobile');
    });
    await t.test('Lulusan institusi, tracer sementara, NULL tidak menjadi nol',async()=>{
      await goto('/lulusan.html');await ready('tracer-summary');await ready('tracer-table');const text=await evaluate('document.body.innerText');assert.deepEqual(await evaluate("[...document.querySelectorAll('#tracer-summary .kpi-card')].slice(0,2).map(e=>[e.querySelector('.kpi-label').textContent,e.querySelector('.kpi-value').textContent])"),[['Responden','328'],['Lulusan','1.100']]);assert.ok(text.includes('Wirausaha dari rincian terisi: 2'));assert.ok(text.includes('belum ada data'));
      assert.equal(await evaluate("Array.from(document.querySelectorAll('#tracer-table td')).filter(e=>e.textContent==='belum ada data').length"),104);
      assert.equal(await evaluate("document.querySelector('#lulusan-prodi').dataset.state"),'empty');await capture('lulusan-desktop');
    });
    await t.test('Desktop dosen dan semua halaman mobile 360px, menu keyboard',async()=>{
      await goto('/statistik-dosen.html');await ready('gender-chart');assert.deepEqual((await chart('gender-chart')).datasets[0].data,[76,146]);await capture('dosen-desktop');
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});
      for(const [path,id]of [['/','dashboard-status'],['/statistik-mahasiswa.html','mahasiswa-chart'],['/mahasiswa-baru.html','pmb-chart'],['/statistik-dosen.html','gender-chart'],['/lulusan.html','tracer-summary'],['/kinerja-prodi.html','prodi-table'],['/monitoring-kpi.html','perspektif-A'],['/kualitas-data.html','quality-table']]){await goto(path);await ready(id);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,path+' tanpa overflow 360px');}
      await goto('/');await wait("document.querySelector('#dashboard-status')?.dataset.state==='ready'&&document.querySelectorAll('.data-panel[data-state=loading]').length===0");await capture('home-mobile');
      await evaluate("document.querySelector('.nav-toggle').click()");assert.equal(await evaluate("document.querySelector('.nav-toggle').getAttribute('aria-expanded')"),'true');assert.equal(await evaluate("document.querySelectorAll('#navbar a[href*=fakultas]').length"),0);
      await evaluate("document.querySelector('.nav-toggle').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");assert.equal(await evaluate("document.querySelector('.nav-toggle').getAttribute('aria-expanded')"),'false');
    });
    await t.test('B2: rasio publik, filter prodi, sumber, ekspor dan tampilan 360px',async()=>{
      await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
      await call('Network.clearBrowserCookies');await goto('/rasio-dosen-mahasiswa.html');await ready('ratio-summary');await ready('ratio-chart');await ready('ratio-table');
      const text=await evaluate("document.querySelector('#ratio-summary').textContent");assert.ok(text.includes('5.080')&&text.includes('222')&&text.includes('22,88'));
      assert.ok(text.includes('Tabel 1.3')&&text.includes('PDF 17'));
      assert.equal(await evaluate("(()=>{const root=document.querySelector('#ratio-summary'),s=getComputedStyle(root);return root.classList.contains('data-summary')&&s.backgroundColor==='rgb(255, 255, 255)'&&s.boxShadow!=='none'&&s.borderTopWidth==='0px'&&s.paddingTop==='24px';})()"),true,'Ringkasan rasio memakai kartu putih dengan padding 24px');
      assert.equal(await evaluate("getComputedStyle(document.querySelector('#ratio-summary .panel-meta')).borderTopWidth"),'0px');
      assert.equal(await evaluate("document.querySelector('#ratio-chart').classList.contains('data-panel')&&document.querySelector('#ratio-table').classList.contains('data-panel')"),true);
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#ratio-summary .kpi-label')).map(e=>e.textContent)"),['Mahasiswa Aktif','Dosen Tetap','Rasio Dosen:Mahasiswa']);
      assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#ratio-summary .kpi-value')).map(e=>e.textContent)"),['5.080','222','1 : 22,88']);
      assert.ok((await evaluate("document.querySelector('#ratio-summary .kpi-description').textContent")).includes('2025/2026'));
      assert.equal(await evaluate("(()=>{const cards=Array.from(document.querySelectorAll('#ratio-summary .kpi-card')).map(e=>e.getBoundingClientRect());return cards.length===3&&cards.every(c=>Math.abs(c.width-cards[0].width)<1&&c.top===cards[0].top)&&cards[1].left>cards[0].left;})()"),true);
      assert.equal(await evaluate("document.querySelector('#ratio-summary .panel-meta').getBoundingClientRect().top>=document.querySelector('#ratio-summary .kpi-cards').getBoundingClientRect().bottom"),true);
      assert.equal(await evaluate("Array.from(document.querySelectorAll('#ratio-summary .kpi-card')).some(e=>e.textContent.includes('Sumber:'))"),false);
      await capture('ratio-desktop');
      assert.equal(await evaluate("document.querySelectorAll('#ratio-table tbody tr').length"),19);
      const first=await evaluate("document.querySelector('[name=prodi_id] option[value]:not([value=\"\"])').value");await set('prodi_id',first);await ready('ratio-table');
      await wait("document.querySelectorAll('#ratio-table tbody tr').length===1");assert.ok((await evaluate('location.search')).includes('prodi_id='+first));
      assert.equal(await evaluate("document.querySelector('#ratio-table .download-excel').disabled"),false);
      assert.equal(await evaluate("document.querySelector('#ratio-chart .download-excel').disabled"),false);
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('ratio-mobile');
      assert.equal(await evaluate("(()=>{const cards=Array.from(document.querySelectorAll('#ratio-summary .kpi-card')).map(e=>e.getBoundingClientRect());return cards.every(c=>c.left===cards[0].left)&&cards[1].top>=cards[0].bottom&&cards[2].top>=cards[1].bottom;})()"),true);
      assert.deepEqual(await evaluate("import('/assets/js/ui.js').then(m=>{const root=document.createElement('div');m.renderKpiCards(root,[{label:'Vide',value:null},{label:'Nol',value:0},{label:'Rasio',value:23.25,prefix:'1 : '}]);return Array.from(root.querySelectorAll('.kpi-value')).map(e=>e.textContent);})"),['-','0','1 : 23,25']);
      assert.equal(await evaluate("document.querySelectorAll('#navbar a[data-destination=\"rasio-dosen-mahasiswa.html\"]').length"),1);
    });
    await t.test('B3: akreditasi publik, 19 butir, rekap, empty state dan 360px',async()=>{
      await call('Network.clearBrowserCookies');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await goto('/akreditasi.html');await ready('accreditation-detail');await ready('accreditation-chart');await ready('accreditation-recap');
      assert.equal(await evaluate("document.querySelector('#accreditation-institution').dataset.state"),'ready');assert.equal(await evaluate("document.querySelector('#accreditation-international').dataset.state"),'empty');
      assert.equal(await evaluate("document.querySelectorAll('#accreditation-detail tbody tr').length"),19);assert.equal((await chart('accreditation-chart')).datasets[0].data.reduce((n,x)=>n+x,0),19);
      assert.ok((await evaluate("document.querySelector('#accreditation-unmapped').textContent")).includes('2 butir belum terpetakan'));
      assert.equal(await evaluate("document.querySelector('#accreditation-consistency').dataset.consistent"),'true');
      assert.equal(await evaluate("document.querySelectorAll('#accreditation-unmapped tbody tr').length"),2);
      assert.equal(await evaluate("document.querySelectorAll('#accreditation-detail tbody tr').length"),19);
      assert.ok((await evaluate("document.querySelector('#accreditation-recap tbody tr:last-child').textContent")).includes('19 (100%)'));
      assert.equal(await evaluate("document.querySelectorAll('#accreditation-detail a').length"),0);
      assert.ok((await evaluate("document.querySelector('#accreditation-institution').textContent")).includes('Menunggu input PJM'));
      await capture('pimpinan-s2-accreditation-desktop');
      assert.equal(await evaluate("document.querySelector('#accreditation-detail .download-excel').disabled"),false);
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('accreditation-mobile');
      await writeFile('.runtime/phase3/pimpinan-s2-accreditation-360.png',Buffer.from((await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
      await evaluate("document.querySelector('#accreditation-detail .table-scroll').focus()");
      assert.equal(await evaluate("document.activeElement.classList.contains('table-scroll')"),true);
      assert.ok(await evaluate("Array.from(document.querySelectorAll('#accreditation-detail .table-scroll')).every(e=>e.tabIndex===0)"));
      await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
      assert.equal(await evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),true);
      await call('Emulation.setEmulatedMedia',{features:[]});
      await set('jenjang','D3');await wait("document.querySelectorAll('#accreditation-detail tbody tr').length===2");assert.ok((await evaluate('location.search')).includes('jenjang=D3'));
      await evaluate("window.savedFetch=window.fetch;window.fetch=()=>Promise.reject(new TypeError('Network'));document.querySelector('.filters').requestSubmit()");await wait("document.querySelector('#accreditation-summary').dataset.state==='error'");
      await evaluate("window.fetch=window.savedFetch;document.querySelector('.filters').requestSubmit()");await ready('accreditation-summary');
      await evaluate("window.fetch=async (...args)=>{const r=await window.savedFetch(...args);if(!String(args[0]).includes('/dashboard/akreditasi'))return r;const b=await r.clone().json();b.meta.total_master++;return new Response(JSON.stringify(b),{status:200,headers:{'Content-Type':'application/json'}});};document.querySelector('.filters').requestSubmit()");
      await wait("document.querySelector('#accreditation-consistency')?.dataset.consistent==='false'");assert.equal(await evaluate("document.querySelector('#accreditation-consistency').getAttribute('role')"),'alert');
      await evaluate("window.fetch=async (...args)=>{const r=await window.savedFetch(...args);if(!String(args[0]).includes('/dashboard/akreditasi'))return r;const b=await r.clone().json();b.data=[];b.meta.institusi=[];b.meta.rekap=[];b.meta.prodi=b.meta.prodi.map(p=>({prodi_id:p.prodi_id,prodi_nama:p.prodi_nama,jenjang:p.jenjang,peringkat:null}));return new Response(JSON.stringify(b),{status:200,headers:{'Content-Type':'application/json'}});};document.querySelector('.filters').requestSubmit()");await wait("document.querySelector('#accreditation-chart').dataset.state==='empty'");
      assert.ok((await evaluate("document.querySelector('#accreditation-detail').textContent")).includes('-'));
      await evaluate("window.fetch=window.savedFetch;document.querySelector('.filters').requestSubmit()");await ready('accreditation-chart');
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.accreditation-hero > p')).color"),'rgb(255, 255, 255)');
    });
    for(const [name,count] of [['penelitian',5],['hki',4],['pkm',2]])await t.test('B4: '+name+' publik, sumber, NULL dana, filter tahun, empty dan 360px',async()=>{
      await call('Network.clearBrowserCookies');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await goto('/'+name+'.html');await ready('research-chart');await ready('research-table');
      assert.equal(await evaluate("document.querySelectorAll('#research-table tbody tr').length"),count);assert.ok((await evaluate("document.querySelector('#research-table .panel-meta').textContent")).includes('Tabel 4.'));
      if(name!=='hki')assert.equal(await evaluate("Array.from(document.querySelectorAll('#research-table tbody tr')).every(r=>r.lastElementChild.textContent==='belum ada data')"),true);
      await set('tahun','2026');await ready('research-table');assert.ok((await evaluate('location.search')).includes('tahun=2026'));
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture(name+'-mobile');
      assert.equal(await evaluate("document.querySelector('#research-table .download-excel').disabled"),false);
      const second=await evaluate("Array.from(document.querySelector('[name=periode_laporan_id]').options).find(x=>x.textContent.includes('Semester II'))?.value");assert.ok(second);await set('periode_laporan_id',second);await wait("document.querySelector('#research-table').dataset.state==='empty'");assert.equal(await evaluate("document.querySelectorAll('#research-chart canvas').length"),0);
    });
    await t.test('B5: prestasi publik, 19 prodi termasuk NULL, sumber 1.8, filter dan 360px',async()=>{
      await call('Network.clearBrowserCookies');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await goto('/prestasi-mahasiswa.html');await ready('achievement-chart');await ready('achievement-table');
      assert.equal(await evaluate("document.querySelectorAll('#achievement-table tbody tr').length"),19);assert.ok((await evaluate("document.querySelector('#achievement-table .panel-meta').textContent")).includes('Tabel 1.8'));
      assert.deepEqual((await chart('achievement-chart')).datasets[0].data,[105,8,9]);assert.equal(await evaluate("Array.from(document.querySelectorAll('#achievement-table tbody tr')).every(r=>r.lastElementChild.textContent==='belum ada data')"),true);
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('prestasi-mobile');
      const prodi=await evaluate("document.querySelector('[name=prodi_id]').options[6].value");await set('prodi_id',prodi);await wait("document.querySelectorAll('#achievement-table tbody tr').length===1");assert.ok((await evaluate('location.search')).includes('prodi_id='));
      const second=await evaluate("Array.from(document.querySelector('[name=periode_laporan_id]').options).find(x=>x.textContent.includes('Semester II'))?.value");await set('periode_laporan_id',second);await wait("document.querySelector('#achievement-table').dataset.state==='empty'");assert.equal(await evaluate("document.querySelectorAll('#achievement-chart canvas').length"),0);
    });
    await t.test('C1: kerja sama publik, sumber terpisah, status, nama institusi, 360px dan kosong',async()=>{
      await call('Network.clearBrowserCookies');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await goto('/kerja-sama.html');await ready('cooperation-table');await ready('cooperation-kelembagaan');assert.equal(await evaluate("document.querySelectorAll('#cooperation-table tbody tr').length"),4);
      assert.deepEqual((await chart('cooperation-kelembagaan')).datasets[0].data,[6,14,5,3,1]);assert.deepEqual((await chart('cooperation-horizontal')).datasets[0].data,[4,7,null,null,1]);assert.ok((await evaluate('document.body.textContent')).includes('AseanSpace; ICBC; HR&CDI'));assert.ok((await evaluate('document.body.textContent')).includes('hanya dari sel terisi'));assert.ok(!(await evaluate('document.body.textContent')).includes('Rp'));
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('cooperation-mobile');assert.equal(await evaluate("document.querySelector('#cooperation-table .download-excel').disabled"),false);
      const second=await evaluate("Array.from(document.querySelector('[name=periode_laporan_id]').options).find(x=>x.textContent.includes('Semester II'))?.value");await set('periode_laporan_id',second);await wait("document.querySelector('#cooperation-table').dataset.state==='empty'");assert.equal(await evaluate("document.querySelectorAll('#page-content canvas').length"),0);
    });
    await t.test('C2: tiga grafik terpisah, SKS desimal, sumber, 360px dan empty',async()=>{
      await call('Network.clearBrowserCookies');await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await goto('/produktivitas-dosen.html');await ready('productivity-table');await ready('productivity-beban-mengajar');assert.equal(await evaluate("document.querySelectorAll('#productivity-table tbody tr').length"),3);assert.deepEqual((await chart('productivity-beban-mengajar')).datasets[0].data.map(Number),[12,12.83]);assert.ok((await evaluate("document.querySelector('#productivity-table').textContent")).includes('12,83'));assert.ok((await evaluate("document.querySelector('#productivity-table .panel-meta').textContent")).includes('Tabel 2.8'));
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:800,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('productivity-mobile');assert.equal(await evaluate("document.querySelector('#productivity-table .download-excel').disabled"),false);
      const second=await evaluate("Array.from(document.querySelector('[name=periode_laporan_id]').options).find(x=>x.textContent.includes('Semester II'))?.value");await set('periode_laporan_id',second);await wait("document.querySelector('#productivity-table').dataset.state==='empty'");assert.equal(await evaluate("document.querySelectorAll('#page-content canvas').length"),0);
    });
    await t.test('Wajib ganti password, safe next dan menu BSDM/internal',async()=>{
      await call('Network.clearBrowserCookies');await goto('/login.html?next='+encodeURIComponent('/ruang-unit.html'));await login(users[1],password);
      await wait("location.pathname==='/ganti-password.html' && document.readyState==='complete' && !!document.querySelector('[name=new_password]')");
      await evaluate(`document.querySelector('[name=old_password]').value=${JSON.stringify(password)};document.querySelector('[name=new_password]').value=${JSON.stringify(newPassword)};document.querySelector('[name=confirm_password]').value='beda';document.querySelector('#auth-form').requestSubmit()`);
      // HTML minLength menolak nilai terlalu pendek; gunakan panjang cukup untuk memeriksa mismatch JS.
      await evaluate(`document.querySelector('[name=confirm_password]').value='pengulangan-berbeda';document.querySelector('#auth-form').requestSubmit()`);await wait("document.querySelector('#auth-message').textContent.includes('tidak sama')");
      await evaluate(`document.querySelector('[name=confirm_password]').value=${JSON.stringify(newPassword)};document.querySelector('#auth-form').requestSubmit()`);
      await wait("location.pathname==='/ruang-unit.html' && document.querySelector('#pegawai-internal')?.dataset.state==='ready'");const text=await evaluate('document.body.innerText');assert.ok(text.includes('109')&&text.includes('68'));await wait("document.querySelector('#navbar').textContent.includes('Input Data BSDM')");
      assert.equal(await evaluate("document.querySelectorAll('#navbar .nav-lock').length"),0);
      await evaluate("document.querySelector('.nav-toggle').click();document.querySelector('[aria-controls=account-menu]').click()");assert.equal(await evaluate("document.querySelector('[aria-controls=account-menu]').getAttribute('aria-expanded')"),'true');assert.equal(await evaluate("document.querySelector('#account-menu a').dataset.destination"),'input/bsdm.html');await capture('navbar-account-mobile');
      await evaluate("document.querySelector('.nav-logout').click()");await wait("location.pathname==='/index.html'");
      const safe=await evaluate("import('/assets/js/api.js').then(m=>['//evil.com','https://evil.com','https://'+location.host+'/statistik-mahasiswa.html','statistik-mahasiswa.html','/\\\\evil.com','/index.html','/statistik-mahasiswa.html'].map(v=>m.safeNext(v)))");assert.deepEqual(safe,['/index.html','/index.html','/index.html','/index.html','/index.html','/index.html','/statistik-mahasiswa.html']);
    });
    await bulkVerificationUiCases(t,{owner,base,users,password,call,evaluate,wait,goto,login,set,capture});
    await t.test('Fase 4: BAA tempel, autosave, submit, PRP approve dan dashboard berubah',async()=>{
      const academic=(await owner.query("INSERT INTO periode_akademik(kode,tahun_ajaran,semester,urutan) SELECT $1,'2098/2099','Genap',max(urutan)+1 FROM periode_akademik RETURNING id",['ui-'+run])).rows[0].id;
      const report=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,coalesce(max(tahun) FILTER(WHERE tahun>=2099),2098)+1,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id",['ui-'+run])).rows[0].id;
      const c=await owner.connect();try{await c.query('BEGIN');await c.query("SELECT set_config('app.user_id',(SELECT id::text FROM users WHERE is_system AND nama='seed' LIMIT 1),true)");
        await c.query("INSERT INTO mahasiswa_aktif(periode_laporan_id,periode_akademik_id,unit_id,prodi_id,total,perempuan,status_mhs,status,is_current_approved,approved_by,approved_at,created_by,sumber_id,sumber) SELECT $1,$2,unit_id,prodi_id,total,perempuan,status_mhs,'approved',true,approved_by,now(),created_by,sumber_id,sumber FROM v_dashboard_mahasiswa WHERE periode_akademik_kode='20252'",[report,academic]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
      try{
        await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await call('Network.clearBrowserCookies');await goto('/login.html?next=%2F%2Fevil.com');await login(users[2],password);await goto('/input/baa.html');
        await wait("location.pathname==='/input/baa.html'&&document.querySelectorAll('#entry-table tbody tr').length===19");
        await set('report',String(report));await pause(250);await set('academic',String(academic));await pause(300);await wait("document.querySelector('#entry-table input')?.value==='418'");
        const firstId=(await owner.query('SELECT id FROM mahasiswa_aktif WHERE periode_laporan_id=$1 ORDER BY prodi_id LIMIT 1',[report])).rows[0].id;
        await evaluate("(()=>{const d=new DataTransfer();d.setData('text/plain','1.234\tBUKAN ANGKA');document.querySelector('#entry-table input').dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));})()");
        assert.equal(await evaluate("document.querySelectorAll('#entry-table input[aria-invalid=true]').length"),1);await pause(1100);assert.equal((await owner.query('SELECT count(*)::int AS n FROM mahasiswa_aktif WHERE periode_laporan_id=$1 AND status=$2',[report,'draft'])).rows[0].n,0);
        await evaluate("(()=>{const d=new DataTransfer();d.setData('text/plain',' 1.234 \t');document.querySelector('#entry-table input').dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));})()");
        await wait("document.querySelector('#save-status').dataset.state==='saved'");
        let draft=(await owner.query("SELECT * FROM mahasiswa_aktif WHERE periode_laporan_id=$1 AND status='draft'",[report])).rows[0];assert.equal(draft.total,1234);assert.equal(draft.perempuan,null);assert.equal(draft.previous_approved_id,firstId);
        assert.equal((await owner.query('SELECT sum(total)::int AS n FROM v_dashboard_mahasiswa WHERE periode_laporan_id=$1',[report])).rows[0].n,5080);
        assert.equal(await evaluate("fetch('/input/bsdm.html').then(r=>r.status)"),403);
        await capture('input-baa-desktop');await evaluate("document.querySelector('#submit-data').click()");await wait("document.querySelector('#entry-table input')?.disabled");
        draft=(await owner.query("SELECT * FROM mahasiswa_aktif WHERE periode_laporan_id=$1 AND status='submitted'",[report])).rows[0];assert.ok(draft);
        const own=await evaluate(`import('/assets/js/api.js').then(m=>m.request('/verification/mahasiswa-aktif/${draft.id}/approve',{method:'POST',body:{row_version:${draft.row_version},review_note:'Self approval'}}).then(()=>200).catch(e=>e.status))`);assert.equal(own,403);
        await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('input-baa-mobile');
        await call('Network.clearBrowserCookies');await goto('/login.html?next=%2Fverifikasi.html');await login(users[3],password);await goto('/verifikasi.html');await wait("document.querySelector('#review-queue')?.dataset.state==='ready'");
        await evaluate(`Array.from(document.querySelectorAll('#review-queue button')).find(b=>b.textContent==='Periksa #${draft.id}').click()`);await ready('review-detail');assert.ok((await evaluate("document.querySelector('#review-detail').textContent")).includes('1.234'));
        await evaluate("document.querySelector('#review-note').value='Diperiksa PRP melalui uji Edge';document.querySelector('#approve-data').click()");await wait("document.querySelector('#review-detail')?.dataset.state==='empty'");
        await goto('/');await ready('dashboard-status');assert.equal(await evaluate("document.querySelector('[data-card=mahasiswa] .home-card-value').textContent"),'5.896');
        assert.equal((await owner.query('SELECT sum(total)::int AS n FROM v_dashboard_mahasiswa WHERE periode_laporan_id=$1',[report])).rows[0].n,5896);
        await goto('/statistik-mahasiswa.html');await ready('mahasiswa-chart');await set('periode_akademik_id',String(academic));await set('periode_laporan_id',String(report));await ready('mahasiswa-summary');await ready('mahasiswa-gender');await ready('mahasiswa-jenjang');
        assert.ok((await evaluate("document.querySelector('#mahasiswa-summary').textContent")).includes('5.896'));
        assert.deepEqual((await chart('mahasiswa-gender')).datasets[0].data,[1455,null]);
        assert.equal((await chart('mahasiswa-jenjang')).datasets[0].data.reduce((a,b)=>a+b,0),5896);
        assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);

      }finally{await owner.query('DELETE FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM periode_laporan WHERE id=$1 AND kode=$2',[report,'ui-'+run]);await owner.query('DELETE FROM periode_akademik WHERE id=$1 AND kode=$2',[academic,'ui-'+run]);}
    });
    await t.test('Fase 4: seluruh tab unit dan admin desktop/mobile',async()=>{
      for(const [index,role,pw]of [[2,'baa',password],[1,'bsdm',newPassword],[5,'ppa',password],[6,'bpka',password],[3,'prp',password]]){
        await call('Network.clearBrowserCookies');await goto('/login.html?next='+encodeURIComponent('/input/'+role+'.html'));await login(users[index],pw);await goto('/input/'+role+'.html');await wait("!!document.querySelector('#entry-table')");
        const tabs=await evaluate("Array.from(document.querySelectorAll('.input-tabs button')).map(b=>b.dataset.domain)");
        for(const tab of tabs){await evaluate(`document.querySelector('[data-domain="${tab}"]').click()`);await pause(250);await wait("!!document.querySelector('#entry-table')");assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true,role+'/'+tab);assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"),['mahasiswa-aktif','formasi',...simpleCases.map(([name])=>name)].includes(tab)?1:0);}
      }
      await call('Network.clearBrowserCookies');await goto('/login.html?next=%2Fadmin%2Fusers.html');await login(users[4],password);await goto('/admin/users.html');await ready('users-table');
      assert.equal(await evaluate("document.querySelector('[name=role] option[value=bkm]').textContent"),'BKK');assert.equal(await evaluate("document.querySelector('a[data-destination=\"input/bkm.html\"]').textContent"),'Input Data BKK');
      const email='admin-created-'+run+'@test.invalid';await evaluate(`document.querySelector('[name=nama]').value='UI created';document.querySelector('[name=email]').value=${JSON.stringify(email)};document.querySelector('[name=password]').value=${JSON.stringify(newPassword)};document.querySelector('.user-form').requestSubmit()`);
      await wait("document.querySelector('#admin-message').textContent==='Pengguna tersimpan.'");const added=(await owner.query('SELECT id,email,must_change_password FROM users WHERE email=$1',[email])).rows[0];users.push(added);assert.equal(added.must_change_password,true);
      await goto('/admin/formulir.html');await ready('form-policy');
      try{await evaluate("document.querySelector('[aria-label=\"Perlu verifikasi mahasiswa-aktif\"]').click()");await wait("document.querySelector('.auth-message').textContent.includes('Pengaturan tersimpan')");assert.equal((await owner.query("SELECT perlu_verifikasi FROM definisi_formulir WHERE domain='mahasiswa-aktif'")).rows[0].perlu_verifikasi,false);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);}
      finally{await evaluate("import('/assets/js/api.js').then(m=>m.request('/admin/formulir/mahasiswa-aktif',{method:'PATCH',body:{perlu_verifikasi:true}}))");}
      await goto('/admin/users.html');await ready('users-table');
      await capture('admin-users-mobile');await goto('/admin/audit.html');await ready('audit-table');assert.ok(!(await evaluate('document.body.textContent')).includes('password_hash'));assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
    });
    await t.test('B3: formulir PJM bersama, kolom teks/tanggal dan mobile',async()=>{
      await goto('/input/pjm.html');await wait("document.querySelectorAll('#entry-table tbody tr').length===23");
      assert.equal(await evaluate("document.querySelector('[name=academic]').parentElement.hidden"),true);
      assert.equal(await evaluate("document.querySelectorAll('#entry-table input[type=date]').length"),46);
      assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"),0);
      assert.ok((await evaluate("document.querySelector('#entry-table').textContent")).includes('S1 Geografi (belum terpetakan)'));
      await set('accreditation_scope','internasional');await wait("document.querySelectorAll('#entry-table tbody tr').length===20");
      assert.ok((await evaluate("document.querySelector('#entry-table').textContent")).includes('Internasional - 01'));
      assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('input-pjm-mobile');
    });
    await t.test('B4: tiga tab formulir LPPM bersama dan mobile',async()=>{
      await goto('/input/lppm.html');await wait("document.querySelectorAll('#entry-table tbody tr').length===5");
      for(const [name,count] of [['penelitian',5],['hki',4],['pkm',2]]){
        await evaluate(`document.querySelector('[data-domain="${name}"]').click()`);await wait(`document.querySelectorAll('#entry-table tbody tr').length===${count}`);
        assert.equal(await evaluate("document.querySelector('[name=academic]').parentElement.hidden"),true);assert.equal(await evaluate("document.querySelector('[name=year]').value"),'2026');assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
      }
      assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"),0);await capture('input-lppm-mobile');
    });
    await t.test('B5: formulir BKK 19 prodi, tahun, NULL dan mobile',async()=>{
      await goto('/input/bkm.html');await wait("document.querySelectorAll('#entry-table tbody tr').length===19");assert.equal(await evaluate("document.querySelector('h1').textContent"),'Input Data BKK');assert.match(await evaluate('document.title'),/^Input Data BKK/);assert.equal(await evaluate("document.querySelector('[name=academic]').parentElement.hidden"),true);assert.equal(await evaluate("document.querySelector('[name=year]').value"),'2026');assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"),1);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('input-bkm-mobile');
    });
    await t.test('C1: form kerja sama bersama, empat baris, angka/teks institusi, 360px',async()=>{
      await goto('/input/kerjasama.html');await wait("document.querySelectorAll('#entry-table tbody tr').length===4");assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"),1);assert.ok((await evaluate("document.querySelector('#form-total')?.textContent || document.body.textContent")).includes('tidak dijumlahkan'));assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('input-cooperation-mobile');
    });
    await t.test('C2: tab BSDM produktivitas, tahun/angka dan tiga baris mobile',async()=>{
      await goto('/input/bsdm.html');await wait("!!document.querySelector('[data-domain=produktivitas-dosen]')");await evaluate("document.querySelector('[data-domain=produktivitas-dosen]').click()");await wait("document.querySelectorAll('#entry-table tbody tr').length===3");assert.equal(await evaluate("document.querySelector('[name=academic]').parentElement.hidden"),true);assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"),1);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('input-productivity-mobile');
    });
    await t.test('C3: halaman/API AMI wajib login, label evaluasi diri, sumber dan 360px',async()=>{
      for(const path of ['/ami.html','/api/dashboard/ami'])assert.equal((await fetch(base+path,{redirect:'manual'})).status,401);
      await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await goto('/ami.html');await ready('ami-readiness');await ready('ami-gaps');await ready('ami-chart');
      assert.equal(await evaluate("document.querySelectorAll('#ami-readiness tbody tr').length"),28);assert.equal(await evaluate("document.querySelectorAll('#ami-rekap tbody tr').length"),4);assert.deepEqual((await chart('ami-chart')).datasets[0].data,[1,7,5,6]);
      const text=await evaluate('document.body.textContent');assert.match(text,/bukan audit formal/);assert.ok(text.includes('52,13')&&text.includes('72,23'));assert.ok(text.includes('1.357')&&text.includes('1.050'));assert.match(text,/PDF 128\/cetak 120/);assert.match(text,/PDF 135\/cetak 127/);assert.ok(text.includes('S1 Geografi'));
      assert.equal(await evaluate("Array.from(document.querySelectorAll('#ami-readiness tbody tr')).slice(19).every(r=>r.lastChild.textContent==='belum ada data')"),true);
      assert.ok(await evaluate("!!document.querySelector('#ami-gaps .data-tools button')"));await capture('ami-desktop');
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('ami-mobile');await set('tahun','2026');await ready('ami-readiness');assert.ok((await evaluate('location.search')).includes('tahun=2026'));const second=await evaluate("Array.from(document.querySelector('[name=periode_laporan_id]').options).find(x=>x.textContent.includes('Semester II'))?.value");await set('periode_laporan_id',second);await wait("document.querySelector('#ami-readiness')?.dataset.state==='empty'");assert.equal(await evaluate("document.querySelectorAll('#page-content canvas').length"),0);
    });
    await t.test('C3: tab PJM AMI 32 butir, tanpa template, nama sumber dan 360px',async()=>{
      await goto('/input/pjm.html');await wait("!!document.querySelector('[data-domain=ami]')");await evaluate("document.querySelector('[data-domain=ami]').click()");await wait("document.querySelectorAll('#entry-table tbody tr').length===32");assert.match(await evaluate('document.body.textContent'),/bukan audit formal/);assert.equal(await evaluate("document.querySelector('[name=academic]').parentElement.hidden"),true);assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"),0);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);await capture('input-ami-mobile');
    });
    await t.test('C3: approval dan revisi PRP mengubah tabel/grafik AMI di browser',async()=>{
      const report=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,coalesce(max(tahun) FILTER(WHERE tahun>=2099),2098)+1,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id",['ami-ui-'+run])).rows[0].id;
      const request=async(path,method,body)=>(await evaluate(`import('/assets/js/api.js').then(m=>m.request(${JSON.stringify(path)},{method:${JSON.stringify(method)},body:${JSON.stringify(body)}}))`)).data;
      let cookie='',csrf;
      const reviewer=async(path,method='GET',body)=>{const response=await fetch(base+'/api'+path,{method,headers:{cookie,...(method==='GET'?{}:{'content-type':'application/json','x-csrf-token':csrf})},...(body?{body:JSON.stringify(body)}:{})});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const json=await response.json();assert.equal(response.status,200,JSON.stringify(json));return json.data;};
      try{
        csrf=(await reviewer('/auth/csrf')).csrf;csrf=(await reviewer('/auth/login','POST',{email:users[3].email,password})).csrf;
        let row=await request('/data/ami','POST',{periode_laporan_id:report,tahun:2099,kategori:'entitas-01',skor_standar:400,realisasi:100,capaian_laporan:25,jumlah_standar:67,kesenjangan:20,persen_kesenjangan:29.85});row=await request(`/data/ami/${row.id}/submit`,'POST',{row_version:row.row_version});row=await reviewer(`/verification/ami/${row.id}/approve`,'POST',{row_version:row.row_version,review_note:'Uji UI PRP'});
        const path='/ami.html?periode_laporan_id='+report+'&tahun=2099';await goto(path);await ready('ami-readiness');assert.equal(await evaluate("document.querySelector('#ami-readiness tbody tr').children[2].textContent"),'100');assert.deepEqual((await chart('ami-chart')).datasets[0].data,[0,0,0,1]);
        let rev=await request(`/data/ami/${row.id}/revision`,'POST',{row_version:row.row_version});rev=await request(`/data/ami/${rev.id}`,'PATCH',{row_version:rev.row_version,realisasi:360,capaian_laporan:90});rev=await request(`/data/ami/${rev.id}/submit`,'POST',{row_version:rev.row_version});await goto(path);await ready('ami-readiness');assert.equal(await evaluate("document.querySelector('#ami-readiness tbody tr').children[2].textContent"),'100');await reviewer(`/verification/ami/${rev.id}/approve`,'POST',{row_version:rev.row_version,review_note:'Revisi diperiksa UI PRP'});await goto(path);await ready('ami-readiness');assert.equal(await evaluate("document.querySelector('#ami-readiness tbody tr').children[2].textContent"),'360');assert.deepEqual((await chart('ami-chart')).datasets[0].data,[1,0,0,0]);assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),true);
      }finally{await owner.query('DELETE FROM ami_revisi WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM periode_laporan WHERE id=$1 AND kode=$2',[report,'ami-ui-'+run]);}
    });
    await t.test('D1: keuangan login, sumber/satuan, penurunan, empty dan 360px',async()=>{
      for(const path of ['/keuangan.html','/api/dashboard/keuangan'])assert.equal((await fetch(base+path,{redirect:'manual'})).status,401);
      await goto('/keuangan.html');for(const id of ['rasio','pendapatan','biaya','laporan'])await ready('finance-'+id);
      assert.deepEqual(await evaluate("['rasio','pendapatan','biaya','laporan'].map(id=>document.querySelectorAll('#finance-'+id+' tbody tr').length)"),[5,2,4,6]);
      const text=await evaluate('document.body.innerText');assert.ok(text.includes('-5.310.639.000'));assert.ok(text.includes('-45.994.239.000'));assert.ok(text.includes('59.395.010.115'));assert.ok(text.includes('PDF 144/cetak 136'));assert.ok(text.includes('kode tidak disebutkan'));
      await ready('finance-chart-likuiditas');assert.deepEqual((await chart('finance-chart-likuiditas')).datasets[0].data.map(Number),[7.25,15.59]);assert.equal(await evaluate("document.querySelectorAll('#finance-pendapatan .download-excel').length"),1);
      await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('finance-mobile');
      const next=await evaluate("document.querySelector('[name=periode_laporan_id]').options[1].value");await set('periode_laporan_id',next);await wait("document.querySelector('#finance-pendapatan')?.dataset.state==='empty' && document.querySelectorAll('canvas').length===0");
    });
    await t.test('D1: form BKU bersama, 17 baris dan mobile tanpa mutasi',async()=>{
      await goto('/input/bku.html');await wait("document.querySelectorAll('#entry-table tbody tr').length===17");
      assert.ok((await evaluate('document.body.innerText')).includes('Rp/mahasiswa'));assert.ok((await evaluate('document.body.innerText')).includes('tidak dijumlahkan'));
      assert.equal(await evaluate("Array.from(document.querySelectorAll('[data-field=perubahan]')).some(x=>Number(x.value)===-5310639000)"),true);
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('finance-input-mobile');
    });
    await t.test('D3: pegawai/formasi wajib login, sumber, agregat, export dan 360px',async()=>{
      for(const path of ['/pegawai-formasi.html','/pegawai-%66ormasi.html','/api/dashboard/formasi','/api/dashboard/pegawai-pergerakan','/api/dashboard/pegawai-formasi'])assert.equal((await fetch(base+path,{redirect:'manual'})).status,401);
      await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await goto('/pegawai-formasi.html');await ready('employment-summary');await ready('employment-formation-table');await ready('employment-movement-table');
      assert.equal(await evaluate("document.querySelectorAll('#employment-summary tbody tr').length"),4);assert.ok((await evaluate("document.querySelector('#employment-summary').textContent")).includes('109'));
      const sourceText=await evaluate("document.querySelector('#employment-summary .panel-meta').textContent");assert.ok(sourceText.includes('Genap 2025/2026'));assert.ok(!sourceText.includes('20252'));assert.equal((sourceText.match(/Tabel 2\.7/g)??[]).length,1);const formationSource=await evaluate("document.querySelector('#employment-formation-table .panel-meta').textContent");assert.equal((formationSource.match(/Tabel 2\.9/g)??[]).length,1);
      assert.equal(await evaluate("document.querySelectorAll('#employment-formation-table tbody tr').length"),50);assert.deepEqual((await chart('employment-movement-chart')).datasets[0].data,[5,4,2,5]);
      await wait("!!document.querySelector('#employment-quality')");assert.equal(await evaluate("document.querySelector('#employment-quality').open"),false);
      assert.equal(await evaluate("document.querySelectorAll('#employment-quality li').length"),4);assert.equal(await evaluate("document.querySelectorAll('#employment-quality .employment-source').length"),8);
      const shortages=await chart('employment-formation-chart');assert.equal(shortages.labels.length,10);assert.equal(shortages.datasets[0].data.length,10);assert.ok(shortages.datasets[0].data.every(x=>x>0));assert.deepEqual(shortages.datasets[0].data,[...shortages.datasets[0].data].sort((a,b)=>b-a));assert.equal(await evaluate("Chart.getChart(document.querySelector('#employment-formation-chart canvas')).options.indexAxis"),'y');
      await evaluate("document.querySelector('#employment-quality summary').focus()");await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait("document.querySelector('#employment-quality').open");
      await evaluate("document.querySelector('#employment-quality').open=false;document.querySelector('#employment-formation-table .employment-flag').click()");await wait("document.querySelector('#employment-quality').open");
      await evaluate("document.querySelector('#employment-formation-table thead th:nth-child(4) button').click();document.querySelector('#employment-formation-table thead th:nth-child(4) button').click()");assert.equal(await evaluate("document.querySelector('#employment-formation-table thead th:nth-child(4)').getAttribute('aria-sort')"),'descending');
      await set('jenis_unit','akademik');await ready('employment-formation-table');assert.equal(await evaluate("document.querySelectorAll('#employment-formation-table tbody tr').length"),6);assert.ok((await evaluate('location.search')).includes('jenis_unit=akademik'));assert.ok((await chart('employment-formation-chart')).labels.length<=10);
      await goto('/pegawai-formasi.html?jenis_unit=akademik');await ready('employment-formation-table');assert.equal(await evaluate("document.querySelector('[name=jenis_unit]').value"),'akademik');assert.equal(await evaluate("document.querySelectorAll('#employment-formation-table tbody tr').length"),6);await set('jenis_unit','');await ready('employment-formation-table');
      assert.ok((await evaluate("document.querySelector('#employment-formation-table tbody').innerText")).includes('1.100'));assert.ok((await evaluate('document.body.innerText')).includes('PDF 44/cetak 36'));assert.ok((await evaluate('document.body.innerText')).includes('Tabel 2.11'));
      assert.equal(await evaluate("document.querySelector('#employment-pkwt').dataset.state"),'empty');assert.equal(await evaluate("document.querySelectorAll('#employment-pkwt canvas').length"),0);assert.equal(await evaluate("document.querySelectorAll('#employment-formation-table .download-excel').length"),1);
      await set('tahun','2026');await ready('employment-formation-table');assert.ok((await evaluate('location.search')).includes('tahun=2026'));
      await evaluate("(()=>{const s=document.querySelector('#employment-movement-chart .data-tools select');s.value='horizontal';s.dispatchEvent(new Event('change'));})()");assert.equal(await evaluate("Chart.getChart(document.querySelector('#employment-movement-chart canvas')).options.indexAxis"),'y');
      await evaluate("window.staffExport=null;window.staffOldURL=URL.createObjectURL;window.staffOldClick=HTMLAnchorElement.prototype.click;URL.createObjectURL=b=>{window.staffExport=b;return 'blob:employment-test'};HTMLAnchorElement.prototype.click=function(){};document.querySelector('#employment-formation-table .download-excel').click()");await wait('!!window.staffExport');assert.ok(await evaluate('staffExport.size>0'));await evaluate('URL.createObjectURL=window.staffOldURL;HTMLAnchorElement.prototype.click=window.staffOldClick');
      await capture('employment-desktop');await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('employment-mobile');
      const second=await evaluate("Array.from(document.querySelector('[name=periode_laporan_id]').options).find(x=>x.textContent.includes('Semester II'))?.value");await set('periode_laporan_id',second);await wait("document.querySelector('#employment-formation-table')?.dataset.state==='empty'");await wait("document.querySelector('#employment-movement-chart')?.dataset.state==='empty'");assert.equal(await evaluate("document.querySelectorAll('#page-content canvas').length"),0);
    });
    await t.test('D3: dua tab BSDM, 50/4 baris, sumber tetap dan form 360px',async()=>{
      const before=(await owner.query('SELECT (SELECT count(*) FROM formasi_revisi)+(SELECT count(*) FROM pergerakan_pegawai_revisi) AS n')).rows[0].n;
      await call('Network.clearBrowserCookies');await goto('/login.html');await login(users[1],newPassword);await goto('/input/bsdm.html');await wait("!!document.querySelector('[data-domain=formasi]')");
      await evaluate("document.querySelector('[data-domain=formasi]').click()");await wait("document.querySelectorAll('#entry-table tbody tr').length===50");assert.equal(await evaluate("document.querySelector('[name=academic]').parentElement.hidden"),true);assert.ok((await evaluate("document.querySelector('#entry-table').textContent")).includes('SEKOLAH PASCASARJANA'));assert.equal(await evaluate("Array.from(document.querySelectorAll('#entry-table [data-field=capaian_laporan]')).some(x=>x.value==='1100')"),true);
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('employment-form-mobile');
      await evaluate("document.querySelector('[data-domain=pegawai-pergerakan]').click()");await wait("document.querySelectorAll('#entry-table tbody tr').length===4");assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('#entry-table [data-field=jumlah]')).map(x=>Number(x.value))"),[5,4,2,5]);
      assert.equal((await owner.query('SELECT (SELECT count(*) FROM formasi_revisi)+(SELECT count(*) FROM pergerakan_pegawai_revisi) AS n')).rows[0].n,before,'Membuka form tidak menulis data');
      await call('Network.clearBrowserCookies');await goto('/login.html');await login(users[4],password);
    });
    await t.test('D0: cakupan lulusan institusi serta tab tracer/KPI, seed tetap dan 360px',async()=>{
      const count=(await owner.query("SELECT (SELECT count(*) FROM lulusan)+(SELECT count(*) FROM tracer_ringkasan)+(SELECT count(*) FROM kpi_input) AS n")).rows[0].n;
      await goto('/input/baa.html');await wait("!!document.querySelector('[data-domain=lulusan]')");await evaluate("document.querySelector('[data-domain=lulusan]').click()");await wait("!!document.querySelector('[name=scope]')");await set('scope','institusi');await set('year','2025');await wait("document.querySelectorAll('#entry-table tbody tr').length===1");assert.equal(await evaluate("document.querySelector('[data-field=jumlah]').value"),'1100');assert.equal(await evaluate("document.querySelector('[data-field=jumlah]').disabled"),false);assert.equal(await evaluate("document.querySelector('[name=academic]').parentElement.hidden"),true);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
      await goto('/input/bpka.html');await wait("!!document.querySelector('[data-domain=tracer-ringkasan]')");await evaluate("document.querySelector('[data-domain=tracer-ringkasan]').click()");await wait("document.querySelectorAll('#entry-table tbody tr').length===1");assert.equal(await evaluate("document.querySelector('[data-field=responden]').value"),'328');assert.equal(await evaluate("document.querySelector('[name=temporary]').value"),'true');assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('tracer-institution-mobile');
      await goto('/input/prp.html');await wait("!!document.querySelector('[data-domain=kpi-input]')");await evaluate("document.querySelector('[data-domain=kpi-input]').click()");await wait("document.querySelectorAll('#entry-table tbody tr').length===2");assert.ok((await evaluate("document.querySelector('#entry-table').textContent")).includes('dosen_tetap_nidn_non_pln'));assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('[data-field=nilai_numerik]')).map(x=>Number(x.value)).sort((a,b)=>a-b)"),[118,198]);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
      assert.equal((await owner.query("SELECT (SELECT count(*) FROM lulusan)+(SELECT count(*) FROM tracer_ringkasan)+(SELECT count(*) FROM kpi_input) AS n")).rows[0].n,count,'Membuka form tidak menulis data');
    });
    await t.test('IKU form PRP: master 19, presisi, catatan dan tanpa tulis saat dibuka',async()=>{
      const before=(await owner.query('SELECT * FROM iku_capaian ORDER BY id')).rows;
      await call('Network.clearBrowserCookies');await goto('/login.html');await login(users[3],password);
      for(const width of [1440,360]){
        await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===360});
        await goto('/input/prp.html');await wait("!!document.querySelector('[data-domain=iku-capaian]')");
        await evaluate("document.querySelector('[data-domain=iku-capaian]').click()");await wait("document.querySelectorAll('#entry-table tbody tr').length===19 && !!document.querySelector('[name=quarter]')");
        assert.equal(await evaluate("document.querySelectorAll('input[type=file]').length"),0);
        assert.equal(await evaluate("document.querySelector('[name=quarter]').value"),'T2');
        assert.equal(await evaluate("document.querySelectorAll('[data-field=catatan_verifikasi]').length"),19);
        assert.equal(await evaluate("Array.from(document.querySelectorAll('[data-field=realisasi]')).some(x=>x.value==='0,905')"),true);
        assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
        await capture('pimpinan-input-iku-'+width);
      }
      assert.deepEqual((await owner.query('SELECT * FROM iku_capaian ORDER BY id')).rows,before);
    });
    await t.test('Logout dari dashboard/input mengganti URL, Back menolak data privat dan sesi habis ramah',async()=>{
      for(const [user,path,selector] of [[users[0],'/pegawai-formasi.html','#employment-summary'],[users[2],'/input/baa.html','#entry-table'],[users[0],'/pegawai%2dformasi.html','#employment-summary'],[users[2],'/%69nput/baa.html','#entry-table']]){
        await call('Network.clearBrowserCookies');await goto('/login.html');await login(user,password);
        await goto(path+'?logout_check=before');await wait('!!document.querySelector('+JSON.stringify(selector)+')');
        await evaluate("window.addEventListener('pagehide',()=>localStorage.setItem('e1-pagehide',document.documentElement.style.visibility),{once:true})");
        await goto(path);assert.equal(await evaluate("localStorage.getItem('e1-pagehide')"),'hidden');await wait('!!document.querySelector('+JSON.stringify(selector)+')');await wait("!!document.querySelector('.nav-logout')");
        await evaluate("document.querySelector('.nav-logout').click()");await wait("location.pathname==='/index.html' && document.readyState==='complete'");await wait("document.querySelector('#navbar')?.dataset.auth==='anonymous'");assert.equal(await evaluate("import('/assets/js/api.js').then(m=>m.getUser())"),null);
        const history=await call('Page.getNavigationHistory');await call('Page.navigateToHistoryEntry',{entryId:history.entries[history.currentIndex-1].id});await wait("location.pathname==='/login.html' && document.readyState==='complete'");assert.equal(await evaluate('!!document.querySelector('+JSON.stringify(selector)+')'),false);assert.equal(await evaluate("new URLSearchParams(location.search).get('next')"),decodeURIComponent(path)+'?logout_check=before');
      }
      for(const bad of ['//evil.com','https://evil.com','/\\evil.com']){await call('Network.clearBrowserCookies');await goto('/login.html?next='+encodeURIComponent(bad));await login(users[0],password);assert.equal(await evaluate('location.pathname'),'/index.html');}
      await call('Network.clearBrowserCookies');await goto('/pegawai-formasi.html?tahun=2026');await wait("location.pathname==='/login.html'");await login(users[0],password);await ready('employment-summary');assert.equal(await evaluate('location.search'),'?tahun=2026');
      await call('Network.clearBrowserCookies');await evaluate("import('/assets/js/api.js').then(m=>m.request('/dashboard/formasi')).catch(()=>{})");await wait("!!document.querySelector('#session-expired a')");assert.ok((await evaluate("document.querySelector('#session-expired').textContent")).includes('Sesi berakhir, silakan login lagi'));assert.equal(await evaluate("new URL(document.querySelector('#session-expired a').href).pathname"),'/login.html');
    });
    await t.test('E1: unduh, unggah, preview dan terapkan draft BAA/BSDM desktop/360px',async()=>{
      const academic=(await owner.query("INSERT INTO periode_akademik(kode,tahun_ajaran,semester,urutan,aktif) VALUES($1,'2098/2099','Genap',(SELECT max(urutan)+1 FROM periode_akademik),false) RETURNING id",['excel-ui-'+run])).rows[0].id;
      const report=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,coalesce(max(tahun) FILTER(WHERE tahun>=2099),2098)+1,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id",['excel-ui-'+run])).rows[0].id;
      try{for(const [user,pw,path,domain,count,field]of [[users[2],password,'baa','mahasiswa-aktif',19,'total'],[users[1],newPassword,'bsdm','formasi',50,'jumlah']]){
        await call('Network.clearBrowserCookies');await goto('/login.html');await login(user,pw);await goto('/input/'+path+'.html');await wait('!!document.querySelector('+JSON.stringify('[data-domain='+domain+']')+')');await evaluate('document.querySelector('+JSON.stringify('[data-domain='+domain+']')+').click()');await wait("document.querySelectorAll('#entry-table tbody tr').length==="+count);await set('report',String(report));if(domain==='mahasiswa-aktif')await set('academic',String(academic));else await set('year','2099');await wait("document.querySelectorAll('#entry-table tbody tr').length==="+count);
        const bytes=await downloadTemplate(domain);const files=unzipSync(bytes);let data=strFromU8(files['xl/worksheets/sheet2.xml']);data=data.replace(/<c r="C2".*?<\/c>/,'<c r="C2"><v>12</v></c>').replace(/<c r="D2".*?<\/c>/,'<c r="D2"><v>5</v></c>');files['xl/worksheets/sheet2.xml']=strToU8(data);const filename=resolve('.runtime/phase3/excel-'+domain+'-'+run+'.xlsx');await writeFile(filename,zipSync(files));
        const doc=await call('DOM.getDocument'),node=await call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#template-file'});await call('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[filename]});await evaluate("document.querySelectorAll('#template-upload > button')[1].click()");await wait("!!document.querySelector('#template-upload').dataset.previewId");assert.ok((await evaluate("document.querySelector('#template-upload .save-status').textContent")).includes('Isi berkas belum diterapkan ke draft'));
        assert.ok((await evaluate("document.querySelector('#template-upload').textContent")).includes('Perubahan manual yang belum tersimpan akan disimpan sebagai draft'));
        const table=domain==='formasi'?'formasi_revisi':'mahasiswa_aktif';assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${table} WHERE periode_laporan_id=$1`,[report])).rows[0].n,0);
        await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('excel-'+domain+'-desktop');await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('excel-'+domain+'-mobile');
        await evaluate("document.querySelector('#template-apply').click()");await wait("document.querySelector('#template-upload .save-status').textContent.includes('Data masuk sebagai DRAFT, belum diajukan')");await wait("document.querySelector('#entry-table [data-field="+field+"]')?.value==='12'");await wait("document.querySelector('#form-feedback-dialog')?.open");assert.match(await evaluate("document.querySelector('#form-feedback-dialog').textContent"),/DRAFT, belum diajukan/);await evaluate("document.querySelector('#form-feedback-dialog button').click()");const rows=(await owner.query(`SELECT status,is_current_approved FROM ${table} WHERE periode_laporan_id=$1`,[report])).rows;assert.equal(rows.length,count);assert.ok(rows.every(r=>r.status==='draft'&&!r.is_current_approved));
        assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${domain==='formasi'?'v_dashboard_formasi':'v_dashboard_mahasiswa'} WHERE periode_laporan_id=$1`,[report])).rows[0].n,0);
        const request=async(path,method,body)=>(await evaluate(`import('/assets/js/api.js').then(m=>m.request(${JSON.stringify(path)},{method:${JSON.stringify(method)},body:${JSON.stringify(body)}}))`)).data;
        let cookie='',csrf;const reviewer=async(path,method='GET',body)=>{const response=await fetch(base+'/api'+path,{method,headers:{cookie,...(method==='GET'?{}:{'content-type':'application/json','x-csrf-token':csrf})},...(body?{body:JSON.stringify(body)}:{})});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const json=await response.json();assert.equal(response.status,200,JSON.stringify(json));return json.data;};
        csrf=(await reviewer('/auth/csrf')).csrf;csrf=(await reviewer('/auth/login','POST',{email:users[3].email,password})).csrf;
        let first=(await owner.query(`SELECT * FROM ${table} WHERE periode_laporan_id=$1 ORDER BY id LIMIT 1`,[report])).rows[0];first=await request('/data/'+domain+'/'+first.id+'/submit','POST',{row_version:first.row_version});first=await reviewer('/verification/'+domain+'/'+first.id+'/approve','POST',{row_version:first.row_version,review_note:'Uji kembalikan draft UI'});
        let rev=await request('/data/'+domain+'/'+first.id+'/revision','POST',{row_version:first.row_version});await request('/data/'+domain+'/'+rev.id,'PATCH',{row_version:rev.row_version,[field]:2});await set('report',String(report));await wait("document.querySelector('#entry-table [data-field="+field+"]')?.value==='2'");
        const dialog=async(selector,accept)=>{const clicked=evaluate('document.querySelector('+JSON.stringify(selector)+').click()');await pause(150);await call('Page.handleJavaScriptDialog',{accept});await clicked;};
        await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});await dialog('.discard-draft',false);assert.match(dialogs.at(-1),/Buang 1 baris/);assert.equal(await evaluate("document.querySelector('#entry-table [data-field="+field+"]').value"),'2');await dialog('.discard-draft',true);await wait("document.querySelector('#entry-table [data-field="+field+"]')?.value==='12'");await wait("document.querySelector('#input-history').textContent.includes('Dibatalkan')");assert.equal(await evaluate("document.querySelector('#form-feedback-toast').textContent"),'✓Draft dibatalkan');assert.equal(await evaluate("!!document.querySelector('#form-feedback-dialog')"),false);assert.ok((await evaluate("document.querySelector('#input-history').textContent")).includes('Dibatalkan'));assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
        await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});await dialog('#discard-all-drafts',true);assert.ok(dialogs.at(-1).includes('Buang '+(count-1)+' baris'));await wait("document.querySelector('#save-status')?.textContent.includes('"+(count-1)+" baris draft dibatalkan.') && document.querySelector('#entry-table [data-field="+field+"]')?.value==='12'");assert.equal(await evaluate("document.querySelector('#entry-table [data-field="+field+"]').value"),'12');assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${table} WHERE periode_laporan_id=$1 AND status='draft'`,[report])).rows[0].n,0);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.equal(await evaluate("Array.from(document.querySelectorAll('#entry-table [data-field="+field+"]')).slice(1).every(x=>x.value==='')"),true);

      }}finally{await owner.query('DELETE FROM formasi_revisi WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM mahasiswa_aktif WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM periode_laporan WHERE id=$1',[report]);await owner.query('DELETE FROM periode_akademik WHERE id=$1',[academic]);}
    });
    await t.test('E2: delapan form, dua cakupan lulusan, XLSX sampai draft desktop/360px',async()=>{
      const academic=(await owner.query("INSERT INTO periode_akademik(kode,tahun_ajaran,semester,urutan,aktif) VALUES($1,'2098/2099','Genap',(SELECT max(urutan)+1 FROM periode_akademik),false) RETURNING id",['e2-ui-'+run])).rows[0].id;
      try{for(const [domain,path,count,extra,academicRequired]of simpleCases){
        const report=(await owner.query("INSERT INTO periode_laporan(kode,tahun,semester,mulai,selesai,urutan) SELECT $1,coalesce(max(tahun) FILTER(WHERE tahun>=2099),2098)+1,'S1','2099-01-01','2099-06-30',max(urutan)+1 FROM periode_laporan RETURNING id",['e2-ui-'+domain+'-'+(extra.cakupan??'')+'-'+run])).rows[0].id;
        const field=formDefinitions[domain].columns[0].key;
        try{
        await call('Network.clearBrowserCookies');await goto('/login.html');await login(users[4],password);await goto('/input/'+path+'.html');await wait('!!document.querySelector('+JSON.stringify('[data-domain='+domain+']')+')');await evaluate('document.querySelector('+JSON.stringify('[data-domain='+domain+']')+').click()');
        await wait("!!document.querySelector('#entry-table tbody tr')");await set('report',String(report));
        if(extra.cakupan)await set('scope',extra.cakupan);
        if(academicRequired)await set('academic',String(academic));
        if(extra.tahun||extra.tahun_masuk||extra.tahun_lulus)await set('year','2099');
        if(extra.periode_wisuda)await set('wisuda',extra.periode_wisuda);
        if(extra.tanggal_snapshot)await set('snapshot',extra.tanggal_snapshot);
        await wait("document.querySelectorAll('#entry-table tbody tr').length==="+count);
        const bytes=await downloadTemplate(domain);const files=unzipSync(bytes);let data=strFromU8(files['xl/worksheets/sheet2.xml']);data=data.replace(/<c r="C2".*?<\/c>/,'<c r="C2"><v>12</v></c>');files['xl/worksheets/sheet2.xml']=strToU8(data);const filename=resolve('.runtime/phase3/excel-'+domain+'-'+run+'.xlsx');await writeFile(filename,zipSync(files));
        const doc=await call('DOM.getDocument'),node=await call('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#template-file'});await call('DOM.setFileInputFiles',{nodeId:node.nodeId,files:[filename]});await evaluate("document.querySelectorAll('#template-upload > button')[1].click()");await wait("!!document.querySelector('#template-upload').dataset.previewId");assert.ok((await evaluate("document.querySelector('#template-upload .save-status').textContent")).includes('Isi berkas belum diterapkan ke draft'));
        assert.ok((await evaluate("document.querySelector('#template-upload').textContent")).includes('Perubahan manual yang belum tersimpan akan disimpan sebagai draft'));
        const table=getDomain(domain).table;assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${table} WHERE periode_laporan_id=$1`,[report])).rows[0].n,0);
        await call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('excel-'+domain+'-desktop');await call('Emulation.setDeviceMetricsOverride',{width:360,height:900,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);await capture('excel-'+domain+'-mobile');
        await evaluate("document.querySelector('#template-apply').click()");await wait("document.querySelector('#template-upload .save-status').textContent.includes('Data masuk sebagai DRAFT, belum diajukan')");await wait("document.querySelector('#entry-table [data-field="+field+"]')?.value==='12'");await wait("document.querySelector('#form-feedback-dialog')?.open");assert.match(await evaluate("document.querySelector('#form-feedback-dialog').textContent"),/DRAFT, belum diajukan/);await evaluate("document.querySelector('#form-feedback-dialog button').click()");const rows=(await owner.query(`SELECT status,is_current_approved FROM ${table} WHERE periode_laporan_id=$1`,[report])).rows;assert.equal(rows.length,count);assert.ok(rows.every(r=>r.status==='draft'&&!r.is_current_approved));

        }finally{await owner.query('DELETE FROM '+getDomain(domain).table+' WHERE periode_laporan_id=$1',[report]);await owner.query('DELETE FROM periode_laporan WHERE id=$1',[report]);}
      }}finally{await owner.query('DELETE FROM periode_akademik WHERE id=$1',[academic]);}
    });
    await t.test('Unduhan: respons kosong/rusak/sesi/limiter menjadi alert, tanpa file di disk',async()=>{
      await call('Network.clearBrowserCookies');await goto('/login.html');await login(users[4],password);await goto('/input/baa.html');await wait("!!document.querySelector('#template-upload button') && !!document.querySelector('#entry-table tbody tr')");
      const first=await downloadTemplate('mahasiswa-aktif');await pause(11000);
      const delayed=await downloadTemplate('mahasiswa-aktif','#template-upload .save-status a');assert.deepEqual(delayed,first,'Blob remains downloadable beyond the former ten-second timer');
      const beforeFiles=await readdir(downloadRoot),beforeEvents=downloads.size;
      for(const fault of ['empty','html','truncated','checksum','403','429','503','network','401']){
        await evaluate(`window.realTransferFetch=window.fetch;window.fetch=async(...args)=>{if(!String(args[0]).includes('/template'))return window.realTransferFetch(...args);const fault=${JSON.stringify(fault)};if(fault==='network')throw new TypeError('Koneksi unduhan terputus.');if(['401','403','429','503'].includes(fault))return new Response(JSON.stringify({error:{message:'Unduhan ditolak '+fault}}),{status:Number(fault),headers:{'content-type':'application/json'}});const real=await window.realTransferFetch(...args),headers=new Headers(real.headers),bytes=new Uint8Array(await real.arrayBuffer());if(fault==='html'){headers.set('content-type','text/html');return new Response('<html>Login</html>',{headers});}if(fault==='empty'){headers.set('content-length','0');return new Response(null,{headers});}if(fault==='checksum')bytes[60]^=1;const body=fault==='truncated'?bytes.slice(0,30):bytes;headers.set('content-length',String(body.length));return new Response(body,{headers});};document.querySelector('#template-upload button').click()`);
        try{await wait("!document.querySelector('#template-upload button').disabled && document.querySelector('#template-upload .save-status').getAttribute('role')==='alert'");const shown=await evaluate("document.querySelector('#template-upload .save-status').textContent");assert.match(shown,({empty:/Template kosong/,html:/Template kosong/,truncated:/Template kosong/,checksum:/Template kosong/,'403':/tidak berhak/,'429':/Terlalu banyak permintaan/,'503':/layanan sedang tidak tersedia/,network:/Server tidak dapat dihubungi/,'401':/Sesi berakhir/})[fault]);assert.ok(!shown.includes('Unduhan ditolak'), 'raw response message is not displayed');}finally{await evaluate('window.fetch=window.realTransferFetch');}
        assert.equal(downloads.size,beforeEvents,fault+': no browser download');assert.deepEqual(await readdir(downloadRoot),beforeFiles,fault+': no saved file');
      }
    });
    await formFeedbackUiCases({t,base,owner,users,password,call,evaluate,wait,goto,login,set,capture,pause});
    await errorHandlingUiCases({t,base,owner,users,password,call,evaluate,wait,goto,login,capture,pause});
    assert.deepEqual(exceptions,[]);assert.deepEqual(csp,[]);await call('Browser.close');
  }finally{socket?.close();browser?.kill();api.kill();await new Promise(r=>api.exitCode!==null?r():(api.once('exit',r),setTimeout(r,1000)));await owner.query('UPDATE users SET aktif=false,session_version=session_version+1 WHERE id=ANY($1::bigint[])',[users.map(u=>u.id)]);await owner.end();}
});

test('Excel: regresi entry npm start/dev tanpa harness auth/audit',excelEntryCases);
