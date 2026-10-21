// Expected scope is explicit: adding registry entries must not silently expand E2.
export const simpleCases=[
 ['mahasiswa-baru','ppa',19,{tahun_masuk:2099,tanggal_snapshot:'2099-06-30'},true],
 ['tendik','bsdm',19,{},true],
 ['pegawai-ringkasan','bsdm',4,{},true],
 ['lulusan','baa',19,{cakupan:'prodi',tahun_lulus:2099,periode_wisuda:'E2 uji wisuda'},true],
 ['prestasi','bkm',19,{tahun:2099},false],
 ['kerjasama','kerjasama',4,{tahun:2099},false],
 ['produktivitas-dosen','bsdm',3,{tahun:2099},false],
 ['pegawai-pergerakan','bsdm',4,{tahun:2099},false],
 ['lulusan','baa',1,{cakupan:'institusi',tahun_lulus:2099},false]
];
