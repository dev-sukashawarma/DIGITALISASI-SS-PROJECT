# Sukashawarma PWA & Push Notification Guide

Dokumen ini menjelaskan arsitektur PWA (Progressive Web App) dan sistem Web Push Notification pada *monorepo* Sukashawarma, beserta panduan untuk memperluas fungsionalitas notifikasi (misal: menambahkan jenis notifikasi baru).

---

## 1. Arsitektur PWA
Sistem PWA diimplementasikan menggunakan package internal `@suka/pwa` dan `@suka/offline-queue` yang menggunakan library **Serwist** (`@serwist/next`). 

Setiap aplikasi memiliki konfigurasi PWA di dalam `next.config.mjs` (atau `.js`) yang di-wrap dengan `withSerwist`. Konfigurasi ini mengatur:
- **Service Worker (`sw.js`)**: Di-*generate* otomatis berdasarkan *entry point* `src/app/sw.ts`. Service Worker akan me-*handle* caching *asset*, halaman (offline fallback), dan juga menerima event push notification.
- **Manifest (`manifest.webmanifest`)**: Dibuat melalui `src/app/manifest.ts` berisi konfigurasi *icon*, *theme color*, dan identitas aplikasi untuk *Add to Home Screen* (A2HS).
- **Background Sync**: Terintegrasi pada package `@suka/offline-queue` untuk *flush* antrean API saat koneksi internet kembali stabil secara otomatis (tanpa perlu membuka aplikasi).

---

## 2. Arsitektur Push Notification
Notifikasi memanfaatkan standar Web Push API dan Supabase Edge Functions.

**Alur Kerja Push Notification:**
1. **Subscribe**: User mengklik "Izinkan Notifikasi" melalui komponen `<NotificationToggle />` yang ada di aplikasi masing-masing (misal di dashboard Distribusi atau Stok).
2. **Simpan Kredensial**: Informasi *subscription* beserta *VAPID keys* dikirim ke Supabase dan disimpan pada tabel `push_subscriptions`.
3. **Trigger Notifikasi**: Terjadi sebuah *event* yang memicu pengiriman pesan (baik dari perubahan *database* maupun *action user* manual).
4. **Edge Function `send-push`**: Menerima request untuk mengirim pesan (berisi `title`, `body`, target `user_id` atau `outlet_id`). Function ini mengambil kredensial langganan dari tabel `push_subscriptions` dan meneruskannya ke Web Push Server (Google/Mozilla/Apple) menggunakan *library* `web-push`.
5. **Receive & Show**: Web Push Server menembak *Service Worker* di perangkat user, kemudian `sw.js` menampilkan *notification banner* kepada user.

---

## 3. Cara Menambahkan Jenis Notifikasi Baru

Terdapat 2 cara untuk mengirim notifikasi, tergantung dari mana aksi tersebut berasal.

### Cara A: Otomatis dari Database (via PostgreSQL Triggers)
Digunakan ketika notifikasi harus dipicu secara otomatis oleh sistem saat data berubah (contoh: status Surat Jalan berubah jadi "dikirim", atau stok barang menyentuh limit minimal).

1. Buat *migration* baru di folder `supabase/migrations/`
2. Buat fungsi `PL/pgSQL` untuk membentuk *payload* notifikasi dan menembak fungsi Edge `send-push`
3. Pasang fungsi sebagai trigger pada tabel terkait

**Contoh: Notifikasi Stok Menipis**
```sql
-- 1. Buat fungsi notifikasi
create or replace function public.notify_low_stock()
returns trigger as $$
declare
  payload jsonb;
begin
  -- Cek jika stok turun di bawah treshold minimum
  if NEW.amount <= NEW.minimum_threshold then
    -- Siapkan payload (dikirim ke seluruh staf di outlet terkait)
    payload := jsonb_build_object(
      'title', 'Peringatan Stok ⚠️',
      'body', 'Stok ' || NEW.item_name || ' hampir habis! Sisa: ' || NEW.amount,
      'url', '/stok/monitoring',
      'outlet_id', NEW.outlet_id -- Targetkan ke outlet yang sesuai
    );

    -- Panggil HTTP POST ke Edge Function send-push
    perform net.http_post(
      url := 'https://[PROJECT-REF].supabase.co/functions/v1/send-push',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer [SERVICE_ROLE_KEY]"}'::jsonb,
      body := payload
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- 2. Pasangkan ke tabel stok
create trigger check_low_stock_trigger
  after update of amount on public.stock_items
  for each row execute function public.notify_low_stock();
```

### Cara B: Manual dari Aplikasi (via Action Frontend/Backend)
Digunakan apabila notifikasi dikirim secara *on-demand* akibat dari aksi user secara langsung dari aplikasi UI (contoh: Admin mengirim *broadcast message* promosi, atau HR mengirim teguran ke staf tertentu).

**Contoh Request dari Next.js (Client Component atau Server Action):**
```typescript
import { createClient } from '@/lib/supabase/client'

async function sendTeguran(staffId: string) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Wajib sertakan token session agar Edge Function dapat memverifikasi identitas pengirim
      'Authorization': `Bearer ${session?.access_token}` 
    },
    body: JSON.stringify({
      title: "Pesan dari HRD 📩",
      body: "Tolong segera periksa jadwal shifting Anda di aplikasi Absensi.",
      url: "/absensi",
      user_id: staffId // Kirim ke akun staf tersebut saja
    })
  })

  if (!response.ok) {
    console.error("Gagal kirim teguran")
  }
}
```

### Opsi Parameter Payload Edge Function `send-push`
Payload berupa objek JSON yang wajib dikirim di *body request*:

| Parameter | Tipe | Wajib? | Keterangan |
| :--- | :--- | :--- | :--- |
| `title` | string | **Ya** | Judul Notifikasi (Maks. ~50 karakter disarankan) |
| `body` | string | **Ya** | Isi teks notifikasi |
| `url` | string | Tidak | URL yang akan dibuka jika notifikasi di-klik (relatif atau absolut) |
| `user_id` | string | Tidak* | Kirim hanya ke satu user spesifik |
| `outlet_id` | string | Tidak* | Kirim ke seluruh staf yang terdaftar di outlet ini |
| `broadcast` | boolean | Tidak* | Set `true` untuk mengirim notifikasi ke *semua user* di seluruh outlet (Mass Broadcast) |
| `app` | string | Tidak | Memfilter target aplikasi (misal: `"stok"`, `"distribusi"`) |

*) *Anda harus mengirim **salah satu** dari `user_id`, `outlet_id`, atau `broadcast` agar notifikasi tahu tujuannya.*

---

## 4. Penanganan Offline dan Cleanup Subscription
- Jika notifikasi dikirim saat perangkat user *offline*, notifikasi akan tertunda dan baru diterima sesaat setelah perangkat terhubung ke internet (tergantung limitasi TTL dari *Push Service Provider*).
- Ketika Edge Function mengirim notifikasi dan mendapati respon bahwa `Subscription Expired/Unsubscribed` (Error `404` / `410` dari Google/Mozilla), maka *Edge Function* secara otomatis menghapus record langganan tersebut dari database agar tidak membebani eksekusi pengiriman berikutnya.
