import { useQuery } from '@tanstack/react-query'
import { createSupabaseBrowserClient } from '@suka/auth'
import { computeSuggestion, sortSuggestions, type SuggestionRow, type SuggestionComputed } from '@/lib/purchase/suggestion'

const supabase = createSupabaseBrowserClient()

export function usePurchaseSuggestion() {
  const q = useQuery<SuggestionComputed[]>({
    queryKey: ['purchase-suggestion'],
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('purchase_suggestion_spv').select('*, bahan_baku(kategori, satuan_tengah, faktor_tengah, satuan_kecil, faktor_tampilan)')
      if (error) throw error
      const computed = (data as unknown as SuggestionRow[]).map((r) => computeSuggestion(r))
      return sortSuggestions(computed)
    },
  })
  return { rows: q.data ?? [], loading: q.isLoading, error: q.error }
}
