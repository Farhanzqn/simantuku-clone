-- Pembatalan logis; indeks working existing mengecualikan discarded. Tidak mengubah approved.
DO $$ DECLARE t text; c record; BEGIN
 FOREACH t IN ARRAY ARRAY['mahasiswa_aktif','mahasiswa_baru','dosen_prodi','tendik_prodi','lulusan','tracer_study','tracer_ringkasan','kpi_capaian','kpi_input','mahasiswa_angkatan','pegawai_ringkasan','rka_revisi','akreditasi_revisi','penelitian_revisi','hki_revisi','pkm_revisi','prestasi_revisi','kerjasama_revisi','produktivitas_dosen_revisi','ami_revisi','keuangan_revisi','formasi_revisi','pergerakan_pegawai_revisi'] LOOP
  FOR c IN SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint
   WHERE conrelid=t::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%draft%submitted%approved%rejected%'
  LOOP
   EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',t,c.conname);
   EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s',t,c.conname,replace(c.definition,'''rejected''::text','''rejected''::text, ''discarded''::text'));
  END LOOP;
 END LOOP;
END $$;
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
      IF TG_OP='UPDATE' AND domain_name IN ('akreditasi','penelitian','hki','pkm','prestasi','kerjasama','produktivitas-dosen','ami','keuangan','formasi','pegawai-pergerakan') AND current_user<>'app_user'
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

CREATE OR REPLACE FUNCTION audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_value jsonb; new_value jsonb; actor bigint; override_value boolean;
BEGIN
  IF TG_OP<>'INSERT' THEN old_value=to_jsonb(OLD); END IF;
  IF TG_OP<>'DELETE' THEN new_value=to_jsonb(NEW); END IF;
  IF current_setting('app.action',true)='draft_discard' AND old_value->>'status'='draft' AND new_value->>'status'='discarded' THEN
    old_value=jsonb_build_object('id',old_value->'id','status','draft','periode_laporan_id',old_value->'periode_laporan_id');
    new_value=jsonb_build_object('id',new_value->'id','status','discarded','periode_laporan_id',new_value->'periode_laporan_id',
      'form',current_setting('app.discard_form',true),'jumlah_baris',current_setting('app.discard_count',true)::integer);
  END IF;
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
