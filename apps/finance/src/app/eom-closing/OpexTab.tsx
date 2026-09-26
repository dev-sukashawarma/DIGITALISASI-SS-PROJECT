'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@suka/auth'
import { useExpenses } from '@/hooks/useExpenses'
import { useOutlets } from '@/hooks/useOutlets'
import { monthRange } from '@/lib/period'
import { rupiah } from '@/lib/format'
import { CATEGORY_META } from '@/lib/expenseCategories'
import { buildOpexSummary, previousMonth, type OpexGroup, type OpexUnit } from '@/lib/eom/opex'

const GROUPS: { key: OpexGroup; label: string; desc: string }[] = [
  { key: 'global', label: 'Global', desc: 'Biaya pusat: gaji staf kantor & pengeluaran global' },
  { key: 'internal', label: 'Internal', desc: 'Outlet milik sendiri' },
  { key: 'mitra', label: 'Mitra', desc: 'Outlet mitra — memengaruhi bagi hasil' },
]

const catLabel = (c: string) => (CATEGORY_META as Record<string, { label: string }>)[c]?.label ?? c

export default function OpexTab({ month, year }: { month: number; year: number }) {
  const cur = useMemo(() => monthRange(year, month), [year, month])
  const prevYm = previousMonth(year, month)
  const prev = useMemo(() => monthRange(prevYm.year, prevYm.month), [prevYm.year, prevYm.month])

  // Filter & hook sama dengan halaman Pengeluaran / Rekap Bulanan.
  const curQ = useExpenses({ from: cur.from, to: cur.to, outletId: 'all', source: 'all' })
  const prevQ = useExpenses({ from: prev.from, to: prev.to, outletId: 'all', source: 'all' })
  const { data: outlets = [], isLoading: outletsLoading } = useOutlets()

  const { outletStaff } = useAuth()
  const [printing, setPrinting] = useState(false)
  const [group, setGroup] = useState<OpexGroup>('internal')
  const [onlyMissing, setOnlyMissing] = useState(false)

  const summary = useMemo(
    () => buildOpexSummary(curQ.rows, prevQ.rows, outlets),
    [curQ.rows, prevQ.rows, outlets],
  )

  if (curQ.loading || prevQ.loading || outletsLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-2xl border border-suka-gray-200">
        <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-suka-brown">Memuat pengeluaran…</p>
      </div>
    )
  }
  if (curQ.error || prevQ.error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm">Gagal memuat pengeluaran: {curQ.error || prevQ.error}</div>
  }

  const handlePdf = async () => {
    setPrinting(true)
    try {
      const { generateOpexEomPdf } = await import('./exportEomPdf')
      await generateOpexEomPdf(summary, {
        month, year, prevLabel: `${MONTHS_ID[prevYm.month - 1]} ${prevYm.year}`, dicetakOleh: outletStaff?.name ?? 'Finance',
      })
      toast.success('PDF rincian OPEX diunduh')
    } catch (e) {
      console.error(e)
      toast.error('Gagal membuat PDF')
    } finally {
      setPrinting(false)
    }
  }

  const totalMissing = GROUPS.reduce((s, g) => s + summary.totals[g.key].missingCount, 0)
  const units = summary.units.filter((u) => u.group === group && (!onlyMissing || u.missing.length > 0))

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={handlePdf} disabled={printing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-suka-brown text-white text-xs font-bold hover:opacity-90 disabled:opacity-50">
          <FileDown size={12} /> {printing ? 'Menyiapkan PDF…' : 'Unduh PDF Rincian'}
        </button>
      </div>
      <div className={`rounded-2xl border p-4 flex items-start gap-3 ${totalMissing === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
        {totalMissing === 0 ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
        <div className="text-sm">
          <p className="font-bold">
            {totalMissing === 0
              ? 'Semua kategori yang terisi bulan lalu sudah diisi bulan ini.'
              : `${totalMissing} kategori biaya yang ada bulan lalu belum diisi bulan ini.`}
          </p>
          <p className="text-xs mt-0.5 opacity-80">
            Pembanding: {MONTHS_ID[prevYm.month - 1]} {prevYm.year}. Angka diambil dari data yang sama dengan halaman Pengeluaran.
            Batas input biaya bulan ini: tanggal 10 bulan berikutnya.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GROUPS.map((g) => {
          const t = summary.totals[g.key]
          const active = group === g.key
          return (
            <button key={g.key} onClick={() => setGroup(g.key)}
              className={`text-left rounded-2xl border p-4 shadow-sm transition-all ${active ? 'border-suka-orange ring-2 ring-suka-orange/20 bg-orange-50/40' : 'border-suka-gray-200 bg-white hover:border-suka-gray-300'}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-wide text-suka-brown">OPEX {g.label}</p>
                {t.missingCount > 0
                  ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{t.missingCount} belum diisi</span>
                  : <CheckCircle2 size={14} className="text-emerald-600" />}
              </div>
              <p className="mt-2 text-xl font-black text-suka-brown">{rupiah(t.total)}</p>
              <p className="text-[11px] text-suka-gray-500">bulan lalu {rupiah(t.totalPrev)} · {t.unitCount} {g.key === 'global' ? 'unit' : 'outlet'}</p>
              <p className="mt-1 text-[11px] text-suka-gray-400">{g.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-suka-gray-100 flex items-center justify-between gap-4">
          <h3 className="font-black text-suka-brown">Kelengkapan OPEX {GROUPS.find((g) => g.key === group)!.label}</h3>
          <label className="flex items-center gap-2 text-xs font-semibold text-suka-gray-600 cursor-pointer">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="accent-suka-orange" />
            Hanya yang belum lengkap
          </label>
        </div>
        {units.length === 0 ? (
          <p className="py-10 text-center text-sm text-suka-gray-400">Tidak ada data.</p>
        ) : (
          <div className="divide-y divide-suka-gray-100">
            {units.map((u) => <UnitRow key={u.unitId} u={u} />)}
          </div>
        )}
        <p className="px-5 py-3 text-[11px] text-suka-gray-500 border-t border-suka-gray-100 flex items-start gap-1.5">
          <Info size={12} className="shrink-0 mt-0.5" />
          Kategori "belum diisi" = terisi bulan lalu tapi belum ada bulan ini. Rincian per kategori ada di PDF. Penandaan "tidak ada bulan ini" dan centang verifikasi menyusul bersama pengiriman ke HUB.
        </p>
      </div>
    </div>
  )
}

function UnitRow({ u }: { u: OpexUnit }) {
  const diff = u.total - u.totalPrev
  return (
    <div className={`px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 ${u.missing.length > 0 ? 'bg-amber-50/40' : ''}`}>
      <span className="font-bold text-sm text-suka-brown min-w-[180px]">{u.unitName.replace('SUKA SHAWARMA ', '')}</span>
      <span className="text-sm font-black text-suka-ink">{rupiah(u.total)}</span>
      <span className={`text-[11px] ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-700' : 'text-suka-gray-400'}`}>
        {u.totalPrev > 0 ? `${diff >= 0 ? '+' : ''}${rupiah(diff)} vs bulan lalu` : 'bulan lalu kosong'}
      </span>
      <span className="flex flex-wrap gap-1 ml-auto">
        {u.missing.length === 0
          ? <span className="text-[10px] font-bold text-emerald-700">✓ lengkap</span>
          : u.missing.map((c) => (
              <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">belum: {catLabel(c)}</span>
            ))}
      </span>
    </div>
  )
}

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
