// Opt-in E1/E2: satu parser, endpoint dan workflow bersama.
export const excelForms={
 'mahasiswa-aktif':{version:1,entities:'prodi',context:['periode_laporan_id','periode_akademik_id','status_mhs']},
 formasi:{version:1,entities:'categories',context:['periode_laporan_id','tahun']},
 'mahasiswa-baru':{version:1,entities:'prodi',context:['periode_laporan_id','periode_akademik_id','tahun_masuk','tanggal_snapshot']},
 tendik:{version:1,entities:'prodi',context:['periode_laporan_id','periode_akademik_id']},
 'pegawai-ringkasan':{version:1,entities:'categories',context:['periode_laporan_id','periode_akademik_id']},
 lulusan:{version:1,entities:'lulusan',context:['periode_laporan_id','periode_akademik_id','cakupan','tahun_lulus','periode_wisuda']},
 prestasi:{version:1,entities:'prodi',context:['periode_laporan_id','tahun']},
 kerjasama:{version:1,entities:'categories',context:['periode_laporan_id','tahun']},
 'produktivitas-dosen':{version:1,entities:'categories',context:['periode_laporan_id','tahun']},
 'pegawai-pergerakan':{version:1,entities:'categories',context:['periode_laporan_id','tahun']}
};
