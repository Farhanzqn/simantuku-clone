// Ambang presentasi, bukan skor resmi berbobot Kemdiktisaintek.
export const ikuThresholds=Object.freeze({tercapai:100,mendekati:70});
export function ikuBand(value){return value===null?'unknown':Number(value)>=ikuThresholds.tercapai?'success':Number(value)>=ikuThresholds.mendekati?'warning':'danger';}
