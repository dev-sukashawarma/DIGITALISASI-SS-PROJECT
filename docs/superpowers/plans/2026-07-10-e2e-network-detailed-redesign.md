# E2E Network Detailed Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rombak `docs/interactive-diagrams/e2e_network_detailed.html` menjadi dashboard-shell interaktif (Approach B) yang bebas bug render, akurat terhadap kode nyata, dan berpanel-detail komprehensif; lalu sebarkan koreksi fakta ke 3 sibling HTML + `FLOWS.md`.

**Architecture:** Single-file HTML statis (buka-langsung di browser). Mermaid 10 (ESM) untuk graf, `svg-pan-zoom` (CDN) untuk pan/zoom, Tailwind (CDN) untuk UI, vanilla JS untuk panel detail + filter aliran (klasifikasi edge pasca-render). Tanpa build step, tanpa backend.

**Tech Stack:** HTML5, Tailwind CSS (CDN), Mermaid.js 10 (ESM), svg-pan-zoom (CDN), vanilla JavaScript.

**Verifikasi:** Tidak ada test runner untuk HTML statis. Setiap task diverifikasi manual di browser (render, konsol bersih, interaksi) + cek silang fakta ke `apps/absensi/src/lib/face/match.ts`. Commit sering.

**Referensi fakta kunci (jangan diarang):**
- Lib wajah: `@vladmandic/human` v3.3.6 (BUKAN face-api.js)
- Metrik: cosine similarity, `DEFAULT_MATCH_THRESHOLD = 0.65` (`apps/absensi/src/lib/face/match.ts:20`)
- Kiosk: `apps/absensi/src/app/kiosk/[outlet_id]/page.tsx` + `apps/absensi/src/features/clock/AttendanceKioskPanel.tsx`
- GPS: `apps/absensi/src/lib/gps.ts` MASIH aktif → alur = FaceMatch → GPS → Liveness
- ADR-011: `fill_harga_snapshot` dipicu Surat Jalan (kunci HPP)

---

## File Structure

- **Modify (utama):** `docs/interactive-diagrams/e2e_network_detailed.html` — seluruh redesign (Task 1–7).
- **Modify (sibling):** `docs/interactive-diagrams/e2e_network.html`, `e2e_swimlane.html`, `e2e_macro.html` — koreksi fakta (Task 8).
- **Modify (doc):** `docs/FLOWS.md` — sinkron metrik wajah + tambah langkah Liveness (Task 9).

Semua logika tetap dalam satu file HTML per diagram (pola eksisting repo — jangan pecah jadi banyak file).

---

## Task 1: Perbaiki bug render & koreksi fakta pada graf Mermaid

**Files:**
- Modify: `docs/interactive-diagrams/e2e_network_detailed.html` (blok `<pre class="mermaid">` + `<style>`)

- [ ] **Step 1: Tambah `classDef absen` dan node absensi baru**

Di dalam blok definisi `classDef` (setelah baris `classDef external ...`), tambahkan:

```
classDef absen fill:#dbeafe, stroke:#2563eb, stroke-width:2px;
```

- [ ] **Step 2: Susun ulang subgraph `Portal_Absensi` dengan GPS + Liveness + Checklist**

Ganti isi subgraph `Portal_Absensi` menjadi (perhatikan node baru `GPSCheck` dan `ChecklistBuka`, dan semua node absensi pakai `:::absen`):

```
subgraph Portal_Absensi ["Portal & Absensi (M1)"]
    SyncOutlets("<div style='width:180px; text-align:center;' class='p-1'>Sinkronisasi Outlet</div>"):::portal
    EnrollFace("<div style='width:180px; text-align:center;' class='p-1'>Rekam Wajah Staf</div>"):::portal
    ClockIn("<div style='width:180px; text-align:center;' class='p-1'>Clock-In Staf (Kiosk)</div>"):::absen
    FaceMatch("<div style='width:180px; text-align:center;' class='p-1'>Validasi Wajah 1:N</div>"):::absen
    GPSCheck("<div style='width:180px; text-align:center;' class='p-1'>Cek Radius GPS Outlet</div>"):::absen
    LivenessCheck("<div style='width:180px; text-align:center;' class='p-1'>Anti-Spoofing (Liveness)</div>"):::absen
    OfflineQueue("<div style='width:180px; text-align:center;' class='p-1'>Antrean Offline</div>"):::absen
    ChecklistBuka("<div style='width:180px; text-align:center;' class='p-1'>Checklist Buka Toko</div>"):::portal
    AttendanceDB("<div style='width:180px; text-align:center;' class='p-1'>Database Kehadiran</div>"):::portal

    SyncOutlets --> EnrollFace
    EnrollFace --> ClockIn
    ClockIn --->|"Capture 📸"| FaceMatch
    FaceMatch --->|"Cosine ≥ 0.65"| GPSCheck
    GPSCheck --->|"Dalam radius"| LivenessCheck
    LivenessCheck --->|"Challenge senyum/kedip"| AttendanceDB
    LivenessCheck -.->|"Gagal koneksi"| OfflineQueue
    OfflineQueue -->|"Koneksi pulih"| AttendanceDB
    AttendanceDB --> ChecklistBuka
end
```

- [ ] **Step 3: Perbaiki cross-edge gerbang kasir agar lewat ChecklistBuka**

Ganti baris:

```
AttendanceDB ===>|"Syarat akses kasir (Wajib Absen)"| POS_Sales
```

menjadi:

```
ChecklistBuka ===>|"Syarat buka kasir (Wajib Absen + Checklist)"| POS_Sales
```

- [ ] **Step 4: Buang handler click mati & tambah click node baru**

Hapus baris `click GPSCheck call showDetails("GPSCheck")` yang lama (jika ada duplikasi posisi), lalu pastikan blok click absensi berbunyi persis:

```
click SyncOutlets call showDetails("SyncOutlets")
click EnrollFace call showDetails("EnrollFace")
click ClockIn call showDetails("ClockIn")
click FaceMatch call showDetails("FaceMatch")
click GPSCheck call showDetails("GPSCheck")
click LivenessCheck call showDetails("LivenessCheck")
click OfflineQueue call showDetails("OfflineQueue")
click ChecklistBuka call showDetails("ChecklistBuka")
click AttendanceDB call showDetails("AttendanceDB")
```

(Hapus `click GPSCheck` yang menunjuk ke posisi lama bila menyebabkan duplikat; harus tepat satu.)

- [ ] **Step 5: Verifikasi render di browser**

Buka `docs/interactive-diagrams/e2e_network_detailed.html` di browser. Buka DevTools Console.
Expected: graf render; node `FaceMatch/GPSCheck/LivenessCheck/OfflineQueue/ClockIn` **berwarna biru** (bukan abu default); tidak ada error Mermaid "Trying to inactivate an inactive" / "No diagram type". Node `GPSCheck` & `ChecklistBuka` tampil.

- [ ] **Step 6: Commit**

```bash
git add docs/interactive-diagrams/e2e_network_detailed.html
git commit -m "fix(diagram): perbaiki classDef absen, hidupkan GPSCheck, koreksi alur clock-in E2E"
```

---

## Task 2: Perluas skema `nodeData` — field komprehensif untuk node absensi & inti

**Files:**
- Modify: `docs/interactive-diagrams/e2e_network_detailed.html` (objek `nodeData` di `<script>`)

- [ ] **Step 1: Tetapkan skema baru & isi node absensi (fakta terkoreksi)**

Ganti entri `FaceMatch`, `LivenessCheck`, `OfflineQueue`, `ClockIn`, `AttendanceDB` dan TAMBAH `GPSCheck`, `ChecklistBuka` dengan skema baru (`status`, `inflow`, `outflow`, `dbObjects`, `codePath`, `refs`, `related`):

```js
"ClockIn": { app: "Absensi (M1)", color: "text-blue-600", role: "Seluruh Staf", status: "live",
  description: "Halaman Kios <code>apps/absensi/src/app/kiosk/[outlet_id]/page.tsx</code> (komponen <code>AttendanceKioskPanel</code>). Staf menekan Clock-In/Out di tablet toko. Jendela waktu diatur per outlet via <code>outlet_attendance_config.absen_window_mode</code> (auto/manual).",
  inflow: "Dipicu staf setelah EnrollFace selesai.", outflow: "Memulai rantai validasi anti-curang (Face → GPS → Liveness).",
  dbObjects: ["outlet_attendance_config", "attendance"], codePath: "apps/absensi/src/features/clock/AttendanceKioskPanel.tsx",
  refs: ["Session 2026-06-26: Absensi Time Window"], related: ["FaceMatch", "ChecklistBuka"] },

"FaceMatch": { app: "Absensi (M1)", color: "text-blue-600", role: "Sistem (@vladmandic/human)", status: "live",
  description: "Validasi wajah lokal di browser memakai <code>@vladmandic/human</code> v3.3.6. Identify <b>1:N</b> dengan metrik <b>cosine similarity</b> (bukan euclidean) dan ambang <code>DEFAULT_MATCH_THRESHOLD = 0.65</code>. Enrollment frontal-only dirata-rata agar diskriminatif (orang sama ~0.86, beda ~0.53).",
  inflow: "Frame kamera 📸 dari ClockIn.", outflow: "Jika cocok (≥0.65) lanjut ke Cek Radius GPS.",
  dbObjects: ["outlet_staff.face_descriptor"], codePath: "apps/absensi/src/lib/face/match.ts",
  refs: ["Session 2026-06-24: Face Match Hardening", "match.ts DEFAULT_MATCH_THRESHOLD=0.65"], related: ["GPSCheck", "EnrollFace", "LivenessCheck"] },

"GPSCheck": { app: "Absensi (M1)", color: "text-blue-600", role: "Sistem (Geolocation)", status: "live",
  description: "Verifikasi posisi perangkat berada dalam radius outlet memakai koordinat lat/lng master outlet (disuplai SyncOutlets). Divalidasi ganda di server pada <code>api/submit-attendance/route.ts</code>.",
  inflow: "Hasil match wajah lolos.", outflow: "Jika dalam radius, lanjut ke Liveness.",
  dbObjects: ["outlets.lat", "outlets.lng"], codePath: "apps/absensi/src/lib/gps.ts",
  refs: ["FLOWS.md #3 Clock-in"], related: ["FaceMatch", "LivenessCheck", "SyncOutlets"] },

"LivenessCheck": { app: "Absensi (M1)", color: "text-blue-600", role: "Sistem Anti-Spoofing", status: "live",
  description: "Tantangan liveness 2-fase: staf melakukan gerakan (senyum/kedip/menoleh) lalu <b>kembali frontal</b> sebelum verifikasi identitas final dijalankan (mencegah skor rendah saat wajah masih menoleh). Mencegah spoofing foto/video.",
  inflow: "Posisi GPS valid.", outflow: "Hasil akhir ditulis ke Database Kehadiran (atau OfflineQueue bila koneksi putus).",
  dbObjects: [], codePath: "apps/absensi/src/lib/face/liveness.ts",
  refs: ["Session 2026-06-24 (lanjutan): Liveness 2-fase"], related: ["AttendanceDB", "OfflineQueue"] },

"OfflineQueue": { app: "Absensi (M1)", color: "text-blue-600", role: "Penyimpanan Lokal", status: "live",
  description: "Antrean lokal di browser (IndexedDB) menampung presensi saat koneksi outlet putus, lalu sinkron otomatis (push) ke Supabase saat online.",
  inflow: "Presensi gagal terkirim.", outflow: "Sync ke AttendanceDB saat koneksi pulih.",
  dbObjects: ["attendance"], codePath: null, refs: [], related: ["AttendanceDB"] },

"ChecklistBuka": { app: "Absensi (M1)", color: "text-blue-600", role: "Leader / SPV", status: "live",
  description: "Gerbang buka toko: Leader/SPV harus menuntaskan Checklist Buka Toko + absen sebelum aplikasi Kasir bisa transaksi. Menjadi syarat mutlak membuka POS.",
  inflow: "Kehadiran tercatat.", outflow: "Membuka kunci POS_Sales.",
  dbObjects: ["daily_checklist_records", "checklist_items"], codePath: null,
  refs: ["Spec E2E cross-app: Absensi→POS gate"], related: ["POS_Sales", "AttendanceDB"] },

"AttendanceDB": { app: "Database Utama", color: "text-blue-600", role: "Supabase (attendance)", status: "live",
  description: "Tabel pencatat riwayat kehadiran real-time. Seluruh aktivitas absensi bersifat realtime (Supabase Realtime publication).",
  inflow: "Hasil clock-in valid / sync offline.", outflow: "Menyuplai data jam kerja ke Payroll & memantau HR.",
  dbObjects: ["attendance", "supabase_realtime publication"], codePath: null,
  refs: ["Session 2026-07-10: Absensi Realtime"], related: ["PayrollSystem", "HROps", "ChecklistBuka"] },
```

- [ ] **Step 2: Verifikasi tak ada error sintaks JS**

Buka file di browser, DevTools Console.
Expected: tidak ada `SyntaxError`; klik node `FaceMatch` (setelah Task 3 render panel) belum wajib — cukup pastikan konsol bersih saat load.

- [ ] **Step 3: Commit**

```bash
git add docs/interactive-diagrams/e2e_network_detailed.html
git commit -m "feat(diagram): skema nodeData komprehensif untuk node absensi (fakta terkoreksi)"
```

---

## Task 3: Render drawer detail komprehensif (skema baru)

**Files:**
- Modify: `docs/interactive-diagrams/e2e_network_detailed.html` (fungsi `window.showDetails`)

- [ ] **Step 1: Tulis ulang `showDetails` untuk merender semua field baru**

Ganti isi `window.showDetails` menjadi (menyembunyikan field kosong; `related` jadi tombol; badge status):

```js
window.showDetails = function(id) {
    const data = nodeData[id];
    if (!data) return;
    const panel = document.getElementById('detailsPanel');
    const title = document.getElementById('detailTitle');
    const content = document.getElementById('detailContent');
    title.textContent = id.replace(/([A-Z])/g, ' $1').trim();

    const statusMap = {
        live: { label: "🟢 Live", cls: "bg-green-100 text-green-800" },
        dev: { label: "🟡 Dalam Pengembangan", cls: "bg-yellow-100 text-yellow-800" },
        external: { label: "⚪ Eksternal", cls: "bg-gray-200 text-gray-700" }
    };
    const st = statusMap[data.status] || statusMap.external;
    const section = (label, html) => html ? `
        <div><h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">${label}</h3>${html}</div>` : '';
    const list = (label, arr) => (arr && arr.length) ? section(label,
        `<ul class="list-disc list-inside text-sm text-gray-700 space-y-0.5">${arr.map(x => `<li><code>${x}</code></li>`).join('')}</ul>`) : '';
    const relatedBtns = (data.related && data.related.length) ? section("Node Terkait",
        `<div class="flex flex-wrap gap-2">${data.related.map(r =>
            `<button onclick="showDetails('${r}')" class="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200 transition">${r.replace(/([A-Z])/g,' $1').trim()}</button>`).join('')}</div>`) : '';

    content.innerHTML = `
        <div class="space-y-5">
            <div class="flex items-center justify-between pb-4 border-b border-gray-100">
                <p class="font-bold ${data.color} text-lg">${data.app}</p>
                <span class="text-xs font-semibold px-2 py-1 rounded ${st.cls}">${st.label}</span>
            </div>
            ${section("Pelaku / Aktor", `<div class="inline-block bg-gray-100 px-3 py-1 rounded text-gray-800 text-sm font-medium">${data.role}</div>`)}
            ${section("Deskripsi Teknis", `<p class="text-gray-700 leading-relaxed text-sm bg-gray-50 p-4 rounded border border-gray-100">${data.description}</p>`)}
            ${section("Aliran Masuk", data.inflow ? `<p class="text-sm text-gray-700">⬇️ ${data.inflow}</p>` : '')}
            ${section("Aliran Keluar", data.outflow ? `<p class="text-sm text-gray-700">➡️ ${data.outflow}</p>` : '')}
            ${list("Objek Database", data.dbObjects)}
            ${data.codePath ? section("Path Kode", `<code class="text-xs bg-gray-800 text-gray-100 px-2 py-1 rounded block overflow-x-auto">${data.codePath}</code>`) : ''}
            ${list("Referensi / ADR", data.refs)}
            ${relatedBtns}
        </div>`;
    panel.classList.remove('hidden');
};
```

- [ ] **Step 2: Verifikasi di browser**

Buka file, klik node `FaceMatch`.
Expected: drawer kanan muncul dengan badge 🟢 Live, deskripsi menyebut `@vladmandic/human` & `0.65`, ada bagian Aliran Masuk/Keluar, Objek Database, Path Kode `apps/absensi/src/lib/face/match.ts`, dan tombol Node Terkait (`GPSCheck` dll). Klik tombol `GPSCheck` → panel berganti ke GPSCheck.

- [ ] **Step 3: Commit**

```bash
git add docs/interactive-diagrams/e2e_network_detailed.html
git commit -m "feat(diagram): drawer detail komprehensif (status, aliran, objek DB, path, node terkait)"
```

---

## Task 4: Lengkapi `nodeData` node non-absensi dengan field baru

**Files:**
- Modify: `docs/interactive-diagrams/e2e_network_detailed.html` (`nodeData`: node POS, Finance, Stok, Distribusi, Admin, Owner, Auth, External)

- [ ] **Step 1: Tambah field `status/inflow/outflow/dbObjects/codePath/refs/related` ke node kunci**

Perbarui minimal node berikut agar konsisten skema baru (contoh representatif; terapkan pola sama ke semua node tersisa, `status` sesuai: Finance M5 = `dev`, Supplier/CashDrawer aktor fisik = `external`, sisanya `live`):

```js
"BOM_Trigger": { app: "Database (Supabase)", color: "text-green-600", role: "Trigger / Edge Function", status: "live",
  description: "Trigger <code>AFTER INSERT</code> pesanan yang membedah <b>Bill of Materials</b> tiap produk jadi gramasi bahan baku lalu menulis baris <code>pemakaian</code> ke <code>ledger_stok</code>. Reversal void idempotent (hanya net-negatif per bahan). Wajib <code>SECURITY DEFINER</code> + guard no-negative.",
  inflow: "ID produk terjual dari POS_Sales.", outflow: "Memotong stok mentah di StockLedger.",
  dbObjects: ["trg_process_bom_stok", "ledger_stamp_saldo", "ledger_stok", "stok_balance"],
  codePath: "supabase/migrations/20260708100001_fix_ledger_saldo_atomic.sql",
  refs: ["COGS/BOM Automation 2026-07-04", "Invariant stok_balance↔ledger 2026-07-08"], related: ["POS_Sales", "StockLedger"] },

"StockLedger": { app: "Database Utama", color: "text-orange-500", role: "Tabel Supabase", status: "live",
  description: "Buku Besar Logistik bertanda (qty>0 masuk, <0 keluar). HPP harian = Stok Awal + Masuk − Akhir. Saldo dijaga trigger atomik; JANGAN UPDATE <code>stok_balance</code> langsung.",
  inflow: "Potongan BOM, penerimaan PO, hasil opname, penerimaan distribusi.", outflow: "Data HPP ke COGS_Matcher; memicu ReorderAlert.",
  dbObjects: ["ledger_stok", "stok_balance", "monitoring_view_spv"], codePath: "apps/stok",
  refs: ["ADR-011 snapshot harga", "Invariant stok_balance↔ledger"], related: ["BOM_Trigger", "COGS_Matcher", "ReorderAlert"] },

"SuratJalan": { app: "Distribusi (M3)", color: "text-purple-600", role: "Admin Gudang", status: "live",
  description: "Menerbitkan Dokumen Surat Jalan (Manifest/DO). Aksi ini memicu <code>fill_harga_snapshot</code> untuk memfoto Harga Master dari Admin Dashboard dan menguncinya permanen — penstabil HPP.",
  inflow: "Instruksi kemas dari ApproveOrder + snapshot harga MasterData.", outflow: "Barang fisik diangkut Supir; dokumen ke outlet.",
  dbObjects: ["surat_jalan", "fill_harga_snapshot"], codePath: "apps/distribusi",
  refs: ["ADR-011: Snapshot harga di Surat Jalan"], related: ["ApproveOrder", "SupirInternal", "MasterData", "ReceiveOutlet"] },

"DashUI": { app: "Admin Dash (Modul Owner)", color: "text-rose-600", role: "Owner & Mitra", status: "live",
  description: "Antarmuka analitik di rute <code>/dashboard/owner</code>, difilter RBAC. Peran <b>mitra</b> read-only ter-scope 1 outlet lewat <code>accessible_outlet_ids()</code> + scoped views. Menampilkan Leaderboard, P&L, ROI.",
  inflow: "Metrik pra-kalkulasi dari MaterializedViews.", outflow: "Visualisasi Net Cash & Margin ke Owner/Mitra.",
  dbObjects: ["sales_summary_spv", "sales_hourly_spv", "accessible_outlet_ids()"], codePath: "apps/admin-dashboard/src/app/dashboard/owner",
  refs: ["Session 2026-06-29: Mitra Role", "Admin-dashboard performance"], related: ["MaterializedViews", "COGS_Matcher"] },
```

Untuk node lain yang belum diperbarui (`PortalLogin, AuthValidator, SyncOutlets, EnrollFace, POS_Sales, POS_Offline, PaymentGateway, CashDrawer, Settlement, CompanyBank, SupplierPayment, PayrollSystem, PhysicalCount, DiffCalc, ReorderAlert, CrewOrder, ApproveOrder, CreatePO, ReceivePO, ReceiveOutlet, DiscrepancySplit, ClaimLoss, SupirInternal, SupplierEksternal, MasterData, HROps, SysHealth, EdgeRollup, COGS_Matcher, MaterializedViews`): tambahkan minimal `status`, `inflow`, `outflow`, dan `related` (boleh `dbObjects`/`codePath`/`refs` kosong `[]`/`null`). Pertahankan `description` lama bila sudah akurat.

- [ ] **Step 2: Verifikasi**

Buka file; klik acak 6 node lintas subgraph (mis. `POS_Sales`, `SuratJalan`, `DashUI`, `PayrollSystem`, `PhysicalCount`, `MasterData`).
Expected: semua menampilkan badge status yang benar (Finance = 🟡), tanpa field kosong yang bocor, tombol Node Terkait berfungsi.

- [ ] **Step 3: Commit**

```bash
git add docs/interactive-diagrams/e2e_network_detailed.html
git commit -m "feat(diagram): lengkapi nodeData non-absensi dgn status/aliran/objek DB/related"
```

---

## Task 5: Dashboard shell — rail kiri (legenda + filter) & drawer chrome

**Files:**
- Modify: `docs/interactive-diagrams/e2e_network_detailed.html` (`<body>` layout, `<main>`, `<aside>`)

- [ ] **Step 1: Bangun rail kiri sebagai kolom flex**

Ubah `<body>` menjadi 3 kolom. Tambahkan `<aside>` kiri SEBELUM `<main>`:

```html
<body class="bg-gray-50 h-screen flex overflow-hidden">
  <!-- Rail Kiri -->
  <aside class="w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto shrink-0">
    <div class="p-4 border-b">
      <h1 class="text-lg font-bold text-gray-800 leading-tight">Peta E2E 4-Dimensi</h1>
      <p class="text-xs text-gray-500 mt-1">Sukashawarma Outlet Suite</p>
    </div>
    <div class="p-4 border-b space-y-2">
      <h2 class="text-xs font-bold text-gray-400 uppercase tracking-wider">Filter Aliran</h2>
      <button data-flow-btn="data" class="w-full text-left text-sm px-3 py-2 rounded border hover:bg-gray-50">🔗 Data & Sistem</button>
      <button data-flow-btn="money" class="w-full text-left text-sm px-3 py-2 rounded border hover:bg-green-50">💵 Arus Uang ($)</button>
      <button data-flow-btn="goods" class="w-full text-left text-sm px-3 py-2 rounded border hover:bg-amber-50">📦 Barang Fisik</button>
      <button data-flow-btn="doc" class="w-full text-left text-sm px-3 py-2 rounded border hover:bg-gray-50">📄 Dokumen Bisnis</button>
      <button id="showAllFlows" class="w-full text-left text-sm px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Tampilkan Semua</button>
    </div>
    <div class="p-4 space-y-1.5">
      <h2 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Legenda App (Warna Node)</h2>
      <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded" style="background:#f3f4f6;border:1px solid #4b5563"></span> Auth & SSO</div>
      <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded" style="background:#dbeafe;border:1px solid #2563eb"></span> Portal & Absensi</div>
      <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded" style="background:#dcfce7;border:1px solid #22c55e"></span> POS Kasir</div>
      <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded" style="background:#ffedd5;border:1px solid #f97316"></span> Stok</div>
      <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded" style="background:#f3e8ff;border:1px solid #a855f7"></span> Distribusi</div>
      <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded" style="background:#e0f2fe;border:1px solid #0284c7"></span> Admin Dashboard</div>
      <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded" style="background:#ffe4e6;border:1px solid #e11d48"></span> Owner Module</div>
      <div class="flex items-center gap-2 text-xs"><span class="w-3 h-3 rounded" style="background:#fef3c7;border:1px solid #d97706"></span> Finance (M5 Dev)</div>
    </div>
  </aside>
  <!-- Main + drawer kanan tetap di bawah -->
```

Pindahkan `<h1>`/`<p>` lama di dalam `<main>` (hapus, sudah pindah ke rail). Bungkus `<pre class="mermaid">` dengan `<div id="graphWrap">` untuk pan/zoom (Task 6).

- [ ] **Step 2: Tambahkan toolbar kanvas (zoom + search) di atas graf**

Di dalam `<main>`, sebelum kartu graf, tambahkan:

```html
<div class="flex items-center gap-2 mb-3">
  <input id="nodeSearch" type="text" placeholder="Cari node… (mis. BOM)" class="border rounded px-3 py-1.5 text-sm w-64">
  <button id="zoomIn" class="px-3 py-1.5 border rounded text-sm hover:bg-gray-100">＋</button>
  <button id="zoomOut" class="px-3 py-1.5 border rounded text-sm hover:bg-gray-100">－</button>
  <button id="zoomReset" class="px-3 py-1.5 border rounded text-sm hover:bg-gray-100">Reset</button>
</div>
```

- [ ] **Step 3: Verifikasi layout**

Buka file.
Expected: 3 kolom (rail kiri legenda+filter, kanvas tengah dengan toolbar, drawer kanan tersembunyi). Graf tetap render. Belum ada aksi pada tombol (diikat di Task 6–7).

- [ ] **Step 4: Commit**

```bash
git add docs/interactive-diagrams/e2e_network_detailed.html
git commit -m "feat(diagram): dashboard shell — rail kiri legenda+filter & toolbar kanvas"
```

---

## Task 6: Pan/zoom (`svg-pan-zoom`) + search node

**Files:**
- Modify: `docs/interactive-diagrams/e2e_network_detailed.html` (`<head>` script import + init script)

- [ ] **Step 1: Muat svg-pan-zoom & init setelah Mermaid render**

Karena Mermaid ESM `startOnLoad:true` render async, ganti init jadi eksplisit. Di `<head>` ganti blok modul mermaid menjadi:

```html
<script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: false, htmlLabels: true, theme: 'default', securityLevel: 'loose' });
  window.mermaid = mermaid;
  await mermaid.run({ querySelector: '.mermaid' });
  window.__onGraphReady && window.__onGraphReady();
</script>
```

- [ ] **Step 2: Tulis handler graph-ready untuk pan/zoom, zoom buttons**

Di `<script>` bawah (setelah `closeDetails`), tambahkan:

```js
let panZoom = null;
window.__onGraphReady = function() {
  const svg = document.querySelector('.mermaid svg');
  if (!svg) return;
  svg.style.maxWidth = 'none';
  svg.style.width = '100%';
  svg.style.height = '78vh';
  panZoom = svgPanZoom(svg, { controlIconsEnabled: false, fit: true, center: true, minZoom: 0.2, maxZoom: 8 });
  document.getElementById('zoomIn').onclick = () => panZoom.zoomIn();
  document.getElementById('zoomOut').onclick = () => panZoom.zoomOut();
  document.getElementById('zoomReset').onclick = () => { panZoom.resetZoom(); panZoom.center(); panZoom.fit(); };
  classifyFlows();       // Task 7
  wireFlowFilters();     // Task 7
  wireSearch();
};

function wireSearch() {
  const input = document.getElementById('nodeSearch');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = input.value.trim().toLowerCase();
    if (!q) return;
    const match = Object.keys(nodeData).find(id => id.toLowerCase().includes(q));
    if (match) { showDetails(match); highlightNode(match); }
  });
}

function highlightNode(id) {
  document.querySelectorAll('.mermaid .node').forEach(n => n.classList.remove('node-hit'));
  const el = document.querySelector(`.mermaid [id*="${id}"]`);
  if (el) { const g = el.closest('.node'); if (g) g.classList.add('node-hit'); }
}
```

Tambahkan CSS di `<style>`:

```css
.node-hit rect, .node-hit polygon { stroke: #4f46e5 !important; stroke-width: 4px !important; }
```

- [ ] **Step 3: Verifikasi**

Buka file. Uji: drag kanvas menggeser graf; scroll zoom; tombol ＋/－/Reset bekerja; ketik "BOM" di search + Enter → panel BOM_Trigger terbuka & node ter-outline ungu.
Expected: semua bekerja; konsol bersih (fungsi `classifyFlows`/`wireFlowFilters` sudah didefinisikan di Task 7 — kerjakan Task 7 sebelum verifikasi final; sementara boleh stub kosong bila menguji terpisah).

- [ ] **Step 4: Commit**

```bash
git add docs/interactive-diagrams/e2e_network_detailed.html
git commit -m "feat(diagram): pan/zoom svg-pan-zoom + search node + highlight"
```

---

## Task 7: Filter 4-aliran (klasifikasi edge pasca-render)

**Files:**
- Modify: `docs/interactive-diagrams/e2e_network_detailed.html` (`<script>` + `<style>`)

- [ ] **Step 1: Implementasi klasifikasi & filter (aman/no-op bila struktur beda)**

Tambahkan di `<script>`:

```js
function classifyFlows() {
  const svg = document.querySelector('.mermaid svg');
  if (!svg) return;
  const labels = Array.from(svg.querySelectorAll('.edgeLabels .edgeLabel, .edgeLabel'));
  const paths = Array.from(svg.querySelectorAll('.edgePaths path.path, .edgePaths path'));
  const classify = (txt) => txt.includes('$') ? 'money'
    : txt.includes('📦') ? 'goods'
    : txt.includes('📄') ? 'doc' : 'data';
  // Tandai path berdasar urutan indeks label↔path (asumsi Mermaid: paralel).
  const n = Math.min(labels.length, paths.length);
  for (let i = 0; i < n; i++) {
    const flow = classify(labels[i].textContent || '');
    paths[i].setAttribute('data-flow', flow);
    paths[i].classList.add('flow-edge');
  }
  // Path tanpa label (edge internal subgraph) → data
  paths.forEach(p => { if (!p.getAttribute('data-flow')) { p.setAttribute('data-flow','data'); p.classList.add('flow-edge'); } });
}

let activeFlow = null;
function applyFlowFilter(flow) {
  const svg = document.querySelector('.mermaid svg');
  if (!svg) return;
  activeFlow = flow;
  svg.querySelectorAll('.flow-edge').forEach(p => {
    if (!flow || p.getAttribute('data-flow') === flow) { p.style.opacity = ''; p.style.strokeWidth = flow ? '4px' : ''; }
    else { p.style.opacity = '0.06'; p.style.strokeWidth = ''; }
  });
}

function wireFlowFilters() {
  document.querySelectorAll('[data-flow-btn]').forEach(btn => {
    btn.onclick = () => applyFlowFilter(btn.getAttribute('data-flow-btn'));
  });
  const all = document.getElementById('showAllFlows');
  if (all) all.onclick = () => applyFlowFilter(null);
}
```

- [ ] **Step 2: Verifikasi filter**

Buka file. Klik "📦 Barang Fisik".
Expected: hanya edge berlabel 📦 (Supplier→ReceivePO, SuratJalan→Supir, Supir→ReceiveOutlet) yang tegas; edge lain sangat redup. Klik "Tampilkan Semua" → semua kembali. Klik "💵 Arus Uang" → hanya edge `$` menonjol. Jika pemetaan meleset, graf tetap utuh tanpa error (no-op).

- [ ] **Step 3: Verifikasi menyeluruh (regresi)**

Ulangi cek Task 1/3/6: render bersih, klik node → drawer lengkap, pan/zoom + search + 4 filter semuanya jalan bersamaan. Konsol tanpa error.

- [ ] **Step 4: Commit**

```bash
git add docs/interactive-diagrams/e2e_network_detailed.html
git commit -m "feat(diagram): filter 4-aliran via klasifikasi edge pasca-render (aman no-op)"
```

---

## Task 8: Koreksi fakta pada 3 sibling HTML

**Files:**
- Modify: `docs/interactive-diagrams/e2e_network.html`
- Modify: `docs/interactive-diagrams/e2e_swimlane.html`
- Modify: `docs/interactive-diagrams/e2e_macro.html`

- [ ] **Step 1: Cari klaim usang di tiap file**

Untuk tiap file, cari string: `face-api`, `Euclidean`, `0.5`, `clock/page`, `Bebas GPS`, `GPS lama`.
Run (Grep tool, bukan bash): pattern `face-api|Euclidean|clock/page|Bebas GPS|GPS lama` pada folder `docs/interactive-diagrams`.
Expected: daftar baris yang perlu dikoreksi.

- [ ] **Step 2: Terapkan koreksi konsisten**

Di tiap kemunculan:
- `face-api.js` → `@vladmandic/human`
- `Euclidean Distance < 0.5` / `Euclidean < 0.5` → `cosine similarity ≥ 0.65`
- `clock/page.tsx` → `kiosk/[outlet_id]/page.tsx`
- Narasi "Bebas GPS"/"GPS diganti Liveness" → "GPS + Liveness dua-duanya aktif (FaceMatch → GPS → Liveness)".

- [ ] **Step 3: Verifikasi**

Buka ketiga file di browser; pastikan render tetap normal dan teks terkoreksi muncul.
Grep ulang pattern Step 1 → Expected: tidak ada lagi kemunculan usang (kecuali bila memang label historis yang disengaja).

- [ ] **Step 4: Commit**

```bash
git add docs/interactive-diagrams/e2e_network.html docs/interactive-diagrams/e2e_swimlane.html docs/interactive-diagrams/e2e_macro.html
git commit -m "fix(diagram): koreksi fakta wajah/GPS/path di 3 sibling E2E HTML"
```

---

## Task 9: Sinkronkan `FLOWS.md #3` (clock-in)

**Files:**
- Modify: `docs/FLOWS.md` (section "3. Clock-in dengan Face Matching + GPS (M1)")

- [ ] **Step 1: Perbarui label metrik & tambah langkah Liveness**

Pada blok flowchart section 3:
- Ganti node `desc` teks `face-api.js hitung descriptor` → `@vladmandic/human hitung descriptor`.
- Ganti kondisi `match` `(jarak di bawah 0.5)` → `(cosine similarity ≥ 0.65)`.
- Setelah cabang `gps -- "Ya" -->`, sisipkan node Liveness sebelum `online`:

```
    gps -- "Ya" --> live{"Liveness OK?<br/>(challenge senyum/kedip,<br/>kembali frontal)"}
    live -- "Tidak" --> rej3["❌ Tolak: gagal liveness"]
    live -- "Ya" --> online{"Online?"}
```

Dan tambahkan `class rej3 no;` pada baris `class` di bawah.

- [ ] **Step 2: Verifikasi render Mermaid GitHub-style**

Pratinjau `FLOWS.md` (VS Code Markdown preview atau GitHub).
Expected: diagram section 3 render dengan langkah Liveness baru, tanpa error sintaks Mermaid; metrik menunjukkan cosine ≥ 0.65.

- [ ] **Step 3: Commit**

```bash
git add docs/FLOWS.md
git commit -m "docs(flows): sinkron clock-in — cosine 0.65, @vladmandic/human, tambah langkah Liveness"
```

---

## Self-Review (sudah dijalankan)

- **Spec coverage:** §2 bug/fakta → Task 1,8,9. §3 shell → Task 5,6. §4 panel → Task 2,3,4. §5 filter → Task 7. §6 konten graf → Task 1. §7 sibling+FLOWS → Task 8,9. Semua tercakup.
- **Placeholder scan:** tidak ada TBD; semua step berisi kode nyata.
- **Konsistensi tipe/fungsi:** `classifyFlows`, `wireFlowFilters`, `wireSearch`, `highlightNode`, `applyFlowFilter`, `__onGraphReady`, `showDetails` konsisten dipakai antar-task; skema `nodeData` (status/inflow/outflow/dbObjects/codePath/refs/related) konsisten Task 2↔3↔4.
- **Catatan urutan:** Task 6 memanggil `classifyFlows()/wireFlowFilters()` yang didefinisikan di Task 7 — kerjakan 6 lalu 7 berurutan (atau stub kosong sementara) sebelum verifikasi final.
