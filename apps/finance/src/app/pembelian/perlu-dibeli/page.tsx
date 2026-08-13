'use client'

import { useState, Fragment, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePurchaseSuggestion } from '@/hooks/usePurchaseSuggestion'
import { formatStok } from '@/lib/format'
import { PageHeader, StatTile } from '@/components/ui'
import { 
  ShoppingCart, Search, AlertTriangle, AlertCircle, 
  CheckCircle2, Sparkles, Package, ArrowRight
} from 'lucide-react'
import CountUp from 'react-countup'
import { Spinner } from '@suka/design-system'

const BADGE_STYLE: Record<string, { label: string; bg: string; text: string; border: string }> = {
  mendesak: { label: 'Mendesak', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200/80' },
  menipis: { label: 'Menipis', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200/80' },
  aman: { label: 'Aman', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80' },
}

export default function PerluDibeliPage() {
  const { rows, loading } = usePurchaseSuggestion()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'mendesak' | 'menipis' | 'aman'>('all')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const router = useRouter()

  const toggle = (id: string) => setChecked((c) => ({ ...c, [id]: !c[id] }))

  // Hitung jumlah statistik
  const mendesakCount = useMemo(() => rows.filter(r => r.tingkat === 'mendesak').length, [rows])
  const menipisCount = useMemo(() => rows.filter(r => r.tingkat === 'menipis').length, [rows])
  const amanCount = useMemo(() => rows.filter(r => r.tingkat === 'aman').length, [rows])
  
  const selectedRows = useMemo(() => rows.filter((r) => checked[r.bahan_baku_id]), [rows, checked])
  const selectedCount = selectedRows.length

  // Quick Action: Centang semua item mendesak
  const selectMendesak = () => {
    const newChecked: Record<string, boolean> = { ...checked }
    rows.forEach(r => {
      if (r.tingkat === 'mendesak') {
        newChecked[r.bahan_baku_id] = true
      }
    })
    setChecked(newChecked)
  }

  // Filter rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      const matchSearch = search ? r.nama.toLowerCase().includes(search.toLowerCase()) : true
      const matchStatus = statusFilter !== 'all' ? r.tingkat === statusFilter : true
      return matchSearch && matchStatus
    })
  }, [rows, search, statusFilter])

  const buatDraft = () => {
    if (selectedRows.length === 0) return
    sessionStorage.setItem('po_draft_items', JSON.stringify(
      selectedRows.map((r) => ({ bahan_baku_id: r.bahan_baku_id, nama: r.nama, satuan: r.satuan, qty: r.qty_saran }))
    ))
    router.push('/pembelian/new?from=suggestion')
  }

  if (loading) {
    return (
      <div className="p-16 flex flex-col items-center justify-center text-suka-gray-400 font-medium">
        <Spinner className="w-8 h-8 text-suka-orange" />
        <span className="mt-3 text-xs font-bold text-suka-brown">Memuat analisis usulan pembelian…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <PageHeader
        title="Usulan Bahan Baku (Perlu Dibeli)"
        description="Rekomendasi kuantitas pembelian otomatis berdasarkan sisa stok riil, threshold, dan permintaan cabang."
      >
        <button
          onClick={buatDraft}
          disabled={selectedCount === 0}
          className="mt-3 sm:mt-0 flex items-center justify-center gap-2.5 bg-gradient-to-r from-suka-brown to-suka-ink text-white font-extrabold px-6 py-3 rounded-2xl hover:from-suka-ink hover:to-black active:scale-[.98] transition-all text-sm shadow-[0_8px_20px_rgba(44,24,16,0.15)] disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
        >
          <ShoppingCart className="w-4 h-4 text-suka-orange" />
          <span>Buat Draft PO ({selectedCount})</span>
          {selectedCount > 0 && <ArrowRight className="w-4 h-4 ml-1" />}
        </button>
      </PageHeader>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Total Usulan Items"
          value={<CountUp end={rows.length} duration={1} />}
          sub="Jenis Bahan Baku Terdata"
          icon={Package}
          accent="brown"
        />
        <StatTile
          label="Stok Mendesak"
          value={<CountUp end={mendesakCount} duration={1} />}
          sub="Butuh Restok Segera"
          icon={AlertTriangle}
          accent="red"
        />
        <StatTile
          label="Stok Menipis"
          value={<CountUp end={menipisCount} duration={1} />}
          sub="Mendekati Limit Threshold"
          icon={AlertCircle}
          accent="orange"
        />
        <StatTile
          label="Draft PO Dipilih"
          value={<CountUp end={selectedCount} duration={1} />}
          sub="Siap Diproses Ke PO"
          icon={CheckCircle2}
          accent="green"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white/60 backdrop-blur-xl rounded-2xl border border-suka-gray-200/60 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-suka-gray-400" />
            <input
              type="text"
              placeholder="Cari nama bahan baku (misal: SAPI, MINYAK)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs font-bold text-suka-ink bg-white shadow-inner border border-suka-gray-200 rounded-xl focus:outline-none focus:border-suka-orange focus:ring-4 focus:ring-suka-orange/10 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all border ${
                statusFilter === 'all'
                  ? 'bg-suka-brown text-white border-suka-brown shadow-xs'
                  : 'bg-white text-suka-gray-600 border-suka-gray-200 hover:bg-suka-gray-50'
              }`}
            >
              Semua ({rows.length})
            </button>
            <button
              onClick={() => setStatusFilter('mendesak')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all border ${
                statusFilter === 'mendesak'
                  ? 'bg-red-600 text-white border-red-600 shadow-xs'
                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Mendesak ({mendesakCount})
            </button>
            <button
              onClick={() => setStatusFilter('menipis')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all border ${
                statusFilter === 'menipis'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
              }`}
            >
              Menipis ({menipisCount})
            </button>
            <button
              onClick={() => setStatusFilter('aman')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all border ${
                statusFilter === 'aman'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Aman ({amanCount})
            </button>
          </div>

          {/* Quick Select Action */}
          {mendesakCount > 0 && (
            <button
              onClick={selectMendesak}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-orange-50 text-suka-orange border border-orange-200/80 hover:bg-orange-100 active:scale-95 transition-all shadow-2xs shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Centang Semua Mendesak
            </button>
          )}
        </div>
      </div>

      {/* Glassmorphism Table Container */}
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl border border-suka-gray-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-suka-cream/40 text-suka-gray-500 text-[9px] font-black uppercase tracking-widest border-b border-suka-gray-100">
                <th className="py-4 px-5 text-center w-12">Pilih</th>
                <th className="py-4 px-5">Nama Bahan Baku</th>
                <th className="py-4 px-5 text-right">Stok Riil Saat Ini</th>
                <th className="py-4 px-5 text-right">Threshold Min.</th>
                <th className="py-4 px-5 text-right">Est. Sisa Hari</th>
                <th className="py-4 px-5 text-right">Permintaan Cabang</th>
                <th className="py-4 px-5 text-right">Sudah Dipesan</th>
                <th className="py-4 px-5 text-right">Qty Saran Pembelian</th>
                <th className="py-4 px-5 text-center">Status Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-suka-gray-100 text-xs">
              {(() => {
                if (filteredRows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-suka-gray-400 space-y-2">
                        <Package className="w-10 h-10 mx-auto text-suka-gray-300" />
                        <p className="font-extrabold text-suka-brown text-sm">Tidak ada usulan bahan baku</p>
                        <p className="text-xs text-suka-gray-400">Tidak ada item yang sesuai dengan filter atau kata kunci pencarian.</p>
                      </td>
                    </tr>
                  )
                }

                const grouped = filteredRows.reduce((acc, r) => {
                  let k = r.kategori || 'lainnya'
                  if (k.toLowerCase() === 'lain-lain') k = 'lainnya'
                  if (!acc[k]) acc[k] = []
                  acc[k].push(r)
                  return acc
                }, {} as Record<string, typeof filteredRows>)

                const CATEGORY_ORDER = ['item core', 'bumbu', 'kemasan', 'minuman', 'lainnya']
                const sortedGroups = Object.entries(grouped).sort(([catA], [catB]) => {
                  const iA = CATEGORY_ORDER.indexOf(catA.toLowerCase())
                  const iB = CATEGORY_ORDER.indexOf(catB.toLowerCase())
                  if (iA !== -1 && iB !== -1) return iA - iB
                  if (iA !== -1) return -1
                  if (iB !== -1) return 1
                  return catA.localeCompare(catB)
                })

                return sortedGroups.map(([kategori, items]) => (
                  <Fragment key={kategori}>
                    {/* Sub-header Kategori */}
                    <tr className="bg-suka-brown/5 text-suka-brown font-black text-xs uppercase tracking-widest border-y border-suka-brown/10">
                      <td colSpan={9} className="py-3 px-6 bg-gradient-to-r from-suka-cream/60 via-transparent to-transparent">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-suka-orange" />
                          Kategori: {kategori} ({items.length} Item)
                        </span>
                      </td>
                    </tr>

                    {/* Table Rows */}
                    {items.map((r) => {
                      const isSelected = !!checked[r.bahan_baku_id]
                      const badgeMeta = BADGE_STYLE[r.tingkat] ?? BADGE_STYLE.aman
                      const isMendesak = r.tingkat === 'mendesak'

                      return (
                        <tr 
                          key={r.bahan_baku_id} 
                          onClick={() => toggle(r.bahan_baku_id)}
                          className={`transition-all duration-200 cursor-pointer ${
                            isSelected 
                              ? 'bg-orange-50/70 font-semibold' 
                              : 'hover:bg-white/80'
                          }`}
                        >
                          <td className="py-3.5 px-5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={isSelected} 
                              onChange={() => toggle(r.bahan_baku_id)} 
                              className="w-4 h-4 rounded text-suka-orange focus:ring-suka-orange cursor-pointer"
                            />
                          </td>
                          <td className="py-3.5 px-5">
                            <div className="font-extrabold text-suka-brown text-sm">{r.nama}</div>
                            {r.bahan_baku?.satuan_tengah && r.bahan_baku?.faktor_tengah ? (
                              <div className="text-[10px] text-suka-gray-400 mt-0.5 font-medium tracking-wide">
                                1 {r.satuan} = {r.bahan_baku.faktor_tengah} {r.bahan_baku.satuan_tengah}
                                {r.bahan_baku.satuan_kecil && r.bahan_baku.faktor_tampilan ? 
                                  ` \u2022 1 ${r.bahan_baku.satuan_tengah} = ${r.bahan_baku.faktor_tampilan} ${r.bahan_baku.satuan_kecil}` 
                                : ''}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-suka-ink whitespace-nowrap">
                            {formatStok(
                              r.stok,
                              r.satuan,
                              r.bahan_baku?.satuan_tengah,
                              r.bahan_baku?.faktor_tengah,
                              r.bahan_baku?.satuan_kecil,
                              r.bahan_baku?.faktor_tampilan
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right font-semibold text-suka-gray-500">
                            {r.threshold} {r.satuan}
                          </td>
                          <td className="py-3.5 px-5 text-right font-bold text-suka-brown">
                            {r.days_left != null ? (
                              <span className={r.days_left <= 3 ? 'text-red-600 font-extrabold' : 'text-suka-brown'}>
                                {r.days_left} hari
                              </span>
                            ) : (
                              <span className="text-suka-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-right font-semibold text-suka-gray-600 whitespace-nowrap">
                            {r.permintaan_pending ? formatStok(
                              r.permintaan_pending,
                              r.satuan,
                              r.bahan_baku?.satuan_tengah,
                              r.bahan_baku?.faktor_tengah,
                              r.bahan_baku?.satuan_kecil,
                              r.bahan_baku?.faktor_tampilan
                            ) : <span className="text-suka-gray-300">—</span>}
                          </td>
                          <td className="py-3.5 px-5 text-right font-semibold text-suka-gray-600 whitespace-nowrap">
                            {r.sudah_dipesan ? formatStok(
                              r.sudah_dipesan,
                              r.satuan,
                              r.bahan_baku?.satuan_tengah,
                              r.bahan_baku?.faktor_tengah,
                              r.bahan_baku?.satuan_kecil,
                              r.bahan_baku?.faktor_tampilan
                            ) : <span className="text-suka-gray-300">—</span>}
                          </td>
                          <td className="py-3.5 px-5 text-right font-black text-suka-brown whitespace-nowrap text-sm bg-suka-cream/20">
                            {formatStok(
                              r.qty_saran,
                              r.satuan,
                              r.bahan_baku?.satuan_tengah,
                              r.bahan_baku?.faktor_tengah,
                              r.bahan_baku?.satuan_kecil,
                              r.bahan_baku?.faktor_tampilan
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${badgeMeta.bg} ${badgeMeta.text} ${badgeMeta.border} shadow-2xs`}>
                              {isMendesak && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />}
                              {badgeMeta.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
