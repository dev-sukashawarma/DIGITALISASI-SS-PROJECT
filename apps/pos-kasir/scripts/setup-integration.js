const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

const envPath = path.join(__dirname, '..', '.env.local');

// 1. Generate Secrets
const orderToKasirSecret = generateSecret();
const kasirToOrderSecret = generateSecret();

// Di SS_ORDER config.js ada URL supabase-nya, mari kita extract
const ssOrderConfigPath = path.join(__dirname, '..', '..', '..', '..', 'SS_ORDER', 'config.js');
let orderSystemNotifyUrl = 'https://ipwkiizicobqdpfcmgvc.supabase.co/functions/v1/kasir-order-done';

if (fs.existsSync(ssOrderConfigPath)) {
  const configContent = fs.readFileSync(ssOrderConfigPath, 'utf8');
  const match = configContent.match(/supabaseUrl:\s*['"](https:\/\/[^'"]+)['"]/);
  if (match && match[1]) {
    orderSystemNotifyUrl = `${match[1]}/functions/v1/kasir-order-done`;
  }
}

// Extract pos-kasir URL
let posKasirUrl = 'http://localhost:3000/api/orders/incoming';
// You might need to change this to the real production URL later

// 2. Update pos-kasir .env.local
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

function updateOrAddEnv(content, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  } else {
    return content + (content.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
  }
}

envContent = updateOrAddEnv(envContent, 'ORDER_TO_KASIR_SECRET', orderToKasirSecret);
envContent = updateOrAddEnv(envContent, 'KASIR_TO_ORDER_SECRET', kasirToOrderSecret);
envContent = updateOrAddEnv(envContent, 'ORDER_SYSTEM_NOTIFY_URL', orderSystemNotifyUrl);

fs.writeFileSync(envPath, envContent);

console.log('✅ Berhasil mengatur .env.local untuk pos-kasir!');
console.log('');
console.log('====================================================');
console.log('LANGKAH SELANJUTNYA: Set Secrets di SS_ORDER (Supabase)');
console.log('====================================================');
console.log('Jalankan perintah berikut di terminal (di dalam folder SS_ORDER) JIKA Anda sudah login ke supabase CLI:');
console.log('');
console.log(`npx supabase secrets set ORDER_TO_KASIR_SECRET=${orderToKasirSecret} KASIR_TO_ORDER_SECRET=${kasirToOrderSecret} POS_KASIR_API_URL=${posKasirUrl}`);
console.log('');
console.log('ATAU, masukkan secara manual di Supabase Dashboard (SS_ORDER) -> Settings -> API -> Edge Function Secrets:');
console.log(`- ORDER_TO_KASIR_SECRET = ${orderToKasirSecret}`);
console.log(`- KASIR_TO_ORDER_SECRET = ${kasirToOrderSecret}`);
console.log(`- POS_KASIR_API_URL     = ${posKasirUrl}`);
console.log(`- FONNTE_TOKEN          = (masukkan token fonnte Anda)`);
console.log('====================================================');
