'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  FileDown,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  X,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@suka/auth'
import { useExpenses } from '@/hooks/useExpenses'
import { useOutlets } from '@/hooks/useOutlets'
import { monthRange } from '@/lib/period'
import { rupiah } from '@/lib/format'
import { CATEGORY_META } from '@/lib/expenseCategories'
import {
  buildOpexSummary,
  previousMonth,
  type OpexGroup,
  type OpexUnit,
  type OpexClusterGroup,
  type OpexCategoryItem,
  type OpexClusterKey,
} from '@/lib/eom/opex'
import {
  getOpexExemptionsAction,
  setOpexExemptionAction,
  removeOpexExemptionAction,
} from '@/app/actions/eomOpex'

const GROUPS: { key: OpexGroup; label: string; desc: string }[] = [
  { key: 'global', label: 'Global (Pusat)', desc: 'Biaya kantor pusat: gaji staf kantor & operasional global' },
  { key: 'internal', label: 'Internal', desc: 'Outlet milik sendiri' },
  { key: 'mitra', label: 'Mitra', desc: 'Outlet kemitraan — memengaruhi perhitungan bagi hasil' },
]

const QUICK_REASONS = [
  'Dibayar tahunan / di muka',
  'Ditanggung Kantor Pusat',
  'Tidak ada aktivitas / pemakaian bulan ini',
  'Digabung ke pengeluaran lain',
]

const catLabel = (c: string) => (CATEGORY_META as Record<string, { label: string }>)[c]?.label ?? c

export default function OpexTab({ month, year }: { month: number; year: number }) {
  const queryClient = useQueryClient()
  const { outletStaff } = useAuth()
  const cur = useMemo(() => monthRange(year, month), [year, month])
  const prevYm = previousMonth(year, month)
  const prev = useMemo(() => monthRange(prevYm.year, prevYm.month), [prevYm.year, prevYm.month])

  // Data expenses current & prev month
  const curQ = useExpenses({ from: cur.from, to: cur.to, outletId: 'all', source: 'all' })
  const prevQ = useExpenses({ from: prev.from, to: prev.to, outletId: 'all', source: 'all' })
  const { data: outlets = [], isLoading: outletsLoading } = useOutlets()

  // Query exemptions (status nihil terverifikasi)
  const exemptionsQ = useQuery({
    queryKey: ['eom-opex-exemptions', year, month],
    queryFn: async () => {
      const res = await getOpexExemptionsAction(month, year)
      if (!res.success) throw new Error(res.error)
      return res.exemptions
    },
    staleTime: 60_000,
  })

  const [printingPdf, setPrintingPdf] = useState(false)
  const [exportingExcel, setExportingExcel] = useState(false)
  const [group, setGroup] = useState<OpexGroup>('internal')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({})

  // State dialog penandaan nihil
  const [activeNihilModal, setActiveNihilModal] = useState<{
    unitId: string
    unitName: string
    category: string
    categoryLabel: string
  } | null>(null)
  const [selectedQuickReason, setSelectedQuickReason] = useState<string>(QUICK_REASONS[0])
  const [customNotes, setCustomNotes] = useState<string>('')
  const [submittingNihil, setSubmittingNihil] = useState<boolean>(false)

  // Build summary with clusters and exemptions
  const summary = useMemo(() => {
    const rawExemptions = (exemptionsQ.data ?? []).map((ex) => ({
      unitId: ex.unit_id,
      category: ex.category,
      quickReason: ex.quick_reason,
      notes: ex.notes,
      markedBy: ex.marked_by,
      markedAt: ex.created_at,
    }))
    return buildOpexSummary(curQ.rows, prevQ.rows, outlets, rawExemptions)
  }, [curQ.rows, prevQ.rows, outlets, exemptionsQ.data])

  const toggleExpand = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }))
  }

  const toggleExpandAll = (unitsToToggle: OpexUnit[]) => {
    const allOpen = unitsToToggle.every((u) => !!expandedUnits[u.unitId])
    const nextState = { ...expandedUnits }
    unitsToToggle.forEach((u) => {
      nextState[u.unitId] = !allOpen
    })
    setExpandedUnits(nextState)
  }

  const handlePdf = async () => {
    setPrintingPdf(true)
    try {
      const { generateOpexEomPdf } = await import('./exportEomPdf')
      await generateOpexEomPdf(summary, {
        month,
        year,
        prevLabel: `${MONTHS_ID[prevYm.month - 1]} ${prevYm.year}`,
        dicetakOleh: outletStaff?.name ?? 'Finance',
      })
      toast.success('PDF Berita Acara OPEX berhasil diunduh')
    } catch (e: any) {
      console.error(e)
      toast.error('Gagal membuat PDF: ' + (e?.message || 'Error'))
    } finally {
      setPrintingPdf(false)
    }
  }

  const handleExcel = async () => {
    setExportingExcel(true)
    try {
      const { generateOpexExcel } = await import('./exportOpexExcel')
      await generateOpexExcel({
        month,
        year,
        summary,
        dicetakOleh: outletStaff?.name ?? 'Finance',
      })
      toast.success('Workbook Excel Berita Acara OPEX berhasil diunduh')
    } catch (e: any) {
      console.error(e)
      toast.error('Gagal membuat Excel: ' + (e?.message || 'Error'))
    } finally {
      setExportingExcel(false)
    }
  }

  const handleSaveNihil = async () => {
    if (!activeNihilModal) return
    setSubmittingNihil(true)
    try {
      const res = await setOpexExemptionAction({
        month,
        year,
        unitId: activeNihilModal.unitId,
        category: activeNihilModal.category,
        quickReason: selectedQuickReason,
        notes: customNotes.trim() || null,
        markedBy: outletStaff?.name ?? 'Finance Staff',
      })
      if (!res.success) throw new Error(res.error)
      toast.success(`Kategori ${activeNihilModal.categoryLabel} berhasil ditandai Nihil`)
      setActiveNihilModal(null)
      setSelectedQuickReason(QUICK_REASONS[0])
      setCustomNotes('')
      queryClient.invalidateQueries({ queryKey: ['eom-opex-exemptions', year, month] })
    } catch (err: any) {
      toast.error('Gagal menandai nihil: ' + (err?.message || 'Error'))
    } finally {
      setSubmittingNihil(false)
    }
  }

  const handleRemoveNihil = async (unitId: string, category: string, catTitle: string) => {
    try {
      const res = await removeOpexExemptionAction({ month, year, unitId, category })
      if (!res.success) throw new Error(res.error)
      toast.success(`Status nihil untuk ${catTitle} dibatalkan`)
      queryClient.invalidateQueries({ queryKey: ['eom-opex-exemptions', year, month] })
    } catch (err: any) {
      toast.error('Gagal membatalkan status nihil: ' + (err?.message || 'Error'))
    }
  }

  if (curQ.loading || prevQ.loading || outletsLoading || exemptionsQ.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 bg-white rounded-2xl border border-suka-gray-200">
        <div className="w-8 h-8 border-4 border-suka-orange border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-suka-brown">Memuat dan mengelompokkan data OPEX…</p>
        <p className="text-xs text-suka-gray-500">Mengkonsolidasi biaya seluruh cabang dan memeriksa status kelengkapan.</p>
      </div>
    )
  }

  if (curQ.error || prevQ.error) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-sm">
        Gagal memuat pengeluaran: {curQ.error || prevQ.error}
      </div>
    )
  }

  const totalMissing = GROUPS.reduce((s, g) => s + summary.totals[g.key].missingCount, 0)
  const totalExempted = GROUPS.reduce((s, g) => s + summary.totals[g.key].exemptedCount, 0)
  const units = summary.units.filter((u) => u.group === group && (!onlyMissing || u.missing.length > 0))
  const allCurrentUnitsOpen = units.length > 0 && units.every((u) => !!expandedUnits[u.unitId])

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-suka-gray-200 shadow-xs">
        <div>
          <h2 className="text-sm font-black text-suka-brown flex items-center gap-2">
            <Layers size={16} className="text-suka-orange" />
            Rekapitulasi Biaya Operasional (OPEX)
          </h2>
          <p className="text-xs text-suka-gray-500 mt-0.5">
            Biaya operasional murni dikelompokkan per kluster. Pembelian bahan baku kas toko dipisahkan di seksi Non-OPEX.
          </p>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleExcel}
            disabled={exportingExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 disabled:opacity-50 transition-colors shadow-xs"
          >
            <FileSpreadsheet size={13} className="text-emerald-700" />
            {exportingExcel ? 'Menyiapkan Excel…' : 'Ekspor Excel (.xlsx)'}
          </button>
          <button
            onClick={handlePdf}
            disabled={printingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-suka-brown text-white text-xs font-bold hover:bg-suka-brown/90 disabled:opacity-50 transition-colors shadow-xs"
          >
            <FileDown size={13} />
            {printingPdf ? 'Menyiapkan PDF…' : 'Unduh PDF Rincian'}
          </button>
        </div>
      </div>

      {/* 2. Banner Kelengkapan */}
      <div
        className={`rounded-2xl border p-4 flex items-start gap-3 shadow-xs ${
          totalMissing === 0
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}
      >
        {totalMissing === 0 ? (
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
        ) : (
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
        )}
        <div className="text-sm">
          <p className="font-bold">
            {totalMissing === 0
              ? `Seluruh kategori biaya bulan ini telah lengkap terisi atau diverifikasi nihil (${totalExempted} nihil).`
              : `${totalMissing} kategori biaya yang ada bulan lalu belum diisi bulan ini (${totalExempted} telah diverifikasi nihil).`}
          </p>
          <p className="text-xs mt-0.5 opacity-85">
            Pembanding kelengkapan: {MONTHS_ID[prevYm.month - 1]} {prevYm.year}. Batas input biaya operasional bulan ini: tanggal 10 bulan berikutnya. Kategori yang memang tidak memiliki biaya bulan ini dapat ditandai sebagai <b>Nihil</b>.
          </p>
        </div>
      </div>

      {/* 3. Kartu Kelompok Entitas (Global, Internal, Mitra) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GROUPS.map((g) => {
          const t = summary.totals[g.key]
          const active = group === g.key
          return (
            <button
              key={g.key}
              onClick={() => setGroup(g.key)}
              className={`text-left rounded-2xl border p-4.5 shadow-xs transition-all relative overflow-hidden ${
                active
                  ? 'border-suka-orange ring-2 ring-suka-orange/20 bg-orange-50/40 shadow-sm'
                  : 'border-suka-gray-200 bg-white hover:border-suka-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-suka-brown">
                  OPEX {g.label}
                </span>
                <div className="flex items-center gap-1.5">
                  {t.exemptedCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {t.exemptedCount} nihil
                    </span>
                  )}
                  {t.missingCount > 0 ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
                      {t.missingCount} belum diisi
                    </span>
                  ) : (
                    <CheckCircle2 size={15} className="text-emerald-600" />
                  )}
                </div>
              </div>

              <p className="mt-2.5 text-2xl font-black text-suka-brown tracking-tight">
                {rupiah(t.total)}
              </p>

              <div className="mt-1 flex items-center gap-2 text-xs text-suka-gray-500">
                <span>bulan lalu {rupiah(t.totalPrev)}</span>
                <span>•</span>
                <span>
                  {t.unitCount} {g.key === 'global' ? 'unit kantor' : 'outlet'}
                </span>
              </div>

              {t.nonOpexTotal > 0 && (
                <div className="mt-2 pt-2 border-t border-suka-gray-100 text-[11px] font-semibold text-amber-800 flex items-center justify-between">
                  <span>Bahan Baku Non-OPEX:</span>
                  <span>{rupiah(t.nonOpexTotal)}</span>
                </div>
              )}

              <p className="mt-2 text-[11px] text-suka-gray-400 line-clamp-1">{g.desc}</p>
            </button>
          )
        })}
      </div>

      {/* 4. Konsolidasi Kluster Beban (Grid 5 Kluster) */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-suka-gray-100 pb-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-suka-brown flex items-center gap-2">
              <Sparkles size={14} className="text-suka-orange" />
              Konsolidasi Beban Berdasarkan Kluster (Seluruh Cabang & Pusat)
            </h3>
            <p className="text-[11px] text-suka-gray-500">
              Total agregat biaya se-Indonesia untuk analisis struktur biaya operasional.
            </p>
          </div>
          <span className="text-[11px] font-bold text-suka-gray-400">
            Periode: {MONTHS_ID[month - 1]} {year}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          {(Object.keys(summary.clusterTotals) as OpexClusterKey[]).map((cKey) => {
            const ct = summary.clusterTotals[cKey]
            const diffPositive = ct.diff > 0
            const diffNegative = ct.diff < 0
            const isNonOpex = ct.isNonOpex

            return (
              <div
                key={cKey}
                className={`p-3.5 rounded-xl border transition-all ${
                  isNonOpex
                    ? 'bg-amber-50/40 border-amber-200'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-suka-brown truncate">
                    {ct.label}
                  </span>
                  {isNonOpex && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900">
                      Non-OPEX
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-base font-black text-suka-ink">{rupiah(ct.total)}</p>

                <div className="mt-1 flex items-center gap-1 text-[10px]">
                  {ct.totalPrev > 0 ? (
                    <span
                      className={`inline-flex items-center font-bold ${
                        diffPositive
                          ? 'text-red-600'
                          : diffNegative
                          ? 'text-emerald-700'
                          : 'text-suka-gray-500'
                      }`}
                    >
                      {diffPositive ? <ArrowUpRight size={11} /> : diffNegative ? <ArrowDownRight size={11} /> : null}
                      {ct.diffPct != null ? `${Math.abs(ct.diffPct).toFixed(1)}%` : '0%'}
                    </span>
                  ) : (
                    <span className="text-suka-gray-400">Bln lalu kosong</span>
                  )}
                  <span className="text-suka-gray-400">vs {rupiah(ct.totalPrev)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 5. Tabel Breakdown & Accordion per Outlet */}
      <div className="bg-white rounded-2xl border border-suka-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-suka-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-suka-cream/10">
          <div>
            <h3 className="font-black text-suka-brown text-sm">
              Kelengkapan & Rincian OPEX {GROUPS.find((g) => g.key === group)!.label}
            </h3>
            <p className="text-[11px] text-suka-gray-500 mt-0.5">
              Klik nama outlet untuk melihat rincian per kluster beban (Gaji, Listrik, Sewa, dll.) dan menandai status nihil.
            </p>
          </div>

          <div className="flex items-center gap-4 self-start sm:self-auto">
            <button
              onClick={() => toggleExpandAll(units)}
              className="text-xs font-bold text-suka-brown hover:text-suka-orange transition-colors"
            >
              {allCurrentUnitsOpen ? 'Tutup Semua Rincian' : 'Buka Semua Rincian'}
            </button>
            <label className="flex items-center gap-2 text-xs font-semibold text-suka-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyMissing}
                onChange={(e) => setOnlyMissing(e.target.checked)}
                className="accent-suka-orange"
              />
              Hanya yang belum lengkap
            </label>
          </div>
        </div>

        {units.length === 0 ? (
          <p className="py-12 text-center text-sm text-suka-gray-400">
            Tidak ada data outlet yang sesuai dengan filter.
          </p>
        ) : (
          <div className="divide-y divide-suka-gray-100">
            {units.map((u) => {
              const isOpen = !!expandedUnits[u.unitId]
              return (
                <UnitAccordionItem
                  key={u.unitId}
                  u={u}
                  isOpen={isOpen}
                  onToggle={() => toggleExpand(u.unitId)}
                  onOpenNihilModal={(cat, label) =>
                    setActiveNihilModal({
                      unitId: u.unitId,
                      unitName: u.unitName.replace('SUKA SHAWARMA ', ''),
                      category: cat,
                      categoryLabel: label,
                    })
                  }
                  onRemoveNihil={(cat, label) => handleRemoveNihil(u.unitId, cat, label)}
                />
              )
            })}
          </div>
        )}

        <div className="px-5 py-3 text-[11px] text-suka-gray-500 border-t border-suka-gray-100 flex items-start gap-1.5 bg-slate-50/50">
          <Info size={13} className="shrink-0 mt-0.5 text-suka-gray-400" />
          <span>
            <b>Catatan Auditor:</b> Kategori berlabel <i>Belum Diisi</i> adalah pengeluaran yang pernah tercatat bulan lalu namun belum dicatat bulan ini. Jika pengeluaran tersebut memang nihil/tidak terjadi, klik tombol <b>Tandai Nihil</b> pada baris kategori yang bersangkutan.
          </span>
        </div>
      </div>

      {/* 6. Modal / Dialog Konfirmasi Nihil */}
      {activeNihilModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-suka-gray-200 space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-suka-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Verifikasi Status Biaya Nihil
                </span>
                <h4 className="text-base font-black text-suka-brown mt-1">
                  Tandai Nihil: {activeNihilModal.categoryLabel}
                </h4>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Unit: <b>{activeNihilModal.unitName}</b> • Periode {MONTHS_ID[month - 1]} {year}
                </p>
              </div>
              <button
                onClick={() => setActiveNihilModal(null)}
                className="p-1.5 rounded-xl hover:bg-suka-gray-100 text-suka-gray-400 hover:text-suka-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-suka-brown">
                Pilih Alasan Umum:
              </label>
              <div className="flex flex-col gap-1.5">
                {QUICK_REASONS.map((r) => {
                  const selected = selectedQuickReason === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedQuickReason(r)}
                      className={`text-left text-xs p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                        selected
                          ? 'border-suka-orange bg-orange-50/50 text-suka-brown font-bold'
                          : 'border-suka-gray-200 hover:border-suka-gray-300 text-suka-ink'
                      }`}
                    >
                      <span>{r}</span>
                      {selected && <Check size={14} className="text-suka-orange" />}
                    </button>
                  )
                })}
              </div>

              <div className="space-y-1 pt-1">
                <label className="block text-xs font-bold text-suka-brown">
                  Catatan Tambahan (Opsional):
                </label>
                <input
                  type="text"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="Contoh: Dibayar 1 tahun di bulan Juni, perpanjang Mei 2027"
                  className="w-full text-xs p-2.5 rounded-xl border border-suka-gray-200 focus:outline-none focus:border-suka-orange"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-suka-gray-100">
              <button
                type="button"
                onClick={() => setActiveNihilModal(null)}
                disabled={submittingNihil}
                className="px-4 py-2 rounded-xl border border-suka-gray-200 text-xs font-bold text-suka-gray-600 hover:bg-suka-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNihil}
                disabled={submittingNihil}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck size={14} />
                {submittingNihil ? 'Menyimpan…' : 'Simpan Status Nihil'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function UnitAccordionItem({
  u,
  isOpen,
  onToggle,
  onOpenNihilModal,
  onRemoveNihil,
}: {
  u: OpexUnit
  isOpen: boolean
  onToggle: () => void
  onOpenNihilModal: (category: string, label: string) => void
  onRemoveNihil: (category: string, label: string) => void
}) {
  const diff = u.total - u.totalPrev
  const diffPct = u.totalPrev > 0 ? (diff / u.totalPrev) * 100 : null

  return (
    <div className={`transition-colors ${u.missing.length > 0 ? 'bg-amber-50/20' : ''}`}>
      {/* Header Row Bar */}
      <div
        onClick={onToggle}
        className="px-5 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 cursor-pointer hover:bg-suka-cream/20 select-none transition-colors"
      >
        <button
          type="button"
          className="text-suka-gray-400 hover:text-suka-brown transition-colors"
        >
          {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </button>

        <span className="font-bold text-sm text-suka-brown min-w-[200px] flex items-center gap-2">
          {u.unitName.replace('SUKA SHAWARMA ', '')}
          {u.group === 'mitra' && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
              MITRA
            </span>
          )}
        </span>

        {/* OPEX Murni */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs text-suka-gray-400">OPEX:</span>
          <span className="text-sm font-black text-suka-ink">{rupiah(u.total)}</span>
        </div>

        {/* Selisih OPEX */}
        <span
          className={`text-[11px] font-medium ${
            diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-700' : 'text-suka-gray-400'
          }`}
        >
          {u.totalPrev > 0
            ? `${diff >= 0 ? '+' : ''}${rupiah(diff)} (${diffPct != null ? `${diffPct.toFixed(1)}%` : ''}) vs bln lalu`
            : 'bln lalu kosong'}
        </span>

        {/* Non-OPEX Bahan Baku Badge jika ada */}
        {u.nonOpexTotal > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
            Bahan Baku: {rupiah(u.nonOpexTotal)}
          </span>
        )}

        {/* Badges Status Kelengkapan di Kanan */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          {u.exempted.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {u.exempted.length} nihil
            </span>
          )}
          {u.missing.length === 0 ? (
            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={13} />
              lengkap
            </span>
          ) : (
            u.missing.map((c) => (
              <span
                key={c}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900"
              >
                belum: {catLabel(c)}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Expanded Accordion Body */}
      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4 bg-slate-50/60 border-t border-suka-gray-100 animate-in fade-in duration-100">
          <div className="grid grid-cols-1 gap-3">
            {u.clusters.map((cl) => (
              <ClusterCard
                key={cl.key}
                cluster={cl}
                onOpenNihilModal={onOpenNihilModal}
                onRemoveNihil={onRemoveNihil}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ClusterCard({
  cluster,
  onOpenNihilModal,
  onRemoveNihil,
}: {
  cluster: OpexClusterGroup
  onOpenNihilModal: (category: string, label: string) => void
  onRemoveNihil: (category: string, label: string) => void
}) {
  const isNonOpex = cluster.isNonOpex
  return (
    <div
      className={`rounded-xl border overflow-hidden shadow-2xs ${
        isNonOpex ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-suka-gray-200'
      }`}
    >
      {/* Cluster Header */}
      <div
        className={`px-4 py-2.5 flex items-center justify-between border-b ${
          isNonOpex ? 'bg-amber-100/60 border-amber-200 text-amber-950' : 'bg-slate-100/80 border-suka-gray-200 text-suka-brown'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider">{cluster.label}</span>
          {isNonOpex && (
            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
              NON-OPEX / COGS
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="font-bold text-suka-gray-500">
            Subtotal: <span className="font-black text-suka-ink">{rupiah(cluster.total)}</span>
          </span>
          <span className="text-[11px] text-suka-gray-400">
            bln lalu {rupiah(cluster.totalPrev)}
          </span>
        </div>
      </div>

      {/* Cluster Categories Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/70 text-[10px] uppercase text-suka-gray-500 border-b border-suka-gray-100">
            <tr>
              <th className="py-2 px-3 text-left">Kategori Biaya</th>
              <th className="py-2 px-3 text-right">Bulan Ini</th>
              <th className="py-2 px-3 text-right">Bulan Lalu</th>
              <th className="py-2 px-3 text-right">Selisih</th>
              <th className="py-2 px-3 text-center">Status / Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {cluster.categories.map((it) => (
              <CategoryRow
                key={it.category}
                item={it}
                onOpenNihilModal={() => onOpenNihilModal(it.category, it.label)}
                onRemoveNihil={() => onRemoveNihil(it.category, it.label)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategoryRow({
  item,
  onOpenNihilModal,
  onRemoveNihil,
}: {
  item: OpexCategoryItem
  onOpenNihilModal: () => void
  onRemoveNihil: () => void
}) {
  const isMissing = item.status === 'missing'
  const isNihil = item.status === 'nihil'
  const isAdded = item.status === 'added'

  return (
    <tr className={`transition-colors ${isMissing ? 'bg-amber-50/60' : isNihil ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'}`}>
      <td className="py-2.5 px-3 font-semibold text-suka-brown flex items-center gap-2">
        <span>{item.label}</span>
      </td>

      <td className="py-2.5 px-3 text-right font-black text-suka-ink">
        {item.current > 0 ? rupiah(item.current) : isNihil ? <span className="text-emerald-700 font-bold">Rp 0 (Nihil)</span> : '—'}
      </td>

      <td className="py-2.5 px-3 text-right text-suka-gray-500">
        {item.previous > 0 ? rupiah(item.previous) : '—'}
      </td>

      <td
        className={`py-2.5 px-3 text-right font-medium ${
          item.diff > 0 ? 'text-red-600' : item.diff < 0 ? 'text-emerald-700' : 'text-suka-gray-400'
        }`}
      >
        {item.previous > 0 ? `${item.diff >= 0 ? '+' : ''}${rupiah(item.diff)}` : '—'}
      </td>

      <td className="py-2.5 px-3 text-center">
        {isMissing ? (
          <div className="inline-flex items-center gap-1.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
              Belum Diisi
            </span>
            <button
              onClick={onOpenNihilModal}
              title="Tandai bahwa kategori ini memang tidak ada biaya bulan ini"
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-2xs cursor-pointer"
            >
              Tandai Nihil
            </button>
          </div>
        ) : isNihil ? (
          <div className="inline-flex items-center gap-1.5">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-help"
              title={`Alasan: ${item.exemption?.quickReason || ''}${item.exemption?.notes ? ` - ${item.exemption.notes}` : ''}`}
            >
              ✓ Nihil ({item.exemption?.quickReason || 'Diverifikasi'})
            </span>
            <button
              onClick={onRemoveNihil}
              title="Batalkan status nihil"
              className="text-suka-gray-400 hover:text-red-600 p-0.5 rounded transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        ) : isAdded ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            Kategori Baru
          </span>
        ) : (
          <span className="text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1">
            <Check size={13} />
            Normal
          </span>
        )}
      </td>
    </tr>
  )
}

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
]
