// Master is the counting universe. Unmapped source rows never imply a mapping.
export function accreditationSummary(master, rows) {
 const detail=rows.filter(r=>r.cakupan==='prodi');
 const prodi=master.map(p=>{const matches=detail.filter(r=>String(r.prodi_id)===String(p.id));return {...(matches[0]??{}),prodi_id:p.id,prodi_nama:p.nama,jenjang:p.jenjang,jumlah_catatan:matches.length,peringkat:matches[0]?.peringkat??null};});
 const rekap=[];
 for(const p of prodi){let cell=rekap.find(r=>r.jenjang===p.jenjang&&r.peringkat===p.peringkat);if(!cell){cell={jenjang:p.jenjang,peringkat:p.peringkat,jumlah:0};rekap.push(cell);}cell.jumlah++;}
 for(const cell of rekap)cell.persentase=prodi.length?100*cell.jumlah/prodi.length:null;
 const total_rekap=rekap.reduce((n,r)=>n+r.jumlah,0);
 return {prodi,rekap_master:rekap,total_master:master.length,total_rekap,konsisten:master.length===total_rekap,jumlah_peringkat:new Set(prodi.map(r=>r.peringkat).filter(Boolean)).size,tanpa_data:prodi.filter(r=>!r.jumlah_catatan).length,duplikat:prodi.filter(r=>r.jumlah_catatan>1).length};
}
