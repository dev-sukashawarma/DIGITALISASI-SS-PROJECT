"use client"

import { useQuery } from "@tanstack/react-query"
import { createSupabaseBrowserClient } from "@suka/auth"
import { cleanItemName } from "@/lib/order-item-name"
import { ambilRiwayatHpp, ambilVersiRiwayatHpp, buatPenerapRiwayat, tanggalWib } from "@/lib/hpp/riwayatHpp"
import { getItemHpp } from "@/lib/posReport/compute"
import { resolveSalesSource } from "@/lib/resolveSalesSource"
import { TEST_OUTLET_ID } from "@/lib/outletFilters"

export interface HppByChannelRow {
  outlet_id: string
  sales_source: string
  hpp: number
}

export function useHppByChannel(from: string, to: string) {
  const supabase = createSupabaseBrowserClient()
  const versiQuery = useQuery({
    queryKey: ["hpp-riwayat-versi"],
    staleTime: 60_000,
    enabled: Boolean(from && to),
    queryFn: () => ambilVersiRiwayatHpp(supabase),
  })
  const versiHpp = versiQuery.data

  const query = useQuery<HppByChannelRow[]>({
    queryKey: ["hpp-by-channel-calculated-v2", from, to, versiHpp ?? ""],
    staleTime: 2 * 60_000,
    enabled: Boolean(from && to && versiHpp),
    queryFn: async () => {
      const ordersGte = `${from}T00:00:00.000+07:00`
      const ordersLte = `${to}T23:59:59.999+07:00`

      const { data: outlets } = await supabase
        .from("outlets")
        .select("id, type")
      const outletTypeMap = new Map<string, string>()
      outlets?.forEach((o: any) => outletTypeMap.set(o.id, o.type || "outlet"))

      const { data: menuItemsData } = await supabase
        .from("menu_items")
        .select(
          "id, name, hpp_override, channel_hpp, is_package, is_available, outlet_id, categories(name), package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))",
        )

      const riwayatRows = await ambilRiwayatHpp(supabase)
      const penerapHpp = buatPenerapRiwayat(menuItemsData ?? [], riwayatRows, cleanItemName)

      const queryOrders = supabase
        .from("orders")
        .select(
          "id, outlet_id, channel, sales_source, is_endorse, status, created_at, order_items(menu_item_name, quantity, menu_items(id, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))))",
        )
        .gte("created_at", ordersGte)
        .lte("created_at", ordersLte)
        .neq("outlet_id", TEST_OUTLET_ID)
        // Pengurut wajib untuk .range(): tanpa ORDER BY, halaman bisa
        // melompati atau mengulang baris (±30 halaman per bulan).
        .order("id", { ascending: true })

      const PAGE_SIZE = 1000
      const allOrders: any[] = []
      let offset = 0
      while (true) {
        const { data, error } = await queryOrders.range(
          offset,
          offset + PAGE_SIZE - 1,
        )
        if (error) throw error
        const page = data ?? []
        allOrders.push(...page)
        if (page.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      }

      const queryEcommerce = supabase
        .from("ecommerce_sales")
        .select(
          "id, channel_id, order_date, ecommerce_sale_items(menu_items:menu_id(id, name, hpp_override, channel_hpp, is_package, package_items:menu_packages!package_id(quantity, component:menu_items!menu_item_id(id, hpp_override, channel_hpp))), quantity)",
        )
        .gte("order_date", ordersGte)
        .lte("order_date", ordersLte)
        .order("id", { ascending: true })

      const allEc: any[] = []
      offset = 0
      while (true) {
        const { data, error } = await queryEcommerce.range(
          offset,
          offset + PAGE_SIZE - 1,
        )
        if (error) throw error
        const page = data ?? []
        allEc.push(...page)
        if (page.length < PAGE_SIZE) break
        offset += PAGE_SIZE
      }

      const hppMap = new Map<string, number>()
      const keyFn = (oId: string, src: string) => oId + "|" + src

      allOrders.forEach((o: any) => {
        // Sama dengan omzet (hanya order selesai). Dulu hanya membuang
        // cancelled/void, jadi HPP order yang belum selesai ikut terhitung.
        if (o.status !== "completed" && o.status !== "settled") return
        const outletType = outletTypeMap.get(o.outlet_id)
        // Kunci kanal HARUS sama dengan pengelompokan omzet Rekap Bulanan
        // (view sales_daily_spv → resolve_sales_source). Dulu dipakai
        // payment_method (cash/qris), sehingga seluruh HPP Food Apps & TikTok
        // jatuh ke "offline".
        const source = resolveSalesSource(o.channel, o.sales_source, o.is_endorse)
        const orderChannel = o.channel || o.sales_source

        const orderWibDate = tanggalWib(o.created_at)
        const pHpp = penerapHpp.untuk(orderWibDate)
        o.order_items?.forEach((item: any) => {
          const hpp = getItemHpp(
            pHpp.terapkan(item.menu_items),
            outletType,
            item.menu_item_name,
            pHpp.byName,
            orderChannel,
            undefined,
            undefined,
            o.outlet_id,
            orderWibDate,
          )
          const qty = item.quantity || 1
          const key = keyFn(o.outlet_id, source)
          const current = hppMap.get(key) || 0
          hppMap.set(key, current + hpp * qty)
        })
      })

      allEc.forEach((ec: any) => {
        const outletId = "ss-online"
        const outletType = "outlet"
        // Sama dengan kunci omzet e-commerce di useSalesDaily.
        const resolved = resolveSalesSource(ec.channel_id, null)
        const source =
          resolved === "tiktok_shop" || resolved === "shopee_shop" ? resolved : "online"

        const ecWibDate = tanggalWib(ec.order_date)
        const pHpp = penerapHpp.untuk(ecWibDate)
        ec.ecommerce_sale_items?.forEach((item: any) => {
          const fallbackName = item.menu_items?.name || "Unknown"
          const hpp = getItemHpp(
            pHpp.terapkan(item.menu_items),
            outletType,
            fallbackName,
            pHpp.byName,
            ec.channel_id,
            undefined,
            undefined,
            outletId,
            ecWibDate,
          )
          const qty = item.quantity || 1
          const key = keyFn(outletId, source)
          const current = hppMap.get(key) || 0
          hppMap.set(key, current + hpp * qty)
        })
      })

      const rows: HppByChannelRow[] = []
      for (const [key, hpp] of hppMap.entries()) {
        const [outlet_id, sales_source] = key.split("|")
        rows.push({ outlet_id, sales_source, hpp })
      }

      return rows
    },
  })
  const versiBelumSiap = !versiHpp && !versiQuery.error
  const aktif = Boolean(from && to)
  return {
    rows: query.data ?? [],
    loading: aktif && (versiQuery.isLoading || query.isLoading || versiBelumSiap),
    error: versiQuery.error
      ? (versiQuery.error as Error).message
      : query.error
        ? (query.error as Error).message
        : null,
  }
}
