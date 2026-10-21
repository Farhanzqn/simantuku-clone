-- Fase 4: formulir parsial mempertahankan NULL, anomali menjadi quality warning.
DO $$ DECLARE t text; c text; r record; BEGIN
 FOR t,c IN SELECT * FROM (VALUES
 ('mahasiswa_aktif','total'),('mahasiswa_aktif','perempuan'),('mahasiswa_baru','target'),('mahasiswa_baru','realisasi_daftar_ulang'),
 ('dosen_prodi','total'),('dosen_prodi','perempuan'),('dosen_prodi','s3'),('dosen_prodi','tenaga_pengajar'),('dosen_prodi','asisten_ahli'),('dosen_prodi','lektor'),('dosen_prodi','lektor_kepala'),('dosen_prodi','guru_besar'),
 ('tendik_prodi','laki'),('tendik_prodi','perempuan'),('lulusan','jumlah'),('mahasiswa_angkatan','total'),('pegawai_ringkasan','jumlah')) x(t,c)
 LOOP EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP NOT NULL',t,c); END LOOP;
 FOR r IN SELECT conrelid::regclass AS t,conname FROM pg_constraint WHERE contype='c' AND conrelid IN ('mahasiswa_aktif'::regclass,'dosen_prodi'::regclass) AND (pg_get_constraintdef(oid) LIKE '%perempuan%total%' OR pg_get_constraintdef(oid) LIKE '%s3%total%')
 LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.t,r.conname); END LOOP;
END $$;
ALTER TABLE mahasiswa_aktif ADD CHECK(perempuan>=0);
ALTER TABLE dosen_prodi ADD CHECK(perempuan>=0), ADD CHECK(s3>=0);
ALTER TABLE lulusan ADD COLUMN masa_studi_rata numeric(5,2) CHECK(masa_studi_rata>=0 AND masa_studi_rata<=100);

-- Target sumber tetap utuh; koreksi target mempunyai workflow tersendiri.
CREATE TABLE rka_revisi (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),periode_akademik_id bigint REFERENCES periode_akademik(id),unit_id bigint NOT NULL REFERENCES unit(id),
 rka_target_id bigint NOT NULL REFERENCES rka_target(id),angka numeric(24,6) CHECK(angka>=0),catatan text,
 versi integer NOT NULL DEFAULT 1 CHECK(versi>0),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
 is_current_approved boolean NOT NULL DEFAULT false,previous_approved_id bigint REFERENCES rka_revisi(id),
 submitted_by bigint REFERENCES users(id),submitted_at timestamptz,approved_by bigint REFERENCES users(id),approved_at timestamptz,
 reviewed_by bigint REFERENCES users(id),reviewed_at timestamptz,review_note text,created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),row_version integer NOT NULL DEFAULT 1,
 sumber_id bigint NOT NULL REFERENCES sumber_data(id),sumber text NOT NULL,
 CHECK(NOT is_current_approved OR status='approved'),CHECK(status<>'submitted' OR submitted_by IS NOT NULL),CHECK(status<>'approved' OR approved_by IS NOT NULL),
 CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),CHECK((approved_by IS NULL)=(approved_at IS NULL)),CHECK(status='approved' OR approved_by IS NULL),
 CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
 UNIQUE(periode_laporan_id,rka_target_id,versi)
);
CREATE UNIQUE INDEX rka_revisi_current ON rka_revisi(periode_laporan_id,rka_target_id) WHERE is_current_approved;
CREATE UNIQUE INDEX rka_revisi_working ON rka_revisi(periode_laporan_id,rka_target_id) WHERE status IN ('draft','submitted','rejected');
CREATE TRIGGER rka_revisi_workflow BEFORE INSERT OR UPDATE ON rka_revisi FOR EACH ROW EXECUTE FUNCTION guard_workflow('rka-target');
CREATE TRIGGER rka_revisi_audit AFTER INSERT OR UPDATE OR DELETE ON rka_revisi FOR EACH ROW EXECUTE FUNCTION audit_change();
GRANT SELECT,INSERT,UPDATE ON rka_revisi TO app_user;
GRANT USAGE ON SEQUENCE rka_revisi_id_seq TO app_user;
-- Kebijakan publikasi Fase 4 yang diminta pengguna; audit mencatat perubahan konfigurasi.
UPDATE visibilitas_modul SET akses=CASE WHEN kode_modul IN ('keuangan','kpi','iku','ami','pegawai-internal','pegawai','formasi','data_quality_flag') THEN 'authenticated' ELSE 'public' END;
INSERT INTO visibilitas_modul(kode_modul,akses) VALUES('pegawai','authenticated'),('formasi','authenticated') ON CONFLICT(kode_modul) DO UPDATE SET akses=EXCLUDED.akses;
