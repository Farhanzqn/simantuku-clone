import {safeNext} from './navigation.js';
const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
export function loginLink(){return '/login.html?next='+encodeURIComponent(safeNext(location.pathname+location.search+location.hash));}
export function failure(target,error,retry){
 if(!target)return;const global=document.getElementById('api-error-notice');if(global&&global!==target&&global.apiError===error)global.hidden=true;target.apiError=error;target.hidden=false;target.setAttribute('role','alert');target.dataset.state='error';target.replaceChildren(node('span',error.message||'Tindakan belum berhasil. Coba lagi.'));
 const actions=node('span');actions.className='error-actions';
 const link=(text,href)=>{const a=node('a',text);a.className='button secondary';a.href=href;actions.append(a);return a;};
 if(error.type==='session'||error.status===401&&error.code!=='LOGIN_FAILED'){
  const a=link('Masuk ulang',loginLink());a.target='_blank';a.rel='noopener';a.append(node('span',' (tab baru)'));
  target.append(node('span',' Isian tetap di tab ini. Setelah masuk, kembali dan ulangi tindakan.'));
 }else if(error.type==='forbidden')link('Hubungi PRP','#bantuan-prp');
 else if(error.type==='missing')link('Kembali ke Beranda','/index.html');
 else{
  const b=node('button',error.action??'Coba lagi');b.type='button';b.className='button secondary';
  b.addEventListener('click',async()=>{if(b.disabled)return;b.disabled=true;try{if(error.type==='conflict')location.reload();else if(retry)await retry();else if(error.write){target.querySelector('span').textContent=error.message+' Gunakan kembali tombol tindakan asal setelah memeriksa riwayat.';document.querySelector('#save-draft,#auth-form button,#review-message')?.focus();}else location.reload();}finally{b.disabled=false;}});
  const until=Date.now()+(error.waitMs??0);if(until>Date.now()){
   b.disabled=true;const tick=()=>{if(!b.isConnected)return;const left=Math.ceil((until-Date.now())/1000);b.disabled=left>0;b.textContent=left>0?'Tunggu '+left.toLocaleString('id-ID')+' detik':'Coba lagi';if(left>0)setTimeout(tick,1000);};setTimeout(tick,0);
  }
  actions.append(b);
  if(['server','unavailable','network','timeout','response','template'].includes(error.type))link('Hubungi PRP','#bantuan-prp');
 }
 target.append(actions);
 return target;
}
if(typeof window!=='undefined'){
 const retrying=new Map();
 window.addEventListener('api-retry',({detail})=>{if(detail.done&&!retrying.has(detail.id))return;let status=document.getElementById('api-retry-status');if(!status){status=node('p');status.id='api-retry-status';status.className='auth-message';status.setAttribute('role','status');(document.querySelector('main')??document.body).prepend(status);}if(detail.done)retrying.delete(detail.id);else retrying.set(detail.id,detail);status.hidden=!retrying.size;status.textContent=[...retrying.values()].map(d=>'Mencoba lagi… '+d.attempt+'/2'+(d.waitMs?' — tunggu '+Math.ceil(d.waitMs/1000).toLocaleString('id-ID')+' detik':'')).join(' · ');});
 window.addEventListener('api-failure',({detail})=>{if(detail.type==='session'&&document.getElementById('session-expired'))return;let box=document.getElementById('api-error-notice');if(!box){box=node('div');box.id='api-error-notice';box.className='auth-message';(document.querySelector('main')??document.body).prepend(box);}failure(box,detail);});
 window.addEventListener('api-recovered',({detail})=>{const box=document.getElementById('api-error-notice');if(box?.apiError?.path===detail.path)box.hidden=true;});
}
