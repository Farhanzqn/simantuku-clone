-- app_user retains no direct INSERT privilege on append-only audit_log.
CREATE FUNCTION record_bulk_verification_event(action text,total integer,succeeded integer,skipped integer,failed integer,filters jsonb,reason text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor bigint; k text; v jsonb; event_id bigint;
BEGIN
 actor=NULLIF(current_setting('app.user_id',true),'')::bigint;
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=actor AND aktif AND NOT is_system AND role IN ('admin','prp')) THEN
  RAISE EXCEPTION 'Aktor audit verifikasi tidak valid' USING ERRCODE='42501'; END IF;
 IF action IS NULL OR action NOT IN ('bulk_approve','bulk_reject') OR current_setting('app.action',true) IS DISTINCT FROM action OR
 total IS NULL OR total NOT BETWEEN 1 AND 100 OR succeeded IS NULL OR skipped IS NULL OR failed IS NULL OR
 succeeded<0 OR skipped<0 OR failed<0 OR succeeded+skipped+failed<>total OR
 filters IS NULL OR jsonb_typeof(filters)<>'object' OR octet_length(filters::text)>1024 OR
 (action='bulk_reject' AND (reason IS NULL OR length(trim(reason)) NOT BETWEEN 1 AND 2000)) OR
 (action='bulk_approve' AND reason IS NOT NULL) OR NULLIF(current_setting('app.request_id',true),'') IS NULL THEN
  RAISE EXCEPTION 'Metadata audit verifikasi tidak valid' USING ERRCODE='22023'; END IF;
 FOR k,v IN SELECT * FROM jsonb_each(filters) LOOP
  IF k='domain' THEN
   IF jsonb_typeof(v)<>'string' OR NOT EXISTS(SELECT 1 FROM public.definisi_formulir WHERE domain=v#>>'{}') THEN
    RAISE EXCEPTION 'Filter form tidak valid' USING ERRCODE='22023'; END IF;
  ELSIF k IN ('unit_id','periode_laporan_id') THEN
   IF jsonb_typeof(v)<>'string' OR (v#>>'{}') !~ '^[1-9][0-9]{0,15}$' THEN
    RAISE EXCEPTION 'Filter ID tidak valid' USING ERRCODE='22023'; END IF;
  ELSE RAISE EXCEPTION 'Filter audit tidak valid' USING ERRCODE='22023'; END IF;
 END LOOP;
 INSERT INTO public.audit_log(user_id,aksi,tabel,request_id,nilai_baru)
 VALUES(actor,action,'verification_bulk',current_setting('app.request_id',true),
 jsonb_build_object('total',total,'success',succeeded,'skipped',skipped,'failed',failed,'filter',filters,'reason',reason)) RETURNING id INTO event_id;
 RETURN event_id;
END $$;
REVOKE EXECUTE ON FUNCTION record_bulk_verification_event(text,integer,integer,integer,integer,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_bulk_verification_event(text,integer,integer,integer,integer,jsonb,text) TO app_user;
