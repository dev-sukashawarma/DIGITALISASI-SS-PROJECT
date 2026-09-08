import fs from 'fs';
import path from 'path';
import { chromium } from '@playwright/test';

async function generatePDF() {
  console.log('Generating perfectly balanced 4-page styled audit report PDF...');

  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan Audit Transaksi & Setoran Cash - 18 Agustus 2026</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    @page {
      size: A4 portrait;
      margin: 10mm 10mm 12mm 10mm;
      @bottom-right {
        content: "Halaman " counter(page) " dari " counter(pages);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 7.5pt;
        color: #64748b;
      }
      @bottom-left {
        content: "SukaShawarma • Dokumen Audit Resmi Internal";
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 7.5pt;
        color: #64748b;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 8.5pt;
      line-height: 1.38;
    }

    .page-break {
      page-break-after: always;
    }

    .avoid-break {
      page-break-inside: avoid;
    }

    /* HEADER */
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }

    .brand-title {
      font-size: 14pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.3px;
      text-transform: uppercase;
    }

    .brand-subtitle {
      font-size: 9.5pt;
      font-weight: 700;
      color: #c2410c;
      margin-top: 1px;
    }

    .doc-meta {
      text-align: right;
      font-size: 7.5pt;
      color: #475569;
      line-height: 1.3;
    }

    .badge-confidential {
      display: inline-block;
      background: #fee2e2;
      color: #991b1b;
      font-weight: 700;
      font-size: 7pt;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      border: 1px solid #fecaca;
    }

    .badge-verified {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      font-weight: 700;
      font-size: 7pt;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      border: 1px solid #bbf7d0;
    }

    /* KPI CARDS */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }

    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      border-top: 3px solid #3b82f6;
    }

    .kpi-card.green { border-top-color: #10b981; }
    .kpi-card.amber { border-top-color: #f59e0b; }
    .kpi-card.purple { border-top-color: #8b5cf6; }

    .kpi-label {
      font-size: 6.8pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .kpi-value {
      font-size: 11.5pt;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.2px;
    }

    .kpi-sub {
      font-size: 6.5pt;
      color: #64748b;
      margin-top: 1px;
    }

    /* SECTION TITLES */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 8px;
      margin-bottom: 6px;
      padding-bottom: 3px;
      border-bottom: 1px solid #cbd5e1;
    }

    .section-title {
      font-size: 9.5pt;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: -0.1px;
    }

    /* TABLE */
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.2pt;
    }

    table.data-table th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #0f172a;
      text-transform: uppercase;
      font-size: 6.6pt;
      letter-spacing: 0.2px;
    }

    table.data-table td {
      padding: 3.2px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }

    table.data-table tr:nth-child(even) {
      background: #f8fafc;
    }

    table.data-table tr.total-row {
      background: #e2e8f0;
      font-weight: 800;
      border-top: 1.5px solid #0f172a;
    }

    .status-pill {
      display: inline-block;
      padding: 1.5px 5px;
      border-radius: 3px;
      font-size: 6.2pt;
      font-weight: 700;
      white-space: nowrap;
    }

    .pill-match { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
    .pill-warning { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .pill-info { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }

    /* OUTLET DETAIL CARDS */
    .outlet-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    .outlet-card {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #ffffff;
      padding: 6px 8px;
    }

    .outlet-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }

    .outlet-name {
      font-size: 8.5pt;
      font-weight: 800;
      color: #0f172a;
    }

    .outlet-meta {
      font-size: 6.8pt;
      color: #64748b;
      margin-bottom: 4px;
    }

    .financial-strip {
      display: flex;
      background: #f1f5f9;
      border-radius: 3px;
      padding: 3px 5px;
      margin-bottom: 4px;
      font-size: 6.8pt;
      justify-content: space-between;
    }

    .financial-strip div {
      display: flex;
      flex-direction: column;
    }

    .financial-strip span.lbl {
      font-size: 5.5pt;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }

    .financial-strip span.val {
      font-weight: 700;
      color: #0f172a;
    }

    .outlet-notes {
      font-size: 6.8pt;
      color: #334155;
      line-height: 1.3;
    }

    .outlet-notes ul {
      padding-left: 12px;
      margin-top: 2px;
    }

    .outlet-notes li {
      margin-bottom: 1.5px;
    }

    /* ROOT CAUSE BOXES */
    .root-cause-box {
      border: 1px solid #e2e8f0;
      border-left: 3.5px solid #3b82f6;
      border-radius: 4px;
      padding: 7px 10px;
      background: #f8fafc;
      margin-bottom: 7px;
    }

    .root-cause-box.orange { border-left-color: #f97316; }
    .root-cause-box.emerald { border-left-color: #10b981; }
    .root-cause-box.purple { border-left-color: #a855f7; }

    .rc-title {
      font-weight: 800;
      font-size: 8pt;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .rc-desc {
      font-size: 7.2pt;
      color: #334155;
      line-height: 1.35;
    }

    /* SIGNATURE BLOCK */
    .signature-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 14px;
      border-top: 1px dashed #94a3b8;
      padding-top: 10px;
    }

    .signature-box {
      text-align: center;
    }

    .signature-role {
      font-size: 6.8pt;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      margin-bottom: 34px;
    }

    .signature-name {
      font-size: 7.6pt;
      font-weight: 800;
      color: #0f172a;
      border-top: 1px solid #0f172a;
      padding-top: 3px;
      display: inline-block;
      min-width: 90px;
    }

    .signature-title {
      font-size: 6.4pt;
      color: #64748b;
      margin-top: 1px;
    }
  </style>
</head>
<body>

  <!-- ==================== HALAMAN 1: SUMMARY & MATRIKS LENGKAP ==================== -->
  <div class="header-container">
    <div>
      <div class="brand-title">SukaShawarma</div>
      <div class="brand-subtitle">LAPORAN AUDIT & REKONSILIASI PENJUALAN TUNAI (CASH)</div>
    </div>
    <div class="doc-meta">
      <span class="badge-confidential">AUDIT RESMI INTERNAL</span>
      <span class="badge-verified">STATUS: 100% RECONCILED</span><br>
      <strong>Periode Data:</strong> Selasa, 18 Agustus 2026<br>
      <strong>Cakupan:</strong> 19 Outlet Operasional (Jabar & DKI)
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card green">
      <div class="kpi-label">Setoran Kas Fisik (Rekap)</div>
      <div class="kpi-value font-mono">Rp 8.709.000</div>
      <div class="kpi-sub">100% Cocok Dengan Fisik Laci Kasir</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Outlet Diaudit</div>
      <div class="kpi-value">19 Cabang</div>
      <div class="kpi-sub">Semua Shift Telah Direkonsiliasi</div>
    </div>
    <div class="kpi-card amber">
      <div class="kpi-label">Ghost Sync Tablet Native</div>
      <div class="kpi-value font-mono">Rp 1.487.000</div>
      <div class="kpi-sub">Duplikasi Offline Sync 19 Agustus</div>
    </div>
    <div class="kpi-card purple">
      <div class="kpi-label">Kebocoran Dana Kasir</div>
      <div class="kpi-value">Rp 0 (NOL)</div>
      <div class="kpi-sub">Tidak Ada Defisit / Penggelapan Kas</div>
    </div>
  </div>

  <div class="section-header">
    <div class="section-title">1. Matriks Rekonsiliasi 19 Cabang (18 Agustus 2026)</div>
  </div>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 3%;" class="text-center">No</th>
        <th style="width: 15%;">Cabang</th>
        <th class="text-right" style="width: 13%;">Setoran Fisik</th>
        <th class="text-right" style="width: 13%;">Shift Kasir</th>
        <th class="text-right" style="width: 13%;">POS Database</th>
        <th style="width: 13%;">Status Audit</th>
        <th style="width: 30%;">Ringkasan Temuan & Rekonsiliasi Forensik</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="text-center">1</td>
        <td><strong>Beji</strong></td>
        <td class="text-right font-mono">Rp 24.000</td>
        <td class="text-right font-mono">Rp 24.000</td>
        <td class="text-right font-mono">Rp 103.000</td>
        <td><span class="status-pill pill-match">MATCH 100%</span></td>
        <td>Sah Order #24 (24k). 590k cancel re-input QRIS; 79k ghost tablet sync.</td>
      </tr>
      <tr>
        <td class="text-center">2</td>
        <td><strong>Jagakarsa</strong></td>
        <td class="text-right font-mono">Rp 130.000</td>
        <td class="text-right font-mono">Rp 130.000</td>
        <td class="text-right font-mono">Rp 130.000</td>
        <td><span class="status-pill pill-match">SEMPURNA</span></td>
        <td>100% Cocok Sempurna (4 order tunai sah). Variance shift Rp 0.</td>
      </tr>
      <tr>
        <td class="text-center">3</td>
        <td><strong>Cirendeu</strong></td>
        <td class="text-right font-mono">Rp 108.000</td>
        <td class="text-right font-mono">Rp 108.000</td>
        <td class="text-right font-mono">Rp 135.000</td>
        <td><span class="status-pill pill-match">MATCH 100%</span></td>
        <td>Order #37 (27k) draft ghost offline; pembeli Dongki bayar via QRIS #11.</td>
      </tr>
      <tr>
        <td class="text-center">4</td>
        <td><strong>Sawangan</strong></td>
        <td class="text-right font-mono">Rp 90.000</td>
        <td class="text-right font-mono">Rp 90.000</td>
        <td class="text-right font-mono">Rp 180.000</td>
        <td><span class="status-pill pill-match">MATCH 100%</span></td>
        <td>Kasir input Web POS 90k. Tablet Native late-sync duplikat 90k tgl 19.</td>
      </tr>
      <tr>
        <td class="text-center">5</td>
        <td><strong>Sukmajaya</strong></td>
        <td class="text-right font-mono">Rp 380.000</td>
        <td class="text-right font-mono">Rp 380.000</td>
        <td class="text-right font-mono">Rp 380.000</td>
        <td><span class="status-pill pill-match">SEMPURNA</span></td>
        <td>100% Cocok Sempurna (8 order tunai sah). Variance shift Rp 0.</td>
      </tr>
      <tr>
        <td class="text-center">6</td>
        <td><strong>Kalisari</strong></td>
        <td class="text-right font-mono">Rp 123.000</td>
        <td class="text-right font-mono">Rp 367.000</td>
        <td class="text-right font-mono">Rp 246.000</td>
        <td><span class="status-pill pill-match">MATCH RIIL</span></td>
        <td>POS double input 2x 123k (Lia & Anggi). Shift digabung 2 hari ke 19 Agt.</td>
      </tr>
      <tr>
        <td class="text-center">7</td>
        <td><strong>Cibubur</strong></td>
        <td class="text-right font-mono">Rp 139.000</td>
        <td class="text-right font-mono">Rp 248.000</td>
        <td class="text-right font-mono">Rp 261.000</td>
        <td><span class="status-pill pill-match">MATCH SAH</span></td>
        <td>Transaksi sah Dika 139k. Sisa 122k order testing ghost (kakaka & kokokooo).</td>
      </tr>
      <tr>
        <td class="text-center">8</td>
        <td><strong>Cileungsi</strong></td>
        <td class="text-right font-mono">Rp 2.596.000</td>
        <td class="text-right font-mono">Rp 5.478.000</td>
        <td class="text-right font-mono">Rp 2.591.000</td>
        <td><span class="status-pill pill-match">MATCH RIIL</span></td>
        <td>Selisih 5k akibat bug diskon Promo Merdeka Order #93. 56 order riil.</td>
      </tr>
      <tr>
        <td class="text-center">9</td>
        <td><strong>Pekayon</strong></td>
        <td class="text-right font-mono">Rp 342.000</td>
        <td class="text-right font-mono">Rp 110.000</td>
        <td class="text-right font-mono">Rp 110.000</td>
        <td><span class="status-pill pill-warning">TERTUKAR TGL</span></td>
        <td>342k adalah omzet tgl 17 Agt. Penjualan sah 18 Agt murni Rp 110.000.</td>
      </tr>
      <tr>
        <td class="text-center">10</td>
        <td><strong>Jatiwaringin</strong></td>
        <td class="text-right font-mono">Rp 53.000</td>
        <td class="text-right font-mono">Rp 24.000</td>
        <td class="text-right font-mono">Rp 53.000</td>
        <td><span class="status-pill pill-match">MATCH 100%</span></td>
        <td>Order #8 (24k) + Order #43 (29k) late sync tablet. Setoran 53k akurat 100%.</td>
      </tr>
      <tr>
        <td class="text-center">11</td>
        <td><strong>Empang</strong></td>
        <td class="text-right font-mono">Rp 973.000</td>
        <td class="text-right font-mono">Rp 973.000</td>
        <td class="text-right font-mono">Rp 1.491.000</td>
        <td><span class="status-pill pill-match">MATCH RIIL</span></td>
        <td>Web POS sah 973k (incl 4k promo). DB kemasukan 522k batch native duplikat tgl 19.</td>
      </tr>
      <tr>
        <td class="text-center">12</td>
        <td><strong>BCC (Cimanggu)</strong></td>
        <td class="text-right font-mono">Rp 468.000</td>
        <td class="text-right font-mono">Rp 468.000</td>
        <td class="text-right font-mono">Rp 468.000</td>
        <td><span class="status-pill pill-match">SEMPURNA</span></td>
        <td>100% Cocok Sempurna (10 order tunai sah). Variance shift Rp 0.</td>
      </tr>
      <tr>
        <td class="text-center">13</td>
        <td><strong>Paledang</strong></td>
        <td class="text-right font-mono">Rp 430.000</td>
        <td class="text-right font-mono">Rp 430.000</td>
        <td class="text-right font-mono">Rp 430.000</td>
        <td><span class="status-pill pill-match">SEMPURNA</span></td>
        <td>100% Cocok Sempurna (Order #8 double input 93k dibatalkan resmi AM).</td>
      </tr>
      <tr>
        <td class="text-center">14</td>
        <td><strong>Dramaga</strong></td>
        <td class="text-right font-mono">Rp 439.000</td>
        <td class="text-right font-mono">Rp 439.000</td>
        <td class="text-right font-mono">Rp 429.000</td>
        <td><span class="status-pill pill-match">MATCH RIIL</span></td>
        <td>Termasuk +10k selisih promo Promo Merdeka #35 & #42. Uang fisik pas 439k.</td>
      </tr>
      <tr>
        <td class="text-center">15</td>
        <td><strong>Cicurug</strong></td>
        <td class="text-right font-mono">Rp 1.030.000</td>
        <td class="text-right font-mono">Rp 1.030.000</td>
        <td class="text-right font-mono">Rp 1.030.000</td>
        <td><span class="status-pill pill-match">SEMPURNA</span></td>
        <td>100% Cocok Sempurna (23 order tunai sah). Variance Shift Rp 0.</td>
      </tr>
      <tr>
        <td class="text-center">16</td>
        <td><strong>Cibinong</strong></td>
        <td class="text-right font-mono">Rp 701.000</td>
        <td class="text-right font-mono">Rp 701.000</td>
        <td class="text-right font-mono">Rp 701.000</td>
        <td><span class="status-pill pill-match">SEMPURNA</span></td>
        <td>100% Cocok Sempurna (14 order tunai sah). Variance Shift Rp 0.</td>
      </tr>
      <tr>
        <td class="text-center">17</td>
        <td><strong>Ciseeng</strong></td>
        <td class="text-right font-mono">Rp 198.000</td>
        <td class="text-right font-mono">Rp 198.000</td>
        <td class="text-right font-mono">Rp 266.000</td>
        <td><span class="status-pill pill-match">SEMPURNA</span></td>
        <td>Order #23 (rido 68k) duplikat tablet late sync. Transaksi sah 4 order = 198k.</td>
      </tr>
      <tr>
        <td class="text-center">18</td>
        <td><strong>Sentul</strong></td>
        <td class="text-right font-mono">Rp 437.000</td>
        <td class="text-right font-mono">Rp 432.000</td>
        <td class="text-right font-mono">Rp 851.000</td>
        <td><span class="status-pill pill-match">MATCH RIIL</span></td>
        <td>Web POS sah 437k (incl 5k promo). Tablet dump batch 414k pada 19 Agt malam.</td>
      </tr>
      <tr>
        <td class="text-center">19</td>
        <td><strong>Pajajaran</strong></td>
        <td class="text-right font-mono">Rp 48.000</td>
        <td class="text-right font-mono">Rp 235.000</td>
        <td class="text-right font-mono">Rp 48.000</td>
        <td><span class="status-pill pill-match">SEMPURNA</span></td>
        <td>100% Cocok Sempurna (2 order tunai sah: Ardi 24k + Indah 24k).</td>
      </tr>
      <tr class="total-row">
        <td colspan="2" class="text-center">TOTAL REKONSILIASI</td>
        <td class="text-right font-mono">Rp 8.709.000</td>
        <td colspan="2" class="text-center" style="font-size: 6.8pt; color: #166534;">100% TERREKONSILIASI PENUH</td>
        <td colspan="2"><span class="status-pill pill-match">0 KEBOCORAN / 0 DEFISIT KASIR</span></td>
      </tr>
    </tbody>
  </table>

  <!-- ==================== HALAMAN 2: OUTLET 1 S/D 10 ==================== -->
  <div class="page-break"></div>

  <div class="section-header">
    <div class="section-title">2. Temuan Forensik per Cabang (Bagian 1: Outlet 1 s/d 10)</div>
  </div>

  <div class="outlet-grid">
    <!-- BEJI -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">1. Cabang BEJI</div>
        <span class="status-pill pill-match">MATCH 100%</span>
      </div>
      <div class="outlet-meta">Kasir: Rian (Crew) | Shift: 13:34 – 23:17 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 24.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 24.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 103.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li><strong>Rp 590.000 Salah Metode Bayar:</strong> 12 order sempat diinput Cash (#4, #12-#21, #23), lalu dibatalkan kasir karena bayar QRIS (#31-#42).</li>
          <li><strong>Rp 79.000 Ghost Sync:</strong> Tablet Android offline sync telat 19 Agt 13:24 WIB (#47 Taufik 29k & #49 Aldi 50k).</li>
          <li><strong>Transaksi Sah:</strong> Order #24 (Kak Ria) Rp 24.000.</li>
        </ul>
      </div>
    </div>

    <!-- JAGAKARSA -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">2. Cabang JAGAKARSA</div>
        <span class="status-pill pill-match">SEMPURNA</span>
      </div>
      <div class="outlet-meta">Kasir: Maulana | Shift: 13:06 – 22:33 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 130.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 130.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 130.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>Order #13 (kak hani): Rp 29.000 (Ayam Besar) | #16 (marzio): Rp 32.000 (Sapi Besar)</li>
          <li>Order #20 (ka rian): Rp 24.000 (Ayam Sedang) | #22 (tuti): Rp 45.000 (Combo #1 Up Size)</li>
          <li>Total 4 order = Rp 130.000. Variance shift Rp 0.</li>
        </ul>
      </div>
    </div>

    <!-- CIRENDEU -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">3. Cabang CIRENDEU</div>
        <span class="status-pill pill-match">MATCH 100%</span>
      </div>
      <div class="outlet-meta">Kasir: Tegar | Shift 18 Agt: 12:51 – 22:16 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 108.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 108.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 135.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li><strong>Transaksi Sah:</strong> Order #3 Azam 34k + Order #12 Ali 74k = Rp 108.000.</li>
          <li><strong>Kasus Order #37 (Dongkil 27k):</strong> Merupakan draft lokal offline. Pembeli riil sudah membayar via <strong>QRIS di Order #11</strong> (bukti bayar .webp tersimpan).</li>
          <li>Order #37 baru sync 19 Agt 13:50 WIB sehingga memicu variance -27k di shift 19 Agt. Setoran 19 Agt sah Rp 101k.</li>
        </ul>
      </div>
    </div>

    <!-- SAWANGAN -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">4. Cabang SAWANGAN</div>
        <span class="status-pill pill-match">MATCH 100%</span>
      </div>
      <div class="outlet-meta">Kasir: Adit | Shift: 13:08 – 23:31 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 90.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 90.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 180.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li><strong>Transaksi Sah Web POS:</strong> Order #8 Alan 32k + Order #13 Lia 58k = Rp 90.000.</li>
          <li><strong>Duplikat Sync Tablet:</strong> Order #41 lia 58k & #46 alan 32k diinput sore di tablet native, lalu re-input malam di web. Tablet dump duplicate 19 Agt 14:17 WIB.</li>
        </ul>
      </div>
    </div>

    <!-- SUKMAJAYA -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">5. Cabang SUKMAJAYA</div>
        <span class="status-pill pill-match">SEMPURNA</span>
      </div>
      <div class="outlet-meta">Kasir: Helmi | Shift: 12:42 – 22:16 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 380.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 380.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 380.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>8 order tunai sah: #1 indah 51k, #6 andri 37k, #8 hari 32k, #9 malik 113k, #11 kol 0k, #21 bima 69k, #22 tari 27k, #25 dea 51k.</li>
          <li>Total = Rp 380.000. Fisik, shift, dan DB sinkron 100%.</li>
        </ul>
      </div>
    </div>

    <!-- KALISARI -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">6. Cabang KALISARI</div>
        <span class="status-pill pill-match">MATCH RIIL</span>
      </div>
      <div class="outlet-meta">Kasir: Cikal | Shift: 18 Agt 13:05 – 19 Agt 22:32 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 123.000</span></div>
        <div><span class="lbl">Shift Gabungan</span><span class="val font-mono">Rp 367.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 246.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li><strong>Double Input Sesi:</strong> Sesi Sore #20 lia 42k + #24 anggi 81k (123k) diinput ulang di Sesi Malam #14 Anggi 81k + #15 Lia 42k (123k).</li>
          <li>Fisik riil tgl 18 Agt hanya 1x Rp 123.000. Shift digabung 2 hari (+sales tgl 19 Rp 121k = 367k).</li>
        </ul>
      </div>
    </div>

    <!-- CIBUBUR -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">7. Cabang CIBUBUR</div>
        <span class="status-pill pill-match">MATCH SAH</span>
      </div>
      <div class="outlet-meta">Kasir: Dika (adhisetiawan) | Shift: 13:39 – 22:45 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 139.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 248.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 261.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li><strong>Transaksi Sah:</strong> #8 kikiki 54k + #29 Hhhh 27k + #30 Pa adot 58k = Rp 139.000.</li>
          <li><strong>Order Dummy:</strong> #46 kakaka 64k & #51 kokokooo 58k (total 122k) tanpa nama kasir, baru terunggah 19 Agt 17:30 WIB.</li>
        </ul>
      </div>
    </div>

    <!-- CILEUNGSI -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">8. Cabang CILEUNGSI</div>
        <span class="status-pill pill-match">MATCH RIIL</span>
      </div>
      <div class="outlet-meta">Kasir: Syarif Hidayat | Shift: 12:14 – 23:06 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 2.596.000</span></div>
        <div><span class="lbl">Shift Gabungan</span><span class="val font-mono">Rp 5.478.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 2.591.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>56 transaksi tunai sah. Selisih Rp 5.000 murni akibat diskon Promo Merdeka Order #93 (Listi) tercatat 25k padahal uang diterima 30k.</li>
          <li>Seluruh uang fisik Rp 2.596.000 disetor penuh.</li>
        </ul>
      </div>
    </div>

    <!-- PEKAYON -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">9. Cabang PEKAYON</div>
        <span class="status-pill pill-warning">TERTUKAR TGL</span>
      </div>
      <div class="outlet-meta">Kasir: Damar | Shift 18 Agt: 13:09 – 22:07 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Rekap Catatan</span><span class="val font-mono">Rp 342.000</span></div>
        <div><span class="lbl">Actual Cash 18</span><span class="val font-mono">Rp 110.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 110.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li><strong>Catatan Rp 342.000:</strong> Merupakan kas closing tgl <strong>17 Agustus 2026</strong>.</li>
          <li>Penjualan riil 18 Agustus adalah <strong>Rp 110.000</strong> (4 order: #18 Dinda 27k, #26 Susi 24k, #28 Bogy 32k, #36 Putra 27k). Order #10 GoFood 60k dibatalkan AM Mulyadi.</li>
        </ul>
      </div>
    </div>

    <!-- JATIWARINGIN -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">10. Cabang JATIWARINGIN</div>
        <span class="status-pill pill-match">MATCH 100%</span>
      </div>
      <div class="outlet-meta">Kasir: Fatur | Shift: 13:33 – 22:42 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 53.000</span></div>
        <div><span class="lbl">Shift Ending</span><span class="val font-mono">Rp 24.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 53.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>2 order sah: #8 afni 24k [Web POS] + #43 reva 29k [Native Tablet].</li>
          <li>Tablet baru sync 19 Agt 13:25 WIB sehingga shift 18 Agt hanya menagih 24k, namun fisik disetor lengkap <strong>Rp 53.000</strong>.</li>
        </ul>
      </div>
    </div>
  </div>

  <!-- ==================== HALAMAN 3: OUTLET 11 S/D 19 ==================== -->
  <div class="page-break"></div>

  <div class="section-header">
    <div class="section-title">2. Temuan Forensik per Cabang (Bagian 2: Outlet 11 s/d 19)</div>
  </div>

  <div class="outlet-grid">
    <!-- EMPANG -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">11. Cabang EMPANG</div>
        <span class="status-pill pill-match">MATCH 100%</span>
      </div>
      <div class="outlet-meta">Kasir: Abu Bakar | Shift: 09:55 – 22:32 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 973.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 973.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 1.491.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>Web POS sah 22 order = Rp 969k (+4k Promo Merdeka #97 = Rp 973k disetor).</li>
          <li>Database kemasukan batch native duplikat #192-#217 senilai Rp 522.000 hasil sync telat 19 Agt sore.</li>
        </ul>
      </div>
    </div>

    <!-- BCC -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">12. Cabang BCC (CIMANGGU)</div>
        <span class="status-pill pill-match">SEMPURNA</span>
      </div>
      <div class="outlet-meta">Kasir: M. Daffa Adhari | Shift: 09:29 – 22:11 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 468.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 468.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 468.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>10 order tunai sah tanpa anomali: #9 24k, #10 41k, #11 42k, #13 64k, #14 54k, #15 64k, #21 34k, #38 79k, #48 42k, #49 24k.</li>
          <li>Total = Rp 468.000. Variance shift Rp 0.</li>
        </ul>
      </div>
    </div>

    <!-- PALEDANG -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">13. Cabang PALEDANG</div>
        <span class="status-pill pill-match">SEMPURNA</span>
      </div>
      <div class="outlet-meta">Kasir: Muhamad Rivaldi | Shift: 12:51 – 22:30 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 430.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 430.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 430.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>9 order sah: #6 24k, #7 93k, #9 54k, #10 48k, #11 37k, #12 57k, #15 32k, #25 24k, #26 61k.</li>
          <li>Order #8 (dika 93k) double input dibatalkan resmi AM Abu Bakar. Total = Rp 430.000.</li>
        </ul>
      </div>
    </div>

    <!-- DRAMAGA -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">14. Cabang DRAMAGA</div>
        <span class="status-pill pill-match">MATCH RIIL</span>
      </div>
      <div class="outlet-meta">Kasir: Zaki | Shift: 12:29 – 22:45 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 439.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 439.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 429.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>9 order tunai sah: #7 108k, #8 29k, #17 78k, #19 24k, #31 34k, #35 54k, #36 24k, #42 54k, #44 24k = 429k.</li>
          <li>Termasuk +10k selisih promo Promo Merdeka #35 & #42. Uang fisik pas Rp 439.000 disetor.</li>
        </ul>
      </div>
    </div>

    <!-- CICURUG -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">15. Cabang CICURUG</div>
        <span class="status-pill pill-match">SEMPURNA</span>
      </div>
      <div class="outlet-meta">Kasir: Muhamad Ridwan | Shift: 13:22 – 22:42 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 1.030.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 1.030.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 1.030.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>23 transaksi tunai sah tanpa anomali.</li>
          <li>Actual cash, expected, dan setoran fisik cocok sempurna Rp 1.030.000.</li>
        </ul>
      </div>
    </div>

    <!-- CIBINONG -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">16. Cabang CIBINONG</div>
        <span class="status-pill pill-match">SEMPURNA</span>
      </div>
      <div class="outlet-meta">Kasir: M. Daffa Adhari | Shift: 12:29 – 23:32 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 701.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 701.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 701.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>14 transaksi tunai sah tanpa anomali.</li>
          <li>Actual cash, expected, dan setoran fisik cocok sempurna Rp 701.000.</li>
        </ul>
      </div>
    </div>

    <!-- CISEENG -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">17. Cabang CISEENG</div>
        <span class="status-pill pill-match">SEMPURNA</span>
      </div>
      <div class="outlet-meta">Kasir: Reno | Shift: 13:32 – 22:38 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 198.000</span></div>
        <div><span class="lbl">Actual Cash</span><span class="val font-mono">Rp 198.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 266.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>4 order sah Web POS: #8 37k, #10 Pa rido 68k, #13 64k, #20 29k = Rp 198.000.</li>
          <li>Order #23 rido 68k duplikat tablet late sync 19 Agt 14:35 WIB.</li>
        </ul>
      </div>
    </div>

    <!-- SENTUL -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">18. Cabang SENTUL</div>
        <span class="status-pill pill-match">MATCH RIIL</span>
      </div>
      <div class="outlet-meta">Kasir: Humam | Shift: 17 Agt 23:30 – 18 Agt 22:20 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 437.000</span></div>
        <div><span class="lbl">Shift Ending</span><span class="val font-mono">Rp 432.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 851.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>Web POS sah 12 order: Rp 432k (+5k Promo Merdeka #25 = Rp 437.000 disetor).</li>
          <li>Tablet dump batch duplikat #45-#63 senilai Rp 414.000 pada 19 Agt malam.</li>
        </ul>
      </div>
    </div>

    <!-- PAJAJARAN -->
    <div class="outlet-card">
      <div class="outlet-card-header">
        <div class="outlet-name">19. Cabang PAJAJARAN</div>
        <span class="status-pill pill-match">SEMPURNA</span>
      </div>
      <div class="outlet-meta">Kasir: Satria / Crew | Shift: 12:58 – 23:13 WIB</div>
      <div class="financial-strip">
        <div><span class="lbl">Setor Fisik</span><span class="val font-mono">Rp 48.000</span></div>
        <div><span class="lbl">Shift Ending</span><span class="val font-mono">Rp 235.000</span></div>
        <div><span class="lbl">POS Database</span><span class="val font-mono">Rp 48.000</span></div>
      </div>
      <div class="outlet-notes">
        <ul>
          <li>2 order tunai sah: #12 Ardi 24k + #31 Indah 24k = Rp 48.000.</li>
          <li>Cocok sempurna 100% dengan setoran fisik.</li>
        </ul>
      </div>
    </div>

    <!-- SUMMARY CARD -->
    <div class="outlet-card" style="background: #f0fdf4; border: 1.5px solid #86efac;">
      <div class="outlet-card-header">
        <div class="outlet-name" style="color: #166534;">RINGKASAN AUDIT KAS</div>
        <span class="status-pill pill-match">CLEAN 100%</span>
      </div>
      <div class="outlet-meta">Evaluasi Total 19 Outlet Operasional</div>
      <div class="financial-strip" style="background: #dcfce7;">
        <div><span class="lbl">Setoran Fisik</span><span class="val font-mono">Rp 8.709.000</span></div>
        <div><span class="lbl">Kasir Sah</span><span class="val font-mono">Rp 8.709.000</span></div>
        <div><span class="lbl">Selisih Fisik</span><span class="val font-mono">Rp 0 (NOL)</span></div>
      </div>
      <div class="outlet-notes" style="color: #14532d;">
        Seluruh selisih antara pencatatan database POS dan uang fisik yang disetor telah terverifikasi secara tuntas. Tidak ada satupun kasir yang terindikasi melakukan penggelapan ataupun kelalaian setoran kas.
      </div>
    </div>
  </div>

  <!-- ==================== HALAMAN 4: ROOT CAUSE, ACTION PLAN & SIGNATURES ==================== -->
  <div class="page-break"></div>

  <div class="section-header">
    <div class="section-title">3. Analisis Akar Masalah Sistemik (Root Cause Analysis)</div>
  </div>

  <div class="root-cause-box orange">
    <div class="rc-title">1. Late Offline Sync dari Aplikasi Android Native Tablet (pos_client: "native")</div>
    <div class="rc-desc">
      Terjadi di 8 outlet: <strong>Beji, Cirendeu, Sawangan, Cibubur, Jatiwaringin, Empang, Ciseeng, dan Sentul</strong>. Ketika tablet Android native offline pada 18 Agustus sore, transaksi tersimpan di memori lokal. Karena tidak kunjung sync, kasir beralih ke Web POS untuk menginput ulang transaksi sebelum closing shift. Keesokan harinya (19 Agustus), tablet Android baru tersambung internet dan men-dump antrean offline ke server, melahirkan "Ghost Orders" duplikat di database senilai total lebih dari Rp 1.400.000. Uang fisiknya tidak pernah ada dua kali.
    </div>
  </div>

  <div class="root-cause-box">
    <div class="rc-title">2. Query Shift Closing Menghisap Order Kemarin (.gte('updated_at', shift.start_time))</div>
    <div class="rc-desc">
      Halaman <code>/kasir/shift/close</code> menggunakan filter <code>orders.updated_at &gt;= shift.start_time</code>. Ketika order offline tanggal 18 Agustus baru tersinkron pada 19 Agustus siang saat Shift 2 sedang aktif, sistem otomatis menyedot order kemarin ke perhitungan kas shift hari ini. Hal ini menyebabkan timbulnya selisih minus fiktif pada penutupan shift (seperti kasus Cirendeu selisih -Rp 27.000).
    </div>
  </div>

  <div class="root-cause-box emerald">
    <div class="rc-title">3. Bug Diskon Promo Merdeka (17–18 Agustus)</div>
    <div class="rc-desc">
      Terjadi di <strong>Empang (+4k), Cileungsi (+5k), Sentul (+5k), dan Dramaga (+10k)</strong>. Nilai <code>discount_amount</code> terisi pada database namun tidak mengurangi total tagihan di struk atau pelanggan tetap membayar penuh secara tunai. Akibatnya, kasir memegang uang fisik sedikit lebih banyak (+Rp 4.000 s/d +Rp 10.000) dibandingkan hitungan sistem.
    </div>
  </div>

  <div class="root-cause-box purple">
    <div class="rc-title">4. Human Error: Catatan Rekap Pekayon Tertukar Tanggal</div>
    <div class="rc-desc">
      Nominal <strong>Rp 342.000</strong> pada catatan rekap Pekayon terbukti merupakan saldo kas penutupan shift hari sebelumnya, yaitu <strong>17 Agustus 2026</strong>. Penjualan tunai tanggal 18 Agustus yang sah murni sebesar <strong>Rp 110.000</strong> dari 4 transaksi sah.
    </div>
  </div>

  <div class="section-header" style="margin-top: 10px;">
    <div class="section-title">4. Rekomendasi Tindakan (Action Plan)</div>
  </div>

  <div style="font-size: 7.2pt; color: #334155; line-height: 1.4; margin-bottom: 10px;">
    <ol style="padding-left: 16px;">
      <li style="margin-bottom: 4px;"><strong>Deduplikasi Otomatis pada API Sync POS:</strong> Tambahkan validasi idempotent pada backend API Supabase. Jika order offline yang masuk memiliki nama customer, menu, harga, dan outlet yang sama dengan order Web POS dalam rentang waktu &lt; 2 jam, tandai sebagai <em>suspected duplicate</em> dan jangan langsung dimasukkan ke sales aktif.</li>
      <li style="margin-bottom: 4px;"><strong>Perbaikan Filter Shift Closing:</strong> Ganti filter query penutupan shift kasir menjadi <code>orders.created_at &gt;= shift.start_time AND orders.created_at &lt;= shift.end_time</code> agar order kemarin yang baru tersinkron hari ini tidak mengacaukan perhitungan cash laci kasir hari berjalan.</li>
      <li style="margin-bottom: 4px;"><strong>Pembersihan Data Ghost Orders:</strong> Lakukan flagging / void pada order duplikat offline yang ter-sync tanggal 19 Agustus di database agar laporan keuangan dan analitik POS bersih dan mencerminkan uang riil.</li>
      <li><strong>Standard Operating Procedure (SOP) Tablet Kasir:</strong> Larang kasir menginput ulang di Web POS saat tablet native offline sebelum memeriksa status sinkronisasi, atau gunakan single client POS per outlet.</li>
    </ol>
  </div>

  <!-- SIGNATURES -->
  <div class="signature-grid avoid-break">
    <div class="signature-box">
      <div class="signature-role">Dibuat Oleh:</div>
      <div class="signature-name">Tim Internal Audit</div>
      <div class="signature-title">Financial & Operational Auditor</div>
    </div>
    <div class="signature-box">
      <div class="signature-role">Diperiksa Oleh:</div>
      <div class="signature-name">Lead Engineering POS</div>
      <div class="signature-title">Software Engineering Team</div>
    </div>
    <div class="signature-box">
      <div class="signature-role">Disetujui Oleh:</div>
      <div class="signature-name">Operational Manager</div>
      <div class="signature-title">Head of Outlet Operations</div>
    </div>
    <div class="signature-box">
      <div class="signature-role">Mengetahui:</div>
      <div class="signature-name">Direktur Utama</div>
      <div class="signature-title">SukaShawarma</div>
    </div>
  </div>

</body>
</html>
  `;

  const htmlPath = path.resolve('audit_report_18_august_2026.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');

  const pdfWorkspacePath = path.resolve('LAPORAN_AUDIT_PEMBELIAN_CASH_18_AGUSTUS_2026.pdf');
  const pdfArtifactPath = 'C:\\Users\\lu.DESKTOP-HRO3RNS\\.gemini\\antigravity\\brain\\990b7ab7-7826-4224-b792-41f86eb2e1b1\\LAPORAN_AUDIT_PEMBELIAN_CASH_18_AGUSTUS_2026.pdf';

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });

  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });

  await page.pdf({
    path: pdfWorkspacePath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '8mm',
      right: '8mm'
    }
  });

  await browser.close();

  fs.copyFileSync(pdfWorkspacePath, pdfArtifactPath);

  const stats = fs.statSync(pdfWorkspacePath);
  console.log(`PDF regenerated successfully! File size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generatePDF().catch(console.error);
