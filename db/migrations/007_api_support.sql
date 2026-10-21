INSERT INTO sumber_data(kode,dokumen,catatan) VALUES('input-unit','Input unit Satu Data ITPLN','Input manual melalui API; aktor/perubahan tercatat audit') ON CONFLICT(kode) DO NOTHING;
ALTER FUNCTION audit_change() SET search_path=pg_catalog,public,pg_temp;
CREATE FUNCTION record_app_event(event_action text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF event_action NOT IN ('logout','import_preview','import_commit') THEN RAISE EXCEPTION 'Aksi audit tidak valid'; END IF;
  INSERT INTO public.audit_log(user_id,aksi,tabel,request_id) VALUES(
    NULLIF(current_setting('app.user_id',true),'')::bigint,event_action,'api',NULLIF(current_setting('app.request_id',true),''));
END $$;
REVOKE EXECUTE ON FUNCTION record_app_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_app_event(text) TO app_user;
