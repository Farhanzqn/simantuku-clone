-- Tambahan sumber dashboard Fase 3. Migration sebelumnya dipertahankan.
ALTER TABLE data_quality_flag ADD COLUMN catatan_publik text;
ALTER TABLE domain_unit DROP CONSTRAINT domain_unit_domain_check;
ALTER TABLE domain_unit ADD CONSTRAINT domain_unit_domain_check CHECK(domain IN ('mahasiswa-aktif','mahasiswa-baru','lulusan','dosen','tendik','tracer','tracer-ringkasan','kpi-capaian','kpi-input','rka-target','keuangan','penelitian','hki','pkm','kerjasama','akreditasi','ami','prestasi','mahasiswa-angkatan','pegawai-ringkasan'));
INSERT INTO domain_unit(domain,unit_id) SELECT 'mahasiswa-angkatan',id FROM unit WHERE kode='BAA';
INSERT INTO domain_unit(domain,unit_id) SELECT 'pegawai-ringkasan',id FROM unit WHERE kode='BSDM';
INSERT INTO visibilitas_modul(kode_modul,akses,aktif) VALUES('pegawai-publik','public',true),('pegawai-internal','authenticated',true);

CREATE TABLE mahasiswa_angkatan (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id), periode_akademik_id bigint NOT NULL REFERENCES periode_akademik(id), unit_id bigint NOT NULL REFERENCES unit(id),
 versi integer NOT NULL DEFAULT 1 CHECK(versi>0), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
 is_current_approved boolean NOT NULL DEFAULT false, previous_approved_id bigint REFERENCES mahasiswa_angkatan(id),
 submitted_by bigint REFERENCES users(id),submitted_at timestamptz,approved_by bigint REFERENCES users(id),approved_at timestamptz,
 reviewed_by bigint REFERENCES users(id),reviewed_at timestamptz,review_note text,created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
 sumber_id bigint NOT NULL REFERENCES sumber_data(id),sumber text NOT NULL,
 prodi_id bigint NOT NULL REFERENCES prodi(id), angkatan integer NOT NULL CHECK(angkatan BETWEEN 2000 AND 2200), total integer NOT NULL CHECK(total>=0),
 CHECK(NOT is_current_approved OR status='approved'),CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),CHECK((approved_by IS NULL)=(approved_at IS NULL)),
 CHECK(status<>'submitted' OR submitted_by IS NOT NULL),CHECK(status<>'approved' OR approved_by IS NOT NULL),CHECK(status='approved' OR approved_by IS NULL),
 CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND length(trim(review_note))>0)),UNIQUE(periode_laporan_id,periode_akademik_id,prodi_id,angkatan,versi)
);
CREATE UNIQUE INDEX mahasiswa_angkatan_current_key ON mahasiswa_angkatan(periode_laporan_id,periode_akademik_id,prodi_id,angkatan) WHERE is_current_approved;
CREATE UNIQUE INDEX mahasiswa_angkatan_working_key ON mahasiswa_angkatan(periode_laporan_id,periode_akademik_id,prodi_id,angkatan) WHERE status IN ('draft','submitted','rejected');
CREATE INDEX mahasiswa_angkatan_queue_idx ON mahasiswa_angkatan(unit_id,status,submitted_at);
CREATE TRIGGER mahasiswa_angkatan_workflow BEFORE INSERT OR UPDATE ON mahasiswa_angkatan FOR EACH ROW EXECUTE FUNCTION guard_workflow('mahasiswa-angkatan');
CREATE TRIGGER mahasiswa_angkatan_audit AFTER INSERT OR UPDATE OR DELETE ON mahasiswa_angkatan FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE VIEW v_dashboard_mahasiswa_angkatan AS SELECT d.*,a.kode AS periode_akademik_kode,a.tahun_ajaran,a.semester AS semester_akademik,l.kode AS periode_laporan_kode ,p.kode AS prodi_kode,p.nama AS prodi_nama,p.jenjang
 FROM mahasiswa_angkatan d JOIN periode_akademik a ON a.id=d.periode_akademik_id JOIN periode_laporan l ON l.id=d.periode_laporan_id JOIN prodi p ON p.id=d.prodi_id WHERE d.status='approved' AND d.is_current_approved;
GRANT SELECT,INSERT,UPDATE ON mahasiswa_angkatan TO app_user;
GRANT SELECT ON v_dashboard_mahasiswa_angkatan TO app_user;
GRANT USAGE ON SEQUENCE mahasiswa_angkatan_id_seq TO app_user;

CREATE TABLE pegawai_ringkasan (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id), periode_akademik_id bigint NOT NULL REFERENCES periode_akademik(id), unit_id bigint NOT NULL REFERENCES unit(id),
 versi integer NOT NULL DEFAULT 1 CHECK(versi>0), status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
 is_current_approved boolean NOT NULL DEFAULT false, previous_approved_id bigint REFERENCES pegawai_ringkasan(id),
 submitted_by bigint REFERENCES users(id),submitted_at timestamptz,approved_by bigint REFERENCES users(id),approved_at timestamptz,
 reviewed_by bigint REFERENCES users(id),reviewed_at timestamptz,review_note text,created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),row_version integer NOT NULL DEFAULT 1 CHECK(row_version>0),
 sumber_id bigint NOT NULL REFERENCES sumber_data(id),sumber text NOT NULL,
 kategori text NOT NULL CHECK(kategori IN ('dosen_tetap','dosen_tidak_tetap','tendik','pkwt')), jumlah integer NOT NULL CHECK(jumlah>=0),
 CHECK(NOT is_current_approved OR status='approved'),CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),CHECK((approved_by IS NULL)=(approved_at IS NULL)),
 CHECK(status<>'submitted' OR submitted_by IS NOT NULL),CHECK(status<>'approved' OR approved_by IS NOT NULL),CHECK(status='approved' OR approved_by IS NULL),
 CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND length(trim(review_note))>0)),UNIQUE(periode_laporan_id,periode_akademik_id,kategori,versi)
);
CREATE UNIQUE INDEX pegawai_ringkasan_current_key ON pegawai_ringkasan(periode_laporan_id,periode_akademik_id,kategori) WHERE is_current_approved;
CREATE UNIQUE INDEX pegawai_ringkasan_working_key ON pegawai_ringkasan(periode_laporan_id,periode_akademik_id,kategori) WHERE status IN ('draft','submitted','rejected');
CREATE INDEX pegawai_ringkasan_queue_idx ON pegawai_ringkasan(unit_id,status,submitted_at);
CREATE TRIGGER pegawai_ringkasan_workflow BEFORE INSERT OR UPDATE ON pegawai_ringkasan FOR EACH ROW EXECUTE FUNCTION guard_workflow('pegawai-ringkasan');
CREATE TRIGGER pegawai_ringkasan_audit AFTER INSERT OR UPDATE OR DELETE ON pegawai_ringkasan FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE VIEW v_dashboard_pegawai_ringkasan AS SELECT d.*,a.kode AS periode_akademik_kode,a.tahun_ajaran,a.semester AS semester_akademik,l.kode AS periode_laporan_kode 
 FROM pegawai_ringkasan d JOIN periode_akademik a ON a.id=d.periode_akademik_id JOIN periode_laporan l ON l.id=d.periode_laporan_id  WHERE d.status='approved' AND d.is_current_approved;
GRANT SELECT,INSERT,UPDATE ON pegawai_ringkasan TO app_user;
GRANT SELECT ON v_dashboard_pegawai_ringkasan TO app_user;
GRANT USAGE ON SEQUENCE pegawai_ringkasan_id_seq TO app_user;
