export const dynamic = 'force-static'

const HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kebijakan Privasi — Suka Shawarma</title>
  <style>
    :root {
      --bg: #FFF7ED;
      --card: #FFFFFF;
      --brown: #701604;
      --orange: #F59E0B;
      --ink: #1C1917;
      --muted: #57534E;
      --border: #EAD7C5;
    }
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--ink);
      margin: 0;
      padding: 32px 16px 64px;
      line-height: 1.65;
    }
    .container {
      max-width: 760px;
      margin: 0 auto;
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px 28px;
      box-shadow: 0 8px 24px rgba(112, 22, 4, 0.06);
    }
    .badge {
      display: inline-block;
      background: #FEF3C7;
      color: var(--brown);
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 5px 12px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    h1 {
      color: var(--brown);
      font-size: 1.75rem;
      margin: 0 0 6px;
      line-height: 1.25;
    }
    .meta {
      color: var(--muted);
      font-size: 0.875rem;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }
    h2 {
      color: var(--brown);
      font-size: 1.15rem;
      margin-top: 28px;
      margin-bottom: 10px;
    }
    p, li {
      color: #44403C;
      font-size: 0.95rem;
    }
    ul {
      padding-left: 20px;
      margin: 8px 0 16px;
    }
    li { margin-bottom: 8px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 0.9rem;
    }
    th, td {
      border: 1px solid var(--border);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #FFF7ED;
      color: var(--brown);
      font-weight: 700;
    }
    .callout {
      background: #FFF7ED;
      border: 1px solid #FBD9BC;
      border-radius: 16px;
      padding: 16px 18px;
      margin: 20px 0;
    }
    a {
      color: #D97706;
      font-weight: 700;
      text-decoration: none;
    }
    a:hover { text-decoration: underline; }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      font-size: 0.85rem;
      color: var(--muted);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">KEBIJAKAN PRIVASI RESMI • SUKA SHAWARMA INDONESIA</span>
    <h1>Kebijakan Privasi Aplikasi Suka Shawarma</h1>
    <div class="meta">
      Berlaku sejak: 15 Oktober 2026 &bull; Paket Aplikasi: <code>com.sukashawarma.customer</code>
    </div>

    <p>
      <strong>PT Suka Shawarma Indonesia</strong> ("Suka Shawarma", "kami") berkomitmen untuk melindungi privasi dan keamanan data pribadi pelanggan ("Anda") yang menggunakan aplikasi seluler <strong>Suka Shawarma</strong> di Android serta layanan terkait di <code>https://retail.sukashawarma.com</code>.
    </p>

    <h2>1. Ringkasan Data yang Kami Kumpulkan (Google Play Data Safety)</h2>
    <p>Kami hanya mengumpulkan data minimum yang diperlukan agar Anda dapat memesan makanan/minuman lebih awal (<em>order-ahead</em>) dan mengambilnya di outlet Suka Shawarma:</p>

    <table>
      <thead>
        <tr>
          <th>Kategori Data</th>
          <th>Jenis Data</th>
          <th>Tujuan Penggunaan</th>
          <th>Sifat Pengumpulan</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Informasi Pribadi</strong></td>
          <td>Nama lengkap &amp; Alamat Email (melalui Google Sign-In)</td>
          <td>Fungsi aplikasi, pembuatan akun, autentikasi sesi pelanggan, dan pencatatan riwayat pesanan</td>
          <td>Wajib saat masuk/checkout</td>
        </tr>
        <tr>
          <td><strong>Informasi Pribadi</strong></td>
          <td>Nomor Telepon / WhatsApp</td>
          <td>Komunikasi operasional kasir outlet apabila terdapat konfirmasi terkait pesanan Anda</td>
          <td>Opsional (diisi oleh pengguna)</td>
        </tr>
        <tr>
          <td><strong>Lokasi</strong></td>
          <td>Lokasi Perkiraan (<em>Approximate Location</em> / <code>ACCESS_COARSE_LOCATION</code>)</td>
          <td>Mengurutkan daftar outlet Suka Shawarma terdekat dari posisi Anda saat memilih outlet</td>
          <td>Opsional &amp; hanya di memori (<em>ephemeral</em>, tidak disimpan di server)</td>
        </tr>
        <tr>
          <td><strong>Informasi Keuangan &amp; Transaksi</strong></td>
          <td>Rincian item pesanan, nominal tagihan, dan status pembayaran QRIS</td>
          <td>Memproses pesanan di outlet dan memverifikasi pembayaran QRIS secara otomatis</td>
          <td>Wajib saat bertransaksi</td>
        </tr>
      </tbody>
    </table>

    <h2>2. Penggunaan Izin Perangkat (Android Permissions)</h2>
    <ul>
      <li><code>android.permission.INTERNET</code>: Digunakan untuk berkomunikasi secara aman melalui HTTPS dengan server Suka Shawarma (memuat katalog menu, ketersediaan outlet, voucher, dan status pembayaran QRIS).</li>
      <li><code>android.permission.ACCESS_COARSE_LOCATION</code>: Digunakan hanya saat aplikasi sedang dibuka (<em>foreground</em>) untuk menghitung estimasi jarak ke outlet terdekat. Anda tetap dapat memilih outlet secara manual meskipun menolak izin lokasi ini.</li>
    </ul>

    <h2>3. Keamanan, Enkripsi &amp; Pihak Ketiga</h2>
    <ul>
      <li><strong>Enkripsi Saat Transit (Encryption in Transit):</strong> Seluruh pertukaran data antara aplikasi Android dan server kami dienkripsi menggunakan protokol <strong>HTTPS / TLS 1.2+</strong>.</li>
      <li><strong>Penyimpanan Lokal Terenkripsi:</strong> Token sesi akun di perangkat Anda disimpan menggunakan <code>EncryptedSharedPreferences</code> (Android Keystore AES-256).</li>
      <li><strong>Pemrosesan Pembayaran QRIS:</strong> Pembayaran diproses melalui mitra gerbang pembayaran resmi berlisensi Bank Indonesia (<strong>Xendit</strong>). Aplikasi tidak pernah menyimpan PIN bank, nomor kartu, ataupun kredensial e-wallet Anda.</li>
      <li><strong>Tidak Ada Penjualan Data:</strong> Kami tidak pernah menjual, menyewakan, atau membagikan data pribadi Anda kepada pengiklan maupun pialang data pihak ketiga.</li>
    </ul>

    <h2>4. Penyimpanan &amp; Penghapusan Data (Account &amp; Data Deletion)</h2>
    <div class="callout">
      <strong>Hak Penghapusan Akun &amp; Data Pribadi:</strong><br />
      Anda dapat menghapus akun Suka Shawarma beserta seluruh data pribadi Anda kapan saja secara mandiri maupun melalui halaman web resmi kami:
      <ul>
        <li><strong>Di dalam Aplikasi Android (Instan):</strong> Buka menu <strong>Akun Saya (Profil) &rarr; Informasi Akun &rarr; Hapus Akun Saya</strong>.</li>
        <li><strong>Melalui Web (Tanpa Aplikasi):</strong> Kunjungi halaman <a href="/hapus-akun">https://retail.sukashawarma.com/hapus-akun</a> untuk mengajukan penghapusan akun dan data pribadi.</li>
      </ul>
      Saat akun dihapus, nama, alamat email, nomor telepon WhatsApp, dan token perangkat Anda langsung dihapus permanen. Catatan nominal transaksi masa lalu yang telah dibayar disimpan secara anonim (tanpa identitas pribadi) semata-mata untuk kepatuhan pembukuan keuangan dan perpajakan.
    </div>

    <h2>5. Privasi Anak-Anak</h2>
    <p>
      Layanan kami ditujukan untuk pengguna umum dan tidak secara khusus menargetkan anak-anak di bawah usia 13 tahun. Jika Anda adalah orang tua/wali dan mengetahui bahwa anak Anda memberikan data pribadi tanpa persetujuan Anda, silakan ajukan penghapusan melalui halaman <a href="/hapus-akun">Penghapusan Akun</a>.
    </p>

    <h2>6. Hubungi Kami</h2>
    <p>
      Apabila Anda memiliki pertanyaan mengenai Kebijakan Privasi ini atau pengelolaan data pribadi Anda, silakan hubungi layanan pelanggan resmi <strong>Suka Shawarma Indonesia</strong> melalui fitur <em>Pusat Bantuan &amp; FAQ</em> di dalam aplikasi atau halaman <a href="/hapus-akun">Bantuan Privasi &amp; Penghapusan Akun</a>.
    </p>

    <div class="footer">
      <span>&copy; 2026 PT Suka Shawarma Indonesia</span>
      <span>
        <a href="/syarat">Syarat &amp; Ketentuan</a> &bull;
        <a href="/hapus-akun">Hapus Akun</a>
      </span>
    </div>
  </div>
</body>
</html>`

export async function GET() {
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
