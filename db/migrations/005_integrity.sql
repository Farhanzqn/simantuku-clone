-- CHECK boolean bernilai NULL diterima PostgreSQL: catatan harus eksplisit NOT NULL.
ALTER TABLE data_quality_flag ADD CONSTRAINT quality_resolution_note_required
  CHECK(NOT resolved OR (resolution_note IS NOT NULL AND length(trim(resolution_note))>0));

CREATE FUNCTION guard_tracer_ringkasan() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l lulusan%ROWTYPE;
BEGIN
  SELECT * INTO l FROM lulusan WHERE id=NEW.lulusan_institusi_id;
  IF l.id IS NOT NULL AND (l.cakupan<>'institusi' OR l.tahun_lulus<>NEW.tahun_lulus OR
    l.periode_laporan_id<>NEW.periode_laporan_id OR NEW.responden>l.jumlah) THEN
    RAISE EXCEPTION 'Referensi/denominasi tracer institut tidak sesuai' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tracer_ringkasan_integrity BEFORE INSERT OR UPDATE ON tracer_ringkasan
  FOR EACH ROW EXECUTE FUNCTION guard_tracer_ringkasan();
