// Menu hadiah promo Buy X Get Y (outlet_promos.reward_menu_item_id).
//
// Sumber kebenaran ada di DB (`public.bxgy_reward_menu_id`, migration
// 20261003130000) dan di POS native (`BuyOneGetOneRules.resolveRewardMenuItem`).
// Helper ini hanya menentukan id yang DISIMPAN per outlet, jadi aturannya harus
// sejalan dengan keduanya:
//   - admin memilih menu -> pakai menu itu; kalau menu itu khusus outlet lain,
//     pakai menu bernama sama milik outlet tujuan (atau global).
//   - tidak memilih (promo lama) -> hadiah lama "Original Ayam Reguler".

export const LEGACY_REWARD_MENU_NAME = 'Original Ayam Reguler'

export type RewardMenuCandidate = {
  id: string
  name: string
  outlet_id?: string | null
  is_package?: boolean | null
}

const normalizeName = (value: unknown) => String(value || '').trim().toLocaleLowerCase('id-ID')

/** Menu yang boleh jadi hadiah: bukan paket (paket butuh pilihan isi di kasir). */
export function isRewardEligible(menu: RewardMenuCandidate): boolean {
  return !menu.is_package
}

/** Id menu hadiah lama, dipakai sebagai nilai awal pemilih di form. */
export function legacyRewardMenuId(menus: RewardMenuCandidate[]): string | null {
  const legacy = menus
    .filter(m => normalizeName(m.name) === normalizeName(LEGACY_REWARD_MENU_NAME) && m.outlet_id == null)
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  return legacy?.id ?? null
}

/**
 * Menu hadiah untuk satu outlet tujuan. `menus` = katalog menu yang TERSEDIA.
 * Mengembalikan null bila outlet itu tidak punya menu hadiah yang sah.
 */
export function resolveRewardMenuForOutlet(
  menus: RewardMenuCandidate[],
  outletId: string,
  chosenRewardId?: string | null,
): RewardMenuCandidate | null {
  const usableHere = (m: RewardMenuCandidate) =>
    isRewardEligible(m) && (m.outlet_id == null || m.outlet_id === outletId)
  // Menu milik outlet itu sendiri didahulukan dari menu global, lalu id agar stabil.
  const pick = (candidates: RewardMenuCandidate[]) =>
    candidates.sort((a, b) => {
      const aOwn = a.outlet_id === outletId ? 0 : 1
      const bOwn = b.outlet_id === outletId ? 0 : 1
      return aOwn - bOwn || a.id.localeCompare(b.id)
    })[0] || null

  if (chosenRewardId) {
    const chosen = menus.find(m => m.id === chosenRewardId)
    if (!chosen || !isRewardEligible(chosen)) return null
    if (usableHere(chosen)) return chosen
    const sameName = normalizeName(chosen.name)
    return pick(menus.filter(m => usableHere(m) && normalizeName(m.name) === sameName))
  }

  return pick(menus.filter(m => usableHere(m) && normalizeName(m.name) === normalizeName(LEGACY_REWARD_MENU_NAME)))
}
