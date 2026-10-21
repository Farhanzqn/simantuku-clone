import {request,getUser,safeNext,loginUrl} from './api.js';
import {failure} from './error-ui.js';
const form=document.getElementById('auth-form'),message=document.getElementById('auth-message'),button=form.querySelector('button'),change=document.body.dataset.page==='password';
// Tujuan internal dipertahankan melewati kewajiban ganti password.
const next=safeNext(new URLSearchParams(location.search).get('next'));
async function check(){try{const u=await getUser();if(change&&!u){location.replace(loginUrl(next));return;}if(!change&&u)location.replace(u.must_change_password?'/ganti-password.html?next='+encodeURIComponent(next):next);}catch(e){failure(message,e,check);}}
check();
form.addEventListener('submit',async e=>{e.preventDefault();if(button.disabled)return;message.textContent='';const values=Object.fromEntries(new FormData(form));if(change&&values.new_password!==values.confirm_password){message.textContent='Pengulangan password tidak sama.';return;}
  button.disabled=true;const old=button.textContent;button.textContent='Memproses…';try{if(change){delete values.confirm_password;await request('/auth/change-password',{method:'POST',body:values});form.reset();location.assign(next);}else{const {data}=await request('/auth/login',{method:'POST',body:values});form.reset();location.assign(data.user.must_change_password?'/ganti-password.html?next='+encodeURIComponent(next):next);}}
  catch(err){failure(message,err,()=>form.requestSubmit());}
  finally{button.disabled=false;button.textContent=old;}});
