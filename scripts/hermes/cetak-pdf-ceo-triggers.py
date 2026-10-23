import asyncio
import os
import pathlib
from playwright.async_api import async_playwright

HTML_CONTENT = """<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Matriks 34 Executive Warning Triggers & Cron Bot CEO - Suka Shawarma</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm 10mm 10mm;
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
      line-height: 1.35;
      font-size: 7.5pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }

    .brand-title {
      font-size: 13pt;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0F172A;
      text-transform: uppercase;
    }

    .brand-subtitle {
      font-size: 8pt;
      font-weight: 700;
      color: #D97706;
      margin-top: 1px;
    }

    .brand-meta {
      font-size: 7pt;
      color: #475569;
      margin-top: 2px;
    }

    .header-right {
      text-align: right;
      font-size: 7pt;
      color: #334155;
    }

    .badge-status {
      display: inline-block;
      background: #059669;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 6.5pt;
      padding: 2px 7px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }

    /* SUMMARY BANNER */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }

    .summary-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 5px;
      padding: 6px 8px;
      border-left: 3px solid #0F172A;
    }

    .summary-card.sales { border-left-color: #EF4444; }
    .summary-card.stok { border-left-color: #F59E0B; }
    .summary-card.ops { border-left-color: #3B82F6; }
    .summary-card.finance { border-left-color: #10B981; }

    .summary-title {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748B;
    }

    .summary-val {
      font-size: 11pt;
      font-weight: 800;
      color: #0F172A;
      margin-top: 1px;
    }

    .summary-desc {
      font-size: 6pt;
      color: #475569;
      margin-top: 1px;
    }

    /* SECTION TITLE */
    .section-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0F172A;
      background: #F1F5F9;
      padding: 4px 8px;
      border-radius: 4px;
      margin-top: 8px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-left: 3px solid #D97706;
    }

    .section-meta {
      font-size: 6.5pt;
      font-weight: 600;
      color: #64748B;
    }

    /* TABLES */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }

    th {
      background: #0F172A;
      color: #FFFFFF;
      font-size: 6.8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 4px 6px;
      text-align: left;
    }

    td {
      padding: 4px 6px;
      border-bottom: 1px solid #E2E8F0;
      font-size: 7pt;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background: #F8FAFC;
    }

    tr {
      page-break-inside: avoid;
    }

    .col-no { width: 4%; text-align: center; font-weight: 700; }
    .col-id { width: 18%; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 6.2pt; color: #475569; }
    .col-title { width: 28%; font-weight: 700; color: #0F172A; }
    .col-trigger { width: 18%; font-size: 6.5pt; color: #D97706; font-weight: 600; }
    .col-desc { width: 32%; font-size: 6.7pt; color: #334155; }

    /* DOMAIN BADGES */
    .domain-tag {
      display: inline-block;
      font-size: 5.5pt;
      font-weight: 800;
      text-transform: uppercase;
      padding: 1px 4px;
      border-radius: 3px;
      margin-right: 4px;
      vertical-align: middle;
    }
    .tag-sales { background: #FEE2E2; color: #991B1B; }
    .tag-stok { background: #FEF3C7; color: #92400E; }
    .tag-ops { background: #E0E7FF; color: #3730A3; }
    .tag-hr { background: #E0F2FE; color: #075985; }
    .tag-fin { background: #D1FAE5; color: #065F46; }
    .tag-sys { background: #F3E8FF; color: #6B21A8; }

    .rt-badge {
      display: inline-block;
      background: #DC2626;
      color: #FFFFFF;
      font-size: 5.2pt;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 3px;
      text-transform: uppercase;
      margin-left: 3px;
    }

    .cron-badge {
      display: inline-block;
      background: #475569;
      color: #FFFFFF;
      font-size: 5.2pt;
      font-weight: 800;
      padding: 1px 4px;
      border-radius: 3px;
      text-transform: uppercase;
      margin-left: 3px;
    }

    /* FOOTER */
    .doc-footer {
      border-top: 1.5px solid #0F172A;
      padding-top: 6px;
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 6.5pt;
      color: #64748B;
    }

    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header-container">
    <div>
      <div class="brand-title">SUKA SHAWARMA — EXECUTIVE WARNING MATRIX</div>
      <div class="brand-subtitle">Matriks 34 Trigger Warning & 6 Cron Engine Bot CEO (J.A.R.V.I.S.)</div>
      <div class="brand-meta">Target Bot: <strong>@Agent_SukaShawarma_Bot</strong> · Penerima Utama: <strong>Bos (ID 217831843)</strong> & <strong>Developer (ID 8922720261)</strong></div>
    </div>
    <div class="header-right">
      <div class="badge-status">100% LIVE & DEPLOYED</div>
      <div><strong>Ecosystem:</strong> Supabase khpkoreaaucvyqfhynfq</div>
      <div><strong>Engine:</strong> Coolify agents.sukashawarma.com</div>
      <div><strong>Tanggal:</strong> 23 Oktober 2026</div>
    </div>
  </div>

  <!-- SUMMARY CARDS -->
  <div class="summary-grid">
    <div class="summary-card sales">
      <div class="summary-title">Sales & Revenue</div>
      <div class="summary-val">8 Triggers</div>
      <div class="summary-desc">Void &gt;50k, Selisih kas &gt;100k, Omzet 04:00, 16:00, 22:00, Zero sales.</div>
    </div>
    <div class="summary-card stok">
      <div class="summary-title">Stok & Central Kitchen</div>
      <div class="summary-val">7 Triggers</div>
      <div class="summary-desc">SJ gantung &gt;3.5 jam, Waste &gt;150k, Opname final, Phantom drop 50%.</div>
    </div>
    <div class="summary-card ops">
      <div class="summary-title">Operasional & HR</div>
      <div class="summary-val">12 Triggers</div>
      <div class="summary-desc">Telat buka 30m, Fake GPS &gt;100m, Understaffed, Sidak buruk, Review 1-2⭐.</div>
    </div>
    <div class="summary-card finance">
      <div class="summary-title">Finance & Kas Kecil</div>
      <div class="summary-val">7 Triggers</div>
      <div class="summary-desc">Kas kecil defisit/minus, Nota fiktif, Setoran tertahan &gt;48 jam, Watchdog.</div>
    </div>
  </div>

  <!-- BAGIAN 1: CRON BACKGROUND JOBS -->
  <div class="section-title">
    <span>BAGIAN 1: 6 ENGINE CRON DATABASE TERJADWAL (pg_cron)</span>
    <span class="section-meta">Otomatis Berjalan di Background Supabase Cloud</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 4%; text-align: center;">No</th>
        <th style="width: 22%;">Nama Cron Job</th>
        <th style="width: 15%;">Jadwal (WIB)</th>
        <th style="width: 20%;">Perintah Database</th>
        <th style="width: 39%;">Fungsi Pengawasan & Eskalasi Eksekutif</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="col-no">1</td>
        <td><strong>bot-ceo-delivery</strong></td>
        <td><span class="cron-badge">Tiap Menit</span> <code>* * * * *</code></td>
        <td><code>bot_ceo_kirim_antrean()</code></td>
        <td>Dispatcher pengiriman antrean outbox ke Telegram Bot API @Agent_SukaShawarma_Bot.</td>
      </tr>
      <tr>
        <td class="col-no">2</td>
        <td><strong>bot-ceo-kru-absensi</strong></td>
        <td><span class="cron-badge">14:45 & 15:45 WIB</span></td>
        <td><code>bot_ceo_cek_kru_dan_absensi()</code></td>
        <td>Mendeteksi cabang understaffed (hanya 1 orang hadir) dan anomali alpa massal (&ge; 50% kru absen).</td>
      </tr>
      <tr>
        <td class="col-no">3</td>
        <td><strong>bot-ceo-checklist-missing</strong></td>
        <td><span class="cron-badge">21:00 WIB</span></td>
        <td><code>bot_ceo_cek_checklist_missing()</code></td>
        <td>Audit kepatuhan supervisi: mendata seluruh cabang yang belum dikunjungi Area Manager hari ini.</td>
      </tr>
      <tr>
        <td class="col-no">4</td>
        <td><strong>bot-ceo-opname-missing</strong></td>
        <td><span class="cron-badge">23:15 WIB</span></td>
        <td><code>bot_ceo_cek_opname_terlambat_malam()</code></td>
        <td>Peringatan darurat cut-off malam: merangkum daftar cabang yang belum submit atau belum finalisasi opname.</td>
      </tr>
      <tr>
        <td class="col-no">5</td>
        <td><strong>bot-ceo-unclosed-shifts</strong></td>
        <td><span class="cron-badge">23:45 WIB</span></td>
        <td><code>bot_ceo_cek_unclosed_shifts()</code></td>
        <td>Deteksi kasir gantung: shift POS yang masih berstatus 'open' melewati jam operasional toko.</td>
      </tr>
      <tr>
        <td class="col-no">6</td>
        <td><strong>bot-ceo-setoran-tertahan</strong></td>
        <td><span class="cron-badge">10:00 WIB</span></td>
        <td><code>bot_ceo_cek_setoran_tertahan()</code></td>
        <td>Audit kepatuhan perbankan: uang cash closing shift &ge; Rp 300.000 tertahan &gt; 48 jam belum disetor ke bank.</td>
      </tr>
    </tbody>
  </table>

  <!-- BAGIAN 2: DAFTAR LENGKAP 34 EXECUTIVE WARNING TRIGGERS -->
  <div class="section-title">
    <span>BAGIAN 2: DAFTAR LENGKAP 34 EXECUTIVE WARNING TRIGGERS (URUTAN 1 S/D 34)</span>
    <span class="section-meta">Terdaftar di bot_trigger_catalog · Role: Owner & Admin</span>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-no">No</th>
        <th class="col-id">ID Trigger Catalog</th>
        <th class="col-title">Judul Peringatan & Domain</th>
        <th class="col-trigger">Jadwal / Pemicu</th>
        <th class="col-desc">Deskripsi & Standar Eskalasi Eksekutif</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="col-no">1</td>
        <td class="col-id">tg_ceo_sales_kemarin_0400</td>
        <td class="col-title"><span class="domain-tag tag-sales">SALES</span>Rekap & Ranking Sales Kemarin <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">04:00 WIB Subuh</td>
        <td class="col-desc">Briefing subuh total gross omzet, perbandingan target harian, ranking cabang, dan outlet performa terendah.</td>
      </tr>
      <tr>
        <td class="col-no">2</td>
        <td class="col-id">tg_ceo_marcom_0401</td>
        <td class="col-title"><span class="domain-tag tag-sales">MARCOM</span>Kinerja Marketing & Promo <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">04:01 WIB Subuh</td>
        <td class="col-desc">Laporan penyerapan voucher diskon, promo aktif, perolehan pelanggan baru, dan efektivitas channel marcom.</td>
      </tr>
      <tr>
        <td class="col-no">3</td>
        <td class="col-id">tg_ceo_absensi_hq_0830</td>
        <td class="col-title"><span class="domain-tag tag-hr">HR HQ</span>Presensi Kantor Pusat (HQ) <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">08:30 WIB Pagi</td>
        <td class="col-desc">Kehadiran tim kantor pusat (Direksi, Finance, HRD, Purchasing, Marcom) pagi hari memuat hadir, izin, sakit, telat.</td>
      </tr>
      <tr>
        <td class="col-no">4</td>
        <td class="col-id">tg_ceo_absensi_outlet_1400</td>
        <td class="col-title"><span class="domain-tag tag-hr">HR KRU</span>Presensi Kru Seluruh Outlet <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">14:00 WIB Siang</td>
        <td class="col-desc">Konsolidasi presensi seluruh kru dan leader cabang shift pagi & siang, mendeteksi outlet understaffed dan kru alpa.</td>
      </tr>
      <tr>
        <td class="col-no">5</td>
        <td class="col-id">tg_ceo_sales_sore_1600</td>
        <td class="col-title"><span class="domain-tag tag-sales">SALES</span>Flash Report Penjualan Sore <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">16:00 WIB Sore</td>
        <td class="col-desc">Pencapaian omzet sore terhadap target, porsi terjual, dan cabang dengan pergerakan transaksi terendah.</td>
      </tr>
      <tr>
        <td class="col-no">6</td>
        <td class="col-id">tg_ceo_zero_sales_1930</td>
        <td class="col-title"><span class="domain-tag tag-sales">SALES</span>Cabang Masih Rp 0 di Prime Time <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">19:30 WIB Malam</td>
        <td class="col-desc">Alert jika ada outlet yang sudah buka namun belum menghasilkan transaksi sama sekali di jam prime time malam.</td>
      </tr>
      <tr>
        <td class="col-no">7</td>
        <td class="col-id">tg_ceo_sales_malam_2200</td>
        <td class="col-title"><span class="domain-tag tag-sales">SALES</span>Closing Omzet Final Harian <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">22:00 WIB Malam</td>
        <td class="col-desc">Rangkuman closing harian seluruh gerai: total omzet vs target, best performing outlet, total porsi, dan evaluasi closing.</td>
      </tr>
      <tr>
        <td class="col-no">8</td>
        <td class="col-id">tg_ceo_opname_cutoff_2230</td>
        <td class="col-title"><span class="domain-tag tag-stok">STOK</span>Cut-Off Stok Opname Malam <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">22:30 WIB Malam</td>
        <td class="col-desc">Rekapitulasi kepatuhan opname harian seluruh outlet sebelum tutup toko, mendata cabang yang belum submit atau draft.</td>
      </tr>
      <tr>
        <td class="col-no">9</td>
        <td class="col-id">tg_ceo_opname_finalized</td>
        <td class="col-title"><span class="domain-tag tag-stok">STOK</span>Rekap Finalize Stok Opname <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">opname &rarr; finalized</td>
        <td class="col-desc">Pemberitahuan instan saat gerai memfinalisasi opname fisik beserta rekap persentase kepatuhan jaringan outlet.</td>
      </tr>
      <tr>
        <td class="col-no">10</td>
        <td class="col-id">tg_ceo_void_eskalasi</td>
        <td class="col-title"><span class="domain-tag tag-sales">VOID POS</span>Pembatalan / Void Berisiko Kritis <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">orders void &ge; 50k / beruntun</td>
        <td class="col-desc">Peringatan saat terjadi pembatalan POS bernilai &ge; Rp 50.000 atau terjadi pembatalan beruntun &ge; 2x di satu cabang.</td>
      </tr>
      <tr>
        <td class="col-no">11</td>
        <td class="col-id">tg_ceo_cash_var_eskalasi</td>
        <td class="col-title"><span class="domain-tag tag-fin">CASH VAR</span>Selisih Kas Kritis Closing Shift <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">shifts close selisih &gt; 100k</td>
        <td class="col-desc">Notifikasi darurat saat kasir menutup shift dengan selisih kas fisik laci atau petty cash melebihi Rp 100.000.</td>
      </tr>
      <tr>
        <td class="col-no">12</td>
        <td class="col-id">tg_ceo_late_open_eskalasi</td>
        <td class="col-title"><span class="domain-tag tag-ops">OPERASIONAL</span>Keterlambatan Buka Gerai (&ge; 30m) <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">Tiap 5 menit (Jam buka + 30m)</td>
        <td class="col-desc">Eskalasi jika gerai belum beroperasi (kasir belum buka & kru belum absen) setelah 30 menit dari jadwal buka resmi.</td>
      </tr>
      <tr>
        <td class="col-no">13</td>
        <td class="col-id">tg_ceo_waste_eskalasi</td>
        <td class="col-title"><span class="domain-tag tag-stok">WASTE</span>Pengajuan Waste Bahan (&gt; 150rb) <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">stok_waste &gt; 150k</td>
        <td class="col-desc">Alert eskalasi saat cabang mengajukan waste bahan baku melebihi ambang batas wajar Rp 150.000.</td>
      </tr>
      <tr>
        <td class="col-no">14</td>
        <td class="col-id">tg_ceo_watchdog_2h</td>
        <td class="col-title"><span class="domain-tag tag-sys">WATCHDOG</span>Heartbeat & Diagnostik Sistem <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">Tiap 2 Jam Berkala</td>
        <td class="col-desc">Pemeriksaan rutin ketersediaan DB Supabase, latency API bot, antrean alert outbox, dan sisa storage.</td>
      </tr>
      <tr>
        <td class="col-no">15</td>
        <td class="col-id">tg_ceo_alert_down</td>
        <td class="col-title"><span class="domain-tag tag-sys">SERVER</span>Alert Darurat Server / Database Down <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">Healthcheck kegagalan koneksi</td>
        <td class="col-desc">Peringatan darurat tingkat tinggi jika API backend atau database terputus lebih dari 2 menit.</td>
      </tr>
      <tr>
        <td class="col-no">16</td>
        <td class="col-id">tg_ceo_review_kritis</td>
        <td class="col-title"><span class="domain-tag tag-ops">REVIEW</span>Ulasan Negatif Google Review <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">Google Review &le; 2⭐</td>
        <td class="col-desc">Eskalasi saat ulasan komplain bintang 1 atau 2 masuk di Google Maps cabang untuk intervensi cepat reputasi.</td>
      </tr>
      <tr>
        <td class="col-no">17</td>
        <td class="col-id">tg_ceo_pos_unclosed_shift</td>
        <td class="col-title"><span class="domain-tag tag-sales">KASIR</span>Shift Belum Ditutup Tengah Malam <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">23:45 WIB Malam</td>
        <td class="col-desc">Peringatan shift kasir belum di-close saat gerai telah selesai jam operasional toko, berisiko mengacaukan EOM.</td>
      </tr>
    </tbody>
  </table>

  <!-- PAGE BREAK FOR CLEAN TABLE READABILITY -->
  <div class="page-break"></div>

  <!-- HEADER CONTINUATION -->
  <div class="header-container">
    <div>
      <div class="brand-title">SUKA SHAWARMA — EXECUTIVE WARNING MATRIX (LANJUTAN)</div>
      <div class="brand-subtitle">Matriks 34 Trigger Warning & 6 Cron Engine Bot CEO — Bagian 2 (Item 18 s/d 34)</div>
    </div>
    <div class="header-right">
      <div class="badge-status">HALAMAN 2 / 2</div>
      <div><strong>Target:</strong> @Agent_SukaShawarma_Bot</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-no">No</th>
        <th class="col-id">ID Trigger Catalog</th>
        <th class="col-title">Judul Peringatan & Domain</th>
        <th class="col-trigger">Jadwal / Pemicu</th>
        <th class="col-desc">Deskripsi & Standar Eskalasi Eksekutif</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="col-no">18</td>
        <td class="col-id">tg_ceo_pos_cash_ratio_anomaly</td>
        <td class="col-title"><span class="domain-tag tag-fin">KASIR</span>Anomali Rasio Uang Tunai (&ge; 85%) <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">shifts close porsi cash &ge; 85%</td>
        <td class="col-desc">Deteksi anomali porsi pembayaran tunai tidak wajar (&ge; 85%) di gerai modern/urban (potensi manipulasi QRIS).</td>
      </tr>
      <tr>
        <td class="col-no">19</td>
        <td class="col-id">tg_ceo_marcom_voucher_abuse</td>
        <td class="col-title"><span class="domain-tag tag-sales">DISCOUNT</span>Lonjakan Diskon Manual / Voucher <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">orders diskon manual &ge; 100k</td>
        <td class="col-desc">Peringatan saat kasir memberikan diskon manual berlebih dalam 1 struk atau indikasi pemakaian voucher palsu.</td>
      </tr>
      <tr>
        <td class="col-no">20</td>
        <td class="col-id">tg_ceo_retail_store_rejection_surge</td>
        <td class="col-title"><span class="domain-tag tag-ops">RETAIL</span>Pembatalan Pesanan Online oleh Kru <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">order app ditolak toko &ge; 2x</td>
        <td class="col-desc">Eskalasi darurat saat kru cabang sengaja menolak pesanan masuk aplikasi pelanggan &ge; 2x dalam 1 jam.</td>
      </tr>
      <tr>
        <td class="col-no">21</td>
        <td class="col-id">tg_ceo_distribusi_inbound_rejected</td>
        <td class="col-title"><span class="domain-tag tag-stok">LOGISTIK</span>Penolakan Pengiriman Central Kitchen <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">retur_stok inbound rejected</td>
        <td class="col-desc">Pemberitahuan saat cabang menolak fisik bahan baku kiriman Central Kitchen akibat kualitas rusak atau salah kirim.</td>
      </tr>
      <tr>
        <td class="col-no">22</td>
        <td class="col-id">tg_ceo_distribusi_sj_unconfirmed_night</td>
        <td class="col-title"><span class="domain-tag tag-stok">LOGISTIK</span>Surat Jalan CK Menggantung (&gt; 3.5 Jam) <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">Tiap 15 Menit (17:00 - 23:00 WIB)</td>
        <td class="col-desc">Deteksi pengiriman bahan baku dari gudang CK yang tersendat lama di jalan atau belum dikonfirmasi terima saat closing.</td>
      </tr>
      <tr>
        <td class="col-no">23</td>
        <td class="col-id">tg_ceo_stok_phantom_drop</td>
        <td class="col-title"><span class="domain-tag tag-stok">STOK</span>Penurunan Saldo Stok Drastis (&ge; 50%) <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">stok_balance saldo drop &ge; 50%</td>
        <td class="col-desc">Deteksi anomali penurunan saldo stok bahan baku utama dalam satu mutasi tunggal (potensi kebocoran/pencurian).</td>
      </tr>
      <tr>
        <td class="col-no">24</td>
        <td class="col-id">tg_ceo_stok_opname_missing</td>
        <td class="col-title"><span class="domain-tag tag-stok">OPNAME</span>Cabang Belum Finalisasi Opname <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">23:15 WIB Malam</td>
        <td class="col-desc">Rekapitulasi cut-off malam yang merangkum daftar seluruh gerai yang belum menyelesaikan dan memfinalisasi stok opname.</td>
      </tr>
      <tr>
        <td class="col-no">25</td>
        <td class="col-id">tg_ceo_ops_understaffed_shift</td>
        <td class="col-title"><span class="domain-tag tag-hr">SDM KRU</span>Gerai Kritis Kekurangan Kru (1 Orang) <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">14:45 WIB Siang</td>
        <td class="col-desc">Peringatan otomatis saat gerai hanya dijaga 1 orang kru pada jam operasional aktif (antrean berisiko bottleneck parah).</td>
      </tr>
      <tr>
        <td class="col-no">26</td>
        <td class="col-id">tg_ceo_hr_mass_absenteeism</td>
        <td class="col-title"><span class="domain-tag tag-hr">SDM KRU</span>Anomali Absen Massal di Gerai (&ge; 50%) <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">15:30 WIB Siang</td>
        <td class="col-desc">Deteksi ketidakhadiran abnormal di satu gerai (&ge; 3 kru atau &ge; 50% kru absen) untuk mengantisipasi konflik internal.</td>
      </tr>
      <tr>
        <td class="col-no">27</td>
        <td class="col-id">tg_ceo_absensi_fraud_attempt</td>
        <td class="col-title"><span class="domain-tag tag-hr">FRAUD GPS</span>Percobaan Titip Absen / Fake GPS <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">attendance di luar radius &gt; 100m</td>
        <td class="col-desc">Deteksi presensi clock-in dengan koordinat di luar radius batas aman toko (&gt; 100m) untuk mencegah manipulasi kehadiran.</td>
      </tr>
      <tr>
        <td class="col-no">28</td>
        <td class="col-id">tg_ceo_ops_checklist_buruk</td>
        <td class="col-title"><span class="domain-tag tag-ops">SUPERVISI</span>Hasil Sidak AM Kategori BURUK <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">ceklist_harian kategori Buruk</td>
        <td class="col-desc">Eskalasi darurat saat kunjungan Area Manager menemukan standar higienitas/rasa produk bernilai buruk agar segera diintervensi.</td>
      </tr>
      <tr>
        <td class="col-no">29</td>
        <td class="col-id">tg_ceo_ops_checklist_missing</td>
        <td class="col-title"><span class="domain-tag tag-ops">SUPERVISI</span>Gerai Belum Disupervisi Area Manager <span class="cron-badge">CRON</span></td>
        <td class="col-trigger">21:00 WIB Malam</td>
        <td class="col-desc">Peringatan pengawasan malam saat ada gerai aktif yang terlewat tanpa kunjungan/supervisi checklist harian Area Manager.</td>
      </tr>
      <tr>
        <td class="col-no">30</td>
        <td class="col-id">tg_ceo_hr_excessive_kasbon</td>
        <td class="col-title"><span class="domain-tag tag-hr">KASBON</span>Pengajuan Kasbon Karyawan Berisiko <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">cash_advances &gt; 2.5jt / probation</td>
        <td class="col-desc">Peringatan saat staf mengajukan kasbon &gt; Rp 2.500.000 atau diajukan kru baru (&lt; 90 hari kerja) untuk memitigasi flight risk.</td>
      </tr>
      <tr>
        <td class="col-no">31</td>
        <td class="col-id">tg_ceo_hr_turnover_spike</td>
        <td class="col-title"><span class="domain-tag tag-hr">TURNOVER</span>Gelombang Resign Kru (&ge; 3 Staf / 30 Hari)<span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">outlet_staff status nonaktif &ge; 3</td>
        <td class="col-desc">Deteksi lonjakan resign staf dalam 30 hari di toko yang sama untuk evaluasi iklim kerja dan kepemimpinan lokal.</td>
      </tr>
      <tr>
        <td class="col-no">32</td>
        <td class="col-id">tg_ceo_finance_petty_cash_deficit</td>
        <td class="col-title"><span class="domain-tag tag-fin">PETTY CASH</span>Saldo Kas Kecil Minus / Jebol <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">petty_cash saldo &lt; 0 / minus</td>
        <td class="col-desc">Peringatan otomatis saat pengeluaran kas kecil membuat saldo outlet minus atau selisih fisik petty cash tekor parah saat closing.</td>
      </tr>
      <tr>
        <td class="col-no">33</td>
        <td class="col-id">tg_ceo_finance_no_receipt_expense</td>
        <td class="col-title"><span class="domain-tag tag-fin">NOTA FIKTIF</span>Pengeluaran Kas Tanpa Bukti Nota Fisik <span class="rt-badge">REAL-TIME</span></td>
        <td class="col-trigger">petty_cash &ge; 50k tanpa foto struk</td>
        <td class="col-desc">Deteksi pengeluaran kas operasional &ge; Rp 50.000 tanpa lampiran bukti foto struk/nota fisik yang sah (indikasi fraud).</td>
      </tr>
      <tr>
        <td class="col-no">34</td>
        <td class="col-id">tg_ceo_finance_delayed_bank_deposit</td>
        <td class="col-title"><span class="domain-tag tag-fin">SETORAN</span>Uang Cash Menggantung di Gerai (&gt; 48 Jam)<span class="cron-badge">CRON</span></td>
        <td class="col-trigger">10:00 WIB Pagi</td>
        <td class="col-desc">Audit harian terhadap shift kasir tertutup yang memiliki akumulasi uang cash &ge; Rp 300.000 belum disetor ke bank &gt; 2 hari.</td>
      </tr>
    </tbody>
  </table>

  <!-- FOOTER -->
  <div class="doc-footer">
    <div>Diterbitkan oleh: <strong>Hermes AI Automation System</strong> · Suka Shawarma Multi-Outlet Platform</div>
    <div>Dokumen Resmi Internal Direksi — Format Eksekutif Bebas Kesalahan Sintaks</div>
    <div>Sistem Live: <strong>agents.sukashawarma.com</strong></div>
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
                "top": "8mm",
                "right": "10mm",
                "bottom": "10mm",
                "left": "10mm",
            }
        )
        await browser.close()
    
    print(f"PDF berhasil dibuat: {pdf_path.resolve()} ({os.path.getsize(pdf_path)} bytes)")

if __name__ == "__main__":
    asyncio.run(main())
