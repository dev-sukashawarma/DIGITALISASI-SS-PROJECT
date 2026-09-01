const xlsx = require('xlsx');

const filePath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\Downloads\\payroll agutus.xlsx';
const workbook = xlsx.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log('| No | Nama Karyawan (Excel) | Posisi / Jabatan | Lokasi / Cabang |');
console.log('|---|---|---|---|');

let no = 1;
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row) continue;
  const name = row[1];
  if (name && typeof name === 'string' && name.trim() !== '') {
    const position = row[2] || '-';
    const location = row[4] || '-';
    console.log(`| ${no++} | ${name.trim()} | ${position} | ${location} |`);
  }
}
