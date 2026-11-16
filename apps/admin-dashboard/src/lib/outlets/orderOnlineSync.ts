import type { SupabaseClient } from '@supabase/supabase-js'
import { createOrderOnlineAdminClient } from '@/lib/supabase/order-online-client'
import { adalahTipeOutlet, type TipeOutlet } from '@/lib/outletType'
import {
  kirimKredensialOrderOnlineTelegram,
  type StatusOutletSuka,
} from '@/lib/telegram/hermesNotifier'

/** Order Online hanya mengenal 'owned' | 'partner'. */
export function tipeOrderOnline(jenis: string | null | undefined): 'owned' | 'partner' {
  return jenis === 'mitra' ? 'partner' : 'owned'
}

function dariTipeOrderOnline(tipeOo: string | null | undefined): TipeOutlet | null {
  if (tipeOo === 'partner') return 'mitra'
  if (tipeOo === 'owned') return 'internal'
  return null
}

const AWALAN_MEREK_RE = /^(?:suka\s*shawarma|sukashawarma|mitra\s*ss|mitra|internal|ss|outlet|cabang)[\s\-_.:]+/i
const AKHIRAN_TIPE_RE = /[\s\-_.:]+(?:mitra|internal)$/i
const POLA_EMAIL_OTOMATIS_RE = /^(?:ss|mitra)[a-z0-9]+@ss\.com$/i

/**
 * Mengekstrak kunci cabang bersih (alfanumerik huruf kecil tanpa spasi/awalan merek)
 * dan label tampilan huruf besar untuk nama akun.
 * Contoh:
 * - "cileungsi" -> { kunci: "cileungsi", label: "CILEUNGSI" }
 * - "MITRA CILEUNGSI" -> { kunci: "cileungsi", label: "CILEUNGSI" }
 * - "SUKA SHAWARMA Pondok Aren" -> { kunci: "pondokaren", label: "PONDOK AREN" }
 */
export function ekstrakInfoCabang(nama: string, slug?: string | null): { kunci: string; label: string } {
  let bersih = (nama ?? '').trim()
  while (AWALAN_MEREK_RE.test(bersih)) {
    bersih = bersih.replace(AWALAN_MEREK_RE, '').trim()
  }
  while (AKHIRAN_TIPE_RE.test(bersih)) {
    bersih = bersih.replace(AKHIRAN_TIPE_RE, '').trim()
  }

  let kunci = bersih.toLowerCase().replace(/[^a-z0-9]/g, '')
  let sumberLabel = bersih

  if (!kunci && slug) {
    let bersihSlug = slug.trim()
    while (AWALAN_MEREK_RE.test(bersihSlug)) {
      bersihSlug = bersihSlug.replace(AWALAN_MEREK_RE, '').trim()
    }
    while (AKHIRAN_TIPE_RE.test(bersihSlug)) {
      bersihSlug = bersihSlug.replace(AKHIRAN_TIPE_RE, '').trim()
    }
    kunci = bersihSlug.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (kunci) sumberLabel = bersihSlug.replace(/[-_]+/g, ' ')
  }

  if (!kunci) {
    kunci = (nama ?? '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'outlet'
    sumberLabel = (nama ?? '').trim() || 'OUTLET'
  }

  // Pastikan panjang minimum kunci minimal 2 karakter agar password selalu >= 8 karakter
  if (kunci.length < 2) {
    kunci = `${kunci}01`
  }

  const label = sumberLabel.replace(/\s+/g, ' ').trim().toUpperCase() || 'OUTLET'
  return { kunci, label }
}

export interface KredensialOrderOnline {
  email: string
  password: string
  fullName: string
  kunciCabang: string
}

/**
 * Menghasilkan kredensial standar akun pengelola Form Order:
 * - Mitra:    mitra<cabang>@ss.com / pw: mitra<cabang>2627
 * - Internal: ss<cabang>@ss.com    / pw: ss<cabang>2627
 */
export function buatKredensialOrderOnline(
  nama: string,
  tipe: TipeOutlet,
  slug?: string | null,
  akhiranUnik?: string,
): KredensialOrderOnline {
  const { kunci, label } = ekstrakInfoCabang(nama, slug)
  const awalan = tipe === 'mitra' ? 'mitra' : 'ss'
  const tambahan = akhiranUnik ? akhiranUnik.toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const inti = `${awalan}${kunci}${tambahan}`

  return {
    email: `${inti}@ss.com`,
    password: `${inti}2627`,
    fullName: tipe === 'mitra' ? `MITRA ${label}` : `SS ${label}`,
    kunciCabang: `${kunci}${tambahan}`,
  }
}

export interface OutletUntukOrderOnline {
  id: string
  slug: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  phone?: string | null
  type: string | null
  status?: StatusOutletSuka | string | null
  is_active: boolean
  open_hour: string | null
  close_hour: string | null
}

export interface OpsiSinkronOrderOnline {
  mode?: 'buat' | 'ubah' | 'status'
  tipeSebelumnya?: string | null
  namaSebelumnya?: string | null
}

export interface HasilSinkronOrderOnline {
  outletOrderOnlineId: string | null
  kredensial?: KredensialOrderOnline
  telegramTerkirim?: boolean
  peringatanTelegram?: string
}

function klienOrderOnline(): SupabaseClient | null {
  try {
    return createOrderOnlineAdminClient()
  } catch {
    console.warn('Order Online not configured, skipping sync')
    return null
  }
}

function normalisasiStatusOutlet(status: string | null | undefined, isActive: boolean): StatusOutletSuka {
  if (status === 'active' || status === 'pending' || status === 'inactive') {
    return status
  }
  return isActive ? 'active' : 'inactive'
}

function formatJamDb(jam: string | null | undefined, bawaan: string): string {
  const j = (jam ?? '').trim()
  if (!j) return bawaan
  return j.length === 5 ? `${j}:00` : j
}

async function cariSlugUnikOrderOnline(oo: SupabaseClient, slugDasar: string): Promise<string> {
  const bersih = slugDasar
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'outlet'

  let kandidat = bersih
  let penghitung = 2
  while (true) {
    const { data, error } = await oo
      .from('outlets')
      .select('id')
      .eq('slug', kandidat)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return kandidat
    kandidat = `${bersih}-${penghitung}`
    penghitung++
  }
}

async function pilihKredensialBebasBentrok(
  oo: SupabaseClient,
  nama: string,
  tipe: TipeOutlet,
  slug: string,
  outletOrderOnlineId: string,
): Promise<{ kredensial: KredensialOrderOnline; userBentrokTanpaOutletId: string | null }> {
  let percobaan = 0
  while (true) {
    const akhiran = percobaan === 0 ? undefined : String(percobaan + 1)
    const kandidat = buatKredensialOrderOnline(nama, tipe, slug, akhiran)

    const { data: barisPemakai, error } = await oo
      .from('admin_users')
      .select('id, outlet_id, role')
      .ilike('email', kandidat.email)
      .limit(1)

    if (error) throw new Error(error.message)
    const pemakaiEmail = barisPemakai?.[0] ?? null

    // Aman jika belum dipakai siapa pun, atau dipakai oleh outlet ini sendiri
    if (!pemakaiEmail || pemakaiEmail.outlet_id === outletOrderOnlineId) {
      return { kredensial: kandidat, userBentrokTanpaOutletId: null }
    }

    // Jika baris lama adalah outlet_staff yatim (outlet_id NULL), gunakan ulang akun tersebut
    if (pemakaiEmail.role === 'outlet_staff' && !pemakaiEmail.outlet_id) {
      return { kredensial: kandidat, userBentrokTanpaOutletId: pemakaiEmail.id }
    }

    percobaan++
    if (percobaan > 25) {
      throw new Error(`Tidak dapat menemukan email unik untuk outlet ${nama}`)
    }
  }
}

async function cariAuthUserIdBerdasarkanEmail(oo: SupabaseClient, email: string): Promise<string | null> {
  const target = email.toLowerCase()
  let halaman = 1
  while (halaman <= 10) {
    const { data, error } = await oo.auth.admin.listUsers({ page: halaman, perPage: 200 })
    if (error || !data?.users?.length) return null
    const ketemu = data.users.find((u) => (u.email ?? '').toLowerCase() === target)
    if (ketemu) return ketemu.id
    if (data.users.length < 200) break
    halaman++
  }
  return null
}

/**
 * Sinkronkan baris outlet ke Form Order (Order Online) sekaligus otomatis:
 * 1. Membuat user pengelola outlet baru (mitra<cabang>@ss.com / ss<cabang>@ss.com) saat outlet dibuat.
 * 2. Memperbarui email & password user secara otomatis apabila tipe outlet (Internal <-> Mitra)
 *    atau nama cabang berubah saat di-edit di Admin Dashboard.
 * 3. Menjaga status aktif/nonaktif akun sesuai siklus hidup outlet (Pending & Aktif = akun siap login,
 *    Inactive = akun dinonaktifkan).
 * 4. Mengirim kredensial secara otomatis ke bot Telegram @devsshermesbot.
 */
export async function sinkronOutletKeOrderOnline(
  o: OutletUntukOrderOnline,
  opsi?: OpsiSinkronOrderOnline,
): Promise<HasilSinkronOrderOnline> {
  const oo = klienOrderOnline()
  if (!oo) return { outletOrderOnlineId: null }

  const statusOutlet = normalisasiStatusOutlet(o.status, o.is_active)
  const outletTampilPelanggan = statusOutlet === 'active'

  // 1. Cari apakah outlet sudah tercatat di Form Order (via pos_outlet_id atau id)
  const { data: ada, error: errCari } = await oo
    .from('outlets')
    .select('id, slug, type, name, status, is_active')
    .or(`pos_outlet_id.eq.${o.id},id.eq.${o.id}`)
    .maybeSingle()
  if (errCari) throw new Error(errCari.message)

  const tipeOoBaru = tipeOrderOnline(o.type)
  const dataDasar = {
    pos_outlet_id: o.id,
    name: o.name,
    address: o.address || '-',
    lat: Number.isFinite(o.lat) ? o.lat : null,
    lng: Number.isFinite(o.lng) ? o.lng : null,
    ...(o.phone !== undefined ? { phone_wa: o.phone?.trim() || null } : {}),
    type: tipeOoBaru,
    status: statusOutlet,
    is_active: outletTampilPelanggan,
    open_hour: formatJamDb(o.open_hour, '14:00:00'),
    close_hour: formatJamDb(o.close_hour, '22:00:00'),
  }

  let outletOrderOnlineId: string
  let slugOrderOnline: string

  if (ada) {
    outletOrderOnlineId = ada.id
    slugOrderOnline = ada.slug || o.slug
    const { error } = await oo
      .from('outlets')
      .update({
        ...dataDasar,
        slug: slugOrderOnline,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ada.id)
    if (error) throw new Error(error.message)
  } else {
    outletOrderOnlineId = o.id
    slugOrderOnline = await cariSlugUnikOrderOnline(oo, o.slug || o.name)
    const { error } = await oo.from('outlets').insert({
      id: o.id,
      slug: slugOrderOnline,
      ...dataDasar,
    })
    if (error) throw new Error(error.message)
  }

  // Lokasi non-outlet (gudang, kantor, marketplace, sistem, tes) tidak dibuatkan akun staf outlet
  if (!adalahTipeOutlet(o.type)) {
    return { outletOrderOnlineId }
  }

  const tipeSekarang: TipeOutlet = o.type
  const akunHarusAktif = statusOutlet !== 'inactive'

  // 2. Periksa akun outlet_staff yang sudah tertaut ke outlet ini di Form Order
  const { data: daftarStaff, error: errStaff } = await oo
    .from('admin_users')
    .select('id, email, full_name, is_active')
    .eq('outlet_id', outletOrderOnlineId)
    .eq('role', 'outlet_staff')
  if (errStaff) throw new Error(errStaff.message)

  const staffUtama =
    (daftarStaff ?? []).find((u) => POLA_EMAIL_OTOMATIS_RE.test(u.email)) ??
    (daftarStaff ?? [])[0] ??
    null

  const tipeLamaEksplisit = adalahTipeOutlet(opsi?.tipeSebelumnya) ? opsi!.tipeSebelumnya : null
  const tipeLamaDariOo = ada ? dariTipeOrderOnline(ada.type) : null
  const tipeLamaEfektif: TipeOutlet | null = tipeLamaEksplisit ?? tipeLamaDariOo

  const adalahOutletBaru = !ada || opsi?.mode === 'buat'
  const belumPunyaAkun = !staffUtama
  const tipeBerubah = Boolean(tipeLamaEfektif && tipeLamaEfektif !== tipeSekarang)

  const namaLama = opsi?.namaSebelumnya ?? ada?.name ?? null
  const kunciCabangBerubah =
    Boolean(namaLama) &&
    ekstrakInfoCabang(namaLama!, slugOrderOnline).kunci !==
      ekstrakInfoCabang(o.name, slugOrderOnline).kunci
  const namaBerubahPadaAkunOtomatis =
    Boolean(staffUtama) &&
    opsi?.mode === 'ubah' &&
    kunciCabangBerubah &&
    POLA_EMAIL_OTOMATIS_RE.test(staffUtama.email)

  const perluGenerateAtauPutarKredensial =
    belumPunyaAkun || adalahOutletBaru || tipeBerubah || namaBerubahPadaAkunOtomatis

  if (!perluGenerateAtauPutarKredensial) {
    // Sinkronkan status aktif akun saja (tanpa mereset password user yang sedang berjalan)
    const perluUpdateAktif = (daftarStaff ?? []).some((u) => u.is_active !== akunHarusAktif)
    if (perluUpdateAktif) {
      const { error: errAktif } = await oo
        .from('admin_users')
        .update({ is_active: akunHarusAktif })
        .eq('outlet_id', outletOrderOnlineId)
        .eq('role', 'outlet_staff')
      if (errAktif) throw new Error(errAktif.message)
    }
    return { outletOrderOnlineId }
  }

  // 3. Siapkan kredensial standar & pastikan bebas bentrok dengan outlet lain
  const { kredensial, userBentrokTanpaOutletId } = await pilihKredensialBebasBentrok(
    oo,
    o.name,
    tipeSekarang,
    slugOrderOnline,
    outletOrderOnlineId,
  )

  const targetUserId = staffUtama?.id ?? userBentrokTanpaOutletId
  let finalUserId: string

  if (targetUserId) {
    // Update Auth User yang sudah ada (email + password default baru)
    const payloadUpdateAuth = {
      email: kredensial.email,
      password: kredensial.password,
      email_confirm: true,
      user_metadata: {
        role: 'outlet_staff',
        full_name: kredensial.fullName,
        outlet_id: outletOrderOnlineId,
      },
    }

    let { error: errUpdateAuth } = await oo.auth.admin.updateUserById(targetUserId, payloadUpdateAuth)
    if (errUpdateAuth) {
      const pesan = errUpdateAuth.message.toLowerCase()
      if (pesan.includes('already') || pesan.includes('registered') || pesan.includes('exists')) {
        // Jika ada auth user yatim (tanpa baris admin_users) yang menahan email target, bersihkan lalu ulangi
        const orphanId = await cariAuthUserIdBerdasarkanEmail(oo, kredensial.email)
        if (orphanId && orphanId !== targetUserId) {
          await oo.auth.admin.deleteUser(orphanId).catch(() => {})
          const ulang = await oo.auth.admin.updateUserById(targetUserId, payloadUpdateAuth)
          errUpdateAuth = ulang.error
        }
      }
    }

    if (errUpdateAuth) {
      throw new Error(`Gagal memperbarui akun Auth Form Order: ${errUpdateAuth.message}`)
    }
    finalUserId = targetUserId
  } else {
    // Buat Auth User baru di Form Order
    const { data: createdAuth, error: errCreateAuth } = await oo.auth.admin.createUser({
      email: kredensial.email,
      password: kredensial.password,
      email_confirm: true,
      user_metadata: {
        role: 'outlet_staff',
        full_name: kredensial.fullName,
        outlet_id: outletOrderOnlineId,
      },
    })

    if (errCreateAuth) {
      // Tangani jika ada akun yatim di auth.users yang belum punya baris di admin_users
      const pesan = errCreateAuth.message.toLowerCase()
      if (pesan.includes('already') || pesan.includes('registered') || pesan.includes('exists')) {
        const orphanId = await cariAuthUserIdBerdasarkanEmail(oo, kredensial.email)
        if (!orphanId) {
          throw new Error(`Email ${kredensial.email} sudah terdaftar di Auth Form Order`)
        }
        const { error: errAdopt } = await oo.auth.admin.updateUserById(orphanId, {
          password: kredensial.password,
          email_confirm: true,
          user_metadata: {
            role: 'outlet_staff',
            full_name: kredensial.fullName,
            outlet_id: outletOrderOnlineId,
          },
        })
        if (errAdopt) {
          throw new Error(`Gagal menyelaraskan akun Auth Form Order: ${errAdopt.message}`)
        }
        finalUserId = orphanId
      } else {
        throw new Error(`Gagal membuat akun Auth Form Order: ${errCreateAuth.message}`)
      }
    } else if (!createdAuth?.user) {
      throw new Error('Gagal membuat akun Auth Form Order: respons kosong')
    } else {
      finalUserId = createdAuth.user.id
    }
  }

  // 4. Upsert baris profil admin_users di Form Order
  const { error: errUpsertProfile } = await oo.from('admin_users').upsert({
    id: finalUserId,
    email: kredensial.email,
    full_name: kredensial.fullName,
    role: 'outlet_staff',
    outlet_id: outletOrderOnlineId,
    is_active: akunHarusAktif,
  })
  if (errUpsertProfile) {
    // Jika baru saja membuat auth user baru dan gagal di admin_users, bersihkan auth user yatim
    if (!targetUserId) {
      await oo.auth.admin.deleteUser(finalUserId).catch(() => {})
    }
    throw new Error(`Gagal menyimpan profil pengguna Form Order: ${errUpsertProfile.message}`)
  }

  // 5. Kirim kredensial ke bot Telegram @devsshermesbot secara otomatis
  const aksiNotifikasi =
    adalahOutletBaru || belumPunyaAkun ? 'outlet_baru' : 'perubahan_kredensial'

  const hasilTelegram = await kirimKredensialOrderOnlineTelegram({
    aksi: aksiNotifikasi,
    namaOutlet: o.name,
    slugOutlet: slugOrderOnline,
    tipeBaru: tipeSekarang,
    tipeLama: tipeBerubah ? tipeLamaEfektif : null,
    statusOutlet,
    email: kredensial.email,
    password: kredensial.password,
  })

  return {
    outletOrderOnlineId,
    kredensial,
    telegramTerkirim: hasilTelegram.terkirim,
    peringatanTelegram: hasilTelegram.terkirim ? undefined : hasilTelegram.galat,
  }
}

export async function nonaktifkanOutletDiOrderOnline(id: string): Promise<void> {
  const oo = klienOrderOnline()
  if (!oo) return

  const { data: ada, error: errCari } = await oo
    .from('outlets')
    .select('id')
    .or(`pos_outlet_id.eq.${id},id.eq.${id}`)
    .maybeSingle()
  if (errCari) throw new Error(errCari.message)
  if (!ada) return

  const now = new Date().toISOString()
  const { error: errOutlet } = await oo
    .from('outlets')
    .update({ status: 'inactive', is_active: false, updated_at: now })
    .eq('id', ada.id)
  if (errOutlet) throw new Error(errOutlet.message)

  const { error: errStaff } = await oo
    .from('admin_users')
    .update({ is_active: false })
    .eq('outlet_id', ada.id)
    .eq('role', 'outlet_staff')
  if (errStaff) throw new Error(errStaff.message)
}

export async function hapusOutletDiOrderOnline(id: string): Promise<void> {
  const oo = klienOrderOnline()
  if (!oo) return

  const { data: ada, error: errCari } = await oo
    .from('outlets')
    .select('id')
    .or(`pos_outlet_id.eq.${id},id.eq.${id}`)
    .maybeSingle()
  if (errCari) throw new Error(errCari.message)
  if (!ada) return

  // Hanya dipanggil saat pembatalan pembukaan outlet baru yang masih kosong (belum bertransaksi)
  const { data: staffRows } = await oo
    .from('admin_users')
    .select('id')
    .eq('outlet_id', ada.id)
    .eq('role', 'outlet_staff')

  for (const s of staffRows ?? []) {
    await oo.auth.admin.deleteUser(s.id).catch(() => {})
  }

  const { error } = await oo.from('outlets').delete().eq('id', ada.id)
  if (error) throw new Error(error.message)
}
