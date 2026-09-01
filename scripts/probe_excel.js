const xlsx = require('xlsx');

const filePath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\Downloads\\payroll agutus.xlsx';
try {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // read as array of arrays
  
  console.log('Sheet Name:', sheetName);
  console.log('Total Rows:', data.length);
  console.log('First 10 rows:');
  for (let i = 0; i < Math.min(10, data.length); i++) {
    console.log(data[i]);
  }
} catch (e) {
  console.error('Error reading Excel file:', e.message);
}
