const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'scratch_sheet.xlsx');
const workbook = xlsx.readFile(filePath);

let sql = '';

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  
  // Find the header row index
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && Array.isArray(rows[i])) {
      const firstCell = String(rows[i][0]).toUpperCase();
      if (firstCell === 'NO') {
        headerRowIdx = i;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    return;
  }

  sql += `DO $$ \n`;
  sql += `DECLARE \n`;
  sql += `  v_outlet_name TEXT := '${sheetName.replace(/'/g, "''")}';\n`;
  sql += `  v_outlet_id UUID;\n`;
  sql += `BEGIN\n`;
  sql += `  SELECT id INTO v_outlet_id FROM public.outlets WHERE name ILIKE '%' || v_outlet_name || '%' LIMIT 1;\n`;
  sql += `  IF v_outlet_id IS NULL THEN\n`;
  sql += `    RAISE EXCEPTION 'Outlet dengan nama "%" tidak ditemukan!', v_outlet_name;\n`;
  sql += `  END IF;\n\n`;

  let lastDate = '2026-07-01'; // Default starting point

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0 || !row[0]) continue; // Skip empty rows

    const dateStr = row[1]; // TANGGAL (DD/MM/YYYY)
    const description = row[2] ? String(row[2]).replace(/'/g, "''") : ''; // URAIAN
    let incomeStr = row[3] || 0; // PEMASUKAN
    let expenseStr = row[4] || 0; // PENGELUARAN
    const note = row[5]; // NOTE (kategori lama)

    if (typeof incomeStr === 'string') incomeStr = incomeStr.replace(/[^0-9.-]+/g,"");
    if (typeof expenseStr === 'string') expenseStr = expenseStr.replace(/[^0-9.-]+/g,"");

    const income = parseFloat(incomeStr) || 0;
    const expense = parseFloat(expenseStr) || 0;

    let date = null;
    if (dateStr) {
      if (typeof dateStr === 'number') {
        // Excel serial date
        const d = new Date(Math.round((dateStr - 25569)*86400*1000));
        date = d.toISOString().split('T')[0];
      } else {
        const parts = String(dateStr).split('/');
        if (parts.length === 3) {
          date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }

    if (date) {
      lastDate = date;
    } else {
      date = lastDate;
    }

    // Determine category mapping based on the note
    let category = String(note || '').toLowerCase().trim();
    if (income > 0) {
      if (category === 'cash in') category = 'cash_in';
      else if (category === 'admin') category = 'admin';
      else category = 'cash_in';
      
      sql += `  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)\n`;
      sql += `  VALUES (v_outlet_id, '${category}', ${income}, '${description}', '${date}', 'petty_cash', 'income');\n`;
    }
    
    if (expense > 0) {
      if (['bb', 'bahan baku'].includes(category)) category = 'bb';
      else if (category === 'utilities' || category === 'utilitas') category = 'utilities';
      else if (category === 'overtime') category = 'overtime';
      else if (category === 'admin') category = 'admin';
      else if (category === 'ads') category = 'ads';
      else category = 'outlet';

      sql += `  INSERT INTO public.expenses (outlet_id, category, amount, description, expense_date, payment_source, type)\n`;
      sql += `  VALUES (v_outlet_id, '${category}', ${expense}, '${description}', '${date}', 'petty_cash', 'expense');\n`;
    }
  }

  sql += `END $$;\n\n`;
});

fs.writeFileSync('import.sql', sql);
console.log('SQL generated successfully.');
