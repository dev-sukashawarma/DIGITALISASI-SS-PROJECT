// Satu-satunya peta role → profil Hermes yang boleh diajak chat, dan kunci Hermes → profil
// (spec kantor bot §10). Mendukung profil bawaan dan profil dinamis otomatis.

export type ProfilBawaan = 'ceo' | 'gudang' | 'hrd' | 'finance'
export type Profil = ProfilBawaan | (string & {})

export const SEMUA_PROFIL_BAWAAN: readonly ProfilBawaan[] = ['ceo', 'gudang', 'hrd', 'finance']

// Daftar kata kunci terlarang / bukan profil bot
const KATA_TERLARANG = new Set(['root', 'admin', 'system', 'default', 'guest', 'user', 'undefined', 'null'])

// Peta awal role bawaan
const PROFIL_PER_PERAN_BAWAAN: Record<string, ProfilBawaan[]> = {
  developer: ['ceo', 'gudang', 'hrd', 'finance'],
  owner: ['ceo', 'gudang', 'hrd', 'finance'],
  admin: ['ceo', 'gudang', 'hrd', 'finance'],
  admin_finance: ['finance'],
}

const LABEL_PROFIL_BAWAAN: Record<string, string> = {
  ceo: 'Bot CEO',
  gudang: 'Bot Gudang',
  hrd: 'Bot HRD',
  finance: 'Bot Finance',
}

// Proxy agar LABEL_PROFIL[p] otomatis menghasilkan label jika belum ada di peta bawaan
export const LABEL_PROFIL: Record<string, string> = new Proxy(LABEL_PROFIL_BAWAAN, {
  get(target, prop: string) {
    if (typeof prop !== 'string') return undefined
    if (prop in target) return target[prop]
    return `Bot ${prop.charAt(0).toUpperCase() + prop.slice(1)}`
  },
})

/**
 * Validasi apakah suatu nilai merupakan nama profil bot yang sah.
 * Menerima profil bawaan atau slug nama profil valid (huruf kecil, angka, strip, underscore).
 */
export function adalahProfil(x: unknown): x is Profil {
  if (typeof x !== 'string' || !x) return false
  const s = x.trim()
  if (s.length < 2 || s.length > 32) return false
  if (KATA_TERLARANG.has(s.toLowerCase())) return false
  if ((SEMUA_PROFIL_BAWAAN as readonly string[]).includes(s)) return true
  // Format slug profil bot yang valid
  return /^[a-z0-9][a-z0-9_-]*$/.test(s)
}

/**
 * Mengambil daftar profil yang diizinkan untuk sebuah role pengguna.
 * Role developer, owner, dan admin otomatis memiliki akses ke semua profil bawaan
 * plus profil tambahan yang dikonfigurasi.
 */
export function profilBolehUntukPeran(
  role: string | null | undefined,
  profilTambahan: Profil[] = []
): Profil[] {
  if (!role) return []
  const base = PROFIL_PER_PERAN_BAWAAN[role] ?? []
  if (['developer', 'owner', 'admin'].includes(role) && profilTambahan.length > 0) {
    const set = new Set([...base, ...profilTambahan])
    return Array.from(set)
  }
  return base
}

// Scope kunci MCP (hermes_api_key.scope) → profil Hermes yang memakainya.
const PROFIL_PER_SCOPE: Record<string, Profil> = {
  absensi: 'hrd',
  hr_rinci: 'hrd',
  gudang: 'gudang',
  stok: 'gudang',
  stokis: 'gudang',
  finance: 'finance',
}

/**
 * Memetakan scope kunci MCP ke nama profil bot.
 * Jika scope tunggal baru diberikan (misal: 'marcom' atau 'purchasing'),
 * otomatis dipetakan ke profil dengan nama yang sama.
 */
export function profilUntukKunci(scope: string[]): Profil | null {
  if (!Array.isArray(scope) || scope.length === 0) return null
  if (scope.includes('penjualan')) return 'ceo'
  const mapped: Profil[] = []
  for (const s of scope) {
    if (PROFIL_PER_SCOPE[s]) {
      mapped.push(PROFIL_PER_SCOPE[s])
    } else if (adalahProfil(s)) {
      mapped.push(s)
    } else {
      return null
    }
  }
  const unik = Array.from(new Set(mapped))
  return unik.length === 1 ? unik[0] : null
}
