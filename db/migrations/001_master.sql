CREATE TABLE unit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode text UNIQUE, nama text NOT NULL, aktif boolean NOT NULL DEFAULT true,
  nama_terkonfirmasi boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kode IS NULL OR kode ~ '^[A-Z][A-Z0-9_]*$')
);
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nama text NOT NULL, email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text, role text NOT NULL CHECK (role IN ('admin','viewer','baa','ppa','bsdm','bpka','bku','bkm','lppm','pjm','prp','kerjasama','system')),
  unit_id bigint REFERENCES unit(id), is_system boolean NOT NULL DEFAULT false,
  aktif boolean NOT NULL DEFAULT true, last_login timestamptz,
  must_change_password boolean NOT NULL DEFAULT true, session_version integer NOT NULL DEFAULT 1 CHECK (session_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_system AND role='system' AND NOT aktif AND password_hash IS NULL) OR
    (NOT is_system AND role<>'system' AND password_hash IS NOT NULL)),
  CHECK (role IN ('admin','viewer','system') OR unit_id IS NOT NULL)
);
CREATE INDEX users_unit_idx ON users(unit_id);
CREATE TABLE domain_unit (
  domain text PRIMARY KEY CHECK (domain IN ('mahasiswa-aktif','mahasiswa-baru','lulusan','dosen','tendik','tracer','tracer-ringkasan','kpi-capaian','kpi-input','rka-target','keuangan','penelitian','hki','pkm','kerjasama','akreditasi','ami','prestasi')),
  unit_id bigint NOT NULL REFERENCES unit(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE prodi (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode text NOT NULL UNIQUE, urutan integer NOT NULL UNIQUE CHECK (urutan > 0),
  nama text NOT NULL, jenjang text NOT NULL CHECK (jenjang IN ('D3','S1','S2','PROFESI')),
  kode_dikti text, fakultas text, aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE periode_akademik (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode text NOT NULL UNIQUE, tahun_ajaran text NOT NULL,
  semester text NOT NULL CHECK (semester IN ('Gasal','Genap')),
  urutan integer NOT NULL UNIQUE, mulai date, selesai date, aktif boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mulai IS NULL OR selesai IS NULL OR mulai <= selesai)
);
CREATE UNIQUE INDEX periode_akademik_satu_aktif ON periode_akademik(aktif) WHERE aktif;
CREATE TABLE periode_laporan (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode text NOT NULL UNIQUE, tahun integer NOT NULL CHECK (tahun >= 2000),
  semester text NOT NULL CHECK (semester IN ('S1','S2')),
  mulai date NOT NULL, selesai date NOT NULL, urutan integer NOT NULL UNIQUE, aktif boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (mulai <= selesai), UNIQUE(tahun,semester)
);
CREATE UNIQUE INDEX periode_laporan_satu_aktif ON periode_laporan(aktif) WHERE aktif;
CREATE TABLE sumber_data (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode text NOT NULL UNIQUE, dokumen text NOT NULL, sha256 text,
  nomor_tabel text, halaman_pdf integer CHECK (halaman_pdf > 0), halaman_cetak text,
  rentang_mulai date, rentang_akhir date, catatan text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sha256 IS NULL OR sha256 ~ '^[a-fA-F0-9]{64}$')
);
CREATE TABLE visibilitas_modul (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_modul text NOT NULL UNIQUE,
  akses text NOT NULL CHECK (akses IN ('public','authenticated')), aktif boolean NOT NULL DEFAULT true,
  updated_by bigint REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kpi_indikator (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode text NOT NULL, tahun integer NOT NULL CHECK (tahun >= 2000),
  perspektif text NOT NULL CHECK (perspektif IN ('A','B','C','D')),
  nama text NOT NULL, formula text NOT NULL, bobot numeric(8,2) NOT NULL,
  target_nilai numeric(24,6) CHECK (target_nilai >= 0), target_teks text, target_tanggal date,
  satuan text NOT NULL, jenis text NOT NULL CHECK (jenis IN ('angka','persen','tanggal','indeks')),
  arah text NOT NULL CHECK (arah IN ('higher_is_better','lower_is_better')),
  arah_terkonfirmasi boolean NOT NULL DEFAULT true,
  unit_pemilik_id bigint NOT NULL REFERENCES unit(id), sumber_id bigint NOT NULL REFERENCES sumber_data(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tahun,kode)
);
CREATE TABLE rka_target (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode_item text NOT NULL, item text NOT NULL, angka numeric(24,6) NOT NULL CHECK(angka >= 0),
  satuan text NOT NULL, tahun integer NOT NULL, jenjang text CHECK(jenjang IN ('D3','S1','S2','PROFESI')),
  sumber_id bigint NOT NULL REFERENCES sumber_data(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tahun,kode_item)
);
CREATE TABLE session (
  sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL
);
CREATE INDEX session_expire_idx ON session(expire);
CREATE TABLE audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint REFERENCES users(id), aksi text NOT NULL, tabel text NOT NULL, row_id text,
  nilai_lama jsonb, nilai_baru jsonb, waktu timestamptz NOT NULL DEFAULT now(), request_id text,
  is_override boolean NOT NULL DEFAULT false, override_reason text,
  CHECK (NOT is_override OR (override_reason IS NOT NULL AND length(trim(override_reason)) > 0))
);
CREATE INDEX audit_log_waktu_idx ON audit_log(waktu DESC);
CREATE INDEX audit_log_user_idx ON audit_log(user_id,waktu DESC);
CREATE INDEX audit_log_row_idx ON audit_log(tabel,row_id);
CREATE TABLE data_quality_flag (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kode text NOT NULL UNIQUE, tabel text NOT NULL, row_id bigint,
  unit_id bigint NOT NULL REFERENCES unit(id), sumber_id bigint REFERENCES sumber_data(id),
  pesan text NOT NULL, severity text NOT NULL CHECK(severity IN ('info','warning','error')),
  resolved boolean NOT NULL DEFAULT false, rule_code text NOT NULL, detail jsonb NOT NULL DEFAULT '{}',
  resolved_by bigint REFERENCES users(id), resolved_at timestamptz, resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT resolved OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND length(trim(resolution_note)) > 0))
);
CREATE INDEX quality_unit_status_idx ON data_quality_flag(unit_id,resolved,severity);
CREATE TABLE data_quality_flag_sumber (
  flag_id bigint NOT NULL REFERENCES data_quality_flag(id), sumber_id bigint NOT NULL REFERENCES sumber_data(id),
  nilai_numerik numeric(24,6), satuan text, PRIMARY KEY(flag_id,sumber_id)
);
CREATE TABLE import_batch (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id), unit_id bigint NOT NULL REFERENCES unit(id),
  domain text NOT NULL REFERENCES domain_unit(domain),
  periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id), periode_akademik_id bigint REFERENCES periode_akademik(id),
  tanggal_snapshot date, status text NOT NULL CHECK(status IN ('preview','committed','expired')),
  payload jsonb NOT NULL, hasil_preview jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  CHECK(expires_at > created_at)
);
