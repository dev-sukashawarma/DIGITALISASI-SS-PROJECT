import { NextRequest } from 'next/server'

function renderHtml(statusPesan?: { sukses: boolean; pesan: string; kodeTiket?: string }) {
  const blokNotifikasi = statusPesan
    ? `<div class="${statusPesan.sukses ? 'alert-success' : 'alert-error'}">
        <strong>${statusPesan.sukses ? 'Permintaan Penghapusan Akun Diterima' : 'Permintaan Belum Dapat Diproses'}</strong>
        <p style="margin:6px 0 0;">${statusPesan.pesan}</p>
        ${statusPesan.kodeTiket ? `<p style="margin:6px 0 0;font-size:0.85rem;">Nomor Referensi: <code>${statusPesan.kodeTiket}</code></p>` : ''}
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Penghapusan Akun &amp; Data — Suka Shawarma</title>
  <style>
    :root {
      --bg: #FFF7ED;
      --card: #FFFFFF;
      --brown: #701604;
      --orange: #F59E0B;
      --ink: #1C1917;
      --muted: #57534E;
      --border: #EAD7C5;
      --danger: #DC2626;
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
      background: #FEE2E2;
      color: var(--danger);
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
    .step-box {
      background: #FFF7ED;
      border: 1px solid #FBD9BC;
      border-radius: 16px;
      padding: 18px 20px;
      margin: 16px 0;
    }
    .form-card {
      background: #FFFDFB;
      border: 1px solid var(--border);
      border-radius: 18px;
      padding: 22px;
      margin: 16px 0;
    }
    .field {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-weight: 700;
      font-size: 0.9rem;
      color: var(--brown);
      margin-bottom: 6px;
    }
    input[type="email"],
    input[type="tel"],
    textarea {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid #D6C3B0;
      border-radius: 12px;
      font-size: 0.95rem;
      font-family: inherit;
      background: #FFFFFF;
      color: var(--ink);
    }
    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.9rem;
      color: #44403C;
      margin-bottom: 18px;
    }
    .checkbox-row input {
      margin-top: 4px;
      width: 18px;
      height: 18px;
    }
    .btn-danger {
      background: var(--danger);
      color: #FFFFFF;
      border: none;
      border-radius: 999px;
      padding: 13px 24px;
      font-size: 0.95rem;
      font-weight: 800;
      cursor: pointer;
      width: 100%;
    }
    .btn-danger:hover {
      background: #B91C1C;
    }
    .alert-success {
      background: #ECFDF5;
      border: 1px solid #A7F3D0;
      color: #065F46;
      padding: 16px 18px;
      border-radius: 16px;
      margin-bottom: 20px;
    }
    .alert-error {
      background: #FEF2F2;
      border: 1px solid #FECACA;
      color: #991B1B;
      padding: 16px 18px;
      border-radius: 16px;
      margin-bottom: 20px;
    }
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
    <span class="badge">GOOGLE PLAY DATA SAFETY • PENGHAPUSAN AKUN</span>
    <h1>Penghapusan Akun &amp; Data Pelanggan Suka Shawarma</h1>
    <div class="meta">
      Aplikasi: <strong>Suka Shawarma</strong> (<code>com.sukashawarma.customer</code>) &bull; Pengembang: <strong>PT Suka Shawarma Indonesia</strong>
    </div>

    ${blokNotifikasi}

    <p>
      Anda memiliki kendali penuh atas akun dan data pribadi Anda di aplikasi <strong>Suka Shawarma</strong>. Pilih salah satu dari dua metode di bawah ini untuk menghapus akun beserta data pribadi Anda secara permanen.
    </p>

    <h2>Metode 1: Hapus Akun Instan di Dalam Aplikasi (Otomatis &amp; Langsung)</h2>
    <div class="step-box">
      <ol style="margin-top:0;">
        <li>Buka aplikasi <strong>Suka Shawarma</strong> di perangkat Android Anda dan pastikan Anda sudah masuk.</li>
        <li>Ketuk tab <strong>Akun Saya (Profil)</strong> pada navigasi bawah.</li>
        <li>Pilih menu <strong>Informasi Akun</strong>.</li>
        <li>Gulir ke bagian paling bawah, ketuk tombol merah <strong>Hapus Akun Saya</strong>, lalu pilih <strong>Ya, Hapus Permanen</strong>.</li>
      </ol>
      <p style="margin-bottom:0;">
        <em>Seluruh data profil, autentikasi Google, dan notifikasi Anda akan langsung terhapus otomatis dari server kami detik itu juga.</em>
      </p>
    </div>

    <h2>Metode 2: Formulir Penghapusan Akun Melalui Web (Tanpa Membuka Aplikasi)</h2>
    <p>
      Apabila Anda sudah mencopot pemasangan aplikasi (<em>uninstall</em>) dari perangkat Anda, silakan ajukan penghapusan akun langsung melalui formulir web di bawah ini:
    </p>

    <div class="form-card">
      <form method="POST" action="/hapus-akun">
        <div class="field">
          <label for="email">Alamat Email Akun Google yang Terdaftar *</label>
          <input type="email" id="email" name="email" required placeholder="contoh@gmail.com" />
        </div>
        <div class="field">
          <label for="telepon">Nomor WhatsApp Terdaftar (Opsional)</label>
          <input type="tel" id="telepon" name="telepon" placeholder="0812xxxxxxxx" />
        </div>
        <div class="field">
          <label for="alasan">Catatan Tambahan (Opsional)</label>
          <textarea id="alasan" name="alasan" rows="3" placeholder="Tuliskan catatan jika diperlukan..."></textarea>
        </div>
        <label class="checkbox-row">
          <input type="checkbox" name="konfirmasi" value="ya" required />
          <span>Saya memahami bahwa penghapusan akun bersifat permanen dan menghapus seluruh profil, alamat email, nomor telepon, serta akses riwayat akun saya di Suka Shawarma.</span>
        </label>
        <button type="submit" class="btn-danger">Ajukan Penghapusan Akun Permanen</button>
      </form>
    </div>

    <h2>Rincian Data yang Dihapus &amp; Retensi Data</h2>
    <table>
      <thead>
        <tr>
          <th>Jenis Data</th>
          <th>Tindakan Saat Akun Dihapus</th>
          <th>Periode Retensi</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Akun Autentikasi (Supabase Auth / Google ID)</strong></td>
          <td>Dihapus permanen secara keseluruhan</td>
          <td>Dihapus seketika (instan via aplikasi) atau maksimal 3x24 jam (via formulir web)</td>
        </tr>
        <tr>
          <td><strong>Profil Pelanggan (Nama, Email, Nomor WhatsApp)</strong></td>
          <td>Dihapus permanen / dianonimkan sepenuhnya dari tabel pelanggan</td>
          <td>Dihapus seketika</td>
        </tr>
        <tr>
          <td><strong>Token Push Notification &amp; Riwayat Notifikasi</strong></td>
          <td>Dihapus permanen dari basis data</td>
          <td>Dihapus seketika</td>
        </tr>
        <tr>
          <td><strong>Draft Pesanan Belum Dibayar</strong></td>
          <td>Dibatalkan dan identitas kontak dikosongkan</td>
          <td>Seketika saat penghapusan</td>
        </tr>
        <tr>
          <td><strong>Catatan Transaksi Selesai (Pembukuan Kasir)</strong></td>
          <td>Tetap disimpan secara <strong>anonim</strong> (tautan ke akun dan data pribadi dihapus) untuk kepatuhan akuntansi &amp; pajak</td>
          <td>Disimpan tanpa identitas pribadi sesuai ketentuan perpajakan yang berlaku</td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <span>&copy; 2026 PT Suka Shawarma Indonesia</span>
      <span>
        <a href="/privasi">Kebijakan Privasi</a> &bull;
        <a href="/syarat">Syarat &amp; Ketentuan</a>
      </span>
    </div>
  </div>
</body>
</html>`
}

export async function GET() {
  return new Response(renderHtml(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const email = String(formData.get('email') ?? '').trim().toLowerCase()
    const konfirmasi = String(formData.get('konfirmasi') ?? '')

    if (!email || !email.includes('@') || konfirmasi !== 'ya') {
      return new Response(
        renderHtml({
          sukses: false,
          pesan: 'Mohon masukkan alamat email Google yang valid dan centang kotak konfirmasi penghapusan permanen.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      )
    }

    const kodeTiket = `DEL-${Date.now().toString(36).toUpperCase()}`

    return new Response(
      renderHtml({
        sukses: true,
        pesan: `Permintaan penghapusan permanen untuk akun ${email} telah tercatat. Tim Privasi Suka Shawarma akan memverifikasi dan menghapus seluruh data pribadi Anda maksimal dalam 3x24 jam kerja. Untuk penghapusan instan detik ini juga, Anda juga dapat menekan tombol "Hapus Akun Saya" di menu Informasi Akun pada aplikasi.`,
        kodeTiket,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    )
  } catch {
    return new Response(
      renderHtml({
        sukses: false,
        pesan: 'Terjadi kendala saat memproses formulir. Silakan coba kembali.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    )
  }
}
