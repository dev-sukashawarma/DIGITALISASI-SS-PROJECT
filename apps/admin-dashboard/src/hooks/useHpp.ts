"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import type { PeriodFilterValue } from "@/lib/types";
import { cleanItemName } from "@/lib/order-item-name";
import { isTestOutlet, TEST_OUTLET_ID } from "@/lib/outletFilters";
import { fetchAllPagesParallel } from "@/lib/queryPaging";
import { periodCacheOptions, withPeriodCache } from "@/lib/periodCache";

export interface HppRow {
  outlet_id: string;
  hpp: number;
}

function getItemHpp(
  menuItem: any,
  outletType?: string,
  fallbackName?: string,
  menuItemByNameMap?: Map<string, any>,
  channel?: string | null,
): number {
  let itemObj = menuItem;
  if (
    (!itemObj || (!itemObj.hpp_override && !itemObj.channel_hpp && !itemObj.is_package)) &&
    fallbackName &&
    menuItemByNameMap
  ) {
    const cleanKey = cleanItemName(fallbackName);
    if (menuItemByNameMap.has(cleanKey)) {
      itemObj = menuItemByNameMap.get(cleanKey);
    }
  }
  if (!itemObj) return 0;

  let baseHpp = 0;
  const normCh = channel ? channel.toLowerCase() : null;
  let channelHppVal: number | null = null;
  
  if (itemObj.channel_hpp && typeof itemObj.channel_hpp === 'object' && normCh) {
    if (
      normCh === 'ss-online' ||
      normCh === 'ss_online' ||
      normCh.includes('tiktok') ||
      normCh.includes('shopee') ||
      normCh === 'f3305089-b9e4-4b92-95da-14bf6e7fb6d5' ||
      normCh === 'd68eb5ec-d6bb-4d0a-8758-a2600c8f1584'
    ) {
      channelHppVal = itemObj.channel_hpp.ss_online ?? itemObj.channel_hpp.tiktok_shop ?? itemObj.channel_hpp.shopee_shop ?? itemObj.channel_hpp[normCh] ?? null;
    } else {
      channelHppVal = itemObj.channel_hpp[normCh] ?? null;
    }
  }

  if (channelHppVal !== null && channelHppVal !== undefined && Number(channelHppVal) > 0) {
    baseHpp = Number(channelHppVal);
  } else if (
    itemObj.hpp_override !== null &&
    itemObj.hpp_override !== undefined &&
    Number(itemObj.hpp_override) > 0
  ) {
    baseHpp = Number(itemObj.hpp_override);
  } else if (itemObj.is_package && Array.isArray(itemObj.package_items)) {
    baseHpp = itemObj.package_items.reduce((sum: number, pkg: any) => {
      const compHpp = pkg.component?.hpp_override || 0;
      const qty = pkg.quantity || 1;
      return sum + compHpp * qty;
    }, 0);
  }
  if (outletType === "mitra" && baseHpp > 0) {
    return Math.round(baseHpp * 1.1);
  }
  return baseHpp;
}

const PAGE_SIZE = 1000;

// Kolom HPP yang dipakai getItemHpp. Ditarik SEKALI dari `menu_items` (50 baris)
// lalu dipetakan per id, bukan ikut di-join ke tiap order_item.
const MENU_HPP_SELECT =
  "id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))";

export function useHpp(filter: PeriodFilterValue) {
  const supabase = createClient();
  const queryKey = [
    "hpp-client-calculated",
    filter.from,
    filter.to,
    filter.outletId,
  ] as const;

  const query = useQuery<HppRow[]>({
    queryKey: [...queryKey],
    ...periodCacheOptions(filter),
    enabled: Boolean(filter.from && filter.to),
    queryFn: withPeriodCache(queryKey, filter, async () => {
      const start = new Date(filter.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filter.to);
      end.setHours(23, 59, 59, 999);

      const ordersGte = start.toISOString();
      const ordersLte = end.toISOString();

      // Dua tabel master, kecil dan tak saling bergantung — ambil bersamaan.
      const [outletsRes, menuItemsRes] = await Promise.all([
        supabase.from("outlets").select("id, type, name, slug").neq("id", TEST_OUTLET_ID),
        supabase.from("menu_items").select(MENU_HPP_SELECT),
      ]);

      const outletTypeMap = new Map<string, string>();
      outletsRes.data?.forEach((o: any) => {
        if (!isTestOutlet(o)) outletTypeMap.set(o.id, o.type || "outlet");
      });

      const menuItemsData = menuItemsRes.data;
      const menuItemByNameMap = new Map<string, any>();
      const menuItemByIdMap = new Map<string, any>();
      menuItemsData?.forEach((mi: any) => {
        if (mi.name) menuItemByNameMap.set(cleanItemName(mi.name), mi);
        if (mi.id) menuItemByIdMap.set(mi.id, mi);
      });

      // `order_items` di-select TANPA join bersarang ke menu_items. Join itu
      // mengirim ulang tabel `menu_items` yang cuma 50 baris untuk tiap satu
      // dari ~90.000 order_item: 16,7 MB dan 26 detik untuk satu bulan, hanya
      // untuk menghasilkan 19 baris agregat. `menu_item_id` cukup — objek yang
      // dulu ikut di-join persis baris yang sama dengan yang sudah ada di
      // menuItemByIdMap di atas.
      //
      // `status` disaring di server (dulu tiap baris ditarik lalu dibuang di
      // klien), dan `.order('id')` membuat urutan halaman deterministik —
      // syarat mutlak sebelum halaman boleh diambil paralel.
      const buildOrdersPage = (from: number, to: number, withCount: boolean) => {
        let b = supabase
          .from("orders")
          .select(
            "outlet_id, channel, sales_source, order_items(menu_item_id, menu_item_name, quantity)",
            withCount ? { count: "exact" } : undefined,
          )
          .neq("outlet_id", TEST_OUTLET_ID)
          .in("status", ["completed", "settled"])
          .gte("created_at", ordersGte)
          .lte("created_at", ordersLte)
          .order("id", { ascending: true });

        if (filter.outletId !== "all") b = b.eq("outlet_id", filter.outletId);
        return b.range(from, to);
      };

      const wantsEcommerce =
        filter.outletId === "all" || filter.outletId === "ss-online";

      const buildEcommercePage = (from: number, to: number, withCount: boolean) =>
        supabase
          .from("ecommerce_sales")
          .select(
            "channel_id, ecommerce_sale_items(menu_id, quantity)",
            withCount ? { count: "exact" } : undefined,
          )
          .gte("order_date", ordersGte)
          .lte("order_date", ordersLte)
          .order("id", { ascending: true })
          .range(from, to);

      const [allOrders, ecommerceSalesList] = await Promise.all([
        fetchAllPagesParallel<any>(buildOrdersPage, PAGE_SIZE),
        wantsEcommerce
          ? fetchAllPagesParallel<any>(buildEcommercePage, PAGE_SIZE)
          : Promise.resolve([] as any[]),
      ]);

      const hppMap = new Map<string, number>();

      allOrders.forEach((o: any) => {
        if (isTestOutlet(o.outlet_id)) return;
        const outletType = outletTypeMap.get(o.outlet_id);
        const orderChannel = o.channel || o.sales_source;

        o.order_items?.forEach((item: any) => {
          const hpp = getItemHpp(
            item.menu_item_id ? menuItemByIdMap.get(item.menu_item_id) : null,
            outletType,
            item.menu_item_name,
            menuItemByNameMap,
            orderChannel,
          );
          const qty = item.quantity || 1;
          const current = hppMap.get(o.outlet_id) || 0;
          hppMap.set(o.outlet_id, current + hpp * qty);
        });
      });

      ecommerceSalesList.forEach((saleRecord: any) => {
        const outletId = "ss-online";
        const outletType = "outlet";
        const ecommerceChannel = saleRecord.channel_id || "ss_online";

        saleRecord.ecommerce_sale_items?.forEach((item: any) => {
          const menuItem = item.menu_id
            ? menuItemByIdMap.get(item.menu_id)
            : null;
          const fallbackName = menuItem?.name || "Unknown";
          const hpp = getItemHpp(
            menuItem,
            outletType,
            fallbackName,
            menuItemByNameMap,
            ecommerceChannel,
          );
          const qty = item.quantity || 1;
          const current = hppMap.get(outletId) || 0;
          hppMap.set(outletId, current + hpp * qty);
        });
      });

      return Array.from(hppMap.entries()).map(([outlet_id, hpp]) => ({
        outlet_id,
        hpp,
      }));
    }),
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
