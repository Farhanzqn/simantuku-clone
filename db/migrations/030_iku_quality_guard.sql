-- Stored generated values are unavailable inside BEFORE workflow guards.
-- Derive the badge before the shared immutable-payload comparison instead.
ALTER TABLE iku_capaian ALTER COLUMN perlu_verifikasi DROP EXPRESSION;
ALTER TABLE iku_capaian ALTER COLUMN perlu_verifikasi SET DEFAULT false;
ALTER TABLE iku_capaian ALTER COLUMN perlu_verifikasi SET NOT NULL;
CREATE FUNCTION derive_iku_quality() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 NEW.perlu_verifikasi=NULLIF(trim(NEW.catatan_verifikasi),'') IS NOT NULL;
 RETURN NEW;
END $$;
CREATE TRIGGER iku_capaian_00_quality BEFORE INSERT OR UPDATE ON iku_capaian FOR EACH ROW EXECUTE FUNCTION derive_iku_quality();
