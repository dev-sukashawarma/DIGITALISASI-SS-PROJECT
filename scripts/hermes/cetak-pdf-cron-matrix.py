import asyncio
import os
import pathlib
from playwright.async_api import async_playwright

HTML_CONTENT = """<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Master Plan Sistem Notifikasi & Cron Job Eksekutif - Suka Shawarma</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 12mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      background: #FFFFFF;
      line-height: 1.35;
      font-size: 8pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* HEADER */
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }

    .brand-title {
      font-size: 14pt;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0F172A;
      text-transform: uppercase;
    }

    .brand-title span {
      color: #D97706;
    }

    .doc-subtitle {
      font-size: 8pt;
      color: #64748B;
      font-weight: 500;
      margin-top: 1px;
    }

    .header-meta {
      text-align: right;
      font-size: 7.5pt;
      color: #64748B;
      line-height: 1.3;
    }

    .header-meta strong {
      color: #0F172A;
    }

    .badge-doc {
      display: inline-block;
      background: #FEF3C7;
      color: #92400E;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 7pt;
      margin-bottom: 2px;
      border: 1px solid #FDE68A;
    }

    /* EXECUTIVE INTRO */
    .executive-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 3.5px solid #D97706;
      border-radius: 5px;
      padding: 7px 10px;
      margin-bottom: 12px;
    }

    .executive-card h3 {
      font-size: 8.5pt;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 2px;
    }

    .executive-card p {
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.35;
    }

    /* SECTION STYLING */
    .section-block {
      margin-bottom: 12px;
    }

    .page-break {
      page-break-before: always;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .section-tag {
      font-size: 7pt;
      font-weight: 800;
      text-transform: uppercase;
      padding: 1px 6px;
      border-radius: 3px;
      letter-spacing: 0.4px;
    }

    .tag-daily {
      background: #E0F2FE;
      color: #0369A1;
      border: 1px solid #BAE6FD;
    }

    .tag-anomaly {
      background: #FEE2E2;
      color: #B91C1C;
      border: 1px solid #FECACA;
    }

    .tag-weekly {
      background: #F3E8FF;
      color: #6D28D9;
      border: 1px solid #DDD6FE;
    }

    .section-title {
      font-size: 9.5pt;
      font-weight: 700;
      color: #0F172A;
    }

    .section-desc {
      font-size: 7pt;
      color: #64748B;
      margin-left: auto;
      font-style: italic;
    }

    /* TABLES */
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      font-size: 7.5pt;
    }

    thead {
      background: #0F172A;
      color: #FFFFFF;
    }

    th {
      padding: 5px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 7pt;
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }

    td {
      padding: 5px 8px;
      border-bottom: 1px solid #E2E8F0;
      vertical-align: top;
      color: #334155;
    }

    tr:nth-child(even) {
      background: #F8FAFC;
    }

    .col-no {
      width: 4%;
      text-align: center;
      font-weight: 600;
      color: #64748B;
    }

    .col-time {
      width: 12%;
      font-weight: 700;
      color: #0F172A;
      white-space: nowrap;
    }

    .col-module {
      width: 25%;
    }

    .col-desc {
      width: 59%;
    }

    .module-title {
      font-weight: 700;
      color: #0F172A;
      font-size: 7.5pt;
      display: block;
      margin-bottom: 1px;
    }

    .app-badge {
      display: inline-block;
      font-size: 6.5pt;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      background: #EEF2F6;
      color: #475569;
      padding: 0 4px;
      border-radius: 2px;
      border: 1px solid #CBD5E1;
    }

    .metric-list {
      margin: 0;
      padding-left: 12px;
    }

    .metric-list li {
      margin-bottom: 1px;
    }

    .metric-list li strong {
      color: #0F172A;
    }

    .highlight-warn {
      color: #B45309;
      font-weight: 600;
    }

    .highlight-crit {
      color: #B91C1C;
      font-weight: 600;
    }

    /* FOOTER */
    .doc-footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #E2E8F0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      color: #94A3B8;
    }

    .doc-footer strong {
      color: #64748B;
    }

    .page-indicator {
      font-weight: 600;
      color: #64748B;
    }
  </style>
</head>
<body>

  <!-- ==================== HALAMAN 1 ==================== -->
  <!-- HEADER -->
  <div class="header-container">
    <div>
      <div class="brand-title">SUKA <span>SHAWARMA</span> INDONESIA</div>
      <div class="doc-subtitle">Master Plan Sistem Notifikasi Otomatis & Cron Job Eksekutif</div>
    </div>
    <div class="header-meta">
      <div class="badge-doc">DOKUMEN ARSITEKTUR EKSEKUTIF</div>
      <div><strong>Versi:</strong> 1.0 (Final) · <strong>Oktober 2026</strong></div>
      <div><strong>Klasifikasi:</strong> Internal Dewan Direksi & Owner</div>
    </div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <div class="executive-card">
    <h3>🎯 Prinsip Desain: Pengawasan Presisi, Bebas Spam (Anti-Notification Fatigue)</h3>
    <p>
      Sistem pelaporan otomatis ini dirancang khusus dari sudut pandang <strong>Owner & CEO</strong> dengan mengintegrasikan seluruh aplikasi digital Suka Shawarma. Dokumen ini sengaja disajikan <strong>tanpa rincian teknis routing</strong> agar berfokus penuh pada <em>informasi bisnis yang bernilai uang, keamanan kas, ketersediaan stok, dan disiplin operasional</em>.
    </p>
  </div>

  <!-- TINGKAT 1: RITME OPERASIONAL HARIAN -->
  <div class="section-block">
    <div class="section-header">
      <span class="section-tag tag-daily">TINGKAT 1</span>
      <h2 class="section-title">Ritme Operasional Harian (Daily Executive Pulse)</h2>
      <span class="section-desc">Laporan berkala untuk memantau performa penjualan, kedisiplinan kru, dan kesiapan outlet.</span>
    </div>

    <table>
      <thead>
        <tr>
          <th class="col-no">No</th>
          <th class="col-time">Waktu (WIB)</th>
          <th class="col-module">Modul & Aplikasi Sumber</th>
          <th class="col-desc">Metrik Kunci & Nilai Informasi Bagi Owner</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="col-no">1</td>
          <td class="col-time">04:00 WIB</td>
          <td class="col-module">
            <span class="module-title">Sales Kemarin & Audit Kasir</span>
            <span class="app-badge">apps/pos-kasir</span> <span class="app-badge">apps/finance</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Total Omzet & Target MTD:</strong> Akumulasi omzet seluruh outlet vs target harian & bulanan berjalan.</li>
              <li><strong>Ranking & ATV:</strong> Peringkat penjualan antar cabang, Average Transaction Value, dan top 3 menu terlaris.</li>
              <li><strong class="highlight-warn">⚠️ Audit Selisih Kasir:</strong> Rekonsiliasi uang fisik di laci kasir vs total transaksi sistem (deteksi dini kas tekor/lebih).</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">2</td>
          <td class="col-time">04:01 WIB</td>
          <td class="col-module">
            <span class="module-title">Status Marcom (KOL & Ads)</span>
            <span class="app-badge">apps/marcom</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Aksi KOL Pending:</strong> Daftar nama KOL yang jadwal visit-nya masih tertahan atau draft videonya butuh review/revisi.</li>
              <li><strong>Status Tayang & Pembayaran:</strong> Jumlah video belum posting serta status pelunasan/DP influencer.</li>
              <li><strong>Realisasi Budget Iklan:</strong> Persentase penyerapan budget iklan bulanan dan rincian kampanye aktif per outlet (Meta & TikTok Ads).</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">3</td>
          <td class="col-time">04:02 WIB</td>
          <td class="col-module">
            <span class="module-title">Buffer Gudang & Stok Kritis</span>
            <span class="app-badge">apps/inventori</span> <span class="app-badge">apps/distribusi</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Ketahanan Buffer Gudang Pusat:</strong> Saldo stok aman bahan baku utama (Daging Ayam, Sapi, Kulit Tortilla, Keju, Saos).</li>
              <li><strong class="highlight-crit">🚨 Alert Cabang Kritis:</strong> Deteksi cabang outlet yang saldo bahan bakunya berada di bawah batas minimum dan butuh restock.</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">4</td>
          <td class="col-time">08:30 WIB</td>
          <td class="col-module">
            <span class="module-title">Presensi Tim Kantor Pusat (HQ)</span>
            <span class="app-badge">apps/absensi</span> <span class="app-badge">apps/HR</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Kedisiplinan Tim Manajemen:</strong> Persentase kehadiran staf kantor pendukung operasional dan logistik.</li>
              <li><strong>Daftar Keterlambatan:</strong> Rincian staf yang terlambat kritis (>15 menit) vs batas toleransi (≤15 menit).</li>
              <li><strong>Ketidakhadiran:</strong> Daftar staf yang mengajukan izin, sakit, alpa, atau cuti resmi.</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">5</td>
          <td class="col-time">10:00 WIB</td>
          <td class="col-module">
            <span class="module-title">Opening Readiness Guard</span>
            <span class="app-badge">apps/absensi</span> <span class="app-badge">apps/pos-kasir</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong class="highlight-crit">🚨 Alert Kesiapan Buka:</strong> Notifikasi seketika jika ada outlet yang hingga pukul 10:00 WIB <strong>belum ada kru check-in</strong> atau <strong>mesin kasir belum "Open Shift"</strong>.</li>
              <li><strong>Mencegah Kehilangan Penjualan:</strong> Memastikan seluruh cabang buka tepat waktu dan siap melayani pembeli.</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">6</td>
          <td class="col-time">14:00 WIB</td>
          <td class="col-module">
            <span class="module-title">Presensi Kru Operasional Outlet</span>
            <span class="app-badge">apps/absensi</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Kehadiran Lapangan:</strong> Tingkat kehadiran kru operasional di seluruh cabang se-wilayah.</li>
              <li><strong>Kesiapan Shift:</strong> Keterlambatan kru shift siang dan deteksi cabang yang kekurangan personel (<em>understaffed</em>) sebelum jam sibuk malam.</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">7</td>
          <td class="col-time">15:30 WIB</td>
          <td class="col-module">
            <span class="module-title">Rush-Hour Stock Early Warning</span>
            <span class="app-badge">apps/inventori</span> <span class="app-badge">apps/pos-kasir</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Prediksi Kebutuhan Malam:</strong> Kalkulasi laju konsumsi daging & tortilla harian vs sisa stok di outlet.</li>
              <li><strong>Penyelamatan Omzet:</strong> Memberi waktu bagi tim logistik untuk mengirimkan stok darurat sebelum jam makan malam (18:00 - 21:00 WIB).</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">8</td>
          <td class="col-time">16:00 WIB</td>
          <td class="col-module">
            <span class="module-title">Progress Penjualan Sore</span>
            <span class="app-badge">apps/pos-kasir</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Omzet Berjalan:</strong> Total pendapatan dan jumlah struk transaksi yang berhasil dihimpun s.d. pukul 16:00 WIB.</li>
              <li><strong>Early Evaluation:</strong> Menilai tren penjualan siang untuk menentukan apakah outlet perlu dorongan promo di shift malam.</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">9</td>
          <td class="col-time">22:00 WIB</td>
          <td class="col-module">
            <span class="module-title">Closing Penjualan Malam</span>
            <span class="app-badge">apps/pos-kasir</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Rekapitulasi Closing:</strong> Total omzet penutupan harian seluruh cabang outlet secara real-time.</li>
              <li><strong>Konfirmasi Tutup:</strong> Memastikan seluruh cabang telah menyelesaikan transaksi dan menutup mesin kasir secara tertib.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="doc-footer">
    <div>Halaman 1 dari 2 · Master Plan Cron Job Suka Shawarma</div>
    <div>Internal Dewan Direksi</div>
  </div>

  <!-- ==================== HALAMAN 2 ==================== -->
  <div class="page-break"></div>

  <!-- HEADER HALAMAN 2 -->
  <div class="header-container" style="margin-bottom: 8px;">
    <div>
      <div class="brand-title" style="font-size: 11pt;">SUKA <span>SHAWARMA</span> INDONESIA</div>
      <div class="doc-subtitle">Lanjutan: Pengawasan Anomali Real-Time & Evaluasi Mingguan</div>
    </div>
    <div class="header-meta">
      <div><strong>Halaman 2 dari 2</strong></div>
      <div>Klasifikasi: Internal / Direksi</div>
    </div>
  </div>

  <!-- TINGKAT 2: PENGAWASAN ANOMALI REAL-TIME -->
  <div class="section-block">
    <div class="section-header">
      <span class="section-tag tag-anomaly">TINGKAT 2</span>
      <h2 class="section-title">Pengawasan Anomali Real-Time (Zero-Spam / Exception-Based)</h2>
      <span class="section-desc">Berjalan senyap 24/7 di latar belakang; hanya mengirim notifikasi jika terjadi bahaya atau kecurangan.</span>
    </div>

    <table>
      <thead>
        <tr>
          <th class="col-no">No</th>
          <th class="col-time">Frekuensi Pengecekan</th>
          <th class="col-module">Modul & Aplikasi Sumber</th>
          <th class="col-desc">Kondisi Pemicu (Trigger) & Manfaat Bagi Bisnis</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="col-no">10</td>
          <td class="col-time">Tiap 2 Menit</td>
          <td class="col-module">
            <span class="module-title">Server & Database Down Alert</span>
            <span class="app-badge">apps/monitoring</span> <span class="app-badge">Supabase DB</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong class="highlight-crit">Kondisi Pemicu:</strong> Database kasir Supabase atau server pusat tidak merespons (<em>downtime</em>) lebih dari 2 menit.</li>
              <li><strong>Dampak Bisnis:</strong> Mencegah kasir offline di jam sibuk yang dapat memicu antrean macet dan hilangnya pelanggan. Mengirim konfirmasi pemulihan otomatis saat sistem normal kembali.</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">11</td>
          <td class="col-time">Tiap 15 Menit</td>
          <td class="col-module">
            <span class="module-title">Anti-Fraud: Void & Diskon Manual</span>
            <span class="app-badge">apps/pos-kasir</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong class="highlight-crit">Kondisi Pemicu:</strong> Terdapat kasir yang membatalkan struk (<em>Void</em>) > 3 kali dalam satu hari atau memberikan diskon manual di luar promo > Rp 100.000.</li>
              <li><strong>Dampak Bisnis:</strong> Memotong celah terbesar kebocoran kas di bisnis F&B (manipulasi pembatalan struk setelah uang tunai diterima dari pembeli).</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">12</td>
          <td class="col-time">Tiap 17:00 WIB</td>
          <td class="col-module">
            <span class="module-title">Surat Jalan Logistik Tertahan</span>
            <span class="app-badge">apps/distribusi</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong class="highlight-warn">Kondisi Pemicu:</strong> Surat Jalan pengiriman bahan baku dari Gudang Pusat berstatus terkirim > 24 jam namun belum dikonfirmasi "Diterima" oleh cabang tujuan.</li>
              <li><strong>Dampak Bisnis:</strong> Mencegah risiko bahan baku hilang dalam perjalanan atau kelalaian staf outlet yang lupa menginput barang masuk ke sistem inventori.</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">13</td>
          <td class="col-time">Tiap 2 Jam</td>
          <td class="col-module">
            <span class="module-title">Telemetri Infrastruktur & Health</span>
            <span class="app-badge">apps/monitoring</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Kondisi Pemicu:</strong> Evaluasi berkala telemetri CPU, memori RAM, kapasitas disk VPS Hostinger, dan latensi koneksi database.</li>
              <li><strong>Dampak Bisnis:</strong> Memastikan kapasitas server tetap aman menghadapi lonjakan transaksi tanpa membebani notifikasi harian Owner.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- TINGKAT 3: EVALUASI MINGGUAN -->
  <div class="section-block">
    <div class="section-header">
      <span class="section-tag tag-weekly">TINGKAT 3</span>
      <h2 class="section-title">Evaluasi Strategis Mingguan (Weekly Strategic Digest)</h2>
      <span class="section-desc">Dikirim setiap Senin pagi sebagai dasar keputusan strategis dan rapat koordinasi mingguan.</span>
    </div>

    <table>
      <thead>
        <tr>
          <th class="col-no">No</th>
          <th class="col-time">Jadwal (WIB)</th>
          <th class="col-module">Modul & Aplikasi Sumber</th>
          <th class="col-desc">Metrik Kunci & Nilai Strategis Bagi Owner</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="col-no">14</td>
          <td class="col-time">Senin 07:00 WIB</td>
          <td class="col-module">
            <span class="module-title">Estimasi Laba Bersih & Jatuh Tempo</span>
            <span class="app-badge">apps/finance</span> <span class="app-badge">apps/admin-dashboard</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Estimasi Laba Bersih MTD:</strong> Omzet berjalan dikurangi estimasi HPP (Food Cost) dan biaya OPEX operasional berjalan.</li>
              <li><strong class="highlight-warn">Jatuh Tempo Pembayaran:</strong> Rekap invoice supplier bahan baku, sewa outlet, dan tagihan utilitas yang wajib dibayarkan dalam 7 hari ke depan.</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">15</td>
          <td class="col-time">Senin 07:15 WIB</td>
          <td class="col-module">
            <span class="module-title">Audit Stock Opname & Food Waste</span>
            <span class="app-badge">apps/inventori</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>Selisih Stok Fisik vs Sistem:</strong> Rekapitulasi audit mingguan bahan baku utama di seluruh cabang.</li>
              <li><strong>Deteksi Kebocoran Porsi:</strong> Ranking outlet dengan selisih bahan tertinggi (indikator porsi daging tidak standar, pemborosan, atau bahan rusak).</li>
            </ul>
          </td>
        </tr>

        <tr>
          <td class="col-no">16</td>
          <td class="col-time">Senin 07:30 WIB</td>
          <td class="col-module">
            <span class="module-title">Efektivitas KOL vs Pertumbuhan Omzet</span>
            <span class="app-badge">apps/marcom</span> <span class="app-badge">apps/pos-kasir</span>
          </td>
          <td class="col-desc">
            <ul class="metric-list">
              <li><strong>ROI Endorsement:</strong> KOL mana yang menghasilkan views/reach tertinggi pada video yang tayang minggu lalu.</li>
              <li><strong>Dampak Terhadap Sales:</strong> Korelasi langsung antara penayangan video promosi dengan tren kenaikan omzet pada cabang terkait.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- FOOTER -->
  <div class="doc-footer">
    <div>Diterbitkan oleh <strong>Hermes AI System Architect</strong> · Suka Shawarma Multi-Outlet Platform</div>
    <div>Dokumen Resmi Internal — Format Eksekutif (Bebas Kolom Routing Teknis)</div>
  </div>

</body>
</html>
"""

async def main():
    target_dir = pathlib.Path("docs/arsitektur")
    target_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = target_dir / "Suka_Shawarma_Master_Cron_Job_Eksekutif.pdf"

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(HTML_CONTENT, wait_until="networkidle")
        await page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            margin={
                "top": "10mm",
                "right": "12mm",
                "bottom": "12mm",
                "left": "12mm",
            }
        )
        await browser.close()
    
    print(f"PDF berhasil dibuat: {pdf_path.resolve()} ({os.path.getsize(pdf_path)} bytes)")

if __name__ == "__main__":
    asyncio.run(main())
