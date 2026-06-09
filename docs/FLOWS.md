# Flows — Alur Proses Outlet Suite

Diagram alur tiap proses kunci (Mermaid, render di GitHub).
Lihat juga: [`ARCHITECTURE.md`](ARCHITECTURE.md) · [`PRD.md`](PRD.md)

---

## 1. Sinkron `outlets` (Ecosystem → Outlet Suite) — M0

```mermaid
sequenceDiagram
    participant N as n8n (scheduled)
    participant E as Supabase Ecosystem (produksi)
    participant S as Supabase Outlet Suite (akun baru)

    N->>E: GET /outlets (read key)
    E-->>N: 19 outlets (id uuid, lat, lng, ...)
    N->>S: upsert outlets BY id (uuid dipertahankan)
    Note over S: outlets siap dipakai FK lokal<br/>lat/lng utk GPS absensi
```

---

## 2. Enroll Wajah Staff (M1) — oleh SPV

```mermaid
sequenceDiagram
    participant SPV
    participant App as App Absensi (browser)
    participant FA as face-api.js
    participant S as Supabase (Storage + DB)

    SPV->>App: pilih staff + minta consent
    App->>SPV: tampilkan consent biometrik (UU PDP)
    SPV->>App: ambil 1-3 foto wajah (kamera)
    App->>FA: hitung face descriptor (vektor)
    FA-->>App: descriptor[128]
    App->>S: simpan outlet_staff.face_descriptor + ref_photo_url
    Note over S: enroll tersimpan, RLS per-outlet
```

---

## 3. Clock-in dengan Face Matching + GPS (M1)

```mermaid
flowchart TD
    start(["Staff buka app, tekan Clock-in"]) --> cam["Kamera live ambil wajah"]
    cam --> desc["face-api.js hitung descriptor"]
    desc --> match{"Match 1:1 vs<br/>descriptor terdaftar?<br/>(jarak di bawah 0.5)"}
    match -- "Tidak" --> rej1["❌ Tolak: wajah tidak cocok"]
    match -- "Ya" --> gps{"Dalam radius<br/>GPS outlet?<br/>(75-100m)"}
    gps -- "Tidak" --> rej2["❌ Tolak: di luar lokasi"]
    gps -- "Ya" --> online{"Online?"}
    online -- "Ya" --> save["Simpan attendance<br/>+ selfie audit + ts server"]
    online -- "Tidak" --> queue["Simpan ke offline queue<br/>(sinkron saat online)"]
    queue --> save
    save --> done(["✅ Absen tercatat<br/>(tepat/telat)"])

    classDef ok fill:#0a7d2c,color:#fff;
    classDef no fill:#b00,color:#fff;
    class done,save ok;
    class rej1,rej2 no;
```

---

## 4. Stock Opname & Ledger (M2)

```mermaid
sequenceDiagram
    participant Staff
    participant App as App Stok
    participant S as Supabase

    Note over Staff,S: Inventarisasi (opname) harian/mingguan
    Staff->>App: input hitungan fisik per bahan baku
    App->>S: insert stock_opname + items (counted vs system)
    S-->>App: hitung diff (selisih)
    alt ada selisih
        App->>S: insert stock_ledger(type=adjust, qty=diff, source=opname)
    end

    Note over Staff,S: Pemakaian / waste manual
    Staff->>App: catat keluar/waste
    App->>S: insert stock_ledger(type=keluar|waste)

    Note over S: Monitoring
    S->>S: saldo = SUM(ledger) per outlet+material
    S-->>App: alert bila saldo di bawah reorder_point ⚠️
```

---

## 5. Supply Chain: Surat Jalan → Verifikasi → Stok Masuk (M3→M2)

```mermaid
sequenceDiagram
    participant G as Admin Gudang Pusat
    participant App as App Distribusi
    participant O as Staff Outlet
    participant S as Supabase

    G->>App: buat Surat Jalan (outlet, item, qty_dikirim)
    App->>S: insert shipments(status=dikirim) + shipment_items
    Note over O: barang sampai di outlet
    O->>App: buka shipment, timbang & input qty_diterima
    App->>S: insert goods_receipts(qty_diterima, diff, foto)
    alt qty_diterima < qty_dikirim
        S->>S: shipments.status = selisih_dicatat ⚠️
    else lengkap
        S->>S: shipments.status = diterima_lengkap
    end
    S->>S: TRIGGER insert stock_ledger(type=masuk,<br/>qty=qty_diterima, source=shipment)
    Note over S: stok outlet bertambah = qty TERVERIFIKASI<br/>(bukan qty dikirim)
```

> **Contoh:** kirim 50kg → outlet terima 48kg → discrepancy 2kg dicatat, stok masuk = **48kg**.

---

## 6. Owner Dashboard — Reporting Hub (M4)

```mermaid
flowchart LR
    subgraph SRC["Sumber data"]
        led["stock_ledger<br/>(COGS, waste)"]
        att["attendance<br/>(kehadiran)"]
        shp["shipments<br/>(distribusi)"]
        sales["sales (Ecosystem)<br/>online + POS"]
        comp["compliance<br/>(Checklist MySQL)"]
    end

    n8n["n8n (sinkron)"]
    sales -->|"agregat"| n8n
    comp -->|"berkala"| n8n
    n8n --> roll["sales_rollup +<br/>compliance (di Outlet Suite)"]

    subgraph HUB["Reporting Hub (Supabase Outlet Suite)"]
        roll
        led --> mv["Materialized Views<br/>(pg_cron refresh)"]
        att --> mv
        shp --> mv
        roll --> mv
    end

    mv -->|"baca cepat (sub-detik)"| dash["📊 Owner Dashboard<br/>(static, client-side)"]

    note["Refresh berlapis:<br/>hari ini ~2 mnt · historis jam/harian"]
    mv -.- note
```

---

## 7. Pola Deploy (semua app, static export)

```mermaid
flowchart LR
    dev["Dev push ke branch"] --> pr["Pull Request → review"]
    pr --> merge["Merge ke main"]
    merge --> build["npm run build<br/>(next: output export)"]
    build --> out["folder out/ (statis)"]
    out --> up["upload ke cPanel<br/>public_html/&lt;subdomain&gt;"]
    up --> live["🌐 absensi/stok/distribusi/dashboard .sukashawarma"]
```
