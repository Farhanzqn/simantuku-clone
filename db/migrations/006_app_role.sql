DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_user') THEN
    CREATE ROLE app_user LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE app_user NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM app_user;
GRANT USAGE ON SCHEMA public TO app_user;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_user;
GRANT SELECT,INSERT,UPDATE ON unit,users,domain_unit,prodi,periode_akademik,periode_laporan,
  visibilitas_modul,kpi_indikator,rka_target,session,import_batch,data_quality_flag,
  mahasiswa_aktif,mahasiswa_baru,dosen_prodi,tendik_prodi,lulusan,tracer_study,tracer_ringkasan,kpi_capaian,kpi_input TO app_user;
GRANT SELECT ON sumber_data,data_quality_flag_sumber,audit_log TO app_user;
GRANT SELECT ON v_dashboard_mahasiswa,v_dashboard_dosen,v_dashboard_tendik,v_dashboard_mahasiswa_baru,
  v_dashboard_lulusan,v_dashboard_tracer,v_dashboard_tracer_ringkasan,v_kpi_capaian,v_kpi_input,
  v_dashboard_mahasiswa_agregat,v_dashboard_dosen_agregat,v_dashboard_tendik_agregat,
  v_dashboard_mahasiswa_baru_agregat,v_dashboard_lulusan_agregat TO app_user;
DO $$ DECLARE t text; seq text; BEGIN
  FOREACH t IN ARRAY ARRAY['unit','users','prodi','periode_akademik','periode_laporan','visibilitas_modul',
    'kpi_indikator','rka_target','import_batch','data_quality_flag','mahasiswa_aktif','mahasiswa_baru',
    'dosen_prodi','tendik_prodi','lulusan','tracer_study','tracer_ringkasan','kpi_capaian','kpi_input'] LOOP
    seq=pg_get_serial_sequence('public.'||t,'id');
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO app_user',seq);
  END LOOP;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_user',current_database());
  EXECUTE format('REVOKE CREATE ON DATABASE %I FROM app_user',current_database());
  -- TEMP membolehkan DDL sementara; cabut dari PUBLIC agar tidak diwarisi app_user.
  EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC,app_user',current_database());
END $$;
-- Audit INSERT tetap hak pemilik via trigger, tidak ada akses INSERT/UPDATE/DELETE bagi aplikasi.
ALTER FUNCTION audit_change() SECURITY DEFINER;
ALTER FUNCTION audit_change() SET search_path=pg_catalog,public;
REVOKE EXECUTE ON FUNCTION audit_change() FROM PUBLIC,app_user;
-- Logout/pruning butuh penghapusan session. Fungsi sempit menggantikan hak DELETE tabel.
CREATE FUNCTION delete_app_session(session_id text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  DELETE FROM public.session WHERE sid=session_id;
$$;
CREATE FUNCTION prune_app_sessions() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  DELETE FROM public.session WHERE expire<now();
$$;
REVOKE EXECUTE ON FUNCTION delete_app_session(text),prune_app_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_app_session(text),prune_app_sessions() TO app_user;
