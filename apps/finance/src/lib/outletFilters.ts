export const TEST_OUTLET_ID = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'

/**
 * Cek apakah sebuah outlet adalah outlet pengetesan/testing (Outlet Tes / Trial / Demo).
 * Outlet tes tidak boleh dihitung dalam agregat penjualan, omzet, HPP, waste, maupun pengeluaran.
 */
export function isTestOutlet(
  outlet?: { id?: string | null; name?: string | null; slug?: string | null } | string | null
): boolean {
  if (!outlet) return false

  if (typeof outlet === 'string') {
    const s = outlet.trim().toLowerCase()
    return s === TEST_OUTLET_ID || s.includes('tes') || s.includes('test') || s.includes('trial') || s.includes('demo')
  }

  if (outlet.id && (outlet.id === TEST_OUTLET_ID || outlet.id.toLowerCase().includes('tes') || outlet.id.toLowerCase().includes('test'))) {
    return true
  }

  if (outlet.name) {
    const nameLower = outlet.name.toLowerCase()
    if (nameLower.includes('tes') || nameLower.includes('test') || nameLower.includes('trial') || nameLower.includes('demo')) {
      return true
    }
  }

  if (outlet.slug) {
    const slugLower = outlet.slug.toLowerCase()
    if (slugLower.includes('tes') || slugLower.includes('test') || slugLower.includes('trial') || slugLower.includes('demo')) {
      return true
    }
  }

  return false
}

/**
 * Cek apakah sebuah outlet adalah non-cabang fisik / dummy / virtual channel
 * (Global Outlet, Gudang SS, Outlet Tes, Shopee, SS Backup, TikTok Shop, Kantor Pusat).
 */
export function isExcludedOutlet(
  outlet?: { id?: string | null; name?: string | null; slug?: string | null } | string | null
): boolean {
  if (!outlet) return false

  const name = typeof outlet === 'string' ? outlet : (outlet.name || outlet.slug || outlet.id || '')
  const s = name.trim().toLowerCase()

  return (
    s === TEST_OUTLET_ID ||
    s.includes('tes') ||
    s.includes('test') ||
    s.includes('trial') ||
    s.includes('demo') ||
    s.includes('global') ||
    s.includes('gudang') ||
    s.includes('shopee') ||
    s.includes('shoppee') ||
    s.includes('backup') ||
    s.includes('tiktok') ||
    s.includes('titko') ||
    s.includes('kantor pusat')
  )
}
