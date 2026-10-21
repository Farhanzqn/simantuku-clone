export function passwordPolicy(env=process.env,production=env.NODE_ENV==='production',warn=console.warn){
 const configured=env.DEV_SKIP_PASSWORD_CHANGE==='true';
 if(production&&env.DEV_SKIP_PASSWORD_CHANGE!==undefined&&env.DEV_SKIP_PASSWORD_CHANGE!=='')warn('DEV_SKIP_PASSWORD_CHANGE diabaikan di production; ganti password pertama tetap wajib.');
 return {skip:configured&&env.NODE_ENV==='development'&&!production};
}
