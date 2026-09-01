const xlsx = require('xlsx');

function main() {
  const filePath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\Downloads\\payroll agutus.xlsx';
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Show header row
  console.log("Headers:");
  rows[0].forEach((col, idx) => console.log(`${idx}: ${col}`));
}

main();
