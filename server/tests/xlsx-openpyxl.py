"""Optional independent reader, no project Python dependencies/install side effects."""
import sys
import warnings
import zipfile
import xml.etree.ElementTree as ET
import openpyxl

for path in sys.argv[1:]:
    with zipfile.ZipFile(path) as package:
        assert package.testzip() is None, path
        for name in package.namelist():
            if name.endswith(('.xml', '.rels')):
                ET.fromstring(package.read(name))
    with warnings.catch_warnings(record=True) as notices:
        book = openpyxl.load_workbook(path, data_only=False)
        assert book.sheetnames == ['Petunjuk', 'Data', '_meta'], path
        assert book['_meta'].sheet_state == 'hidden', path
        assert book['Data'].protection.sheet, path
        assert book['Data']['A2'].protection.locked, path
        assert not book['Data']['C2'].protection.locked, path
        book.close()
        for notice in notices:
            print(f'{path}: {notice.message}')
print(f'openpyxl {openpyxl.__version__}: {len(sys.argv) - 1} templates read')
