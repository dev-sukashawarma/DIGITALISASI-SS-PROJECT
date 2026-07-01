# ADR-012 — Reorder Threshold berbasis nilai stok per outlet (metode = Hybrid)

- Status: **Proposed** (metode = **Hybrid (F)** DIPUTUSKAN; penandaan Bahan Inti, hard-block vs alert, & default % belum final)
- Tanggal: 2026-07-01
- Terkait: **ADR-011** (model HPP/valuasi — "nilai stok" di sini = Σ `qty × harga snapshot terbaru per bahan`, sesuai metode valuasi "harga terakhir" yang sudah diputuskan di ADR-011). CONTEXT.md ("Reorder Point", "Bahan Baku"). Bersinggungan dengan reorder point per-item yang sudah ada (`bahan_baku.default_reorder_point`, `outlet_reorder_point`).

## Konteks

Atasan/owner minta kontrol **kapan outlet boleh memesan bahan baku lagi**, berbasis **nilai (rupiah)**, bukan qty per item. Framing beliau:

> Outlet punya "jatah" stok bahan baku senilai ~Rp10 juta. Boleh order lagi kalau nilai stoknya tinggal ~20%. Tujuan: cegah over-order/menimbun, jaga cashflow.

Ini **berbeda** dari reorder point per-item yang sudah ada (ambang qty per bahan). Yang diminta = **gate berbasis nilai di level outlet**: menahan pembuatan **Order Session** (Surat Jalan) baru selama nilai stok masih di atas ambang.

Klarifikasi yang sudah muncul selama diskusi:
- **Ambang persen bukan konstanta** — bisa diatur **per outlet** (outlet lead-time panjang / laju cepat → ambang lebih tinggi).
- **"Nilai stok"** dihitung dari model HPP (ADR-011): `Σ qty_stok × harga snapshot terbaru per bahan`. Jadi fitur ini **downstream** dari model valuasi HPP.

## Tujuan

Gate: **boleh membuat Order Session baru bila nilai stok (relevan) ≤ ambang%**. Menahan over-order, jaga cashflow, tanpa membuat outlet kehabisan bahan vital.

## Keputusan: metode = Hybrid (F) / Model 1

**Metode terpilih = Hybrid (F).** Gate terdiri dari dua lapis:

1. **Plafon nilai total per outlet** — outlet boleh membuat Order Session bila `nilai stok total ≤ ambang% × plafon`. Ini mengontrol over-order/cashflow.
2. **Pengecualian per-item Bahan Inti** — meski nilai total masih di atas ambang, bila ada **Bahan Inti** yang menyentuh reorder point per-item-nya (`bahan_baku.default_reorder_point` / `outlet_reorder_point` yang sudah ada), outlet **tetap boleh** memesan (order darurat), sehingga tak terjebak saat item vital habis.

Ini mengadopsi **Model 1** (plafon total + pengecualian darurat core), **bukan** Model 2 (ambang hanya atas nilai inti). Konsekuensinya, konsep **Bahan Inti (Core Item)** menjadi **wajib** — perlu cara menandai bahan mana yang inti (lihat "Belum diputuskan").

Alasan memilih Hybrid: menutup dua kebutuhan owner sekaligus — kontrol belanja (plafon nilai) + tak terjebak saat bahan vital kosong (per-item core) — dan memanfaatkan reorder point per-item yang **sudah ada** (tinggal menambah lapisan plafon + flag core).

## Kandidat metode acuan "100%" & pemicu (rekam jejak — F dipilih)

Semua memakai skenario Outlet Sudirman: Plafon = Rp10jt, ambang 20% (kecuali C), nilai order terakhir = Rp8jt, laju pakai = Rp1,5jt/hari, AYAM reorder point = 30 kg.

| Metode | Acuan "100%" | Pemicu boleh-order | Pro | Kontra |
|---|---|---|---|---|
| **A** Plafon tetap | Plafon nilai per outlet (mis. 10jt) | nilai stok ≤ 20% × plafon | Sederhana, stabil, per-outlet | Buta komposisi (lihat Skenario 2) |
| **B** Order terakhir | Nilai Order Session terakhir | nilai stok ≤ 20% × order terakhir | Tanpa set plafon manual | "20% dari yang mana" ambigu (stok kumulatif); buta komposisi |
| **C** Days-of-cover | Laju pakai × N hari | cover tersisa < N hari | Responsif ke laju (outlet ramai) | Buta komposisi bila di level total; per-item ≈ reorder point dinamis |
| **E** % dari puncak | Nilai stok puncak setelah restock terakhir | nilai stok ≤ 20% × puncak | Self-calibrating, tanpa plafon manual | Sulit dijelaskan; buta komposisi |
| **F** Hybrid | Plafon (A) + pengecualian per-item core | gate nilai total, tapi item core < reorder point boleh nerobos | Tutup lubang komposisi | Mekanisme ganda |

### Skenario 1 — nilai turun merata, komposisi sehat
Nilai stok = **Rp2,5jt**, AYAM = 40 kg (aman).

| Metode | Cek | Boleh order? |
|---|---|:--:|
| A plafon tetap | 2,5jt > 2,0jt | ❌ belum |
| B order terakhir | 2,5jt > 1,6jt | ❌ belum |
| C days-of-cover | 2,5jt/1,5jt = 1,67 hari < 2 | ✅ boleh |
| E % dari puncak | 2,5jt > 2,0jt | ❌ belum |
| F hybrid | 2,5jt > 2,0jt & item aman | ❌ belum |

→ C berbeda: outlet ramai (laju tinggi) → izinkan restock lebih awal.

### Skenario 2 — nilai total tinggi, TAPI AYAM habis
Nilai stok = **Rp3,0jt** (numpuk kemasan/bumbu), AYAM = **0 kg** (di bawah reorder 30).

| Metode | Cek | Boleh order AYAM? | Masalah |
|---|---|:--:|---|
| A plafon tetap | 3,0jt > 2,0jt | ❌ terblokir | AYAM vital kosong tapi tak boleh pesan |
| B order terakhir | 3,0jt > 1,6jt | ❌ terblokir | sama |
| C days-of-cover (total) | 3,0jt/1,5jt = 2 hari, tidak < 2 | ❌ terblokir | buta komposisi |
| E % dari puncak | 3,0jt > 2,0jt | ❌ terblokir | sama |
| F hybrid | plafon blokir, TAPI AYAM < reorder point | ✅ boleh order AYAM (darurat) | — |

→ **Hanya F** yang menangani komposisi. A/B/C/E "buta komposisi": nilai total sehat menyembunyikan item vital kosong.

## Masalah komposisi & konsep "Bahan Inti"

Kelemahan mendasar metode berbasis-nilai-total (A/B/E, dan C bila total): **nilai total bisa sehat sementara bahan vital kosong** (sisa numpuk di pelengkap). Solusinya butuh klasifikasi bahan → **Bahan Inti (Core Item)** vs **Bahan Pelengkap**. Dua cara memakainya:

- **Model 1 — Plafon nilai TOTAL + pengecualian darurat core.** Gate di nilai total; item core yang menyentuh reorder point boleh menerobos. (= metode F.) Jalan, tapi dua aturan.
- **Model 2 — Ambang % dihitung HANYA atas nilai stok Bahan Inti.** "Boleh order bila nilai stok inti ≤ 20% × plafon inti." Pelengkap tak dihitung → tak bisa menyamarkan item inti yang habis. Pelengkap tetap diurus reorder point per-item yang sudah ada. Satu aturan bersih; menutup lubang komposisi tanpa mekanisme ganda. **(Rekomendasi penulis, belum diputuskan.)**

**Istilah kanonik yang diusulkan (belum dikunci):**
- **Bahan Inti (Core Item)** — bahan penentu produksi (protein, kulit/tortilla, saus utama).
- **Bahan Pelengkap** — sisanya (kemasan, sabun, kertas struk).

## Parameter per outlet

Konfigurasi yang dikelola admin **per outlet** (bukan konstanta sistem):

| Setelan | Contoh | Fungsi |
|---|---|---|
| Plafon nilai stok total (acuan "100%") | Rp10jt | Nilai stok outlet saat penuh (lapis 1 Hybrid) |
| Ambang reorder (%) | 20% (bisa 15/25/30…) | Kapan boleh/dipicu order lagi |

Rekomendasi: sediakan **default global** (mis. 20%) + **override per outlet**, meniru pola `default_reorder_point` (bahan) + `outlet_reorder_point` (override) yang sudah ada — supaya tak ada outlet tanpa ambang, dan konsisten dengan sistem.

## Belum diputuskan

- **Cara menandai bahan "inti"** — flag manual admin, per kategori, atau otomatis dari nilai konsumsi (ABC). (Wajib karena Hybrid butuh klasifikasi Bahan Inti.)
- **Efek saat ambang terpenuhi** — hard-block (permintaan tak bisa disubmit) vs soft-alert (peringatan saja).
- **Nilai default ambang %** & siapa yang boleh set per outlet (admin? spv?).
- **Ketergantungan ADR-011:** valuasi sudah diputuskan (harga terakhir) → "nilai stok" = qty × harga snapshot terbaru per bahan.
