'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Clock, FileText, Store, Tag, User } from 'lucide-react'
import { createSupabaseBrowserClient } from '@suka/auth'

/**
 * Pantauan pengeluaran petty cash dari POS yang sedang menunggu ACC Finance.
 *
 * Sejak 26 Nov 2026 persetujuan pengeluaran outlet POS pindah kembali ke Finance
 * (migrasi 20261126100000_pengeluaran_dan_topup_petty_cash_finance). Panel ini
 * bersifat pantauan (read-only) untuk Area Manager outlet binaan, tanpa tombol ACC/Tolak.
 */

export interface PengeluaranMenunggu {
  id: string
  outlet_id: string
  category: string
  amount: number
  description: string | null
  receipt_url: string | null
  created_at: string
  outlet_nama: string
  pengaju_nama: string | null
}

const LABEL_KATEGORI: Record<string, string> = {
  pengeluaran_outlet: 'Operasional Outlet',
  bahan_baku: 'Bahan Baku',
  gas: 'Gas',
  transport: 'Transport',
  pln: 'PLN / Listrik',
  pdam: 'PDAM / Air',
  internet: 'Internet',
  lembur: 'Lembur',
  endorsement: 'Endorsement',
  rab: 'RAB (Otomatis)',
}

export function labelKategori(category: string | null | undefined): string {
  if (!category) return 'Pengeluaran'
  return LABEL_KATEGORI[category] ?? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function formatWaktu(iso: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(iso))
}

/** Daftar + jumlah pantauan pengeluaran menunggu Finance; dipakai halaman untuk lencana tab. */
export function usePengeluaranMenunggu(outletId: string) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), [])
  const [items, setItems] = useState<PengeluaranMenunggu[]>([])
  const [loading, setLoading] = useState(true)

  // Daftar outlet binaan AM (staff_outlets), dibaca sekali per sesi halaman.
  // null = bukan AM (RM/developer) → tidak disaring di klien.
  const binaanRef = useRef<Promise<string[] | null> | null>(null)
  const reqSeqRef = useRef(0)
  const ambilBinaan = useCallback(() => {
    if (!binaanRef.current) {
      binaanRef.current = (async () => {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) return []
        const [{ data: me }, { data: so }] = await Promise.all([
          supabase.from('outlet_staff').select('role').eq('id', uid).maybeSingle(),
          supabase.from('staff_outlets').select('outlet_id').eq('staff_id', uid),
        ])
        if (me?.role !== 'area_manager') return null
        return (so ?? []).map((r: { outlet_id: string }) => r.outlet_id)
      })()
    }
    return binaanRef.current
  }, [supabase])

  const muat = useCallback(async () => {
    const seq = ++reqSeqRef.current
    const binaan = await ambilBinaan()
    if (seq !== reqSeqRef.current) return
    if (binaan && binaan.length === 0) {
      setItems([])
      setLoading(false)
      return
    }
    let q = supabase
      .from('petty_cash_expenses')
      .select(`
        id, outlet_id, category, amount, description, receipt_url, created_at,
        outlet_staff!petty_cash_expenses_created_by_fkey(name),
        outlets!petty_cash_expenses_outlet_id_fkey!inner(name)
      `)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(200)
    if (outletId !== 'all') q = q.eq('outlet_id', outletId)
    if (binaan) q = q.in('outlet_id', binaan)

    const { data, error } = await q
    if (seq !== reqSeqRef.current) return
    if (error) {
      toast.error('Gagal memuat pengeluaran kasir: ' + error.message)
      setLoading(false)
      return
    }
    setItems(
      ((data ?? []) as any[]).map((row) => {
        const outlet = Array.isArray(row.outlets) ? row.outlets[0] : row.outlets
        const staff = Array.isArray(row.outlet_staff) ? row.outlet_staff[0] : row.outlet_staff
        return {
          id: row.id,
          outlet_id: row.outlet_id,
          category: row.category,
          amount: Number(row.amount) || 0,
          description: row.description ?? null,
          receipt_url: row.receipt_url ?? null,
          created_at: row.created_at,
          outlet_nama: outlet?.name ?? '-',
          pengaju_nama: staff?.name ?? null,
        }
      }),
    )
    setLoading(false)
  }, [supabase, outletId, ambilBinaan])

  useEffect(() => {
    muat()
    let timer: ReturnType<typeof setTimeout> | null = null
    const jadwalkan = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { if (!document.hidden) muat() }, 1000)
    }
    const filter = outletId !== 'all' ? `outlet_id=eq.${outletId}` : undefined
    const channel = supabase
      .channel(`am-pengeluaran-pc:${outletId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'petty_cash_expenses', ...(filter ? { filter } : {}) }, jadwalkan)
      .subscribe()
    const onVisible = () => { if (!document.hidden) muat() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [muat, supabase, outletId])

  return { items, loading, muat }
}

export function PengeluaranKasirPanel({
  items,
  loading,
  onLihatStruk,
}: {
  items: PengeluaranMenunggu[]
  loading: boolean
  onLihatStruk: (url: string) => void
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-white/50 border border-slate-200/40 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-full mb-3 text-emerald-600 ring-4 ring-emerald-50/50">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">Tidak ada pengeluaran menunggu</h3>
        <p className="text-sm text-slate-500 mt-1">Semua pengeluaran petty cash kasir di outlet binaan sudah diproses Finance.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Pantauan saja — persetujuan pengeluaran outlet POS kini diproses langsung oleh tim <b>Finance</b> di Hub Approval.
      </p>
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4"
        >
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold tracking-wide uppercase text-slate-400">
              <span className="text-[#4a1c15] flex items-center gap-1">
                <Store className="w-3.5 h-3.5" />
                {item.outlet_nama}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatWaktu(item.created_at)}
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {labelKategori(item.category)}
              </span>
            </div>
            <h3 className="text-base font-semibold text-slate-900 break-words leading-tight">
              {item.description || '-'}
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                {item.pengaju_nama || 'Kru Kasir'}
              </span>
              {item.receipt_url ? (
                <button
                  type="button"
                  onClick={() => onLihatStruk(item.receipt_url!)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 text-slate-600 rounded hover:bg-slate-50 text-[10px] font-bold uppercase tracking-wider"
                >
                  <FileText className="w-3 h-3" /> Struk
                </button>
              ) : (
                <span className="italic text-amber-600">Tanpa foto struk</span>
              )}
            </div>
          </div>

          <div className="flex flex-row md:flex-col items-center md:items-end justify-between shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-6 gap-2">
            <div className="text-left md:text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">Menunggu ACC Finance</div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{formatRupiah(item.amount)}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
