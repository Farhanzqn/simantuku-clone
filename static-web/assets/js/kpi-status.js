import {ikuBand,ikuThresholds} from './iku-schema.js';

export const kpiStatuses=Object.freeze({
 success:{label:'Tercapai',icon:'✓'},
 warning:{label:'Mendekati',icon:'!'},
 danger:{label:'Belum tercapai',icon:'×'},
 unknown:{label:'Belum dinilai',icon:'−'}
});
export {ikuThresholds as kpiThresholds};
export function kpiBand(value){
 return ikuBand(value===null||value===undefined||value===''||!Number.isFinite(Number(value))?null:value);
}
export function kpiCounts(rows){
 const counts={success:0,warning:0,danger:0,unknown:0};
 for(const row of rows)counts[kpiBand(row.persen_capaian)]++;
 return counts;
}
export function filterKpi(rows,status){return status?rows.filter(row=>kpiBand(row.persen_capaian)===status):rows;}
