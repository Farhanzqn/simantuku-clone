// Pesan berasal dari aplikasi, bukan message/stack driver atau body gateway.
export const safeRequestId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value)?value:'';
export function retryAfter(value,now=Date.now()){
 if(!value)return 0;
 if(/^\d+(?:\.\d+)?$/.test(value))return Math.ceil(Number(value)*1000);
 const at=Date.parse(value);return Number.isFinite(at)?Math.max(0,at-now):0;
}
export class ApiError extends Error{
 constructor(status,message,code,details={}){super(message);Object.assign(this,{status,code,...details});}
}
export const isCsrfRejection=error=>error.status===403&&error.code==='CSRF_INVALID';
export function apiError({status=0,code='',requestId='',waitMs=0,method='GET',kind}={}){
 const write=!['GET','HEAD'].includes(method);
 let type=kind??({400:'bad-request',401:'session',403:code==='CSRF_INVALID'?'csrf':'forbidden',404:'missing',409:'conflict',413:'too-large',422:'validation',429:'rate-limit',503:'unavailable'}[status]??(status>=500?'server':'network'));
 if(code==='LOGIN_FAILED')type='login';
 if(code==='INVALID_TEMPLATE')type='template';
 const messages={
  network:typeof navigator!=='undefined'&&navigator.onLine===false?'Koneksi internet terputus. Periksa jaringan Anda.':'Server tidak dapat dihubungi. Periksa koneksi lalu coba lagi.',
  timeout:'Permintaan melewati batas waktu. Coba lagi setelah memeriksa koneksi.',
  cancelled:'Permintaan dibatalkan.',session:'Sesi berakhir, silakan login lagi. Masuk ulang untuk melanjutkan.',
  login:'Email atau password tidak sesuai. Periksa lalu coba lagi.',
  csrf:'Permintaan ditolak karena token keamanan tidak valid. Pemulihan otomatis berhenti. Muat ulang halaman atau coba lagi.',
  forbidden:'Anda tidak berhak melakukan tindakan ini. Hubungi PRP jika memerlukan akses.',
  missing:'Halaman atau data tidak ditemukan. Periksa pilihan atau kembali ke Beranda.',
  conflict:'Data atau versi sudah berubah. Periksa riwayat dan muat ulang data sebelum melanjutkan.',
  validation:'Isian belum valid. Periksa kolom dan ringkasan kesalahan, lalu coba lagi.',
  'bad-request':'Permintaan tidak valid. Periksa isian atau muat ulang halaman.',
  'too-large':'Berkas atau permintaan terlalu besar. Kurangi ukurannya lalu coba lagi.',
  'rate-limit':'Terlalu banyak permintaan. Tunggu sebelum mencoba lagi.',
  unavailable:'Maaf, layanan sedang tidak tersedia. Coba lagi nanti atau hubungi PRP.',
  server:'Terjadi kesalahan server. Coba lagi nanti atau hubungi PRP.',
  response:'Respons server kosong atau bukan JSON yang valid. Muat ulang halaman atau hubungi PRP.',
  template:'Template kosong, tidak lengkap, atau tidak valid. Tidak ada berkas yang disimpan. Muat ulang halaman lalu coba lagi.'
 };
 let message=messages[type]??messages.server;
 if(waitMs)message+=' Tunggu '+Math.ceil(waitMs/1000).toLocaleString('id-ID')+' detik.';
 const uncertain=write&&['network','timeout','server','unavailable','response','cancelled'].includes(type);
 if(uncertain)message+=' Hasil belum dapat dipastikan. Periksa riwayat sebelum mencoba lagi agar tindakan tidak ganda.';
 const id=safeRequestId(requestId);if(id)message+=' ID permintaan: '+id+'.';
 const action=uncertain?'Coba lagi':({session:'Masuk ulang',csrf:'Coba lagi',forbidden:'Hubungi PRP',missing:'Kembali ke Beranda',conflict:'Muat ulang halaman',response:'Muat ulang halaman',template:'Muat ulang halaman'})[type]??'Coba lagi';
 return new ApiError(status,message,code||type.toUpperCase().replaceAll('-','_'),{type,action,requestId:id,waitMs,uncertain,write,retryable:!write&&(type==='network'||!['template','response'].includes(type)&&[429,502,503,504].includes(status))});
}
