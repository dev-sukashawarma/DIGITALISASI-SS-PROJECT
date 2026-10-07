// Satu-satunya peta role → profil Hermes. Tambah baris saat agen divisi siap (spec W3).
export type Profil = 'ceo' | 'gudang' | 'hrd' | 'finance'

// Sementara HANYA developer (masa uji). Buka lagi untuk owner/admin dengan menambah baris di sini
// DAN di gerbang tile portal (apps/portal/src/app/launcher/page.tsx, bisaBotCeo).
const PETA: Record<string, Profil> = {
  developer: 'ceo',
}

export const LABEL_PROFIL: Record<Profil, string> = {
  ceo: 'Bot CEO',
  gudang: 'Bot Gudang',
  hrd: 'Bot HRD',
  finance: 'Bot Finance',
}

export function profilUntukPeran(role: string | null | undefined): Profil | null {
  if (!role) return null
  return PETA[role] ?? null
}
