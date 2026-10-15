const fs = require('fs');
const xlsx = require('xlsx');

function inspectFile(filePath, label) {
  console.log(`\n========================================`);
  console.log(`INSPECTING: ${label} (${filePath})`);
  console.log(`========================================`);

  const wb = xlsx.readFile(filePath);
  console.log('Sheet Names:', wb.SheetNames);

  wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    // Convert to array of arrays
    const data = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    console.log(`\n--- Sheet [${sheetName}]: Total Rows = ${data.length} ---`);

    if (data.length > 0) {
      console.log('Row 0 (Header sample):', data[0].slice(0, 15));
      if (data.length > 1) {
        console.log('Row 1 (Sample data):', data[1].slice(0, 15));
      }
    }
  });
}

inspectFile('C:/Users/lu.DESKTOP-HRO3RNS/Downloads/sf-transaction.xlsx', 'sf-transaction.xlsx');
inspectFile('C:/Users/lu.DESKTOP-HRO3RNS/Downloads/sf-settlment.xlsx', 'sf-settlment.xlsx');
