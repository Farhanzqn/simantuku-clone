-- CREATE OR REPLACE function memerlukan atribut keamanan eksplisit kembali.
-- App_user tetap tanpa INSERT/UPDATE/DELETE langsung pada audit_log.
ALTER FUNCTION audit_change() SECURITY DEFINER;
ALTER FUNCTION audit_change() SET search_path=pg_catalog,public,pg_temp;
