type MasterCache<T> = { data: T; expiresAt: number };

let menuItemsCache: MasterCache<any[]> | null = null;
let riwayatHppCache: MasterCache<any[]> | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export async function getMenuItemsData(supabaseAdmin: any): Promise<any[]> {
  const now = Date.now();
  if (menuItemsCache && menuItemsCache.expiresAt > now) {
    return menuItemsCache.data;
  }
  const { data, error } = await supabaseAdmin
    .from('menu_items')
    .select(
      'id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))'
    );
  const items = data || [];
  if (!error && items.length > 0) {
    menuItemsCache = { data: items, expiresAt: now + CACHE_TTL_MS };
  }
  return items;
}

export async function getRiwayatHppData(supabaseAdmin: any): Promise<any[]> {
  const now = Date.now();
  if (riwayatHppCache && riwayatHppCache.expiresAt > now) {
    return riwayatHppCache.data;
  }
  const { data, error } = await supabaseAdmin
    .from('menu_hpp_riwayat')
    .select('menu_id, berlaku_mulai, hpp_override, channel_hpp')
    .order('berlaku_mulai', { ascending: true });
  const items = data || [];
  if (!error && items.length > 0) {
    riwayatHppCache = { data: items, expiresAt: now + CACHE_TTL_MS };
  }
  return items;
}
