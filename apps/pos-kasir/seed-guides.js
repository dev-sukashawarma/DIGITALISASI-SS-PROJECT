const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^"|"$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Menghapus panduan lama...');
  const { error: delError } = await supabase
    .from('system_guides')
    .delete()
    .eq('system_code', 'pos');

  if (delError) {
    console.error('Error delete:', delError);
    return;
  }

  console.log('Menambahkan panduan baru...');
  
  const guides = [
    {
      system_code: 'pos',
      category: '1. Membuka Sistem Kasir',
      title: 'Tampilan Awal / Home Kiosk',
      content_html: '<p>Langkah pertama adalah membuka sistem kasir di perangkat (tablet/laptop) outlet Anda.</p><ol><li>Buka browser web (disarankan menggunakan <strong>Google Chrome</strong>).</li><li>Akses alamat web sistem Suka Shawarma.</li><li>Anda akan melihat halaman Home Kiosk seperti gambar di bawah ini. Pilih tombol "Masuk ke Portal" yang dilingkari untuk melanjutkan.</li></ol>',
      image_url: JSON.stringify([{ url: '/guides/1_kiosk_home.png', title: 'Tampilan Awal / Home Kiosk' }]),
      sort_order: 1
    },
    {
      system_code: 'pos',
      category: '2. Masuk ke Akun Anda (Login)',
      title: 'Langkah-langkah Login',
      content_html: '<p>Setelah menekan tombol portal kasir, Anda akan diarahkan ke halaman login. Anda perlu masuk menggunakan akun yang telah diberikan oleh tim IT Suka Shawarma.</p><ol><li><strong>Email atau Username:</strong> Masukkan username kasir Anda (misalnya: <code>kasir_sudirman</code>) atau email yang terdaftar.</li><li><strong>Kata Sandi:</strong> Masukkan kata sandi rahasia Anda. Pastikan huruf besar dan kecilnya sesuai.</li><li>Klik tombol <strong>"Masuk ke Portal"</strong>.</li></ol><blockquote><p><strong>Catatan:</strong> Jangan bagikan kata sandi Anda kepada orang lain untuk menjaga keamanan data penjualan outlet.</p></blockquote>',
      image_url: JSON.stringify([{ url: '/guides/2_login.png', title: 'Halaman Login' }]),
      sort_order: 2
    },
    {
      system_code: 'pos',
      category: '3. Mengelola Pesanan',
      title: 'Mengenal Dashboard Pesanan',
      content_html: '<p>Setelah berhasil login, Anda akan masuk ke <strong>Dashboard Pesanan</strong>. Di sinilah Anda mengelola dan memantau semua pesanan pelanggan. Sistem kami menggunakan alur kerja 3 kolom yang mudah dipahami.</p><ul><li><strong>Kolom Menunggu (Pending):</strong> Pesanan baru yang masuk dari sistem pemesanan pelanggan (Kiosk) akan muncul di sini. Klik tombol untuk menerima pesanan dan memindahkannya ke dapur untuk disiapkan.</li><li><strong>Kolom Diproses (Preparing):</strong> Pesanan sedang dibuat oleh tim dapur. Jika makanan dan minuman sudah siap disajikan/diambil, klik tombol selesai pada tiket pesanan.</li><li><strong>Kolom Selesai (Completed):</strong> Daftar pesanan yang sudah selesai dibuat dan sudah diserahkan kepada pelanggan.</li></ul>',
      image_url: JSON.stringify([{ url: '/guides/3_dashboard.png', title: 'Dashboard Pesanan (3 Kolom)' }]),
      sort_order: 3
    },
    {
      system_code: 'pos',
      category: '4. Manajemen Menu',
      title: 'Mengubah Status Ketersediaan (Stok Makanan)',
      content_html: '<p>Selain menerima pesanan, Anda juga bertugas mengatur ketersediaan menu. Jika ada bahan makanan yang habis (sold out), Anda harus segera mematikannya di sistem agar pelanggan tidak bisa memesan menu tersebut.</p><ol><li>Buka menu <strong>Manajemen Menu</strong> dari navigasi samping (sidebar).</li><li>Cari menu yang ingin Anda ubah statusnya.</li><li>Perhatikan <strong>tombol switch (saklar)</strong> yang dilingkari pada gambar.</li><li>Klik tombol tersebut untuk mengubah status antara <strong>Tersedia (Aktif)</strong> dan <strong>Habis (Sold Out)</strong>.</li><li>Menu yang ditandai Habis akan otomatis hilang dari layar Kiosk pelanggan.</li></ol>',
      image_url: JSON.stringify([{ url: '/guides/4_menu.png', title: 'Halaman Manajemen Menu' }]),
      sort_order: 4
    }
  ];

  const { error: insError } = await supabase
    .from('system_guides')
    .insert(guides);

  if (insError) {
    console.error('Error insert:', insError);
  } else {
    console.log('Berhasil menambahkan', guides.length, 'panduan baru.');
  }
}

run();
