import {safeRequestId,retryAfter} from './error-policy.js';
import {safeNext} from './navigation.js';
const root=document.getElementById('error-card'),params=new URLSearchParams(location.search),id=safeRequestId(root.dataset.requestId||params.get('request_id'));
const reference=document.getElementById('error-reference');if(id){reference.hidden=false;reference.textContent='ID permintaan: '+id;}
const login=document.getElementById('error-login');if(login)login.href='/login.html?next='+encodeURIComponent(safeNext(params.get('next')));
const retry=document.getElementById('error-retry');
if(retry){retry.addEventListener('click',()=>location.reload());if(root.dataset.errorCode==='429'){
 const wait=retryAfter(root.dataset.retryAfter)||60000,until=Date.now()+wait,status=document.getElementById('error-wait');
 const tick=()=>{const left=Math.max(0,Math.ceil((until-Date.now())/1000));retry.disabled=left>0;status.textContent=left?'Coba lagi dalam '+left.toLocaleString('id-ID')+' detik.':'Anda dapat mencoba lagi sekarang.';if(left)setTimeout(tick,1000);};tick();
}}
