export const dynamic = 'force-static'

const HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Syarat &amp; Ketentuan Layanan — Suka Shawarma</title>
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
    <span class="badge">KETENTUAN RESMI • SUKA SHAWARMA INDONESIA</span>
    <h1>Syarat &amp; Ketentuan Layanan</h1>
    <div class="meta">
      Berlaku sejak: 15 Oktober 2026 &bull; Paket Aplikasi: <code>com.sukashawarma.customer</code>
    </div>

    <p>
      Selamat datang di aplikasi <strong>Suka Shawarma</strong> yang dioperasikan oleh <strong>PT Suka Shawarma Indonesia</strong>. Dengan mengakses dan melakukan pemesanan melalui aplikasi ini, Anda menyetujui ketentuan layanan berikut:
    </p>

    <h2>1. Layanan Pesan Lebih Awal &amp; Ambil di Outlet (Order-Ahead &amp; Self-Pickup)</h2>
    <ul>
      <li>Aplikasi Suka Shawarma melayani pemesanan makanan dan minuman secara langsung (<em>order-ahead</em>) untuk diambil sendiri (<em>self-pickup</em>) di outlet Suka Shawarma yang Anda pilih.</li>
      <li>Aplikasi ini tidak menyediakan layanan pesan-antar (<em>delivery</em>) kurir. Pastikan Anda memeriksa nama, alamat, dan status jam operasional outlet sebelum melakukan pembayaran.</li>
    </ul>

    <h2>2. Harga, Pembayaran QRIS &amp; Batas Waktu</h2>
    <ul>
      <li>Seluruh harga menu yang tertera di aplikasi adalah dalam mata uang Rupiah (IDR).</li>
      <li>Pembayaran dilakukan secara nontunai menggunakan <strong>QRIS Standar Nasional</strong> yang dapat dipindai melalui aplikasi <em>mobile banking</em> atau <em>e-wallet</em> pilihan Anda.</li>
      <li>Kode QRIS berlaku selama <strong>15 menit</strong> sejak tagihan dibuat. Apabila pembayaran tidak diselesaikan dalam batas waktu tersebut, pesanan otomatis kedaluwarsa.</li>
      <li>Pesanan baru akan diteruskan ke antrean dapur outlet setelah pembayaran terverifikasi otomatis oleh sistem.</li>
    </ul>

    <h2>3. Pengambilan Pesanan di Outlet</h2>
    <ul>
      <li>Tunjukkan nomor antrean pesanan yang tertera pada layar <strong>Status Pesanan</strong> di aplikasi kepada kasir/kru di outlet saat status pesanan berubah menjadi <strong>Siap Diambil</strong>.</li>
      <li>Demi menjaga kualitas dan kesegaran makanan, harap mengambil pesanan Anda di outlet pada hari dan jam operasional yang sama.</li>
    </ul>

    <h2>4. Kebijakan Pembatalan &amp; Kendala Pesanan</h2>
    <ul>
      <li>Pesanan yang masih berstatus <em>Menunggu Pembayaran</em> dapat dibatalkan kapan saja sebelum Anda memindai dan membayar kode QRIS.</li>
      <li>Pesanan yang sudah dibayar dan masuk ke dapur tidak dapat dibatalkan secara sepihak oleh pelanggan, kecuali terjadi kendala operasional atau ketersediaan stok di outlet yang bersangkutan.</li>
      <li>Apabila terdapat kendala pada pesanan Anda, silakan hubungi layanan pelanggan resmi Suka Shawarma melalui menu <strong>Pusat Bantuan &amp; FAQ</strong> di dalam aplikasi.</li>
    </ul>

    <h2>5. Penggunaan Voucher &amp; Promo</h2>
    <ul>
      <li>Setiap voucher promo memiliki syarat minimum pembelanjaan, periode masa berlaku, kuota, atau pembatasan outlet sesuai yang tertera pada rincian voucher.</li>
      <li>Satu transaksi pesanan hanya dapat menggunakan satu kode voucher aktif.</li>
    </ul>

    <h2>6. Akun Pengguna &amp; Privasi Data</h2>
    <ul>
      <li>Anda bertanggung jawab menjaga keamanan akun Google yang digunakan untuk masuk ke aplikasi Suka Shawarma.</li>
      <li>Pengelolaan dan penghapusan data pribadi Anda diatur sepenuhnya dalam <a href="/privasi">Kebijakan Privasi</a> serta dapat diajukan kapan saja melalui halaman <a href="/hapus-akun">Penghapusan Akun</a>.</li>
    </ul>

    <div class="footer">
      <span>&copy; 2026 PT Suka Shawarma Indonesia</span>
      <span>
        <a href="/privasi">Kebijakan Privasi</a> &bull;
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
