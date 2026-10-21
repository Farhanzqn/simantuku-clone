-- Hanya koreksi kata dalam kutipan flag D3 yang baru, bukan data approved atau angka sumber.
-- Instalasi baru menggunakan kutipan benar di seed-employment; instalasi D3 awal diaudit di sini.
SELECT set_config('app.user_id',coalesce((SELECT id::text FROM users WHERE is_system AND nama='seed' AND NOT aktif),''),true),
 set_config('app.action','correct_source_quote_d3',true),set_config('app.request_id',gen_random_uuid()::text,true);
UPDATE data_quality_flag SET detail=jsonb_set(detail,'{sumber,0,kutipan}',to_jsonb(replace(detail#>>'{sumber,0,kutipan}','30 orang tenaga pendidikan','30 orang tenaga kependidikan')))
WHERE kode='pegawai-tendik-cakupan-berbeda' AND rule_code='source_employment_comparison'
 AND detail#>>'{sumber,0,kutipan}' LIKE '%30 orang tenaga pendidikan%';
