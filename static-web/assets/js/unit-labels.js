// Display alias only; role values, unit codes and source records keep BKM/bkm.
export function unitLabel(value){return typeof value==='string'?value.replace(/\bBKM\b/gi,'BKK'):value;}
