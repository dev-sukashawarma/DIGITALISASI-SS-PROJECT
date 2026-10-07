// Satu-satunya peta role → profil Hermes. Tambah baris saat agen divisi siap (spec W3).
export type Profil = 'ceo' | 'gudang' | 'hrd' | 'finance'

const PETA: Record<string, Profil> = {
  owner: 'ceo',
  admin: 'ceo',
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
