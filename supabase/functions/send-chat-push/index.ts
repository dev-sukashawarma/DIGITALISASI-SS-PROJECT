import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { initializeApp, cert, getApps } from 'npm:firebase-admin/app'
import { getMessaging } from 'npm:firebase-admin/messaging'

/**
 * Push khusus Chat Tim aplikasi native (SUPER-APPS-SS-MOBILE).
 *
 * KENAPA FUNGSI SENDIRI, BUKAN `send-push`
 * `send-push` dengan `broadcast: true` menyiram SELURUH baris `fcm_tokens`,
 * dan tabel itu dipakai bersama aplikasi POS. Lebih buruk lagi, ia menandai
 * pesan broadcast dengan `type: 'broadcast'`, yang di POS berarti "pesan dari
 * owner" — POS lalu membunyikan alarm owner dan menampilkan judul
 * "PESAN DARI OWNER: ...". Itulah sebabnya pesan chat muncul sebagai pesan
 * owner di HP kasir.
 *
 * Fungsi ini karena itu membaca `chat_push_tokens` — tabel yang HANYA diisi
 * aplikasi superapp — sehingga POS tidak pernah menerima pesan chat sama
 * sekali. `send-push` tidak disentuh, jadi web dan POS tetap seperti semula.
 *
 * Payload dikirim sebagai `data`, bukan `notification`, supaya aplikasi yang
 * menyusun tampilannya sendiri: gaya percakapan, nama dan foto grup, serta
 * tombol balas langsung.
 */

let firebaseInitialized = false
function initFirebase() {
  if (!firebaseInitialized && getApps().length === 0) {
    const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT')
    if (!serviceAccountStr) {
      console.warn('FIREBASE_SERVICE_ACCOUNT belum diisi')
      return
    }
    try {
      initializeApp({ credential: cert(JSON.parse(serviceAccountStr)) })
      firebaseInitialized = true
    } catch (e) {
      console.error('Gagal inisialisasi Firebase:', e)
    }
  } else if (getApps().length > 0) {
    firebaseInitialized = true
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    initFirebase()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const {
      message_id,
      sender_id,
      sender_name,
      body,
      group_name,
      group_photo,
      mentions,
    } = await req.json()

    // Siapa yang namanya disebut. Dipakai untuk memberi mereka notifikasi yang
    // berbeda — sama seperti WhatsApp, disebut namanya terasa lain dari sekadar
    // ada pesan baru di grup.
    const disebut: string[] = Array.isArray(mentions) ? mentions.filter((m) => typeof m === 'string') : []

    // Jejak untuk menelusuri sebutan yang tidak sampai. Tanpa baris ini,
    // "penanda tidak muncul" tidak bisa dibedakan antara trigger yang tidak
    // mengirim daftarnya dan id yang tidak cocok dengan pemilik token.
    console.log('send-chat-push: mentions =', JSON.stringify(mentions ?? null))

    if (!body) {
      return new Response(
        JSON.stringify({ error: 'body wajib diisi' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    // Pengirim tidak dikirimi notifikasi pesannya sendiri.
    let query = supabase.from('chat_push_tokens').select('token, staff_id')
    if (sender_id) query = query.neq('staff_id', sender_id)

    const { data: tokens, error } = await query
    if (error) throw error

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Tidak ada perangkat terdaftar', successCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }
    if (!firebaseInitialized) {
      return new Response(
        JSON.stringify({ error: 'Firebase belum dikonfigurasi' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      )
    }

    const dasar: Record<string, string> = {
      type: 'chat',
      title: group_name || 'Chat Tim',
      body: String(body),
      sender: sender_name || 'Anggota tim',
      sender_id: sender_id || '',
      message_id: message_id || '',
      group_photo: group_photo || '',
      url: '/chat',
    }

    // Payload dibangun PER PENERIMA, bukan sekali untuk semua. Fungsi ini memang
    // sudah mengirim per token, jadi membedakan isinya tidak menambah satu pun
    // panggilan jaringan.
    //
    // Isi pesannya TIDAK diubah — hanya penandanya yang ditambahkan. Aplikasi
    // menggambar notifikasi chat dengan MessagingStyle, yang sudah menampilkan
    // nama pengirim di depan pesannya; menyisipkan "X menyebut Anda:" ke dalam
    // body akan membuat namanya tertulis dua kali dalam satu baris.
    const untuk = (staffId: string): Record<string, string> =>
      disebut.includes(staffId) ? { ...dasar, mention: '1' } : dasar

    const hasil = await Promise.allSettled(
      tokens.map(async (t: { token: string; staff_id: string }) => {
        try {
          await getMessaging().send({
            token: t.token,
            data: untuk(t.staff_id),
            android: { priority: 'high' },
          })
        } catch (e: any) {
          // Token mati dibersihkan supaya daftarnya tidak terus membengkak.
          if (e?.code === 'messaging/registration-token-not-registered') {
            await supabase.from('chat_push_tokens').delete().eq('token', t.token)
          }
          throw e
        }
      }),
    )

    const successCount = hasil.filter((r) => r.status === 'fulfilled').length
    return new Response(
      JSON.stringify({
        message: 'Push chat terkirim',
        successCount,
        failCount: hasil.length - successCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error: any) {
    console.error('send-chat-push gagal:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
