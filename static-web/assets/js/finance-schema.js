export const financeCategories=[
 ['likuiditas','Rasio likuiditas','rasio','kali'],['efisiensi','Efisiensi operasional','rasio','%'],['belanja-sdm','Belanja SDM / total anggaran','rasio','%'],['cost-student','Cost per student','rasio','Rp/mahasiswa'],['non-spp','Pendapatan non-SPP','rasio','%'],
 ['pendapatan-mahasiswa','Pendapatan mahasiswa','pendapatan','Rp'],['pendapatan-non-mahasiswa','Pendapatan non mahasiswa','pendapatan','Rp'],
 ['tridarma-langsung','Tri Darma langsung','biaya','Rp'],['tridarma-tidak-langsung','Tri Darma tidak langsung','biaya','Rp'],['umum-operasional','Umum dan operasional','biaya','Rp'],['sewa-outsourcing','Sewa dan outsourcing','biaya','Rp'],
 ['aset','Total aset','laporan','Rp'],['liabilitas','Total liabilitas','laporan','Rp'],['pendapatan-laporan','Pendapatan laporan','laporan','Rp'],['beban-laporan','Beban laporan','laporan','Rp'],['laba-rugi','Laba/Rugi','laporan','Rp'],['arus-kas','Arus kas operasional','laporan','Rp']
];
export const financeDefinition={role:'bku',title:'Keuangan',academic:false,year:true,entities:'categories',categories:financeCategories.map(([key,label,,unit])=>[key,label+' ('+unit+')']),help:'Isi sesuai kelompok dan satuan pada nama baris. Rasio: target/realisasi/status. Pendapatan dan biaya: target/realisasi/capaian laporan (%). Laporan posisi: realisasi/periode sebelumnya/perubahan. Periode sebelumnya belum mempunyai kode semester. Penurunan pada Perubahan boleh negatif atau (angka). Kosong berarti belum tersedia; jangan menjumlahkan kelompok atau memakai nilai kontrak kerja sama.',columns:[
  {key:'target',label:'Target (satuan baris)',min:0,max:1e18},{key:'realisasi',label:'Realisasi (satuan baris)',min:0,max:1e18},{key:'capaian_laporan',label:'Capaian laporan (%)',min:0,max:1e18},
  {key:'periode_sebelumnya',label:'Periode sebelumnya (Rp; kode tidak disebutkan)',min:0,max:1e18},{key:'perubahan',label:'Perubahan (Rp; negatif = turun)',min:-1e18,max:1e18},{key:'status_sumber',label:'Status sumber (rasio)',text:true}
]};
export function financeErrors(row){
 const category=financeCategories.find(x=>x[0]===row.kategori);if(!category)return ['Kategori keuangan tidak tersedia.'];
 const forbidden=category[2]==='laporan'?['target','capaian_laporan','status_sumber']:category[2]==='rasio'?['periode_sebelumnya','perubahan','capaian_laporan']:['periode_sebelumnya','perubahan','status_sumber'];
 return forbidden.filter(k=>row[k]!==null&&row[k]!==undefined&&row[k]!=='').map(k=>'Kolom '+k+' tidak berlaku untuk kelompok '+category[2]+'. Kosongkan sel tersebut.');
}
