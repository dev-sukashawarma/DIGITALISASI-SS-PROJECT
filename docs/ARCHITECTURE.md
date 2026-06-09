# Arsitektur — Sukashawarma Outlet Suite

Dokumen visual struktur sistem. Diagram pakai Mermaid (render otomatis di GitHub).
Lihat juga: [`PRD.md`](PRD.md) · [`FLOWS.md`](FLOWS.md) · [`DB-MIGRATION-PLAN.md`](DB-MIGRATION-PLAN.md) · [`adr/`](adr/)

---

## 1. Context Diagram — siapa pakai apa

```mermaid
flowchart TB
    staff["👤 Staff Outlet<br/>(crew/kasir/spv)"]
    spv["🧑‍💼 SPV / Kepala Outlet"]
    gudang["🏭 Admin Gudang Pusat"]
    owner["👔 Owner"]

    subgraph SUITE["Outlet Suite (BARU)"]
        m1["📷 Absensi + Face<br/>(M1)"]
        m2["📦 Stok Bahan Baku<br/>(M2)"]
        m3["🚚 Distribusi<br/>(M3)"]
        m4["📊 Owner Dashboard<br/>(M4)"]
    end

    subgraph EXIST["Ekosistem Existing (di luar scope build)"]
        online["🛒 Online Order<br/>(TiktokGo)"]
        pos["💵 POS + Self-Service<br/>(shawarma-kiosk)<br/>project Supabase sendiri"]
        checklist["✅ Checklist Ops<br/>(PHP/MySQL)"]
    end

    staff --> m1
    staff --> m2
    spv --> m1
    spv --> m2
    spv --> m3
    gudang --> m3
    owner --> m4

    m3 -->|"stok masuk"| m2
    m2 -->|"COGS / waste"| m4
    m1 -->|"kehadiran"| m4
    m3 -->|"status distribusi"| m4
    pos -.->|"sales (sumber utama, sinkron)"| m4
    online -.->|"sales online (sinkron)"| m4
    checklist -.->|"compliance (fase lanjut)"| m4
```

---

## 2. Topologi Deployment — di mana semuanya tinggal

```mermaid
flowchart LR
    subgraph DEV["Tim Dev"]
        gh["GitHub<br/>DIGITALISASI-SS-PROJECT<br/>(monorepo)"]
    end

    subgraph HOST["cPanel CloudLinux shared (penyedia lokal)"]
        a1["absensi.* (static)"]
        a2["stok.* (static)"]
        a3["distribusi.* (static)"]
        a4["dashboard.* (static)"]
    end

    subgraph SB_NEW["Supabase Cloud — AKUN BARU (Outlet Suite)"]
        db1[("Postgres + RLS<br/>outlet_staff, stok,<br/>shipment, reporting")]
        ef1["Edge Functions"]
        st1["Storage<br/>(selfie, foto bukti)"]
        cron1["pg_cron<br/>(refresh views)"]
    end

    subgraph SB_OLD["Supabase Cloud — AKUN PRODUKSI (Ecosystem)"]
        db0[("outlets master,<br/>orders, POS")]
    end

    gh -->|"build static export → upload out/"| HOST
    HOST -->|"Supabase JS (anon key + RLS)"| db1
    HOST --> ef1
    HOST --> st1
    cron1 -->|"refresh views"| db1
    cron1 -->|"jadwalkan sync"| ef1
    ef1 -->|"baca (read key)"| db0
    ef1 -->|"upsert outlets + sales_rollup"| db1
```

> Catatan: app = file **statis**; semua logika & data di Supabase. cPanel hanya menyajikan file. DB Outlet Suite di **akun Supabase berbeda** dari produksi (ADR-004). Static export (ADR-005). Sinkron antar-akun via Edge Function + pg_cron, bukan n8n (ADR-006).

---

## 3. ERD — model data Outlet Suite

```mermaid
erDiagram
    outlets ||--o{ outlet_staff : "punya"
    outlets ||--o{ attendance : "lokasi"
    outlet_staff ||--o{ attendance : "pelaku"
    outlets ||--o{ outlet_material_config : "atur"
    raw_materials ||--o{ outlet_material_config : "dikonfig"
    outlets ||--o{ stock_ledger : "punya"
    raw_materials ||--o{ stock_ledger : "item"
    outlet_staff ||--o{ stock_ledger : "aktor"
    outlets ||--o{ stock_opname : "lokasi"
    outlet_staff ||--o{ stock_opname : "pelaku"
    stock_opname ||--o{ stock_opname_items : "berisi"
    raw_materials ||--o{ stock_opname_items : "item"
    outlets ||--o{ shipments : "tujuan"
    shipments ||--o{ shipment_items : "berisi"
    raw_materials ||--o{ shipment_items : "item"
    shipments ||--o{ goods_receipts : "diverifikasi"
    raw_materials ||--o{ goods_receipts : "item"
    outlet_staff ||--o{ goods_receipts : "verifikator"

    outlets {
        uuid id PK "sama dgn Ecosystem"
        text slug
        text name
        numeric lat
        numeric lng
        boolean is_active
    }
    outlet_staff {
        uuid id PK
        uuid outlet_id FK
        text name
        text role "crew|kasir|spv|kepala_outlet"
        jsonb face_descriptor
        text ref_photo_url
        text status
    }
    attendance {
        uuid id PK
        uuid outlet_staff_id FK
        uuid outlet_id FK
        text type "in|out"
        timestamptz ts_server
        numeric gps_lat
        numeric gps_lng
        text selfie_url
        numeric match_distance
        text status "tepat|telat|alpha"
    }
    raw_materials {
        uuid id PK
        text name
        text unit "kg|pcs|liter"
        text category
    }
    outlet_material_config {
        uuid outlet_id FK
        uuid material_id FK
        numeric reorder_point
    }
    stock_ledger {
        uuid id PK
        uuid outlet_id FK
        uuid material_id FK
        text type "masuk|keluar|waste|adjust"
        numeric qty
        text source "opname|shipment|manual"
        uuid ref_id
        uuid actor_staff_id FK
        timestamptz created_at
    }
    stock_opname {
        uuid id PK
        uuid outlet_id FK
        date opname_date
        uuid actor_staff_id FK
    }
    stock_opname_items {
        uuid opname_id FK
        uuid material_id FK
        numeric counted_qty
        numeric system_qty
        numeric diff
    }
    shipments {
        uuid id PK
        uuid outlet_id FK
        text no_surat_jalan
        text status "dikirim|diterima_sebagian|diterima_lengkap|selisih_dicatat"
        uuid created_by
        timestamptz created_at
    }
    shipment_items {
        uuid shipment_id FK
        uuid material_id FK
        numeric qty_dikirim
    }
    goods_receipts {
        uuid shipment_id FK
        uuid material_id FK
        numeric qty_diterima
        numeric diff
        text photo_url
        uuid verified_by FK
        timestamptz verified_at
    }
```

---

## 4. Dependency Modul & Fase (2-track paralel)

```mermaid
flowchart TD
    M0["🏗️ M0 Foundation<br/>outlets, outlet_staff,<br/>auth/RLS, design-system<br/><b>Dev B</b>"]

    M1["📷 M1 Absensi + Face<br/><b>Dev A</b>"]
    M2["📦 M2 Stok Bahan Baku<br/><b>Dev B</b>"]
    M3["🚚 M3 Distribusi<br/><b>Dev A</b>"]
    M4["📊 M4 Owner Dashboard<br/><b>Dev B</b>"]

    M0 --> M1
    M0 --> M2
    M2 --> M3
    M3 -->|"qty terverifikasi → stok masuk"| M2
    M2 --> M4
    M1 --> M4
    M3 --> M4

    classDef devA fill:#f29744,stroke:#701604,color:#fff;
    classDef devB fill:#0a7d2c,stroke:#063,color:#fff;
    classDef found fill:#701604,stroke:#400a07,color:#fff;
    class M1,M3 devA;
    class M2,M4 devB;
    class M0 found;
```

| Fase | Dev A (Orange) | Dev B (Green) |
|------|----------------|----------------|
| 1 | M1 Absensi+Face | M0 Foundation |
| 2 | M3 Distribusi | M2 Stok |
| 3 | Integrasi M3→M2 | M4 Dashboard |

---

## 5. Struktur Repo (monorepo)

```mermaid
flowchart TD
    root["DIGITALISASI-SS-PROJECT/"]
    root --> ctx["CONTEXT.md (glossary)"]
    root --> docs["docs/"]
    root --> pkg["packages/design-system/"]
    root --> apps["apps/"]
    root --> sb["supabase/migrations/"]

    docs --> d1["PRD.md"]
    docs --> d2["ARCHITECTURE.md"]
    docs --> d3["FLOWS.md"]
    docs --> d4["DB-MIGRATION-PLAN.md"]
    docs --> d5["PREFLIGHT.md"]
    docs --> d6["adr/0001..0005"]

    apps --> ap1["absensi/ (M1)"]
    apps --> ap2["stok/ (M2)"]
    apps --> ap3["distribusi/ (M3)"]
    apps --> ap4["owner-dashboard/ (M4)"]
```

---

## 6. Alur Kerja Git (2 dev)

```mermaid
gitGraph
    commit id: "docs + skeleton"
    branch feat/m0-foundation
    checkout feat/m0-foundation
    commit id: "schema outlets+staff"
    commit id: "RLS + design-system"
    checkout main
    merge feat/m0-foundation tag: "M0"
    branch feat/m1-absensi
    branch feat/m2-stok
    checkout feat/m1-absensi
    commit id: "face enroll"
    commit id: "clock-in flow"
    checkout feat/m2-stok
    commit id: "opname + ledger"
    checkout main
    merge feat/m1-absensi tag: "M1"
    merge feat/m2-stok tag: "M2"
```
