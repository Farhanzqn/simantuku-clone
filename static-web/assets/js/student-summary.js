import {sum,numeric,difference,format} from './api.js';
import {el} from './ui.js';
export function studentSummary(rows){const total=sum(rows,'total'),perempuan=sum(rows,'perempuan'),complete=rows.length>0&&rows.every(r=>numeric(r.total)!==null&&numeric(r.perempuan)!==null);
 return {total,perempuan,laki:difference(rows,'total','perempuan'),persen_perempuan:complete&&total>0?100*perempuan/total:null};}
export function cohortNote(panel,meta){const r=meta?.rekonsiliasi;if(!r)return;panel.querySelector('.panel-content').append(el('p','Mahasiswa aktif approved: '+format(r.mahasiswa_aktif)+' \u00b7 Rincian angkatan approved: '+format(r.total_angkatan)+(r.selisih!==null&&r.selisih!==0?' \u00b7 Selisih '+format(r.selisih)+'. Menunggu koreksi BAA.':''),'note'));}
