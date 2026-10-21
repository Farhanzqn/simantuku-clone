-- Kolom workflow eksplisit pada setiap tabel, bukan inheritance tanpa FK.
CREATE TABLE mahasiswa_aktif (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint NOT NULL REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES mahasiswa_aktif(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  prodi_id bigint NOT NULL REFERENCES prodi(id),
  total integer NOT NULL CHECK(total>=0), perempuan integer NOT NULL CHECK(perempuan>=0 AND perempuan<=total),
  status_mhs text NOT NULL DEFAULT 'aktif' CHECK(status_mhs IN ('aktif','cuti','nonaktif')),
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,periode_akademik_id,prodi_id,status_mhs,versi)
);
CREATE UNIQUE INDEX mahasiswa_aktif_current_key ON mahasiswa_aktif (periode_laporan_id,periode_akademik_id,prodi_id,status_mhs) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX mahasiswa_aktif_working_key ON mahasiswa_aktif (periode_laporan_id,periode_akademik_id,prodi_id,status_mhs) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX mahasiswa_aktif_queue_idx ON mahasiswa_aktif(unit_id,status,submitted_at);
CREATE INDEX mahasiswa_aktif_laporan_idx ON mahasiswa_aktif(periode_laporan_id);
CREATE INDEX mahasiswa_aktif_akademik_prodi_idx ON mahasiswa_aktif(periode_akademik_id,prodi_id);
CREATE INDEX mahasiswa_aktif_laporan_prodi_idx ON mahasiswa_aktif(periode_laporan_id,prodi_id);
CREATE TABLE mahasiswa_baru (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint NOT NULL REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES mahasiswa_baru(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  prodi_id bigint NOT NULL REFERENCES prodi(id),
  tahun_masuk integer NOT NULL CHECK(tahun_masuk>=2000), tanggal_snapshot date NOT NULL,
  target integer NOT NULL CHECK(target>=0), realisasi_daftar_ulang integer NOT NULL CHECK(realisasi_daftar_ulang>=0),
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,periode_akademik_id,prodi_id,tahun_masuk,tanggal_snapshot,versi)
);
CREATE UNIQUE INDEX mahasiswa_baru_current_key ON mahasiswa_baru (periode_laporan_id,periode_akademik_id,prodi_id,tahun_masuk,tanggal_snapshot) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX mahasiswa_baru_working_key ON mahasiswa_baru (periode_laporan_id,periode_akademik_id,prodi_id,tahun_masuk,tanggal_snapshot) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX mahasiswa_baru_queue_idx ON mahasiswa_baru(unit_id,status,submitted_at);
CREATE INDEX mahasiswa_baru_laporan_idx ON mahasiswa_baru(periode_laporan_id);
CREATE INDEX mahasiswa_baru_akademik_prodi_idx ON mahasiswa_baru(periode_akademik_id,prodi_id);
CREATE INDEX mahasiswa_baru_laporan_prodi_idx ON mahasiswa_baru(periode_laporan_id,prodi_id);
CREATE TABLE lulusan (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES lulusan(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  prodi_id bigint REFERENCES prodi(id), cakupan text NOT NULL CHECK(cakupan IN ('institusi','prodi')),
  tahun_lulus integer NOT NULL CHECK(tahun_lulus>=2000), periode_wisuda text,
  jumlah integer NOT NULL CHECK(jumlah>=0), ipk_rata numeric(4,2) CHECK(ipk_rata BETWEEN 0 AND 4),
  CHECK ((cakupan='institusi' AND prodi_id IS NULL) OR (cakupan='prodi' AND prodi_id IS NOT NULL AND periode_akademik_id IS NOT NULL)),
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,periode_akademik_id,cakupan,prodi_id,tahun_lulus,periode_wisuda,versi)
);
CREATE UNIQUE INDEX lulusan_current_key ON lulusan (periode_laporan_id,periode_akademik_id,cakupan,prodi_id,tahun_lulus,periode_wisuda) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX lulusan_working_key ON lulusan (periode_laporan_id,periode_akademik_id,cakupan,prodi_id,tahun_lulus,periode_wisuda) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX lulusan_queue_idx ON lulusan(unit_id,status,submitted_at);
CREATE INDEX lulusan_laporan_idx ON lulusan(periode_laporan_id);
CREATE INDEX lulusan_akademik_prodi_idx ON lulusan(periode_akademik_id,prodi_id);
CREATE INDEX lulusan_laporan_prodi_idx ON lulusan(periode_laporan_id,prodi_id);
CREATE TABLE dosen_prodi (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint NOT NULL REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES dosen_prodi(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  prodi_id bigint NOT NULL REFERENCES prodi(id),
  total integer NOT NULL CHECK(total>=0), perempuan integer NOT NULL CHECK(perempuan>=0 AND perempuan<=total),
  s3 integer NOT NULL CHECK(s3>=0 AND s3<=total),
  tenaga_pengajar integer NOT NULL CHECK(tenaga_pengajar>=0), asisten_ahli integer NOT NULL CHECK(asisten_ahli>=0),
  lektor integer NOT NULL CHECK(lektor>=0), lektor_kepala integer NOT NULL CHECK(lektor_kepala>=0), guru_besar integer NOT NULL CHECK(guru_besar>=0),
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,periode_akademik_id,prodi_id,versi)
);
CREATE UNIQUE INDEX dosen_prodi_current_key ON dosen_prodi (periode_laporan_id,periode_akademik_id,prodi_id) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX dosen_prodi_working_key ON dosen_prodi (periode_laporan_id,periode_akademik_id,prodi_id) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX dosen_prodi_queue_idx ON dosen_prodi(unit_id,status,submitted_at);
CREATE INDEX dosen_prodi_laporan_idx ON dosen_prodi(periode_laporan_id);
CREATE INDEX dosen_prodi_akademik_prodi_idx ON dosen_prodi(periode_akademik_id,prodi_id);
CREATE INDEX dosen_prodi_laporan_prodi_idx ON dosen_prodi(periode_laporan_id,prodi_id);
CREATE TABLE tendik_prodi (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint NOT NULL REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES tendik_prodi(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  prodi_id bigint NOT NULL REFERENCES prodi(id), laki integer NOT NULL CHECK(laki>=0), perempuan integer NOT NULL CHECK(perempuan>=0),
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,periode_akademik_id,prodi_id,versi)
);
CREATE UNIQUE INDEX tendik_prodi_current_key ON tendik_prodi (periode_laporan_id,periode_akademik_id,prodi_id) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX tendik_prodi_working_key ON tendik_prodi (periode_laporan_id,periode_akademik_id,prodi_id) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX tendik_prodi_queue_idx ON tendik_prodi(unit_id,status,submitted_at);
CREATE INDEX tendik_prodi_laporan_idx ON tendik_prodi(periode_laporan_id);
CREATE INDEX tendik_prodi_akademik_prodi_idx ON tendik_prodi(periode_akademik_id,prodi_id);
CREATE INDEX tendik_prodi_laporan_prodi_idx ON tendik_prodi(periode_laporan_id,prodi_id);
CREATE TABLE tracer_study (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES tracer_study(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  prodi_id bigint NOT NULL REFERENCES prodi(id), tahun_lulus integer NOT NULL CHECK(tahun_lulus>=2000),
  jumlah_lulusan integer CHECK(jumlah_lulusan>=0), responden integer CHECK(responden>=0),
  kerja_kurang_3_bulan integer CHECK(kerja_kurang_3_bulan>=0), kerja_lebih_3_bulan integer CHECK(kerja_lebih_3_bulan>=0),
  sesuai_bidang integer CHECK(sesuai_bidang>=0), wirausaha integer CHECK(wirausaha>=0), studi_lanjut integer CHECK(studi_lanjut>=0),
  CHECK(responden IS NULL OR jumlah_lulusan IS NULL OR responden<=jumlah_lulusan),
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,prodi_id,tahun_lulus,versi)
);
CREATE UNIQUE INDEX tracer_study_current_key ON tracer_study (periode_laporan_id,prodi_id,tahun_lulus) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX tracer_study_working_key ON tracer_study (periode_laporan_id,prodi_id,tahun_lulus) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX tracer_study_queue_idx ON tracer_study(unit_id,status,submitted_at);
CREATE INDEX tracer_study_laporan_idx ON tracer_study(periode_laporan_id);
CREATE INDEX tracer_study_akademik_prodi_idx ON tracer_study(periode_akademik_id,prodi_id);
CREATE INDEX tracer_study_laporan_prodi_idx ON tracer_study(periode_laporan_id,prodi_id);
CREATE TABLE tracer_ringkasan (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES tracer_ringkasan(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  tahun_lulus integer NOT NULL CHECK(tahun_lulus>=2000),
  lulusan_institusi_id bigint NOT NULL REFERENCES lulusan(id), responden integer NOT NULL CHECK(responden>=0),
  kerja_kurang_3_bulan_sumber integer CHECK(kerja_kurang_3_bulan_sumber>=0), kerja_lebih_3_bulan_sumber integer CHECK(kerja_lebih_3_bulan_sumber>=0),
  sesuai_bidang_sumber integer CHECK(sesuai_bidang_sumber>=0), wirausaha_sumber integer CHECK(wirausaha_sumber>=0), studi_lanjut_sumber integer CHECK(studi_lanjut_sumber>=0),
  data_sementara boolean NOT NULL DEFAULT true,
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,tahun_lulus,versi)
);
CREATE UNIQUE INDEX tracer_ringkasan_current_key ON tracer_ringkasan (periode_laporan_id,tahun_lulus) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX tracer_ringkasan_working_key ON tracer_ringkasan (periode_laporan_id,tahun_lulus) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX tracer_ringkasan_queue_idx ON tracer_ringkasan(unit_id,status,submitted_at);
CREATE INDEX tracer_ringkasan_laporan_idx ON tracer_ringkasan(periode_laporan_id);
CREATE TABLE kpi_capaian (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES kpi_capaian(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  indikator_id bigint NOT NULL REFERENCES kpi_indikator(id), tanggal_snapshot date NOT NULL,
  nilai_numerik numeric(24,6) CHECK(nilai_numerik>=0), nilai_teks text, nilai_tanggal date,
  basis_nilai text NOT NULL DEFAULT 'actual' CHECK(basis_nilai IN ('actual','reported_percent')),
  metrik_tambahan jsonb NOT NULL DEFAULT '{}', catatan text,
  CHECK(num_nonnulls(nilai_numerik,nilai_teks,nilai_tanggal)<=1),
  CHECK(basis_nilai<>'reported_percent' OR nilai_numerik IS NOT NULL),
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,indikator_id,tanggal_snapshot,versi)
);
CREATE UNIQUE INDEX kpi_capaian_current_key ON kpi_capaian (periode_laporan_id,indikator_id,tanggal_snapshot) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX kpi_capaian_working_key ON kpi_capaian (periode_laporan_id,indikator_id,tanggal_snapshot) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX kpi_capaian_queue_idx ON kpi_capaian(unit_id,status,submitted_at);
CREATE INDEX kpi_capaian_laporan_idx ON kpi_capaian(periode_laporan_id);
CREATE TABLE kpi_input (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),
  periode_akademik_id bigint REFERENCES periode_akademik(id),
  unit_id bigint NOT NULL REFERENCES unit(id),
  versi integer NOT NULL DEFAULT 1 CHECK(versi>0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  is_current_approved boolean NOT NULL DEFAULT false,
  previous_approved_id bigint REFERENCES kpi_input(id),
  submitted_by bigint REFERENCES users(id), submitted_at timestamptz,
  approved_by bigint REFERENCES users(id), approved_at timestamptz,
  reviewed_by bigint REFERENCES users(id), reviewed_at timestamptz, review_note text,
  created_by bigint NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
  sumber_id bigint REFERENCES sumber_data(id), sumber text,
  indikator_id bigint NOT NULL REFERENCES kpi_indikator(id), kode_input text NOT NULL,
  nilai_numerik numeric(24,6) CHECK(nilai_numerik>=0), satuan text NOT NULL, tanggal_snapshot date NOT NULL,
  CHECK(NOT is_current_approved OR status='approved'),
  CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),
  CHECK((approved_by IS NULL)=(approved_at IS NULL)),
  CHECK(status<>'submitted' OR submitted_by IS NOT NULL),
  CHECK(status<>'approved' OR (approved_by IS NOT NULL AND sumber_id IS NOT NULL)),
  CHECK(status='approved' OR approved_by IS NULL),
  CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
  UNIQUE NULLS NOT DISTINCT(periode_laporan_id,indikator_id,kode_input,tanggal_snapshot,versi)
);
CREATE UNIQUE INDEX kpi_input_current_key ON kpi_input (periode_laporan_id,indikator_id,kode_input,tanggal_snapshot) NULLS NOT DISTINCT WHERE is_current_approved;
CREATE UNIQUE INDEX kpi_input_working_key ON kpi_input (periode_laporan_id,indikator_id,kode_input,tanggal_snapshot) NULLS NOT DISTINCT WHERE status IN ('draft','submitted','rejected');
CREATE INDEX kpi_input_queue_idx ON kpi_input(unit_id,status,submitted_at);
CREATE INDEX kpi_input_laporan_idx ON kpi_input(periode_laporan_id);

