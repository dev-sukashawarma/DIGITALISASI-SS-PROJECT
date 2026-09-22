import { defaultCacheManager, CacheManager } from '../cache-manager';
import { CACHE_KEYS, CACHE_TTL } from '../types';

export interface MenuCacheServices {
  getCachedMenuItems: (supabase: any, outletId?: string) => Promise<any[]>;
  getCachedCategories: (supabase: any) => Promise<any[]>;
  getCachedOutlets: (supabase: any) => Promise<any[]>;
  getCachedOutletById: (supabase: any, outletId: string) => Promise<any | null>;
  invalidateMenuCache: (outletId?: string) => Promise<void>;
  invalidateOutletsCache: (outletId?: string) => Promise<void>;
}

/**
 * Creates domain-specific cached accessors using the provided or default cache manager.
 */
export function createMenuCacheServices(manager: CacheManager = defaultCacheManager): MenuCacheServices {
  return {
    /**
     * Get menu items with joined categories from cache or Supabase.
     */
    async getCachedMenuItems(supabase: any, outletId?: string): Promise<any[]> {
      const cacheKey = outletId ? CACHE_KEYS.MENU_OUTLET(outletId) : CACHE_KEYS.MENU_ALL;

      return manager.getCached(
        cacheKey,
        async () => {
          let query = supabase
            .from('menu_items')
            .select('*, categories(id,name,sort_order)')
            .order('sort_order');

          if (outletId) {
            query = query.or(`outlet_id.is.null,outlet_id.eq.${outletId}`);
          }

          const { data, error } = await query;
          if (error) {
            console.error('[MenuCache] Error fetching menu_items from Supabase:', error);
            throw error;
          }
          return data || [];
        },
        { ttlSeconds: CACHE_TTL.MENU }
      );
    },

    /**
     * Get all categories from cache or Supabase.
     */
    async getCachedCategories(supabase: any): Promise<any[]> {
      return manager.getCached(
        CACHE_KEYS.CATEGORIES_ALL,
        async () => {
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order');

          if (error) {
            console.error('[MenuCache] Error fetching categories from Supabase:', error);
            throw error;
          }
          return data || [];
        },
        { ttlSeconds: CACHE_TTL.CATEGORIES }
      );
    },

    /**
     * Get all outlets from cache or Supabase.
     */
    async getCachedOutlets(supabase: any): Promise<any[]> {
      return manager.getCached(
        CACHE_KEYS.OUTLETS_ALL,
        async () => {
          const { data, error } = await supabase
            .from('outlets')
            .select('*')
            .order('name');

          if (error) {
            console.error('[MenuCache] Error fetching outlets from Supabase:', error);
            throw error;
          }
          return data || [];
        },
        { ttlSeconds: CACHE_TTL.OUTLETS }
      );
    },

    /**
     * Get single outlet info from cache or Supabase.
     */
    async getCachedOutletById(supabase: any, outletId: string): Promise<any | null> {
      return manager.getCached(
        CACHE_KEYS.OUTLET_DETAIL(outletId),
        async () => {
          const { data, error } = await supabase
            .from('outlets')
            .select('*')
            .eq('id', outletId)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error(`[MenuCache] Error fetching outlet ${outletId}:`, error);
          }
          return data || null;
        },
        { ttlSeconds: CACHE_TTL.OUTLETS }
      );
    },

    /**
     * Invalidate all menu caches (e.g. when menu item or availability changed).
     */
    async invalidateMenuCache(outletId?: string): Promise<void> {
      if (outletId) {
        await manager.invalidate(CACHE_KEYS.MENU_OUTLET(outletId));
      }
      // Invalidate general pattern
      await manager.invalidate('suka:menu:*');
      console.info(`[MenuCache] Menu cache purged successfully (outlet: ${outletId || 'all'})`);
    },

    /**
     * Invalidate outlet caches.
     */
    async invalidateOutletsCache(outletId?: string): Promise<void> {
      if (outletId) {
        await manager.invalidate(CACHE_KEYS.OUTLET_DETAIL(outletId));
      }
      await manager.invalidate('suka:outlet*');
      console.info(`[MenuCache] Outlets cache purged successfully`);
    },
  };
}

export const menuCacheServices = createMenuCacheServices(defaultCacheManager);

export const {
  getCachedMenuItems,
  getCachedCategories,
  getCachedOutlets,
  getCachedOutletById,
  invalidateMenuCache,
  invalidateOutletsCache,
} = menuCacheServices;
