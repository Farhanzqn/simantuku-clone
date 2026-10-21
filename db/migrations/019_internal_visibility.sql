-- Kebijakan pegawai/tendik wajib login; tidak mengubah revisi data.
INSERT INTO visibilitas_modul(kode_modul,akses)
SELECT kode,'authenticated' FROM unnest(ARRAY[
  'tendik','keuangan','kpi','iku','ami','pegawai-internal','pegawai','formasi','data_quality_flag'
]) AS kode
ON CONFLICT(kode_modul) DO UPDATE SET akses='authenticated';
