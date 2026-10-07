"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import type { PeriodFilterValue } from "@/lib/types";
import { cleanItemName } from "@/lib/order-item-name";
import { isTestOutlet, TEST_OUTLET_ID } from "@/lib/outletFilters";
import { fetchAllPagesParallel } from "@/lib/queryPaging";
import { periodCacheOptions, withPeriodCache } from "@/lib/periodCache";
import { isMitraOutlet } from "@/lib/outletOwnership";
import { ambilRiwayatHpp, ambilVersiRiwayatHpp, buatPenerapRiwayat, tanggalWib } from "@/lib/hpp/riwayatHpp";
import { adalahKanalSsOnline } from "@/lib/hpp/kanalSsOnline";
import { resolveOrderSource } from "@/lib/order-source";

export interface HppChannelBreakdown {
  outlet: number;
  food_apps: number;
  tiktok_go: number;
  website: number;
}

export interface HppRow {
  outlet_id: string;
  hpp: number;
  baseHpp?: number;
  markup?: number;
  channels?: HppChannelBreakdown;
}

export function getOrderHppChannelGroup(
  channel?: string | null,
  salesSource?: string | null,
  customerName?: string | null,
  isEndorse?: boolean | null,
): keyof HppChannelBreakdown {
  const normCh = (channel || "").toLowerCase().trim();
  const normSrc = (salesSource || "").toLowerCase().trim();

  // 1. Channel eksplisit Food Apps (GoFood, GrabFood, ShopeeFood)
  if (
    [
      "gofood",
      "grabfood",
      "shopeefood",
      "food_apps",
      "foodapps",
      "grab_food",
      "go_food",
      "shopee_food",
    ].includes(normCh)
  ) {
    return "food_apps";
  }

  // 2. Channel eksplisit TikTok Go
  if (["tiktokgo", "tiktok", "tiktok_go"].includes(normCh)) {
    return "tiktok_go";
  }

  // 3. Channel eksplisit Website & Marketplace
  if (
    [
      "online",
      "website",
      "web",
      "website ss",
      "ss-online",
      "ss_online",
      "tiktok_shop",
      "shopee_shop",
    ].includes(normCh)
  ) {
    return "website";
  }

  // 4. Resolusi berbasis sumber pesanan (resolveOrderSource)
  const src = resolveOrderSource(channel, salesSource, customerName, isEndorse).key.toLowerCase();
  if (
    [
      "gofood",
      "grabfood",
      "shopeefood",
      "generic_food_app",
      "food_apps",
      "foodapp",
      "foodapps",
    ].includes(src)
  ) {
    return "food_apps";
  }
  if (["tiktokgo", "tiktok", "tiktok_go"].includes(src)) {
    return "tiktok_go";
  }
  if (
    [
      "online",
      "website",
      "ss-online",
      "ss_online",
      "tiktok_shop",
      "shopee_shop",
    ].includes(src) ||
    normSrc === "online"
  ) {
    return "website";
  }
  return "outlet";
}

function getItemHpp(
  menuItem: any,
  outletType?: string,
  fallbackName?: string,
  menuItemByNameMap?: Map<string, any>,
  channel?: string | null,
): { hpp: number; baseHpp: number; markup: number } {
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
  if (!itemObj) return { hpp: 0, baseHpp: 0, markup: 0 };

  let baseHpp = 0;
  const normCh = channel ? channel.toLowerCase() : null;
  let channelHppVal: number | null = null;
  
  if (itemObj.channel_hpp && typeof itemObj.channel_hpp === 'object' && normCh) {
    if (adalahKanalSsOnline(normCh)) { // hanya marketplace; ShopeeFood & TikTok GO pakai hpp_override
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
      const compHpp = pkg.component
        ? getItemHpp(pkg.component, undefined, undefined, undefined, channel).baseHpp
        : (pkg.component?.hpp_override || 0);
      const qty = pkg.quantity || 1;
      return sum + compHpp * qty;
    }, 0);
  }
  if (outletType === "mitra" && baseHpp > 0) {
    // Outlet mitra ditagih base + 10%. Marginnya adalah SELISIHNYA (= 10% base),
    // bukan 10% dari angka yang sudah dikali 1,1 — itu 11% base, dan Rp-nya
    // tak pernah ditagihkan ke siapa pun.
    const hpp = Math.round(baseHpp * 1.1);
    return { hpp, baseHpp, markup: hpp - baseHpp };
  }
  return { hpp: baseHpp, baseHpp, markup: 0 };
}

const PAGE_SIZE = 1000;

// Kolom HPP yang dipakai getItemHpp. Ditarik SEKALI dari `menu_items` (50 baris)
// lalu dipetakan per id, bukan ikut di-join ke tiap order_item.
const MENU_HPP_SELECT =
  "id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))";

export async function fetchHppRows(supabase: any, filter: PeriodFilterValue): Promise<HppRow[]> {
  const start = new Date(filter.from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(filter.to);
  end.setHours(23, 59, 59, 999);

      const ordersGte = start.toISOString();
      const ordersLte = end.toISOString();

      // Tabel master untuk resep dan outlet
      const [outletsRes, menuItemsRes, mitraInvRes, riwayatRows] = await Promise.all([
        supabase.from("outlets").select("id, type, name, slug").neq("id", TEST_OUTLET_ID),
        supabase.from("menu_items").select(MENU_HPP_SELECT),
        supabase.from("mitra_investments").select("outlet_id"),
        ambilRiwayatHpp(supabase),
      ]);

      const mitraIdsSet = new Set<string>();
      mitraInvRes.data?.forEach((m: any) => {
        if (m.outlet_id) mitraIdsSet.add(m.outlet_id);
      });

      const outletTypeMap = new Map<string, string>();
      outletsRes.data?.forEach((o: any) => {
        if (!isTestOutlet(o)) {
          // Aturan "siapa outlet mitra" dipakai bersama halaman Laba Rugi lewat
          // satu fungsi — kalau ditulis ulang di sini, markup HPP dan pengakuan
          // pendapatan margin bisa diam-diam berbeda daftar outletnya.
          outletTypeMap.set(o.id, isMitraOutlet(o, mitraIdsSet) ? "mitra" : (o.type || "outlet"));
        }
      });

      const menuItemsData = menuItemsRes.data ?? [];
      // HPP per tanggal order: objek menu & peta nama/id ditimpa nilai yang
      // berlaku pada tanggal itu (lihat lib/hpp/riwayatHpp.ts).
      const penerapHpp = buatPenerapRiwayat(menuItemsData, riwayatRows, cleanItemName);

      // `order_items` di-select TANPA join bersarang ke menu_items. Join itu
      // mengirim ulang tabel `menu_items` yang cuma 50 baris untuk tiap satu
      // dari ~90.000 order_item: 16,7 MB dan 26 detik untuk satu bulan, hanya
      // untuk menghasilkan 19 baris agregat. `menu_item_id` cukup — objek yang
      // dulu ikut di-join persis baris yang sama dengan yang sudah ada di
      // penerapHpp.byId di atas.
      //
      // `status` disaring di server (dulu tiap baris ditarik lalu dibuang di
      // klien), dan `.order('id')` membuat urutan halaman deterministik —
      // syarat mutlak sebelum halaman boleh diambil paralel.
      const buildOrdersPage = (from: number, to: number, withCount: boolean) => {
        let b = supabase
          .from("orders")
          .select(
            "outlet_id, channel, sales_source, customer_name, is_endorse, created_at, order_items(menu_item_id, menu_item_name, quantity)",
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
            "channel_id, order_date, ecommerce_sale_items(menu_id, quantity)",
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

      const hppMap = new Map<
        string,
        {
          hpp: number;
          baseHpp: number;
          markup: number;
          channels: HppChannelBreakdown;
        }
      >();

      allOrders.forEach((o: any) => {
        if (isTestOutlet(o.outlet_id)) return;
        const outletType = outletTypeMap.get(o.outlet_id);
        const orderChannel = o.channel || o.sales_source;
        const channelGroup = getOrderHppChannelGroup(
          o.channel,
          o.sales_source,
          o.customer_name,
          o.is_endorse,
        );

        const pHpp = penerapHpp.untuk(tanggalWib(o.created_at));
        o.order_items?.forEach((item: any) => {
          const { hpp, baseHpp, markup } = getItemHpp(
            item.menu_item_id ? pHpp.byId.get(item.menu_item_id) : null,
            outletType,
            item.menu_item_name,
            pHpp.byName,
            orderChannel,
          );
          const qty = item.quantity || 1;
          const current = hppMap.get(o.outlet_id) || {
            hpp: 0,
            baseHpp: 0,
            markup: 0,
            channels: { outlet: 0, food_apps: 0, tiktok_go: 0, website: 0 },
          };
          const itemHpp = hpp * qty;
          current.hpp += itemHpp;
          current.baseHpp += baseHpp * qty;
          current.markup += markup * qty;
          current.channels[channelGroup] += itemHpp;
          hppMap.set(o.outlet_id, current);
        });
      });

      ecommerceSalesList.forEach((saleRecord: any) => {
        const outletId = "ss-online";
        const outletType = "outlet";
        const ecommerceChannel = saleRecord.channel_id || "ss_online";

        const pHpp = penerapHpp.untuk(tanggalWib(saleRecord.order_date));
        saleRecord.ecommerce_sale_items?.forEach((item: any) => {
          const menuItem = item.menu_id
            ? pHpp.byId.get(item.menu_id)
            : null;
          const fallbackName = menuItem?.name || "Unknown";
          const { hpp, baseHpp, markup } = getItemHpp(
            menuItem,
            outletType,
            fallbackName,
            pHpp.byName,
            ecommerceChannel,
          );
          const qty = item.quantity || 1;
          const current = hppMap.get(outletId) || {
            hpp: 0,
            baseHpp: 0,
            markup: 0,
            channels: { outlet: 0, food_apps: 0, tiktok_go: 0, website: 0 },
          };
          const itemHpp = hpp * qty;
          current.hpp += itemHpp;
          current.baseHpp += baseHpp * qty;
          current.markup += markup * qty;
          current.channels.website += itemHpp;
          hppMap.set(outletId, current);
        });
      });

      return Array.from(hppMap.entries()).map(([outlet_id, data]) => ({
        outlet_id,
        hpp: data.hpp,
        baseHpp: data.baseHpp,
        markup: data.markup,
        channels: data.channels,
      }));
}

export function useHpp(filter: PeriodFilterValue) {
  const supabase = createClient();

  const versiQuery = useQuery({
    queryKey: ["hpp-riwayat-versi"],
    staleTime: 60_000,
    enabled: Boolean(filter.from && filter.to),
    queryFn: () => ambilVersiRiwayatHpp(supabase),
  });
  const versiHpp = versiQuery.data;

  const queryKey = [
    "hpp-client-calculated-v2",
    filter.from,
    filter.to,
    filter.outletId,
    versiHpp ?? "",
  ] as const;

  const query = useQuery<HppRow[]>({
    queryKey: [...queryKey],
    ...periodCacheOptions(filter),
    enabled: Boolean(filter.from && filter.to && versiHpp),
    queryFn: withPeriodCache(queryKey, filter, () => fetchHppRows(supabase, filter)),
  });
  // Kegagalan riwayat HPP tak boleh diam-diam tampil sebagai "kosong": selama
  // versiHpp belum ada (masih memuat ATAU gagal), query utama sengaja tetap
  // disabled — jadi loading/error di sini harus ikut mencerminkan versiQuery,
  // bukan cuma query utama.
  const versiBelumSiap = !versiHpp && !versiQuery.error;
  const aktif = Boolean(filter.from && filter.to);
  const loading = aktif && (versiQuery.isLoading || query.isLoading || versiBelumSiap);
  const error = versiQuery.error
    ? (versiQuery.error as Error).message
    : query.error
      ? (query.error as Error).message
      : null;

  return {
    rows: query.data ?? [],
    loading,
    error,
  };
}
