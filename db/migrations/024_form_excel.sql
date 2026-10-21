-- Preview terstruktur sementara; tidak menyimpan berkas XLSX mentah.
CREATE TABLE form_upload_preview (
 id uuid PRIMARY KEY,user_id bigint NOT NULL REFERENCES users(id),domain text NOT NULL REFERENCES domain_unit(domain),
 context jsonb NOT NULL,schema_hash text NOT NULL,rows jsonb NOT NULL,issues jsonb NOT NULL,
 snapshot jsonb NOT NULL,status text NOT NULL DEFAULT 'preview' CHECK(status IN ('preview','applied','expired')),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes'
);
CREATE INDEX form_upload_preview_owner ON form_upload_preview(user_id,domain,status);
GRANT SELECT,INSERT,UPDATE ON form_upload_preview TO app_user;
CREATE FUNCTION record_form_excel_event(action text,metadata jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF action NOT IN ('template_download','template_upload','template_apply') OR jsonb_typeof(metadata)<>'object' OR
 EXISTS(SELECT 1 FROM jsonb_object_keys(metadata) k WHERE k NOT IN ('form','periode','version','schema_hash','rows','valid','errors','warnings','overwritten_cells','result')) THEN
  RAISE EXCEPTION 'Metadata audit template tidak valid';
 END IF;
 INSERT INTO public.audit_log(user_id,aksi,tabel,request_id,nilai_baru) VALUES(
 NULLIF(current_setting('app.user_id',true),'')::bigint,action,'form_excel',NULLIF(current_setting('app.request_id',true),''),metadata);
END $$;
REVOKE EXECUTE ON FUNCTION record_form_excel_event(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_form_excel_event(text,jsonb) TO app_user;
