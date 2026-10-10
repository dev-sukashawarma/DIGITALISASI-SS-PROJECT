// Satu-satunya peta role → profil Hermes yang boleh diajak chat, dan kunci Hermes → profil
// (spec kantor bot §10). Tambah baris saat agen divisi siap.
export type Profil = 'ceo' | 'gudang' | 'hrd' | 'finance'

const SEMUA_PROFIL: readonly Profil[] = ['ceo', 'gudang', 'hrd', 'finance']

// Sementara HANYA developer (masa uji) & admin divisi terkait. Buka untuk owner/admin dengan menambah baris di sini
// DAN di gerbang tile portal (apps/portal/src/app/launcher/page.tsx, bisaBotCeo).
const PROFIL_PER_PERAN: Record<string, Profil[]> = {
  developer: ['ceo', 'hrd', 'finance'],
  admin_finance: ['finance'],
}

export const LABEL_PROFIL: Record<Profil, string> = {
  ceo: 'Bot CEO',
  gudang: 'Bot Gudang',
  hrd: 'Bot HRD',
  finance: 'Bot Finance',
}

export function adalahProfil(x: unknown): x is Profil {
  return typeof x === 'string' && (SEMUA_PROFIL as readonly string[]).includes(x)
}

export function profilBolehUntukPeran(role: string | null | undefined): Profil[] {
  if (!role) return []
  return PROFIL_PER_PERAN[role] ?? []
}

// Scope kunci MCP (hermes_api_key.scope) → profil Hermes yang memakainya.
const PROFIL_PER_SCOPE: Record<string, Profil> = { absensi: 'hrd', gudang: 'gudang', finance: 'finance' }

export function profilUntukKunci(scope: string[]): Profil | null {
  if (scope.includes('penjualan')) return 'ceo'
  if (scope.length === 1) return PROFIL_PER_SCOPE[scope[0]] ?? null
  return null
}
