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
export function useBahanBaku() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['bahan_baku', 'active'],
    queryFn: fetchBahanBaku,
    staleTime: 5 * 60 * 1000, // 5 menit
    gcTime: 30 * 60 * 1000,
  })
  return {
    bahanBaku: data ?? EMPTY_BAHAN,
    loading: isLoading,
    error: error ? (error as Error).message : null,
  }
}
