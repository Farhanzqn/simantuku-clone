-- Peminat PMB: satu agregat institusi, terpisah dari daftar ulang per prodi.
ALTER TABLE domain_unit DROP CONSTRAINT domain_unit_domain_check;
ALTER TABLE domain_unit ADD CONSTRAINT domain_unit_domain_check CHECK(domain IN ('mahasiswa-aktif','mahasiswa-baru','lulusan','dosen','tendik','tracer','tracer-ringkasan','kpi-capaian','kpi-input','rka-target','keuangan','penelitian','hki','pkm','kerjasama','akreditasi','ami','prestasi','mahasiswa-angkatan','pegawai-ringkasan','produktivitas-dosen','formasi','pegawai-pergerakan','iku-capaian','pmb-peminat'));
CREATE TABLE pmb_peminat (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),periode_akademik_id bigint NOT NULL REFERENCES periode_akademik(id),unit_id bigint NOT NULL REFERENCES unit(id),
 tahun_masuk integer NOT NULL CHECK(tahun_masuk BETWEEN 2000 AND 2200),tanggal_snapshot date NOT NULL,
 jumlah_peminat integer CHECK(jumlah_peminat>=0),
 versi integer NOT NULL DEFAULT 1 CHECK(versi>0),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected','discarded')),
 is_current_approved boolean NOT NULL DEFAULT false,previous_approved_id bigint REFERENCES pmb_peminat(id),
 submitted_by bigint REFERENCES users(id),submitted_at timestamptz,approved_by bigint REFERENCES users(id),approved_at timestamptz,
 reviewed_by bigint REFERENCES users(id),reviewed_at timestamptz,review_note text,created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),row_version integer NOT NULL DEFAULT 1,
 sumber_id bigint NOT NULL REFERENCES sumber_data(id),sumber text NOT NULL,
 CHECK(NOT is_current_approved OR status='approved'),CHECK(status<>'submitted' OR submitted_by IS NOT NULL),CHECK(status<>'approved' OR approved_by IS NOT NULL),
 CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),CHECK((approved_by IS NULL)=(approved_at IS NULL)),CHECK(status='approved' OR approved_by IS NULL),
 CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
 UNIQUE(periode_laporan_id,periode_akademik_id,tahun_masuk,tanggal_snapshot,versi)
);
CREATE UNIQUE INDEX pmb_peminat_current ON pmb_peminat(periode_laporan_id,periode_akademik_id,tahun_masuk,tanggal_snapshot) WHERE is_current_approved;
CREATE UNIQUE INDEX pmb_peminat_working ON pmb_peminat(periode_laporan_id,periode_akademik_id,tahun_masuk,tanggal_snapshot) WHERE status IN ('draft','submitted','rejected');
CREATE TRIGGER pmb_peminat_workflow BEFORE INSERT OR UPDATE ON pmb_peminat FOR EACH ROW EXECUTE FUNCTION guard_workflow('pmb-peminat');
CREATE TRIGGER pmb_peminat_audit AFTER INSERT OR UPDATE OR DELETE ON pmb_peminat FOR EACH ROW EXECUTE FUNCTION audit_change();
GRANT SELECT,INSERT,UPDATE ON pmb_peminat TO app_user;
GRANT USAGE ON SEQUENCE pmb_peminat_id_seq TO app_user;

CREATE INDEX pmb_peminat_queue ON pmb_peminat(unit_id,status,submitted_at);
CREATE VIEW v_dashboard_pmb_peminat AS
 SELECT d.jumlah_peminat,d.tahun_masuk,d.tanggal_snapshot,d.periode_laporan_id,l.kode AS periode_laporan_kode,
 d.periode_akademik_id,a.kode AS periode_akademik_kode,a.tahun_ajaran,a.semester AS semester_akademik,d.sumber_id,d.sumber
 FROM pmb_peminat d JOIN periode_laporan l ON l.id=d.periode_laporan_id JOIN periode_akademik a ON a.id=d.periode_akademik_id
 WHERE d.status='approved' AND d.is_current_approved;
GRANT SELECT ON v_dashboard_pmb_peminat TO app_user;
INSERT INTO visibilitas_modul(kode_modul,akses,aktif) VALUES('pmb-peminat','public',true) ON CONFLICT DO NOTHING;
CREATE FUNCTION register_pmb_peminat_ppa() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO domain_unit(domain,unit_id) VALUES('pmb-peminat',NEW.id) ON CONFLICT DO NOTHING;
 INSERT INTO definisi_formulir(domain,role_pengisi) VALUES('pmb-peminat','ppa') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER register_pmb_peminat_ppa AFTER INSERT ON unit FOR EACH ROW WHEN (NEW.kode='PPA') EXECUTE FUNCTION register_pmb_peminat_ppa();
INSERT INTO domain_unit(domain,unit_id) SELECT 'pmb-peminat',id FROM unit WHERE kode='PPA' ON CONFLICT DO NOTHING;
INSERT INTO definisi_formulir(domain,role_pengisi) SELECT domain,'ppa' FROM domain_unit WHERE domain='pmb-peminat' ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION guard_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actor bigint; actor_role text; expected_unit bigint; domain_name text;
BEGIN
  actor=NULLIF(current_setting('app.user_id',true),'')::bigint;
  SELECT role INTO actor_role FROM users WHERE id=actor;
  domain_name=TG_ARGV[0];
  SELECT unit_id INTO expected_unit FROM domain_unit WHERE domain=domain_name;
  IF expected_unit IS NULL OR NEW.unit_id<>expected_unit THEN
    RAISE EXCEPTION 'Unit pemilik domain tidak cocok' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status='discarded' THEN RAISE EXCEPTION 'Draft dibatalkan terkunci' USING ERRCODE='23514'; END IF;
    IF NEW.status='discarded' THEN
      IF OLD.status<>'draft' OR current_setting('app.action',true)<>'draft_discard' OR NOT EXISTS(
        SELECT 1 FROM users u JOIN definisi_formulir f ON f.domain=domain_name
        WHERE u.id=actor AND u.aktif AND NOT u.is_system
        AND (u.role='admin' OR (u.role=f.role_pengisi AND u.unit_id=expected_unit))
      ) THEN RAISE EXCEPTION 'Pembatalan hanya draft oleh pemilik' USING ERRCODE='42501'; END IF;
      IF (to_jsonb(NEW)-ARRAY['status','row_version','updated_at']) IS DISTINCT FROM
         (to_jsonb(OLD)-ARRAY['status','row_version','updated_at']) THEN
        RAISE EXCEPTION 'Pembatalan tidak boleh mengubah isi' USING ERRCODE='23514'; END IF;
    END IF;
    IF OLD.status='approved' AND
      (to_jsonb(NEW)-ARRAY['is_current_approved','updated_at','row_version']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['is_current_approved','updated_at','row_version']) THEN
      RAISE EXCEPTION 'Approved harus direvisi, bukan ditimpa' USING ERRCODE='23514';
    END IF;
    IF OLD.status='submitted' AND
      (to_jsonb(NEW)-ARRAY['status','is_current_approved','approved_by','approved_at','reviewed_by','reviewed_at','review_note','updated_at','row_version']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','is_current_approved','approved_by','approved_at','reviewed_by','reviewed_at','review_note','updated_at','row_version']) THEN
      RAISE EXCEPTION 'Payload submitted terkunci' USING ERRCODE='23514';
    END IF;
    IF NEW.status<>OLD.status AND NOT (
      (OLD.status='draft' AND NEW.status IN ('submitted','discarded')) OR
      (OLD.status='rejected' AND NEW.status='draft') OR
      (OLD.status='submitted' AND NEW.status IN ('approved','rejected'))
    ) THEN RAISE EXCEPTION 'Transisi status tidak sah' USING ERRCODE='23514'; END IF;
    NEW.row_version=OLD.row_version+1;
  ELSIF NEW.status<>'draft' AND NOT (NEW.status='approved' AND actor_role='system') THEN
    RAISE EXCEPTION 'Data baru harus draft kecuali seed' USING ERRCODE='23514';
  END IF;
  IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF actor_role='system' THEN
      IF TG_OP='UPDATE' AND domain_name IN ('akreditasi','penelitian','hki','pkm','prestasi','kerjasama','produktivitas-dosen','ami','keuangan','formasi','pegawai-pergerakan','iku-capaian','pmb-peminat') AND current_user<>'app_user'
        AND current_setting('app.action',true)='seed_approved' AND OLD.status='submitted'
        AND NEW.versi=1 AND NEW.previous_approved_id IS NULL AND NEW.submitted_by=actor
        AND NEW.approved_by=actor AND NEW.review_note='Seed laporan v1'
        AND ((domain_name='iku-capaian' AND NEW.sumber='iku.kemdiktisaintek.go.id T2 2026') OR (domain_name<>'iku-capaian' AND NEW.sumber='Laporan Manajemen ITPLN Semester I 2026'))
        AND EXISTS(SELECT 1 FROM users WHERE id=actor AND is_system AND NOT aktif AND nama='seed') THEN
        NULL; -- Seed baru mengikuti draft -> submitted -> approved, owner-only.
      ELSIF domain_name='iku-capaian' OR TG_OP<>'INSERT' OR NEW.approved_by<>actor OR NEW.submitted_by IS NOT NULL OR
        NEW.sumber IS DISTINCT FROM 'Laporan Manajemen ITPLN Semester I 2026' THEN
        RAISE EXCEPTION 'Metadata seed tidak sah' USING ERRCODE='23514';
      END IF;
    ELSIF current_setting('app.action',true)='auto-approved' AND EXISTS(
      SELECT 1 FROM definisi_formulir f JOIN domain_unit du ON du.domain=f.domain JOIN users u ON u.id=actor
      WHERE f.domain=domain_name AND NOT f.perlu_verifikasi AND u.aktif AND NOT u.is_system
      AND (u.role='admin' OR (u.role=f.role_pengisi AND u.unit_id=du.unit_id))
    ) THEN
      IF TG_OP<>'UPDATE' OR OLD.status<>'submitted' OR NEW.submitted_by IS DISTINCT FROM actor
        OR NEW.approved_by IS DISTINCT FROM actor OR NEW.review_note IS DISTINCT FROM 'auto-approved' THEN
        RAISE EXCEPTION 'Metadata auto approval tidak sah' USING ERRCODE='42501';
      END IF;
    ELSE
      IF actor_role NOT IN ('admin','prp') OR actor_role IS NULL OR NEW.approved_by IS DISTINCT FROM actor OR NEW.submitted_by IS NULL THEN
        RAISE EXCEPTION 'Approval hanya verifikator' USING ERRCODE='42501';
      END IF;
      IF NEW.approved_by=NEW.submitted_by AND NOT (
        actor_role='admin' AND coalesce(NULLIF(current_setting('app.is_override',true),''),'false')::boolean
        AND length(trim(coalesce(current_setting('app.override_reason',true),'')))>0
        AND current_setting('app.action',true)='approve_override'
      ) THEN RAISE EXCEPTION 'Four-eyes: pengaju tidak boleh approve sendiri' USING ERRCODE='42501'; END IF;
    END IF;
  END IF;
  NEW.updated_at=now();
  RETURN NEW;
END $$;

