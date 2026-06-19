const localtunnel = require('localtunnel');

(async () => {
  const tunnel = await localtunnel({ port: 3004 });

  console.log('========================================================================');
  console.log('🔗 URL PUBLIK SEMENTARA UNTUK POS KASIR BERHASIL DIBUAT!');
  console.log('URL:', tunnel.url);
  console.log('========================================================================');
  console.log('');
  console.log('PENTING: Agar pesanan online bisa masuk ke localhost:3004 komputer Anda,');
  console.log('Supabase Cloud butuh URL publik ini.');
  console.log('');
  console.log('Buka Supabase Dashboard SS_ORDER -> Settings -> API -> Edge Function Secrets');
  console.log('Ubah nilai POS_KASIR_API_URL menjadi:');
  console.log('');
  console.log(`POS_KASIR_API_URL = ${tunnel.url}/api/orders/incoming`);
  console.log('');
  console.log('========================================================================');
  console.log('Biarkan terminal ini TETAP TERBUKA selama Anda melakukan testing.');

  tunnel.on('close', () => {
    console.log('Tunnel ditutup.');
  });
})();
