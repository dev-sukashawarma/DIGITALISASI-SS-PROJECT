'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase'
import { fetchAllPages } from '@/lib/fetchAllPages'
import { batasRentangWib, nilaiBertanda, susunMutasi, STATUS_DIHITUNG, type TxMutasi } from '@/lib/kas/mutasiRekening'

/** Mutasi satu rekening pada rentang tanggal WIB (inklusif), lengkap saldo berjalan. */
export function useMutasiRekening(locationId: string, dari: string, sampai: string) {
  const supabase = useMemo(() => createClient(), [])

  return useQuery({
    queryKey: ['mutasi_rekening', locationId, dari, sampai],
    enabled: Boolean(locationId && dari && sampai && dari <= sampai),
    queryFn: async () => {
      const { mulai, akhirEksklusif } = batasRentangWib(dari, sampai)

      // Saldo awal = jumlah semua transaksi yang menggerakkan saldo sebelum tanggal mulai.
      const sebelum = await fetchAllPages<{ id: string; direction: 'in' | 'out'; amount: number }>(() =>
        supabase
          .from('cash_transaction')
          .select('id, direction, amount')
          .eq('cash_location_id', locationId)
          .in('status', STATUS_DIHITUNG as unknown as string[])
          .lt('occurred_at', mulai)
          .order('id', { ascending: true }),
      )
      const saldoAwal = sebelum.reduce((s, t) => s + nilaiBertanda(t), 0)

      const rows = await fetchAllPages<any>(() =>
        supabase
          .from('cash_transaction')
          .select('id, occurred_at, direction, amount, status, source_type, source_id, category, note, sales_date, proof_url, outlet:outlet_id(name)')
          .eq('cash_location_id', locationId)
          .gte('occurred_at', mulai)
          .lt('occurred_at', akhirEksklusif)
          .order('occurred_at', { ascending: true })
          .order('id', { ascending: true }),
      )

      // Pencairan petty cash tidak menyimpan outlet di transaksi kas: ambil dari pengajuannya.
      const topupIds = rows
        .filter(r => r.source_type === 'petty_cash_topup' && r.source_id && !r.outlet?.name)
        .map(r => r.source_id as string)
      const outletTopup = new Map<string, string>()
      for (let i = 0; i < topupIds.length; i += 50) {
        const { data } = await supabase
          .from('petty_cash_topups')
          .select('id, outlet:outlet_id(name)')
          .in('id', topupIds.slice(i, i + 50))
        for (const t of (data ?? []) as any[]) {
          const nama = Array.isArray(t.outlet) ? t.outlet[0]?.name : t.outlet?.name
          if (nama) outletTopup.set(t.id, nama)
        }
      }

      const txs: TxMutasi[] = rows.map(r => ({
        id: r.id,
        occurred_at: r.occurred_at,
        direction: r.direction,
        amount: Number(r.amount),
        status: r.status,
        source_type: r.source_type,
        category: r.category,
        note: r.note,
        sales_date: r.sales_date,
        proof_url: r.proof_url,
        outlet_name: (Array.isArray(r.outlet) ? r.outlet[0]?.name : r.outlet?.name) ?? outletTopup.get(r.source_id) ?? null,
      }))
      return susunMutasi(saldoAwal, txs)
    },
  })
}
