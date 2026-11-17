export const TEST_OUTLET_ID = 'eb174b2b-ff69-47eb-97af-b6c824d3ce4a'
export const TEST_OUTLET_TES99_ID = '04f58143-8da8-49af-b87f-50435f064137'
export const KANTOR_PUSAT_OUTLET_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
export const GUDANG_PUSAT_OUTLET_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b90'
export const GUDANG_SS_ONLINE_OUTLET_ID = 'd23e11b3-23f1-4f9a-b428-cc73e1aa9b91'
export const GLOBAL_SYSTEM_OUTLET_ID = '00000000-0000-0000-0000-000000000000'
export const SHOPEE_OUTLET_ID = '071a2dd4-bf9a-49df-8d87-8915e57c02bb'
export const TIKTOK_SHOP_OUTLET_ID = '99030e0b-ab71-479a-bfea-e04fc58b0fa0'

const EXCLUDED_NON_RETAIL_OUTLET_IDS = new Set<string>([
  TEST_OUTLET_ID,
  TEST_OUTLET_TES99_ID,
  KANTOR_PUSAT_OUTLET_ID,
  GUDANG_PUSAT_OUTLET_ID,
  GUDANG_SS_ONLINE_OUTLET_ID,
  GLOBAL_SYSTEM_OUTLET_ID,
  SHOPEE_OUTLET_ID,
  TIKTOK_SHOP_OUTLET_ID,
])

const EXCLUDED_NON_RETAIL_TYPES = new Set<string>([
  'office',
  'gudang',
  'marketplace',
  'online',
  'system',
  'test',
])

/**
 * Cek apakah sebuah outlet adalah outlet pengetesan/testing (Outlet Tes / Trial / Demo).
 * Outlet tes tidak boleh dihitung dalam agregat penjualan, omzet, HPP, waste, maupun pengeluaran.
 */
export function isTestOutlet(
  outlet?: { id?: string | null; name?: string | null; slug?: string | null; type?: string | null } | string | null
): boolean {
  if (!outlet) return false

  if (typeof outlet === 'string') {
    const s = outlet.trim().toLowerCase()
    return (
      s === TEST_OUTLET_ID ||
      s === TEST_OUTLET_TES99_ID ||
      s.includes('tes') ||
      s.includes('test') ||
      s.includes('trial') ||
      s.includes('demo')
    )
  }

  if (outlet.type && outlet.type.trim().toLowerCase() === 'test') {
    return true
  }

  if (
    outlet.id &&
    (outlet.id === TEST_OUTLET_ID ||
      outlet.id === TEST_OUTLET_TES99_ID ||
      outlet.id.toLowerCase().includes('tes') ||
      outlet.id.toLowerCase().includes('test'))
  ) {
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
  outlet?: { id?: string | null; name?: string | null; slug?: string | null; type?: string | null } | string | null
): boolean {
  if (!outlet) return false

  if (typeof outlet === 'string') {
    const s = outlet.trim().toLowerCase()
    if (EXCLUDED_NON_RETAIL_OUTLET_IDS.has(s) || s === 'ss-online') return true
    return (
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
      s.includes('kantor pusat') ||
      s.includes('ss online')
    )
  }

  if (outlet.id && EXCLUDED_NON_RETAIL_OUTLET_IDS.has(outlet.id.trim().toLowerCase())) {
    return true
  }

  if (outlet.type && EXCLUDED_NON_RETAIL_TYPES.has(outlet.type.trim().toLowerCase())) {
    return true
  }

  const candidates = [outlet.name, outlet.slug, outlet.id].filter(Boolean) as string[]
  for (const raw of candidates) {
    const s = raw.trim().toLowerCase()
    if (
      EXCLUDED_NON_RETAIL_OUTLET_IDS.has(s) ||
      s === 'ss-online' ||
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
      s.includes('kantor pusat') ||
      s.includes('ss online')
    ) {
      return true
    }
  }

  return false
}
