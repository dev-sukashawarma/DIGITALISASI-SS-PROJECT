// Memberi tahu seluruh HP SUKA Kerja Superapps bahwa rilis baru tersedia.
//
// Satu pesan FCM data-only ke topik `superapp-update` — BUKAN notifikasi yang terlihat.
// HP yang menerimanya menjalankan UpdateLatarWorker: cek manifest, unduh patch, lalu
// pasang diam-diam saat aplikasi tidak sedang dipakai. Dengan push ini, cek berkala di
// HP cukup sebagai cadangan yang jarang (12 jam), bukan polling rapat ke database.
//
// Dipanggil oleh scripts/publish-superapp.ps1 (repo SUPER-APPS-SS-MOBILE) setelah
// global_settings.superapp_update diperbarui, memakai kunci service role/secret.

import { initializeApp, cert, getApps } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'

const TOPIK = 'superapp-update'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function initFirebase(): boolean {
  if (getApps().length > 0) return true
  const akun = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
  if (!akun) return false
  initializeApp({ credential: cert(JSON.parse(akun)) })
  return true
}

/**
 * Hanya pemegang kunci admin project yang boleh memicu push ke semua perangkat.
 * Diperiksa dengan mencoba endpoint admin Auth memakai kunci itu sendiri — cara ini
 * berlaku untuk service role JWT lama maupun secret key baru, tanpa membandingkan string.
 */
async function kunciAdminSah(req: Request): Promise<boolean> {
  const kunci = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!kunci || !SUPABASE_URL) return false
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
    headers: { apikey: kunci, Authorization: `Bearer ${kunci}` },
  })
  await res.body?.cancel()
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!(await kunciAdminSah(req))) return json({ error: 'Unauthorized' }, 401)

  let versionCode = 0
  try {
    versionCode = Number((await req.json())?.version_code) || 0
  } catch {
    // body kosong/rusak -> ditolak di bawah
  }
  if (versionCode <= 0) return json({ error: 'version_code wajib diisi' }, 400)

  if (!initFirebase()) return json({ error: 'FIREBASE_SERVICE_ACCOUNT belum diset' }, 500)

  try {
    const messageId = await getMessaging().send({
      topic: TOPIK,
      data: { type: 'superapp_update', version_code: String(versionCode) },
      android: {
        // Normal, bukan high: pesan data tanpa notifikasi yang terlihat tetap sampai,
        // dan FCM menurunkan prioritas aplikasi yang memakai "high" tanpa menampilkan apa pun.
        priority: 'normal',
        // HP yang mati/offline masih menerimanya selama sehari; sesudah itu cek berkala
        // 12 jam dan layar wajib update yang menangani.
        ttl: 24 * 60 * 60 * 1000,
        collapseKey: TOPIK,
      },
    })
    return json({ ok: true, message_id: messageId, topic: TOPIK, version_code: versionCode })
  } catch (e) {
    console.error('Gagal mengirim push update', e)
    return json({ error: String((e as Error)?.message ?? e) }, 502)
  }
})
