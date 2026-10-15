const fs = require('fs');

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const filePath = 'C:/Users/lu.DESKTOP-HRO3RNS/Downloads/grabfood-finance transactionb.csv';
const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
const rows = parseCsvText(text);

const header = rows[0].map(h => h.trim());
const col = (name) => header.indexOf(name);

const cStoreName = col('Store Name');
const cCategory = col('Category');
const cSubcategory = col('Subcategory');
const cAmount = col('Amount');
const cDiscMerchant = col('Discount (Merchant-Funded)');
const cNetSales = col('Net Sales');
const cComm = col('Order commission');
const cTotal = col('Total');
const cTax = col('Tax on GrabFood/GrabMart commission, adjustments, ads');
const cDesc = col('Description');
const cRefundItem = col('Customer refund Item');
const cStatus = col('Status');

let paymentRows = 0;
let adjRows = 0;

let sumPaymentAmount = 0;
let sumPaymentDisc = 0;
let sumPaymentNetSales = 0;
let sumPaymentComm = 0;
let sumPaymentTax = 0;
let sumPaymentTotal = 0;

const adjustments = [];

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row || (cStatus !== -1 && String(row[cStatus] || '').trim().toLowerCase() !== 'transferred')) continue;

  const cat = String(row[cCategory] || '').trim();
  const amt = parseFloat(row[cAmount]) || 0;
  const disc = parseFloat(row[cDiscMerchant]) || 0;
  const netSales = parseFloat(row[cNetSales]) || 0;
  const comm = parseFloat(row[cComm]) || 0;
  const tax = parseFloat(row[cTax]) || 0;
  const total = parseFloat(row[cTotal]) || 0;

  if (cat === 'Payment') {
    paymentRows++;
    sumPaymentAmount += amt;
    sumPaymentDisc += disc;
    sumPaymentNetSales += netSales;
    sumPaymentComm += comm;
    sumPaymentTax += tax;
    sumPaymentTotal += total;
  } else {
    adjRows++;
    adjustments.push({
      store: row[cStoreName],
      category: cat,
      subcategory: row[cSubcategory],
      amount: amt,
      total,
      description: row[cDesc],
      item: row[cRefundItem]
    });
  }
}

console.log('=== RINCIAN POTONGAN DISKON & KOMISI GRABFOOD ===');
console.log({
  paymentOrdersCount: paymentRows,
  adjustmentCount: adjRows,
  transaksiReguler: {
    omzetKotor_Amount: sumPaymentAmount,
    diskonToko_MerchantFunded: sumPaymentDisc,
    omzetSetelahDiskon_NetSales: sumPaymentNetSales,
    komisiGrab_20persen: sumPaymentComm,
    pajakKomisi_Tax: sumPaymentTax,
    totalCair_Total: sumPaymentTotal,
  },
  adjustments
});
