'use server'

import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/authz'
import { HARI_LIBUR_ICS_URL, parseHariLiburIcs } from '@/lib/hariLibur'

// Tulis ke `hari_libur` hanya lewat service role (RLS: authenticated baca saja).
// Setiap perubahan memicu hitung ulang alfa di database (trigger).
const HR_ROLES = ['admin', 'owner', 'admin_hr']
const KEY_SINKRON = 'hr.hari_libur_sinkron_terakhir'
const SINKRON_SETIAP_HARI = 30

function adminDb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

type Hasil = { ok: true; message: string } | { ok: false; error: string }

async function sinkronInternal(): Promise<{ ditambah: number; diperbarui: number; dihapus: number }> {
  const res = await fetch(HARI_LIBUR_ICS_URL, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`Kalender resmi tidak bisa diambil (HTTP ${res.status})`)
  const feed = parseHariLiburIcs(await res.text())
  if (feed.length < 10) throw new Error('Isi kalender resmi tidak wajar — sinkron dibatalkan')

  const db = adminDb()
  const { data: ada, error } = await db
    .from('hari_libur')
    .select('tanggal, nama, jenis, tentatif, sumber, diubah_manual')
  if (error) throw error
  const lama = new Map((ada ?? []).map((r) => [r.tanggal as string, r]))

  let ditambah = 0
  let diperbarui = 0
  const upserts = []
  for (const f of feed) {
    const r = lama.get(f.tanggal)
    // Tanggal yang diatur manual oleh HR tidak disentuh
    if (r && (r.sumber === 'manual' || r.diubah_manual)) continue
    if (!r) ditambah++
    else if (r.nama === f.nama && r.jenis === f.jenis && r.tentatif === f.tentatif) continue
    else diperbarui++
    upserts.push({ ...f, sumber: 'google', updated_at: new Date().toISOString() })
  }
  if (upserts.length) {
    const { error: upErr } = await db.from('hari_libur').upsert(upserts, { onConflict: 'tanggal' })
    if (upErr) throw upErr
  }

  // Tanggal dari kalender yang dicabut pemerintah (mis. tanggal tentatif bergeser)
  const diFeed = new Set(feed.map((f) => f.tanggal))
  const tahunFeed = new Set(feed.map((f) => f.tanggal.slice(0, 4)))
  const hapus = (ada ?? [])
    .filter(
      (r) =>
        r.sumber === 'google' &&
        !r.diubah_manual &&
        tahunFeed.has(String(r.tanggal).slice(0, 4)) &&
        !diFeed.has(r.tanggal)
    )
    .map((r) => r.tanggal)
  if (hapus.length) {
    const { error: delErr } = await db.from('hari_libur').delete().in('tanggal', hapus)
    if (delErr) throw delErr
  }

  await db
    .from('global_settings')
    .upsert({ key: KEY_SINKRON, value: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'key' })

  return { ditambah, diperbarui, dihapus: hapus.length }
}

/** Tombol "Sinkronkan" di halaman Hari Libur. */
export async function sinkronkanHariLibur(): Promise<Hasil> {
  try {
    await requireRole(HR_ROLES)
    const r = await sinkronInternal()
    return {
      ok: true,
      message: `Sinkron selesai: ${r.ditambah} baru, ${r.diperbarui} diperbarui, ${r.dihapus} dihapus`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Gagal sinkron' }
  }
}

/**
 * Dipanggil diam-diam saat halaman HR dibuka: sinkron otomatis bila terakhir
 * sinkron > 30 hari lalu (tanggal tentatif pemerintah sering bergeser).
 */
export async function pastikanHariLiburTerbaru(): Promise<void> {
  try {
    await requireRole(HR_ROLES)
    const { data } = await adminDb().from('global_settings').select('value').eq('key', KEY_SINKRON).maybeSingle()
    const terakhir = data?.value ? new Date(String(data.value)).getTime() : 0
    if (Date.now() - terakhir < SINKRON_SETIAP_HARI * 86_400_000) return
    await sinkronInternal()
  } catch (e) {
    console.warn('[hari-libur] sinkron otomatis gagal:', e instanceof Error ? e.message : e)
  }
}

/** Aktif/nonaktifkan sebuah tanggal (mis. outlet tetap buka saat cuti bersama). */
export async function setHariLiburAktif(tanggal: string, aktif: boolean): Promise<Hasil> {
  try {
    await requireRole(HR_ROLES)
    const { error } = await adminDb()
      .from('hari_libur')
      .update({ aktif, diubah_manual: true, updated_at: new Date().toISOString() })
      .eq('tanggal', tanggal)
    if (error) throw error
    return { ok: true, message: aktif ? 'Tanggal dihitung libur' : 'Tanggal dihitung hari kerja' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Gagal menyimpan' }
  }
}

/** Libur khusus perusahaan (mis. libur outlet serentak). */
export async function tambahHariLibur(tanggal: string, nama: string): Promise<Hasil> {
  try {
    await requireRole(HR_ROLES)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error('Tanggal tidak valid')
    const judul = nama.trim()
    if (!judul) throw new Error('Nama libur wajib diisi')
    const { error } = await adminDb().from('hari_libur').upsert(
      {
        tanggal,
        nama: judul.slice(0, 120),
        jenis: 'manual',
        sumber: 'manual',
        aktif: true,
        diubah_manual: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tanggal' }
    )
    if (error) throw error
    return { ok: true, message: 'Hari libur ditambahkan' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Gagal menyimpan' }
  }
}

/** Hapus libur manual (libur dari kalender resmi cukup dinonaktifkan). */
export async function hapusHariLiburManual(tanggal: string): Promise<Hasil> {
  try {
    await requireRole(HR_ROLES)
    const { error } = await adminDb().from('hari_libur').delete().eq('tanggal', tanggal).eq('sumber', 'manual')
    if (error) throw error
    return { ok: true, message: 'Hari libur dihapus' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Gagal menghapus' }
  }
}

/**
 * Role yang libur otomatis di hari Minggu & tanggal merah (global_settings
 * `hr.role_libur_kantor`). Role lain (crew/outlet) tetap wajib masuk.
 * Perubahan memicu hitung ulang alfa di database (trigger).
 */
export async function setRoleLiburKantor(roles: string[]): Promise<Hasil> {
  try {
    await requireRole(HR_ROLES)
    const bersih = Array.from(new Set(roles.map((r) => r.trim()).filter((r) => /^[a-z_]+$/.test(r))))
    const { error } = await adminDb()
      .from('global_settings')
      .upsert({ key: 'hr.role_libur_kantor', value: bersih, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw error
    return { ok: true, message: 'Pengaturan disimpan, alfa dihitung ulang' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Gagal menyimpan' }
  }
}
