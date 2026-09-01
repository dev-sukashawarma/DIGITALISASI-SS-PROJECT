"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { cleanItemName } from "@/lib/order-item-name";

export interface HppByChannelRow {
  outlet_id: string;
  sales_source: string;
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

export function useHppByChannel(from: string, to: string) {
  const supabase = createClient();
  const query = useQuery<HppByChannelRow[]>({
    queryKey: ["hpp-by-channel-calculated", from, to],
    staleTime: 2 * 60_000,
    enabled: Boolean(from && to),
    queryFn: async () => {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);

      const ordersGte = start.toISOString();
      const ordersLte = end.toISOString();

      const { data: outlets } = await supabase
        .from("outlets")
        .select("id, type");
      const outletTypeMap = new Map<string, string>();
      outlets?.forEach((o: any) => outletTypeMap.set(o.id, o.type || "outlet"));

      const { data: menuItemsData } = await supabase
        .from("menu_items")
        .select(
          "id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))",
        );

      const menuItemByNameMap = new Map<string, any>();
      menuItemsData?.forEach((mi: any) => {
        if (mi.name) {
          menuItemByNameMap.set(cleanItemName(mi.name), mi);
        }
      });

      let queryOrders = supabase
        .from("orders")
        .select(
          "outlet_id, channel, sales_source, payment_method, status, order_items(menu_item_name, quantity, menu_items(hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))))",
        )
        .gte("created_at", ordersGte)
        .lte("created_at", ordersLte);

      const PAGE_SIZE = 1000;
      const allOrders: any[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await queryOrders.range(
          offset,
          offset + PAGE_SIZE - 1,
        );
        if (error) throw error;
        const page = data ?? [];
        allOrders.push(...page);
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      let queryEcommerce = supabase
        .from("ecommerce_sales")
        .select(
          "channel_id, ecommerce_sale_items(menu_items:menu_id(name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))), quantity)",
        )
        .gte("order_date", ordersGte)
        .lte("order_date", ordersLte);

      const ecommerceSalesList: any[] = [];
      offset = 0;
      while (true) {
        const { data, error } = await queryEcommerce.range(
          offset,
          offset + PAGE_SIZE - 1,
        );
        if (error) throw error;
        const page = data ?? [];
        ecommerceSalesList.push(...page);
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      const hppMap = new Map<string, number>();
      const keyFn = (oId: string, src: string) => oId + "|" + src;

      allOrders.forEach((o: any) => {
        if (o.status !== "completed" && o.status !== "settled") return;
        const outletType = outletTypeMap.get(o.outlet_id);
        const source = o.payment_method || "unknown";
        const orderChannel = o.channel || o.sales_source;

        o.order_items?.forEach((item: any) => {
          const hpp = getItemHpp(
            item.menu_items,
            outletType,
            item.menu_item_name,
            menuItemByNameMap,
            orderChannel,
          );
          const qty = item.quantity || 1;
          const key = keyFn(o.outlet_id, source);
          const current = hppMap.get(key) || 0;
          hppMap.set(key, current + hpp * qty);
        });
      });

      ecommerceSalesList.forEach((saleRecord: any) => {
        const outletId = "ss-online";
        const outletType = "outlet";
        const source = saleRecord.channel_id || "ecommerce";

        saleRecord.ecommerce_sale_items?.forEach((item: any) => {
          const fallbackName = item.menu_items?.name || "Unknown";
          const hpp = getItemHpp(
            item.menu_items,
            outletType,
            fallbackName,
            menuItemByNameMap,
            source,
          );
          const qty = item.quantity || 1;
          const key = keyFn(outletId, source);
          const current = hppMap.get(key) || 0;
          hppMap.set(key, current + hpp * qty);
        });
      });

      const rows: HppByChannelRow[] = [];
      for (const [key, hpp] of hppMap.entries()) {
        const [outlet_id, sales_source] = key.split("|");
        rows.push({ outlet_id, sales_source, hpp });
      }

      return rows;
    },
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
