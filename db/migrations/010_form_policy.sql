-- Kebijakan formulir; semua domain tetap memerlukan review secara default.
CREATE TABLE definisi_formulir (
 domain text PRIMARY KEY REFERENCES domain_unit(domain),
 role_pengisi text NOT NULL,
 perlu_verifikasi boolean NOT NULL DEFAULT true,
 updated_by bigint REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO definisi_formulir(domain,role_pengisi) SELECT v.domain,v.role_pengisi FROM (VALUES ('mahasiswa-aktif','baa'),
('mahasiswa-baru','ppa'),
('dosen','bsdm'),
('tendik','bsdm'),
('lulusan','baa'),
('tracer','bpka'),
('tracer-ringkasan','bpka'),
('kpi-capaian','prp'),
('kpi-input','prp'),
('mahasiswa-angkatan','baa'),
('pegawai-ringkasan','bsdm'),
('rka-target','prp')) v(domain,role_pengisi) JOIN domain_unit d ON d.domain=v.domain;
CREATE FUNCTION guard_form_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=NULLIF(current_setting('app.user_id',true),'')::bigint AND role='admin' AND aktif) THEN
  RAISE EXCEPTION 'Pengaturan formulir hanya admin' USING ERRCODE='42501';
 END IF;
 IF NEW.domain IS DISTINCT FROM OLD.domain OR NEW.role_pengisi IS DISTINCT FROM OLD.role_pengisi THEN
  RAISE EXCEPTION 'Identitas formulir hanya melalui migration' USING ERRCODE='42501';
 END IF;
 NEW.updated_by=NULLIF(current_setting('app.user_id',true),'')::bigint;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER definisi_formulir_guard BEFORE UPDATE ON definisi_formulir FOR EACH ROW EXECUTE FUNCTION guard_form_policy();
CREATE TRIGGER definisi_formulir_audit AFTER UPDATE ON definisi_formulir FOR EACH ROW EXECUTE FUNCTION audit_change();
GRANT SELECT ON definisi_formulir TO app_user;
GRANT UPDATE(perlu_verifikasi,updated_by) ON definisi_formulir TO app_user;
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
      IF TG_OP<>'INSERT' OR NEW.approved_by<>actor OR NEW.submitted_by IS NOT NULL OR
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
