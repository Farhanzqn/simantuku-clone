ALTER TABLE form_upload_preview DROP CONSTRAINT form_upload_preview_status_check;
ALTER TABLE form_upload_preview ADD CONSTRAINT form_upload_preview_status_check CHECK(status IN ('preview','applied','expired','cancelled'));
CREATE INDEX form_upload_preview_expiry ON form_upload_preview(expires_at);
CREATE INDEX form_upload_preview_created ON form_upload_preview(created_at);
CREATE FUNCTION prune_form_upload_previews() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 UPDATE public.form_upload_preview SET rows='[]',issues='[]',snapshot='{}',status=CASE WHEN status='preview' THEN 'expired' ELSE status END
 WHERE id IN (SELECT id FROM public.form_upload_preview WHERE (expires_at<=now() OR status<>'preview') AND
 (rows<>'[]'::jsonb OR issues<>'[]'::jsonb OR snapshot<>'{}'::jsonb OR status='preview') ORDER BY expires_at LIMIT 1000 FOR UPDATE SKIP LOCKED);
 DELETE FROM public.form_upload_preview WHERE id IN
 (SELECT id FROM public.form_upload_preview WHERE created_at<now()-interval '7 days' ORDER BY created_at LIMIT 1000 FOR UPDATE SKIP LOCKED);
END $$;
REVOKE EXECUTE ON FUNCTION prune_form_upload_previews() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prune_form_upload_previews() TO app_user;

CREATE OR REPLACE FUNCTION record_form_excel_event(action text,metadata jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE k text; v jsonb; actor bigint;
BEGIN
 IF action IS NULL OR action NOT IN ('template_download','template_upload','template_apply','template_cancel') OR
 metadata IS NULL OR jsonb_typeof(metadata)<>'object' OR octet_length(metadata::text)>2048 THEN
 RAISE EXCEPTION 'Metadata audit template tidak valid'; END IF;
 IF NOT (metadata ?& ARRAY['form','periode','version','schema_hash','result']) OR
 jsonb_typeof(metadata->'form')<>'string' OR (metadata->>'form') NOT IN ('mahasiswa-aktif','formasi') OR
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
  ELSIF k IN ('periode_laporan_id','periode_akademik_id','tahun') THEN
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
