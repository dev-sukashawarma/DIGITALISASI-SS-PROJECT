export const TEST_OUTLET_ID = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'

type OutletLike = { id?: string | null; type?: string | null }

export function isTestOutlet(outlet?: OutletLike | string | null): boolean {
  if (!outlet) return false
  if (typeof outlet === 'string') return outlet === TEST_OUTLET_ID
  if (outlet.id === TEST_OUTLET_ID) return true
  return (outlet.type ?? '') === 'test'
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
