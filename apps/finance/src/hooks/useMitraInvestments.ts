'use client'
import { useQuery } from '@tanstack/react-query'
import {
  getMitraInvestmentsAction,
  type MitraInvestmentExtended,
  type MitraTransferRecord
} from '@/app/actions/mitraInvestments'

export type { MitraInvestmentExtended, MitraTransferRecord }

/**
 * Profil investasi mitra per outlet, dipetakan berdasarkan `outlet_id`.
 *
 * Menggunakan Server Action (getMitraInvestmentsAction) yang dijalankan dengan
 * service client agar bypass RLS anon/browser yang sering mengembalikan array kosong.
 *
 * Dipakai halaman Laba Rugi untuk dua hal: memisahkan outlet mitra dari outlet
 * pusat, dan mengisi angka bagi hasil/BEP di ekspor CSV & PDF.
 */
export function useMitraInvestments() {
  const query = useQuery<Record<string, MitraInvestmentExtended>>({
    queryKey: ['mitra-investments'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      return await getMitraInvestmentsAction()
    },
  })

  return {
    investments: query.data ?? {},
    loading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
  }
}
