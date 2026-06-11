# Notes: Static Export vs SSR — Keputusan Arsitektur

> Dibuat: 2026-06-11 · Konteks: brainstorm fitur transfer stok M2

---

## Keputusan: Tetap Static Export

Project ini deploy ke **cPanel shared hosting** (constraint nyata — tidak bisa run Node.js process). Semua logika bisnis ada di **Supabase RPC + RLS**, sehingga static export cukup untuk semua fitur yang direncanakan.

---

## Pro/Cons

| | **Static Export** | **SSR/Dynamic** |
|---|---|---|
| Deploy | File statis di cPanel ✅ | Butuh Node.js process — tidak support di shared hosting |
| Biaya | Gratis (hosting sudah ada) | Butuh VPS/cloud = biaya tambahan |
| Performa | CDN-ready, load cepat | Cold start lebih lambat |
| Auth & Session | Client-side (Supabase JS SDK) | Bisa server-side httpOnly cookie |
| API Routes | ❌ Tidak bisa | ✅ Bisa |
| Realtime | ✅ Supabase Realtime di browser | ✅ Bisa |
| RLS & RPC | ✅ Semua di Supabase | ✅ Bisa di server atau Supabase |
| Deploy complexity | Rendah — build → upload | Tinggi — PM2, reverse proxy |

---

## Kekurangan yang Relevan

1. **Push notif saat browser tutup** — tidak bisa (lihat seksi Realtime di bawah)
2. **Auth cookie server-side** — session di-manage client-side, sedikit lebih rentan XSS vs httpOnly cookie. Supabase JS sudah handle ini dengan baik.
3. **Background jobs** — tidak bisa dari app. Sudah di-handle oleh **pg_cron di Supabase**.

**Yang tidak relevan untuk internal tool ini:**
- SEO — tidak dibutuhkan
- API Routes — semua sudah di Supabase RPC
- Server-side auth middleware — RLS Supabase lebih kuat

---

## Workaround Push Notif: Supabase Realtime

Supabase Realtime = WebSocket dari browser ke Supabase. Selama tab terbuka, client subscribe ke perubahan tabel dan react secara real-time.

**Contoh use case transfer request:**
```
SPV Outlet submit request → INSERT ke tabel transfer_request
                                    ↓
                         Supabase Realtime broadcast
                                    ↓
              Browser SPV Pusat (tab monitoring terbuka) terima event
                                    ↓
                    Badge counter naik / toast muncul
```

### Kapan notif masuk?

| Kondisi | Notif masuk? |
|---------|-------------|
| Tab aktif terbuka | ✅ Langsung |
| Tab terbuka tapi di background | ✅ Masih masuk |
| Browser minimize ke taskbar | ✅ Masih masuk (WebSocket tetap hidup) |
| Browser ditutup | ❌ Tidak masuk |
| HP sleep / layar mati | ❌ Browser suspend, WebSocket putus |
| Refresh halaman | ✅ Re-subscribe otomatis |

**Verdict:** Untuk SPV Pusat yang buka dashboard monitoring seharian di meja kerja, Realtime cukup. Mirip cara kerja Slack/Notion di browser.

**Push notif native** (Service Worker + Web Push) bisa notif walau tab tutup — tapi butuh HTTPS + server untuk kirim payload + user grant permission. Kompleks untuk cPanel static. Bisa ditambah di fase lanjut jika SPV sering miss request.

---

## Upgrade Path

Jika nanti butuh SSR (push notif native, server-side auth, dll):
- Pindah ke **Vercel Free tier** (Next.js first-party, gratis untuk project kecil)
- Tidak perlu ubah kode apapun — cukup hapus `output: 'export'` dari `next.config.js`
