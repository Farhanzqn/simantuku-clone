-- Akreditasi: realisasi, bukan target Tabel 4.18. NULL berarti belum tersedia.
CREATE TABLE akreditasi_revisi (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 periode_laporan_id bigint NOT NULL REFERENCES periode_laporan(id),periode_akademik_id bigint REFERENCES periode_akademik(id),unit_id bigint NOT NULL REFERENCES unit(id),
 butir text NOT NULL CHECK(length(trim(butir)) BETWEEN 1 AND 200),
 cakupan text NOT NULL CHECK(cakupan IN ('institusi','prodi','internasional')),prodi_id bigint REFERENCES prodi(id),
 nama_sumber text NOT NULL,jenjang text CHECK(jenjang IN ('D3','S1','S2','PROFESI')),
 peringkat text,nomor_sk text,lembaga text,berlaku_mulai date,berlaku_sampai date,status_sumber text,
 versi integer NOT NULL DEFAULT 1 CHECK(versi>0),status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
 is_current_approved boolean NOT NULL DEFAULT false,previous_approved_id bigint REFERENCES akreditasi_revisi(id),
 submitted_by bigint REFERENCES users(id),submitted_at timestamptz,approved_by bigint REFERENCES users(id),approved_at timestamptz,
 reviewed_by bigint REFERENCES users(id),reviewed_at timestamptz,review_note text,created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),row_version integer NOT NULL DEFAULT 1,
 sumber_id bigint NOT NULL REFERENCES sumber_data(id),sumber text NOT NULL,
 CHECK(NOT is_current_approved OR status='approved'),CHECK(status<>'submitted' OR submitted_by IS NOT NULL),CHECK(status<>'approved' OR approved_by IS NOT NULL),
 CHECK((submitted_by IS NULL)=(submitted_at IS NULL)),CHECK((approved_by IS NULL)=(approved_at IS NULL)),CHECK(status='approved' OR approved_by IS NULL),
 CHECK(status<>'rejected' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_note IS NOT NULL AND length(trim(review_note))>0)),
 UNIQUE(periode_laporan_id,butir,versi)
);
CREATE UNIQUE INDEX akreditasi_revisi_current ON akreditasi_revisi(periode_laporan_id,butir) WHERE is_current_approved;
CREATE UNIQUE INDEX akreditasi_revisi_working ON akreditasi_revisi(periode_laporan_id,butir) WHERE status IN ('draft','submitted','rejected');
CREATE TRIGGER akreditasi_revisi_workflow BEFORE INSERT OR UPDATE ON akreditasi_revisi FOR EACH ROW EXECUTE FUNCTION guard_workflow('akreditasi');
CREATE TRIGGER akreditasi_revisi_audit AFTER INSERT OR UPDATE OR DELETE ON akreditasi_revisi FOR EACH ROW EXECUTE FUNCTION audit_change();
GRANT SELECT,INSERT,UPDATE ON akreditasi_revisi TO app_user;
GRANT USAGE ON SEQUENCE akreditasi_revisi_id_seq TO app_user;

CREATE VIEW v_dashboard_akreditasi AS SELECT d.id,d.butir,d.cakupan,d.prodi_id,p.kode AS prodi_kode,p.nama AS prodi_nama,d.nama_sumber,d.jenjang,d.peringkat,d.nomor_sk,d.lembaga,d.berlaku_mulai,d.berlaku_sampai,d.status_sumber,d.periode_laporan_id,l.kode AS periode_laporan_kode,d.sumber_id,d.sumber FROM akreditasi_revisi d LEFT JOIN prodi p ON p.id=d.prodi_id JOIN periode_laporan l ON l.id=d.periode_laporan_id WHERE d.status='approved' AND d.is_current_approved;
GRANT SELECT ON v_dashboard_akreditasi TO app_user;
INSERT INTO visibilitas_modul(kode_modul,akses,aktif) VALUES('akreditasi','public',true) ON CONFLICT(kode_modul) DO NOTHING;
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
      (OLD.status='draft' AND NEW.status='submitted') OR
      (OLD.status='rejected' AND NEW.status='draft') OR
      (OLD.status='submitted' AND NEW.status IN ('approved','rejected'))
    ) THEN RAISE EXCEPTION 'Transisi status tidak sah' USING ERRCODE='23514'; END IF;
    NEW.row_version=OLD.row_version+1;
  ELSIF NEW.status<>'draft' AND NOT (NEW.status='approved' AND actor_role='system') THEN
    RAISE EXCEPTION 'Data baru harus draft kecuali seed' USING ERRCODE='23514';
  END IF;
  IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF actor_role='system' THEN
      IF TG_OP='UPDATE' AND domain_name='akreditasi' AND current_user<>'app_user'
        AND current_setting('app.action',true)='seed_approved' AND OLD.status='submitted'
        AND NEW.versi=1 AND NEW.previous_approved_id IS NULL AND NEW.submitted_by=actor
        AND NEW.approved_by=actor AND NEW.review_note='Seed laporan v1'
        AND NEW.sumber='Laporan Manajemen ITPLN Semester I 2026'
        AND EXISTS(SELECT 1 FROM users WHERE id=actor AND is_system AND NOT aktif AND nama='seed') THEN
        NULL; -- Seed baru mengikuti draft -> submitted -> approved, owner-only.
      ELSIF TG_OP<>'INSERT' OR NEW.approved_by<>actor OR NEW.submitted_by IS NOT NULL OR
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
