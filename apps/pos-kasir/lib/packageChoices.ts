/**
 * Isi paket berbentuk "A atau B" (`menu_packages.or_menu_item_id`, mis. Combo #1:
 * Ice Tea atau Orange Juice). Tiap kelompok wajib dipilih kasir — tanpa pilihan
 * bawaan — karena pilihan itulah yang dipakai BOM (`order_items.package_choices`)
 * untuk memotong stok.
 */
type ChoiceGroup = { id: string; menu_item_id: string; or_menu_item_id?: string | null }

export function packageChoiceGroups<G extends ChoiceGroup>(menu: {
  is_package?: boolean | null
  package_items?: G[] | null
}): G[] {
  if (!menu.is_package) return []
  return (menu.package_items ?? []).filter(pi => !!pi.or_menu_item_id)
}

/** Kelompok yang belum dipilih; `choices` = { [menu_packages.id]: menu_item_id terpilih }. */
export function missingPackageChoices<G extends ChoiceGroup>(
  menu: { is_package?: boolean | null; package_items?: G[] | null },
  choices: Record<string, string>,
): G[] {
  return packageChoiceGroups(menu).filter(pi => {
    const chosen = choices[pi.id]
    return chosen !== pi.menu_item_id && chosen !== pi.or_menu_item_id
  })
}
