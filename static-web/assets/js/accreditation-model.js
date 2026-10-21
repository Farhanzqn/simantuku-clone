export function expiryLabel(end,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
 if(!end)return '';
 if(end<today)return 'Masa berlaku sudah lewat';
 const [y,m,d]=today.split('-').map(Number),last=new Date(Date.UTC(y+1,m,0)).getUTCDate();
 const limit=`${y+1}-${String(m).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
 return end<=limit?'Masa berlaku akan habis ≤12 bulan':'';
}
export function safeCertificate(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function totalsConsistent(meta){return meta.total_master===meta.rekap_master.reduce((n,r)=>n+r.jumlah,0)&&meta.total_master===meta.prodi.length;}
