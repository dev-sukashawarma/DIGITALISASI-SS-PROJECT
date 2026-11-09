'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import type { BahanBaku } from '@/types/stok'

async function fetchBahanBaku(): Promise<BahanBaku[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bahan_baku')
    .select('*')
    .eq('is_active', true)
    .order('nama')
  if (error) throw error
  return (data as BahanBaku[]) ?? []
}

const EMPTY_BAHAN: BahanBaku[] = []

/**
 * Master bahan baku (reference data, jarang berubah). Di-cache via react-query
 * dengan staleTime panjang supaya tidak refetch tiap komponen mount/navigasi.
 */
export function useBahanBaku(opsi: { segar?: boolean } = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bahan_baku', 'active'],
    queryFn: fetchBahanBaku,
    // `segar` (form opname): satuan bisa diganti lewat Ganti Satuan, jadi ambil ulang saat
    // form dibuka, saat tab kembali aktif, dan tiap menit selama form terbuka.
    staleTime: opsi.segar ? 0 : 5 * 60 * 1000, // 5 menit
    refetchOnMount: opsi.segar ? 'always' : true,
    refetchOnWindowFocus: opsi.segar ? true : undefined,
    refetchInterval: opsi.segar ? 60_000 : false,
    gcTime: 30 * 60 * 1000,
  })
  return {
    bahanBaku: data ?? EMPTY_BAHAN,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
