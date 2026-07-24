const fs = require('fs');
try {
  const xlsx = require('xlsx');
  const workbook = xlsx.readFile('D:\\MIT\\CLAUDE CODE PROJECT\\SS DIGITAL PROJECT\\SS COGS SET\\data transaksi pawoon.xls');
  const sheet_name_list = workbook.SheetNames;
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]], { header: 1 });
  
  for (let i = 0; i < 20; i++) {
      if (data[i]) console.log(`Row ${i}:`, data[i]);
  }
} catch (err) {
     console.error("Error reading file:", err.message);
}
