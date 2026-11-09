'use client'

import { useMemo, type ReactNode } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot, Clock } from 'lucide-react'
import { Spinner } from '@suka/design-system'
import { createClient } from '@/lib/supabase'
import { usePendingPrCount } from '@/hooks/usePurchaseRequest'
import { useInvoicePerPo, usePayablePos, useTxBayarPo } from '@/hooks/useSupplierSettlement'
import { susunTugas, type NadaTugas } from '@/lib/purchasing/ringkas'

const GAYA: Record<NadaTugas, { kotak: string; angka: string; ikon: ReactNode }> = {
  peringatan: { kotak: 'border-red-200 bg-red-50', angka: 'text-red-700', ikon: <AlertTriangle className="h-5 w-5 text-red-600" /> },
  aksi: { kotak: 'border-suka-orange/30 bg-white', angka: 'text-suka-orange', ikon: <CircleDot className="h-5 w-5 text-suka-orange" /> },
  info: { kotak: 'border-suka-gray-200 bg-suka-gray-50', angka: 'text-suka-gray-500', ikon: <Clock className="h-5 w-5 text-suka-gray-400" /> },
}

function hariIniWib(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
}

/** Hitungan PO per tahap sebelum barang diterima. */
function usePoBerjalan() {
  const supabase = useMemo(() => createClient(), [])
  return useQuery({
    queryKey: ['purchase-orders', 'tugas-purchasing'],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order')
        .select('id, status, tanggal_estimasi_tiba')
        .in('status', ['draft', 'menunggu_approval_finance', 'dikirim_ke_supplier'])
      if (error) throw error
      const hariIni = hariIniWib()
      const rows = (data ?? []) as { status: string; tanggal_estimasi_tiba: string | null }[]
      return {
        draft: rows.filter((r) => r.status === 'draft').length,
        menungguApproval: rows.filter((r) => r.status === 'menunggu_approval_finance').length,
        terlambat: rows.filter((r) => r.status === 'dikirim_ke_supplier' && !!r.tanggal_estimasi_tiba && r.tanggal_estimasi_tiba.slice(0, 10) < hariIni).length,
      }
    },
  })
}

/** Beranda purchasing: hanya pekerjaan yang perlu dilakukan sekarang, paling mendesak di atas. */
export function TugasHariIni() {
  const { data: pr = 0, isLoading: l1 } = usePendingPrCount()
  const { data: po, isLoading: l2 } = usePoBerjalan()
  const { data: payable = [], isLoading: l3 } = usePayablePos()
  const { data: txs = {}, isLoading: l4 } = useTxBayarPo()
  const { data: invoices = {}, isLoading: l5 } = useInvoicePerPo()

  const tugas = useMemo(() => {
    const belum = payable.filter((p) => p.payment_status === 'unpaid')
    const ditolak = belum.filter((p) => txs[p.id]?.status === 'rejected')
    const adaInv = (id: string) => (invoices[id]?.length ?? 0) > 0
    const normal = belum.filter((p) => txs[p.id]?.status !== 'rejected')
    return susunTugas({
      prMenunggu: pr,
      poDraft: po?.draft ?? 0,
      poMenungguApproval: po?.menungguApproval ?? 0,
      poTerlambat: po?.terlambat ?? 0,
      tanpaInvoice: normal.filter((p) => !adaInv(p.id)).length,
      siapDiajukan: normal.filter((p) => adaInv(p.id)).length,
      ditolakFinance: ditolak.length,
      menungguFinance: payable.filter((p) => p.payment_status === 'pending').length,
    })
  }, [pr, po, payable, txs, invoices])

  const memuat = l1 || l2 || l3 || l4 || l5

  return (
    <section className="space-y-4 font-sans">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-suka-orange">Purchasing</p>
        <h1 className="font-display text-4xl tracking-wide text-suka-brown md:text-5xl">Tugas Hari Ini</h1>
        <p className="mt-1 text-sm font-medium text-suka-ink/60">Yang paling mendesak di atas. Klik untuk langsung mengerjakan.</p>
      </div>

      {memuat ? (
        <div className="flex justify-center py-10"><Spinner size={28} /></div>
      ) : tugas.length === 0 ? (
        <div className="flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-800">
          <CheckCircle2 className="h-6 w-6" />
          <span className="font-semibold">Semua beres. Tidak ada yang perlu dikerjakan sekarang.</span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tugas.map((t) => {
            const g = GAYA[t.nada]
            return (
              <Link key={t.kunci} href={t.href}
                className={`group flex items-center gap-4 rounded-3xl border p-4 shadow-2xs transition hover:shadow-md ${g.kotak}`}>
                <div className={`font-display text-4xl leading-none ${g.angka}`}>{t.jumlah}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-suka-brown">{g.ikon}<span>{t.judul}</span></div>
                  <div className="mt-0.5 text-xs text-suka-ink/60">{t.keterangan}</div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-suka-brown/40 transition group-hover:translate-x-0.5" />
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
