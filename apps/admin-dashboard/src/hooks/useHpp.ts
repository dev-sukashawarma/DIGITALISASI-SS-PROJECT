"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import type { PeriodFilterValue } from "@/lib/types";
import { periodCacheOptions, withPeriodCache } from "@/lib/periodCache";
import { ambilVersiRiwayatHpp } from "@/lib/hpp/riwayatHpp";
import { fetchHppRows, type HppRow } from "@/lib/hpp/fetchHpp";

export type { HppChannelBreakdown, HppRow } from "@/lib/hpp/fetchHpp";
export { getOrderHppChannelGroup, getItemHpp, fetchHppRows } from "@/lib/hpp/fetchHpp";

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
