CREATE TABLE seed_runs (
  kode text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now(), user_id bigint NOT NULL REFERENCES users(id)
);

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;

CREATE FUNCTION audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_value jsonb; new_value jsonb; actor bigint; override_value boolean;
BEGIN
  IF TG_OP<>'INSERT' THEN old_value=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN new_value=to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME='users' THEN
    old_value=old_value - 'password_hash'; new_value=new_value - 'password_hash';
  END IF;
  actor=NULLIF(current_setting('app.user_id',true),'')::bigint;
  override_value=coalesce(NULLIF(current_setting('app.is_override',true),''),'false')::boolean;
  IF override_value AND NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND role='admin' AND aktif) THEN
    RAISE EXCEPTION 'Override hanya admin' USING ERRCODE='42501';
  END IF;
  INSERT INTO audit_log(user_id,aksi,tabel,row_id,nilai_lama,nilai_baru,request_id,is_override,override_reason)
  VALUES(actor,coalesce(NULLIF(current_setting('app.action',true),''),lower(TG_OP)),TG_TABLE_NAME,
    coalesce(new_value->>'id',old_value->>'id',new_value->>'domain',old_value->>'domain',new_value->>'kode',old_value->>'kode'),
    old_value,new_value,NULLIF(current_setting('app.request_id',true),''),override_value,
    NULLIF(current_setting('app.override_reason',true),''));
  RETURN coalesce(NEW,OLD);
END $$;

CREATE FUNCTION audit_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit log append-only' USING ERRCODE='42501'; END $$;
CREATE TRIGGER audit_no_change BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION audit_append_only();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION audit_append_only();

CREATE FUNCTION guard_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
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
CREATE TRIGGER mahasiswa_aktif_workflow BEFORE INSERT OR UPDATE ON mahasiswa_aktif FOR EACH ROW EXECUTE FUNCTION guard_workflow('mahasiswa-aktif');
CREATE TRIGGER mahasiswa_aktif_audit AFTER INSERT OR UPDATE OR DELETE ON mahasiswa_aktif FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER mahasiswa_baru_workflow BEFORE INSERT OR UPDATE ON mahasiswa_baru FOR EACH ROW EXECUTE FUNCTION guard_workflow('mahasiswa-baru');
CREATE TRIGGER mahasiswa_baru_audit AFTER INSERT OR UPDATE OR DELETE ON mahasiswa_baru FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER lulusan_workflow BEFORE INSERT OR UPDATE ON lulusan FOR EACH ROW EXECUTE FUNCTION guard_workflow('lulusan');
CREATE TRIGGER lulusan_audit AFTER INSERT OR UPDATE OR DELETE ON lulusan FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER dosen_prodi_workflow BEFORE INSERT OR UPDATE ON dosen_prodi FOR EACH ROW EXECUTE FUNCTION guard_workflow('dosen');
CREATE TRIGGER dosen_prodi_audit AFTER INSERT OR UPDATE OR DELETE ON dosen_prodi FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tendik_prodi_workflow BEFORE INSERT OR UPDATE ON tendik_prodi FOR EACH ROW EXECUTE FUNCTION guard_workflow('tendik');
CREATE TRIGGER tendik_prodi_audit AFTER INSERT OR UPDATE OR DELETE ON tendik_prodi FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tracer_study_workflow BEFORE INSERT OR UPDATE ON tracer_study FOR EACH ROW EXECUTE FUNCTION guard_workflow('tracer');
CREATE TRIGGER tracer_study_audit AFTER INSERT OR UPDATE OR DELETE ON tracer_study FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER tracer_ringkasan_workflow BEFORE INSERT OR UPDATE ON tracer_ringkasan FOR EACH ROW EXECUTE FUNCTION guard_workflow('tracer-ringkasan');
CREATE TRIGGER tracer_ringkasan_audit AFTER INSERT OR UPDATE OR DELETE ON tracer_ringkasan FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER kpi_capaian_workflow BEFORE INSERT OR UPDATE ON kpi_capaian FOR EACH ROW EXECUTE FUNCTION guard_workflow('kpi-capaian');
CREATE TRIGGER kpi_capaian_audit AFTER INSERT OR UPDATE OR DELETE ON kpi_capaian FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER kpi_input_workflow BEFORE INSERT OR UPDATE ON kpi_input FOR EACH ROW EXECUTE FUNCTION guard_workflow('kpi-input');
CREATE TRIGGER kpi_input_audit AFTER INSERT OR UPDATE OR DELETE ON kpi_input FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER unit_touch BEFORE UPDATE ON unit FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER unit_audit AFTER INSERT OR UPDATE OR DELETE ON unit FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER users_touch BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER users_audit AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER domain_unit_touch BEFORE UPDATE ON domain_unit FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER domain_unit_audit AFTER INSERT OR UPDATE OR DELETE ON domain_unit FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER prodi_touch BEFORE UPDATE ON prodi FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER prodi_audit AFTER INSERT OR UPDATE OR DELETE ON prodi FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER periode_akademik_touch BEFORE UPDATE ON periode_akademik FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER periode_akademik_audit AFTER INSERT OR UPDATE OR DELETE ON periode_akademik FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER periode_laporan_touch BEFORE UPDATE ON periode_laporan FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER periode_laporan_audit AFTER INSERT OR UPDATE OR DELETE ON periode_laporan FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER sumber_data_touch BEFORE UPDATE ON sumber_data FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER sumber_data_audit AFTER INSERT OR UPDATE OR DELETE ON sumber_data FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER visibilitas_modul_touch BEFORE UPDATE ON visibilitas_modul FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER visibilitas_modul_audit AFTER INSERT OR UPDATE OR DELETE ON visibilitas_modul FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER kpi_indikator_touch BEFORE UPDATE ON kpi_indikator FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER kpi_indikator_audit AFTER INSERT OR UPDATE OR DELETE ON kpi_indikator FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER rka_target_touch BEFORE UPDATE ON rka_target FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER rka_target_audit AFTER INSERT OR UPDATE OR DELETE ON rka_target FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER data_quality_flag_touch BEFORE UPDATE ON data_quality_flag FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER data_quality_flag_audit AFTER INSERT OR UPDATE OR DELETE ON data_quality_flag FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER flag_sumber_audit AFTER INSERT OR UPDATE OR DELETE ON data_quality_flag_sumber FOR EACH ROW EXECUTE FUNCTION audit_change();

