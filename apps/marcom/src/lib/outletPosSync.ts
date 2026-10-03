/**
 * Penyelarasan direktori outlet MARCOM dengan tabel `outlets` POS (Supabase).
 *
 * POS (diedit lewat admin-dashboard) adalah sumber kebenaran untuk nama, tipe,
 * region, alamat, dan telepon outlet. MARCOM menyimpan salinannya sendiri
 * (Prisma) karena endorsement/ads/budget berelasi ke id MARCOM.
 *
 * Modul ini murni (tanpa I/O) supaya aturannya bisa diuji: ia hanya menghitung
 * baris mana yang perlu diubah/dibuat.
 */

export type PosOutletInput = {
  id: string
  name: string
  type: string
  region?: string | null
  address?: string | null
  phone?: string | null
  isActive: boolean
}

export type MarcomOutletInput = {
  id: bigint
  name: string
  type: string
  posOutletId: string | null
  posName: string | null
  posType: string | null
  region: string | null
  address: string | null
  phone: string | null
  isActive: boolean
}

export type OutletSyncData = {
  name: string
  type: 'INTERNAL' | 'MITRA'
  posOutletId: string
  posName: string
  posType: string
  region: string | null
  address: string | null
  phone: string | null
  isActive: boolean
}

export type OutletSyncPlan = {
  updates: { id: bigint; data: OutletSyncData }[]
  creates: OutletSyncData[]
  skipped: number
}

/** "SUKA SHAWARMA DEPOK SUKMAJAYA" → "Depok Sukmajaya", "MITRA SAWANGAN DTC" → "Sawangan DTC". */
export function namaTampilOutlet(posName: string): string {
  const tanpaAwalan = posName
    .trim()
    .replace(/^SUKA\s+SHAWARMA\s+/i, '')
    .replace(/^MITRA\s+/i, '')
    .trim()

  return tanpaAwalan
    .split(/\s+/)
    .map((kata) => {
      const huruf = kata.replace(/[^A-Za-z]/g, '')
      // Kata ber-huruf campuran (mis. "TikTok") sudah sengaja ditulis begitu.
      const seragam = huruf === huruf.toUpperCase() || huruf === huruf.toLowerCase()
      if (!huruf || !seragam) return kata
      // Singkatan pendek: BNR, DTC, HQ, SS.
      if (huruf.length <= 3 && huruf === huruf.toUpperCase()) return kata
      const kecil = kata.toLowerCase()
      return kecil.replace(/[a-z]/, (c) => c.toUpperCase())
    })
    .join(' ')
}

/** Tipe POS → tipe MARCOM. Tipe POS tak selalu rapi (mis. "MITRA SS"). */
export function tipeMarcomDariPos(posType: string | null | undefined): 'INTERNAL' | 'MITRA' {
  return (posType || '').toLowerCase().includes('mitra') ? 'MITRA' : 'INTERNAL'
}

/** Lokasi non-outlet yang tak relevan untuk kampanye marcom. */
export function isHiddenOutlet(name: string, posType?: string | null): boolean {
  const tipe = (posType || '').toLowerCase()
  if (tipe === 'system' || tipe === 'test') return true
  const lower = name.toLowerCase()
  return (
    lower.includes('(system)') ||
    lower.includes('gudang pusat') ||
    lower.includes('gudang ss online') ||
    lower.includes('kantor pusat') ||
    lower.includes('ss backup') ||
    lower.includes('central kitchen') ||
    lower.includes('shopee') ||
    lower.includes('shoppee') ||
    lower.includes('tiktok shop')
  )
}

function sama(a: OutletSyncData, b: MarcomOutletInput): boolean {
  return (
    a.name === b.name &&
    a.type === b.type &&
    a.posOutletId === b.posOutletId &&
    a.posName === b.posName &&
    a.posType === b.posType &&
    a.region === b.region &&
    a.address === b.address &&
    a.phone === b.phone &&
    a.isActive === b.isActive
  )
}

/**
 * @param mode
 *  - `otomatis` (tiap halaman dibuka): hanya outlet yang sudah tertaut `posOutletId`,
 *    tanpa membuat baris baru. Status aktif hanya diturunkan (POS nonaktif / lokasi
 *    tersembunyi → nonaktif), tidak pernah dinyalakan, supaya tombol nonaktif di
 *    MARCOM tidak ditimpa.
 *  - `penuh` (tombol Sinkronisasi): juga mencocokkan berdasarkan nama, membuat outlet
 *    POS yang belum ada, dan status aktif mengikuti POS.
 */
export function rencanakanSinkronOutlet(
  posOutlets: PosOutletInput[],
  marcomOutlets: MarcomOutletInput[],
  mode: 'otomatis' | 'penuh'
): OutletSyncPlan {
  const plan: OutletSyncPlan = { updates: [], creates: [], skipped: 0 }

  // Nama MARCOM unik (case-insensitive di sini supaya aman di semua kolasi).
  const namaTerpakai = new Map<string, bigint | null>()
  for (const m of marcomOutlets) namaTerpakai.set(m.name.toLowerCase(), m.id)

  const tersedia = (nama: string, pemilik: bigint | null) => {
    const kunci = nama.toLowerCase()
    return !namaTerpakai.has(kunci) || namaTerpakai.get(kunci) === pemilik
  }
  const pakaiNama = (lama: string | null, baru: string, pemilik: bigint | null) => {
    if (lama) namaTerpakai.delete(lama.toLowerCase())
    namaTerpakai.set(baru.toLowerCase(), pemilik)
  }

  const sudahDicocokkan = new Set<bigint>()

  for (const sb of posOutlets) {
    if ((sb.type || '').toLowerCase() === 'system' || sb.name.includes('(SYSTEM)')) {
      plan.skipped++
      continue
    }

    let match = marcomOutlets.find((m) => m.posOutletId === sb.id)
    if (!match && mode === 'penuh') {
      const target = namaTampilOutlet(sb.name).toLowerCase()
      match = marcomOutlets.find(
        (m) =>
          !m.posOutletId &&
          !sudahDicocokkan.has(m.id) &&
          (namaTampilOutlet(m.name).toLowerCase() === target ||
            m.name.toLowerCase() === sb.name.toLowerCase())
      )
    }

    const hidden = isHiddenOutlet(sb.name, sb.type)
    const tipe = tipeMarcomDariPos(sb.type)

    if (match) {
      sudahDicocokkan.add(match.id)
      const tampil = namaTampilOutlet(sb.name)
      let nama = match.name
      if (match.name.toLowerCase() !== tampil.toLowerCase()) {
        if (tersedia(tampil, match.id)) nama = tampil
        else if (tersedia(sb.name, match.id)) nama = sb.name
      }
      if (nama !== match.name) pakaiNama(match.name, nama, match.id)

      const posAktif = !hidden && sb.isActive
      const data: OutletSyncData = {
        name: nama,
        type: tipe,
        posOutletId: sb.id,
        posName: sb.name,
        posType: sb.type,
        region: sb.region || match.region,
        address: sb.address || match.address,
        phone: sb.phone || match.phone,
        isActive: mode === 'penuh' ? posAktif : match.isActive && posAktif,
      }
      if (!sama(data, match)) plan.updates.push({ id: match.id, data })
      continue
    }

    if (mode === 'otomatis') continue

    const bebas = (n: string) => !namaTerpakai.has(n.toLowerCase())
    const tampil = namaTampilOutlet(sb.name)
    const nama = bebas(tampil) ? tampil : sb.name
    if (!bebas(nama)) {
      plan.skipped++
      continue
    }
    pakaiNama(null, nama, null)
    plan.creates.push({
      name: nama,
      type: tipe,
      posOutletId: sb.id,
      posName: sb.name,
      posType: sb.type,
      region: sb.region || null,
      address: sb.address || null,
      phone: sb.phone || null,
      isActive: !hidden && sb.isActive,
    })
  }

  return plan
}
