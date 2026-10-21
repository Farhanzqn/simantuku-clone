// Translate server validation results; thresholds come from the result itself.
// Unknown messages stay generic so database/driver text never reaches the UI.
export function serverFieldMessage(message){
 if(typeof message!=='string')return 'Isian ditolak server. Periksa nilai dan konteks baris ini.';
 const bound=message.match(/^Too (big|small): expected (number|string) to (?:be |have )?([<>]=)([\d.e+-]+)(?: characters)?$/);
 if(bound){const [,size,type,operator,value]=bound;return type==='string'?'Panjang teks '+(size==='big'?'maksimal ':'minimal ')+value+' karakter.':'Nilai harus '+operator+' '+value+'.';}
 if(message==='Invalid input: expected int, received number')return 'Harus berupa angka bulat.';
 if(message==='Tanggal tidak valid')return 'Tanggal tidak valid.';
 return 'Isian ditolak server. Periksa nilai dan konteks baris ini.';
}
