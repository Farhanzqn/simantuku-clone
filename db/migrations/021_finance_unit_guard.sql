-- La colonne generee est calculee apres le BEFORE workflow: remplir avant le guard.
ALTER TABLE keuangan_revisi ALTER COLUMN satuan DROP EXPRESSION;
CREATE FUNCTION set_finance_unit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.satuan=CASE NEW.kategori WHEN 'likuiditas' THEN 'kali' WHEN 'efisiensi' THEN '%' WHEN 'belanja-sdm' THEN '%' WHEN 'cost-student' THEN 'Rp/mahasiswa' WHEN 'non-spp' THEN '%' WHEN 'pendapatan-mahasiswa' THEN 'Rp' WHEN 'pendapatan-non-mahasiswa' THEN 'Rp' WHEN 'tridarma-langsung' THEN 'Rp' WHEN 'tridarma-tidak-langsung' THEN 'Rp' WHEN 'umum-operasional' THEN 'Rp' WHEN 'sewa-outsourcing' THEN 'Rp' WHEN 'aset' THEN 'Rp' WHEN 'liabilitas' THEN 'Rp' WHEN 'pendapatan-laporan' THEN 'Rp' WHEN 'beban-laporan' THEN 'Rp' WHEN 'laba-rugi' THEN 'Rp' WHEN 'arus-kas' THEN 'Rp' END;
 RETURN NEW;
END $$;
CREATE TRIGGER keuangan_revisi_00_unit BEFORE INSERT OR UPDATE ON keuangan_revisi FOR EACH ROW EXECUTE FUNCTION set_finance_unit();
ALTER TABLE keuangan_revisi ALTER COLUMN satuan SET NOT NULL;
