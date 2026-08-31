"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import type { PeriodFilterValue } from "@/lib/types";
import { cleanItemName } from "@/lib/order-item-name";
import { isTestOutlet, TEST_OUTLET_ID } from "@/lib/outletFilters";

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

export function useHpp(filter: PeriodFilterValue) {
  const supabase = createClient();
  const query = useQuery<HppRow[]>({
    queryKey: [
      "hpp-client-calculated",
      filter.from,
      filter.to,
      filter.outletId,
    ],
    staleTime: 2 * 60_000,
    enabled: Boolean(filter.from && filter.to),
    queryFn: async () => {
      const start = new Date(filter.from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filter.to);
      end.setHours(23, 59, 59, 999);

      const ordersGte = start.toISOString();
      const ordersLte = end.toISOString();

      const { data: outlets } = await supabase
        .from("outlets")
        .select("id, type, name, slug")
        .neq("id", TEST_OUTLET_ID);
      const outletTypeMap = new Map<string, string>();
      outlets?.forEach((o: any) => {
        if (!isTestOutlet(o)) outletTypeMap.set(o.id, o.type || "outlet");
      });

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
          "outlet_id, channel, sales_source, status, order_items(menu_item_name, quantity, menu_items(hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))))",
        )
        .neq("outlet_id", TEST_OUTLET_ID)
        .gte("created_at", ordersGte)
        .lte("created_at", ordersLte);

      if (filter.outletId !== "all") {
        queryOrders = queryOrders.eq("outlet_id", filter.outletId);
      }

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

      const ecommerceSalesList: any[] = [];
      if (filter.outletId === "all" || filter.outletId === "ss-online") {
        let queryEcommerce = supabase
          .from("ecommerce_sales")
          .select(
            "channel_id, ecommerce_sale_items(menu_items:menu_id(name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(hpp_override, channel_hpp))), quantity)",
          )
          .gte("order_date", ordersGte)
          .lte("order_date", ordersLte);

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
      }

      const hppMap = new Map<string, number>();

      allOrders.forEach((o: any) => {
        if (o.status === "cancelled" || o.status === "void" || isTestOutlet(o.outlet_id)) return;
        const outletType = outletTypeMap.get(o.outlet_id);
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
          const current = hppMap.get(o.outlet_id) || 0;
          hppMap.set(o.outlet_id, current + hpp * qty);
        });
      });

      ecommerceSalesList.forEach((saleRecord: any) => {
        const outletId = "ss-online";
        const outletType = "outlet";
        const ecommerceChannel = saleRecord.channel_id || "ss_online";

        saleRecord.ecommerce_sale_items?.forEach((item: any) => {
          const fallbackName = item.menu_items?.name || "Unknown";
          const hpp = getItemHpp(
            item.menu_items,
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
    },
  });
  return {
    rows: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  };
}
