import asyncio
import os
import pathlib
from playwright.async_api import async_playwright

HTML_CONTENT = """<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Master Matriks 34 Executive Warning & Cron Bot CEO - Suka Shawarma</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 4mm 6mm 4mm 6mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      line-height: 1.15;
      font-size: 5.8pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* HEADER */
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5px solid #0F172A;
      padding-bottom: 3px;
      margin-bottom: 3px;
    }

    .brand-title {
      font-size: 9.5pt;
      font-weight: 900;
      letter-spacing: -0.3px;
      color: #0F172A;
      text-transform: uppercase;
    }

    .brand-subtitle {
      font-size: 6.2pt;
      font-weight: 700;
      color: #D97706;
    }

    .brand-meta {
      font-size: 5.5pt;
      color: #475569;
    }

    .header-right {
      text-align: right;
      font-size: 5.5pt;
      color: #334155;
    }

    .badge-status {
      display: inline-block;
      background: #059669;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 5.2pt;
      padding: 1px 4px;
      border-radius: 2px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 1px;
    }

    /* ENGINE DISPATCHER STRIP */
    .dispatcher-banner {
      background: #0F172A;
      color: #F8FAFC;
      border-radius: 3px;
      padding: 2.5px 6px;
      margin-bottom: 3px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 5.4pt;
    }

    .dispatcher-banner strong {
      color: #38BDF8;
    }

    /* MASTER TABLE */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2px;
    }

    th {
      background: #0F172A;
      color: #FFFFFF;
      font-size: 5.6pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      padding: 2px 3px;
      text-align: left;
    }

    td {
      padding: 1.2px 3px;
      border-bottom: 1px solid #E2E8F0;
      font-size: 5.6pt;
      vertical-align: middle;
      line-height: 1.15;
    }

    tr:nth-child(even) td {
      background: #F8FAFC;
    }

    tr {
      page-break-inside: avoid;
    }

    .col-no { width: 3%; text-align: center; font-weight: 700; color: #475569; }
    .col-domain { width: 10%; }
    .col-title { width: 29%; font-weight: 700; color: #0F172A; }
    .col-engine { width: 17%; }
    .col-trigger { width: 16%; font-weight: 600; color: #B45309; }
    .col-desc { width: 25%; color: #334155; }

    /* TAGS */
    .tag {
      display: inline-block;
      font-size: 4.8pt;
      font-weight: 800;
      padding: 0.5px 2.5px;
      border-radius: 2px;
      text-transform: uppercase;
    }
    .tag-sales { background: #FEE2E2; color: #991B1B; }
    .tag-stok { background: #FEF3C7; color: #92400E; }
    .tag-ops { background: #E0E7FF; color: #3730A3; }
    .tag-hr { background: #E0F2FE; color: #075985; }
    .tag-fin { background: #D1FAE5; color: #065F46; }
    .tag-sys { background: #F3E8FF; color: #6B21A8; }

    .engine-tag {
      display: inline-block;
      font-size: 4.6pt;
      font-weight: 700;
      padding: 0.5px 2.5px;
      border-radius: 2px;
    }
    .eng-rt { background: #DC2626; color: #FFFFFF; font-weight: 800; }
    .eng-cron { background: #334155; color: #F8FAFC; font-family: ui-monospace, Menlo, Consolas, monospace; }

    /* FOOTER */
    .doc-footer {
      border-top: 1px solid #0F172A;
      padding-top: 2px;
      margin-top: 2px;
      display: flex;
      justify-content: space-between;
      font-size: 5.2pt;
      color: #64748B;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header-container">
    <div>
      <div class="brand-title">SUKA SHAWARMA — MASTER EXECUTIVE WARNING & CRON MATRIX</div>
      <div class="brand-subtitle">Matriks Tunggal 34 Warning Trigger & 6 Mesin Cron Otomatis — Bot CEO (J.A.R.V.I.S.)</div>
      <div class="brand-meta">Bot: <strong>@Agent_SukaShawarma_Bot</strong> · Notifikasi: <strong>Bos (ID 217831843)</strong> & <strong>Developer (ID 8922720261)</strong></div>
    </div>
    <div class="header-right">
      <div class="badge-status">100% ACTIVE & LIVE</div>
      <div>DB: Supabase khpkoreaaucvyqfhynfq · Coolify agents.sukashawarma.com</div>
      <div>Terverifikasi: <strong>23 Oktober 2026</strong></div>
    </div>
  </div>

  <!-- DISPATCHER BANNER -->
  <div class="dispatcher-banner">
    <div>⚡ <strong>Dispatcher Utama:</strong> <code>bot-ceo-delivery</code> (Jadwal: <code>* * * * *</code> Tiap Menit) — Mengosongkan outbox & kirim instan ke Telegram Bot API.</div>
    <div>Kecepatan Dispatch: <strong>&le; 60 Detik</strong> · Total Coverage: <strong>34 Executive Warning Triggers & 6 Engine Background</strong></div>
  </div>

  <!-- SINGLE MASTER UNIFIED TABLE -->
  <table>
    <thead>
      <tr>
        <th class="col-no">No</th>
        <th class="col-domain">Domain</th>
        <th class="col-title">Judul Peringatan Eksekutif</th>
        <th class="col-engine">Mesin / Engine</th>
        <th class="col-trigger">Jadwal / Event Pemicu</th>
        <th class="col-desc">Deskripsi & Standar Eskalasi Direksi</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="col-no">1</td>
        <td class="col-domain"><span class="tag tag-sales">SALES</span></td>
        <td class="col-title">Rekapitulasi & Ranking Penjualan Kemarin</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron subuh harian</span></td>
        <td class="col-trigger">04:00 WIB Subuh</td>
        <td class="col-desc">Briefing subuh total omzet gross, evaluasi vs target harian, ranking cabang, dan outlet performa terendah.</td>
      </tr>
      <tr>
        <td class="col-no">2</td>
        <td class="col-domain"><span class="tag tag-sales">MARCOM</span></td>
        <td class="col-title">Ringkasan Kinerja Marketing & Promo Kemarin</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron evaluasi marcom</span></td>
        <td class="col-trigger">04:01 WIB Subuh</td>
        <td class="col-desc">Laporan penyerapan voucher diskon, promo aktif, perolehan pelanggan baru, dan efektivitas channel marcom.</td>
      </tr>
      <tr>
        <td class="col-no">3</td>
        <td class="col-domain"><span class="tag tag-hr">HR HQ</span></td>
        <td class="col-title">Laporan Presensi Staf Kantor Pusat (HQ)</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron presensi pagi hq</span></td>
        <td class="col-trigger">08:30 WIB Pagi</td>
        <td class="col-desc">Kehadiran staf kantor pusat (Direksi, Finance, HRD, Purchasing) memuat tepat waktu, izin, sakit, dan terlambat.</td>
      </tr>
      <tr>
        <td class="col-no">4</td>
        <td class="col-domain"><span class="tag tag-hr">HR OUTLET</span></td>
        <td class="col-title">Laporan Presensi Kru Seluruh Outlet</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron presensi siang</span></td>
        <td class="col-trigger">14:00 WIB Siang</td>
        <td class="col-desc">Konsolidasi presensi seluruh kru dan leader cabang shift pagi & siang, deteksi outlet understaffed dan kru alpa.</td>
      </tr>
      <tr>
        <td class="col-no">5</td>
        <td class="col-domain"><span class="tag tag-sales">SALES</span></td>
        <td class="col-title">Flash Report Penjualan Sore</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron monitoring sore</span></td>
        <td class="col-trigger">16:00 WIB Sore</td>
        <td class="col-desc">Pencapaian omzet sore terhadap target, porsi terjual, dan cabang dengan pergerakan transaksi terendah.</td>
      </tr>
      <tr>
        <td class="col-no">6</td>
        <td class="col-domain"><span class="tag tag-sales">SALES</span></td>
        <td class="col-title">Eskalasi Cabang Masih Rp 0 di Prime Time</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron audit malam</span></td>
        <td class="col-trigger">19:30 WIB Malam</td>
        <td class="col-desc">Alert jika ada outlet yang sudah buka namun belum menghasilkan transaksi sama sekali di jam prime time malam.</td>
      </tr>
      <tr>
        <td class="col-no">7</td>
        <td class="col-domain"><span class="tag tag-sales">SALES</span></td>
        <td class="col-title">Laporan Penutupan & Omzet Final Harian</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron closing harian</span></td>
        <td class="col-trigger">22:00 WIB Malam</td>
        <td class="col-desc">Rangkuman eksekutif closing seluruh gerai: total omzet vs target bulanan, best performing outlet, dan total porsi.</td>
      </tr>
      <tr>
        <td class="col-no">8</td>
        <td class="col-domain"><span class="tag tag-stok">STOK</span></td>
        <td class="col-title">Eskalasi Cut-Off Stok Opname Malam</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron cut-off malam</span></td>
        <td class="col-trigger">22:30 WIB Malam</td>
        <td class="col-desc">Rekapitulasi kepatuhan opname harian seluruh outlet sebelum tutup toko, mendata cabang yang belum submit atau draft.</td>
      </tr>
      <tr>
        <td class="col-no">9</td>
        <td class="col-domain"><span class="tag tag-stok">STOK</span></td>
        <td class="col-title">Notifikasi Rekap Finalize Stok Opname Cabang</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">opname &rarr; finalized</td>
        <td class="col-desc">Pemberitahuan instan saat gerai memfinalisasi opname fisik beserta rekap persentase kepatuhan jaringan outlet.</td>
      </tr>
      <tr>
        <td class="col-no">10</td>
        <td class="col-domain"><span class="tag tag-sales">VOID POS</span></td>
        <td class="col-title">Eskalasi Pembatalan / Void POS Berisiko Kritis</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">orders void &ge; 50k / beruntun</td>
        <td class="col-desc">Peringatan saat terjadi pembatalan POS bernilai &ge; Rp 50.000 atau terjadi pembatalan beruntun &ge; 2x di satu cabang.</td>
      </tr>
      <tr>
        <td class="col-no">11</td>
        <td class="col-domain"><span class="tag tag-fin">CASH VAR</span></td>
        <td class="col-title">Eskalasi Selisih Kas Kritis Closing Shift</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">shifts close selisih &gt; 100k</td>
        <td class="col-desc">Notifikasi darurat saat kasir menutup shift dengan selisih kas fisik laci atau petty cash melebihi Rp 100.000.</td>
      </tr>
      <tr>
        <td class="col-no">12</td>
        <td class="col-domain"><span class="tag tag-ops">OPERASIONAL</span></td>
        <td class="col-title">Eskalasi Keterlambatan Buka Gerai (&ge; 30 Menit)</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron telat-buka</span></td>
        <td class="col-trigger">Tiap 5 menit (Jam buka + 30m)</td>
        <td class="col-desc">Eskalasi jika gerai belum beroperasi (kasir belum buka & kru belum absen) setelah 30 menit dari jadwal buka resmi.</td>
      </tr>
      <tr>
        <td class="col-no">13</td>
        <td class="col-domain"><span class="tag tag-stok">WASTE</span></td>
        <td class="col-title">Eskalasi Pengajuan Waste Bahan Baku (&gt; 150rb)</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">stok_waste &gt; 150k</td>
        <td class="col-desc">Alert eskalasi saat cabang mengajukan waste bahan baku melebihi ambang batas wajar toleransi Rp 150.000.</td>
      </tr>
      <tr>
        <td class="col-no">14</td>
        <td class="col-domain"><span class="tag tag-sys">WATCHDOG</span></td>
        <td class="col-title">Heartbeat & Diagnostik Infrastruktur VPS</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron watchdog</span></td>
        <td class="col-trigger">Tiap 2 Jam Berkala</td>
        <td class="col-desc">Pemeriksaan rutin ketersediaan DB Supabase, latency API bot, antrean alert outbox, dan sisa storage server.</td>
      </tr>
      <tr>
        <td class="col-no">15</td>
        <td class="col-domain"><span class="tag tag-sys">SERVER</span></td>
        <td class="col-title">Alert Darurat Server / Database Down</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">Healthcheck kegagalan koneksi</td>
        <td class="col-desc">Peringatan darurat tingkat tinggi jika API backend atau koneksi database terputus lebih dari 2 menit.</td>
      </tr>
      <tr>
        <td class="col-no">16</td>
        <td class="col-domain"><span class="tag tag-ops">REVIEW</span></td>
        <td class="col-title">Eskalasi Ulasan Negatif Google Maps (SukaReview)</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">Google Review &le; 2⭐</td>
        <td class="col-desc">Eskalasi saat ulasan komplain bintang 1 atau 2 masuk di Google Maps cabang untuk intervensi cepat reputasi.</td>
      </tr>
      <tr>
        <td class="col-no">17</td>
        <td class="col-domain"><span class="tag tag-sales">KASIR</span></td>
        <td class="col-title">Shift Kasir Belum Ditutup Lewat Jam Operasional</td>
        <td class="col-engine"><span class="engine-tag eng-cron">bot-ceo-unclosed-shifts</span></td>
        <td class="col-trigger">23:45 WIB Malam</td>
        <td class="col-desc">Peringatan shift kasir belum di-close saat gerai telah selesai jam operasional toko, berisiko mengacaukan EOM.</td>
      </tr>
      <tr>
        <td class="col-no">18</td>
        <td class="col-domain"><span class="tag tag-fin">KASIR</span></td>
        <td class="col-title">Anomali Rasio Uang Tunai saat Closing (&ge; 85%)</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">shifts close porsi cash &ge; 85%</td>
        <td class="col-desc">Deteksi anomali porsi pembayaran tunai tidak wajar (&ge; 85%) di gerai modern/urban (potensi manipulasi QRIS).</td>
      </tr>
      <tr>
        <td class="col-no">19</td>
        <td class="col-domain"><span class="tag tag-sales">DISCOUNT</span></td>
        <td class="col-title">Lonjakan Diskon Manual / Indikasi Voucher Abuse</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">orders diskon manual &ge; 100k</td>
        <td class="col-desc">Peringatan saat kasir memberikan diskon manual berlebih dalam 1 struk atau indikasi pemakaian voucher palsu.</td>
      </tr>
      <tr>
        <td class="col-no">20</td>
        <td class="col-domain"><span class="tag tag-ops">RETAIL</span></td>
        <td class="col-title">Lonjakan Pembatalan Order Online oleh Kru Toko</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">order app ditolak toko &ge; 2x</td>
        <td class="col-desc">Eskalasi darurat saat kru cabang sengaja menolak pesanan masuk aplikasi pelanggan &ge; 2x dalam 1 jam.</td>
      </tr>
      <tr>
        <td class="col-no">21</td>
        <td class="col-domain"><span class="tag tag-stok">LOGISTIK</span></td>
        <td class="col-title">Penolakan Bahan Baku Kiriman Central Kitchen</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">retur_stok inbound rejected</td>
        <td class="col-desc">Pemberitahuan saat cabang menolak fisik bahan baku kiriman Central Kitchen akibat kualitas rusak atau salah kirim.</td>
      </tr>
      <tr>
        <td class="col-no">22</td>
        <td class="col-domain"><span class="tag tag-stok">LOGISTIK</span></td>
        <td class="col-title">Surat Jalan CK Menggantung (&gt; 3.5 Jam / Closing)</td>
        <td class="col-engine"><span class="engine-tag eng-cron">cron sj-gantung</span></td>
        <td class="col-trigger">Tiap 15 Menit (17:00 - 23:00)</td>
        <td class="col-desc">Deteksi pengiriman bahan baku dari Central Kitchen yang tersendat lama di perjalanan atau belum diterima toko.</td>
      </tr>
      <tr>
        <td class="col-no">23</td>
        <td class="col-domain"><span class="tag tag-stok">STOK</span></td>
        <td class="col-title">Penurunan Saldo Stok Bahan Baku Drastis (&ge; 50%)</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">stok_balance saldo drop &ge; 50%</td>
        <td class="col-desc">Deteksi anomali penurunan saldo stok bahan baku utama dalam satu mutasi tunggal (potensi kebocoran/pencurian).</td>
      </tr>
      <tr>
        <td class="col-no">24</td>
        <td class="col-domain"><span class="tag tag-stok">OPNAME</span></td>
        <td class="col-title">Rekapitulasi Cabang Belum Finalisasi Opname</td>
        <td class="col-engine"><span class="engine-tag eng-cron">bot-ceo-opname-missing</span></td>
        <td class="col-trigger">23:15 WIB Malam</td>
        <td class="col-desc">Rekapitulasi cut-off malam yang merangkum daftar seluruh gerai yang belum menyelesaikan dan memfinalisasi stok opname.</td>
      </tr>
      <tr>
        <td class="col-no">25</td>
        <td class="col-domain"><span class="tag tag-hr">SDM KRU</span></td>
        <td class="col-title">Cabang Kritis Kekurangan Kru (Hanya 1 Orang Hadir)</td>
        <td class="col-engine"><span class="engine-tag eng-cron">bot-ceo-kru-absensi</span></td>
        <td class="col-trigger">14:45 WIB Siang</td>
        <td class="col-desc">Peringatan otomatis saat gerai hanya dijaga 1 orang kru pada jam operasional aktif (antrean berisiko bottleneck parah).</td>
      </tr>
      <tr>
        <td class="col-no">26</td>
        <td class="col-domain"><span class="tag tag-hr">SDM KRU</span></td>
        <td class="col-title">Anomali Absen Massal di Satu Gerai (&ge; 50% Kru)</td>
        <td class="col-engine"><span class="engine-tag eng-cron">bot-ceo-kru-absensi</span></td>
        <td class="col-trigger">15:30 WIB Siang</td>
        <td class="col-desc">Deteksi ketidakhadiran abnormal di satu gerai (&ge; 3 kru atau &ge; 50% kru absen) untuk mengantisipasi mogok kerja.</td>
      </tr>
      <tr>
        <td class="col-no">27</td>
        <td class="col-domain"><span class="tag tag-hr">FRAUD GPS</span></td>
        <td class="col-title">Percobaan Titip Absen / Fake GPS di Luar Radius</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">attendance radius &gt; 100m</td>
        <td class="col-desc">Deteksi presensi clock-in dengan koordinat di luar radius batas aman toko (&gt; 100m) untuk mencegah kecurangan kehadiran.</td>
      </tr>
      <tr>
        <td class="col-no">28</td>
        <td class="col-domain"><span class="tag tag-ops">SUPERVISI</span></td>
        <td class="col-title">Hasil Supervisi Area Manager Kategori BURUK</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">ceklist_harian kategori Buruk</td>
        <td class="col-desc">Eskalasi darurat saat kunjungan Area Manager menemukan standar higienitas/rasa produk bernilai buruk agar segera diintervensi.</td>
      </tr>
      <tr>
        <td class="col-no">29</td>
        <td class="col-domain"><span class="tag tag-ops">SUPERVISI</span></td>
        <td class="col-title">Cabang Belum Disupervisi Area Manager Hari Ini</td>
        <td class="col-engine"><span class="engine-tag eng-cron">bot-ceo-checklist-missing</span></td>
        <td class="col-trigger">21:00 WIB Malam</td>
        <td class="col-desc">Peringatan pengawasan malam saat ada gerai aktif yang terlewat tanpa kunjungan/supervisi checklist harian Area Manager.</td>
      </tr>
      <tr>
        <td class="col-no">30</td>
        <td class="col-domain"><span class="tag tag-hr">KASBON</span></td>
        <td class="col-title">Pengajuan Kasbon Karyawan Berisiko Tinggi</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">cash_advances &gt; 2.5jt / probation</td>
        <td class="col-desc">Peringatan saat staf mengajukan kasbon &gt; Rp 2.500.000 atau diajukan kru baru (&lt; 90 hari kerja) untuk memitigasi flight risk.</td>
      </tr>
      <tr>
        <td class="col-no">31</td>
        <td class="col-domain"><span class="tag tag-hr">TURNOVER</span></td>
        <td class="col-title">Anomali Gelombang Resign Kru (&ge; 3 Staf / 30 Hari)</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">outlet_staff nonaktif &ge; 3</td>
        <td class="col-desc">Deteksi lonjakan perputaran staf (turnover) dalam 30 hari di toko yang sama untuk evaluasi kepemimpinan lokal.</td>
      </tr>
      <tr>
        <td class="col-no">32</td>
        <td class="col-domain"><span class="tag tag-fin">PETTY CASH</span></td>
        <td class="col-title">Saldo Kas Kecil Jebol / Minus (Defisit Laci Toko)</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">petty_cash saldo &lt; 0 / minus</td>
        <td class="col-desc">Peringatan otomatis saat pengeluaran kas kecil membuat saldo outlet minus atau selisih fisik petty cash tekor parah saat closing.</td>
      </tr>
      <tr>
        <td class="col-no">33</td>
        <td class="col-domain"><span class="tag tag-fin">NOTA FIKTIF</span></td>
        <td class="col-title">Pengeluaran Kas Tanpa Bukti Nota Fisik</td>
        <td class="col-engine"><span class="engine-tag eng-rt">REAL-TIME</span></td>
        <td class="col-trigger">petty_cash &ge; 50k tanpa foto struk</td>
        <td class="col-desc">Deteksi pengeluaran kas operasional &ge; Rp 50.000 tanpa lampiran bukti foto struk/nota fisik yang sah (indikasi fraud).</td>
      </tr>
      <tr>
        <td class="col-no">34</td>
        <td class="col-domain"><span class="tag tag-fin">SETORAN</span></td>
        <td class="col-title">Uang Setoran Tunai Menggantung di Gerai (&gt; 48 Jam)</td>
        <td class="col-engine"><span class="engine-tag eng-cron">bot-ceo-setoran-tertahan</span></td>
        <td class="col-trigger">10:00 WIB Pagi</td>
        <td class="col-desc">Audit harian terhadap shift kasir tertutup yang memiliki akumulasi uang cash &ge; Rp 300.000 belum disetor ke bank &gt; 2 hari.</td>
      </tr>
    </tbody>
  </table>

  <!-- FOOTER -->
  <div class="doc-footer">
    <div>Diterbitkan oleh: <strong>Hermes AI Automation System</strong> · Suka Shawarma Multi-Outlet Platform</div>
    <div>Dokumen Resmi Internal Direksi — Format Master Matriks Terpadu Bebas Redundansi (1 Lembar Utuh)</div>
    <div>Sistem Live: <strong>agents.sukashawarma.com</strong> · Target Bot: <strong>@Agent_SukaShawarma_Bot</strong></div>
  </div>

</body>
</html>
"""

async def main():
    target_dir = pathlib.Path("docs/arsitektur")
    target_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = target_dir / "Suka_Shawarma_CEO_Bot_34_Warning_Triggers_Matrix.pdf"

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(HTML_CONTENT, wait_until="networkidle")
        await page.pdf(
            path=str(pdf_path),
            format="A4",
            print_background=True,
            margin={
                "top": "4mm",
                "right": "6mm",
                "bottom": "4mm",
                "left": "6mm",
            }
        )
        await browser.close()
    
    print(f"PDF terpadu berhasil dibuat: {pdf_path.resolve()} ({os.path.getsize(pdf_path)} bytes)")

if __name__ == "__main__":
    asyncio.run(main())
