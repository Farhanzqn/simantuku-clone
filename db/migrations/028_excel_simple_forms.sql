-- E2: extend audit allowlist only; preserve actor, payload and privilege guards.
CREATE OR REPLACE FUNCTION record_form_excel_event(action text,metadata jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE k text; v jsonb; actor bigint;
BEGIN
 IF action IS NULL OR action NOT IN ('template_download','template_upload','template_apply','template_cancel') OR
 metadata IS NULL OR jsonb_typeof(metadata)<>'object' OR octet_length(metadata::text)>2048 THEN
 RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
 IF NOT (metadata ?& ARRAY['form','periode','version','schema_hash','result']) OR
 jsonb_typeof(metadata->'form')<>'string' OR (metadata->>'form') NOT IN ('mahasiswa-aktif','formasi','mahasiswa-baru','tendik','pegawai-ringkasan','lulusan','prestasi','kerjasama','produktivitas-dosen','pegawai-pergerakan') OR
 jsonb_typeof(metadata->'version')<>'number' OR (metadata->>'version') !~ '^[1-9][0-9]{0,3}$' OR
 jsonb_typeof(metadata->'schema_hash')<>'string' OR (metadata->>'schema_hash') !~ '^[0-9a-f]{64}$' OR
 jsonb_typeof(metadata->'periode')<>'object' OR jsonb_typeof(metadata->'result')<>'string' OR
 (metadata->>'result') NOT IN ('generated','preview','rejected','draft','cancelled') THEN
 RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
 IF (action='template_download' AND metadata->>'result'<>'generated') OR
 (action='template_upload' AND metadata->>'result' NOT IN ('preview','rejected')) OR
 (action='template_apply' AND metadata->>'result'<>'draft') OR
 (action='template_cancel' AND metadata->>'result'<>'cancelled') THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(metadata) LOOP
  IF k NOT IN ('form','periode','version','schema_hash','rows','valid','errors','warnings','overwritten_cells','result') THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
  IF k IN ('rows','valid','errors','warnings','overwritten_cells') AND (jsonb_typeof(v)<>'number' OR v::text !~ '^[0-9]{1,6}$') THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
 END LOOP;
 IF NOT ((metadata->'periode') ? 'periode_laporan_id') THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(metadata->'periode') LOOP
  IF k='status_mhs' THEN
   IF jsonb_typeof(v)<>'string' OR v#>>'{}' NOT IN ('aktif','cuti','nonaktif') THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
  ELSIF k='cakupan' AND metadata->>'form'='lulusan' THEN
   IF jsonb_typeof(v)<>'string' OR v#>>'{}' NOT IN ('institusi','prodi') THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
  ELSIF k='periode_wisuda_hash' AND metadata->>'form'='lulusan' THEN
   IF jsonb_typeof(v)<>'string' OR v#>>'{}' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
  ELSIF k='tanggal_snapshot' AND metadata->>'form'='mahasiswa-baru' THEN
   IF jsonb_typeof(v)<>'string' OR v#>>'{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
  ELSIF k='periode_akademik_id' AND v='null'::jsonb AND metadata->>'form'='lulusan' AND metadata->'periode'->>'cakupan'='institusi' THEN
   NULL;
  ELSIF k IN ('periode_laporan_id','periode_akademik_id','tahun','tahun_masuk','tahun_lulus') THEN
   IF jsonb_typeof(v)<>'number' OR v::text !~ '^[1-9][0-9]{0,15}$' THEN RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
  ELSE RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
 END LOOP;
 actor=NULLIF(current_setting('app.user_id',true),'')::bigint;
 IF NOT EXISTS(SELECT 1 FROM public.users u JOIN public.definisi_formulir f ON f.domain=metadata->>'form'
 JOIN public.domain_unit d ON d.domain=f.domain WHERE u.id=actor AND u.aktif AND NOT u.is_system
 AND (u.role='admin' OR (u.role=f.role_pengisi AND u.unit_id=d.unit_id))) THEN RAISE EXCEPTION 'Aktor audit template tidak valid' USING ERRCODE='42501'; END IF;
 INSERT INTO public.audit_log(user_id,aksi,tabel,request_id,nilai_baru) VALUES(actor,action,'form_excel',NULLIF(current_setting('app.request_id',true),''),metadata);
END $$;
REVOKE EXECUTE ON FUNCTION record_form_excel_event(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_form_excel_event(text,jsonb) TO app_user;
