import React from 'react'
import { 
  X, 
  TrendingUp
} from 'lucide-react'
import { useBahanBakuPriceHistory } from '@/hooks/useBahanBakuPriceHistory'
import { formatRupiah } from './HargaBahanTable'
import type { FluktuasiHargaItem } from '@/hooks/useFluktuasiHarga'
import { Spinner } from '@suka/design-system'

interface HargaBahanDetailModalProps {
  item: FluktuasiHargaItem | null
  isOpen: boolean
  onClose: () => void
}

export function HargaBahanDetailModal({
  item,
  isOpen,
  onClose
}: HargaBahanDetailModalProps) {
  const { poHistory, isLoading } = useBahanBakuPriceHistory(item?.bahan_baku_id ?? null)

  if (!isOpen || !item) return null

  // Data for chart: gabungkan poHistory kronologis ASC
  const chartPoints = [...poHistory].reverse()
  const priceValues = chartPoints.map((p) => p.harga_terima)

  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 100000
  const priceRange = maxPrice - minPrice === 0 ? 1000 : maxPrice - minPrice

  // SVG Chart dimensions
  const svgWidth = 650
  const svgHeight = 180
  const padX = 40
  const padY = 25
  const graphWidth = svgWidth - padX * 2
  const graphHeight = svgHeight - padY * 2

  const getY = (val: number) => svgHeight - padY - ((val - minPrice) / priceRange) * graphHeight
  const getX = (idx: number, total: number) =>
    total <= 1 ? svgWidth / 2 : padX + (idx / (total - 1)) * graphWidth

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-[#fffdfa] rounded-3xl border border-suka-brown/15 shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Modal */}
        <div className="p-5 md:p-6 border-b border-suka-brown/10 bg-white flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-suka-cream text-suka-brown font-mono text-[10px] font-black uppercase">
                {item.kode || 'SKU'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-suka-orange/10 text-suka-orange text-[10px] font-black uppercase">
                {item.kategori_nama}
              </span>
            </div>
            <h2 className="text-xl font-black text-suka-brown font-display">{item.nama}</h2>
            <p className="text-xs text-suka-brown/70 flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
              <span>Satuan: <strong className="text-suka-brown">{item.satuan || 'PCS'}</strong></span>
              <span>·</span>
              <span>Harga Master: <strong className="text-suka-brown">{item.harga_master != null ? formatRupiah(item.harga_master) : '—'}</strong></span>
              <span>·</span>
              <span>
                PO Terakhir:{' '}
                <strong className={item.harga_terakhir ? "text-suka-orange" : "text-suka-brown/50"}>
                  {item.harga_terakhir ? formatRupiah(item.harga_terakhir) : 'Belum ada PO'}
                </strong>
              </span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-suka-cream/50 text-suka-brown/60 hover:text-suka-brown hover:bg-suka-cream transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
          {/* Section 1: Grafik Tren Riwayat Pembelian */}
          <div className="bg-white rounded-2xl border border-suka-brown/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-suka-brown uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-suka-orange" />
                Grafik Riwayat Harga Pembelian Vendor
              </h3>
              <div className="text-[10px] font-bold text-suka-brown/60">
                {chartPoints.length} Transaksi Tercatat
              </div>
            </div>

            {chartPoints.length > 0 ? (
              <div className="w-full overflow-x-auto">
                <svg
                  width={svgWidth}
                  height={svgHeight}
                  className="mx-auto overflow-visible"
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                >
                  {/* Grid Lines */}
                  <line x1={padX} y1={padY} x2={svgWidth - padX} y2={padY} stroke="#e5e0dc" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1={padX} y1={svgHeight - padY} x2={svgWidth - padX} y2={svgHeight - padY} stroke="#e5e0dc" strokeWidth="1" />

                  {/* Price Trend Polyline */}
                  {chartPoints.length > 1 && (
                    <path
                      d={chartPoints.reduce((acc, pt, idx) => {
                        const x = getX(idx, chartPoints.length)
                        const y = getY(pt.harga_terima)
                        return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`
                      }, '')}
                      fill="none"
                      stroke="#f29744"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Points & Labels */}
                  {chartPoints.map((pt, idx) => {
                    const x = getX(idx, chartPoints.length)
                    const y = getY(pt.harga_terima)
                    return (
                      <g key={pt.id} className="group">
                        <circle
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#f29744"
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="transition-all hover:r-6 cursor-pointer"
                        />
                        <text
                          x={x}
                          y={y - 8}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill="#701604"
                        >
                          {formatRupiah(pt.harga_terima)}
                        </text>
                        <text
                          x={x}
                          y={svgHeight - 8}
                          textAnchor="middle"
                          fontSize="8"
                          fontWeight="bold"
                          fill="#877365"
                        >
                          {new Date(pt.tanggal_po).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
            ) : (
              <div className="py-10 text-center text-suka-brown/40 text-xs font-bold">
                Belum ada riwayat transaksi pembelian PO yang tercatat.
              </div>
            )}
          </div>

          {/* Section 2: Tabel Riwayat Pembelian PO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-suka-brown/10 pb-2">
              <h3 className="text-xs font-black text-suka-brown uppercase tracking-wider">
                Daftar Riwayat Invoice / PO Masuk ({poHistory.length})
              </h3>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner className="w-6 h-6 text-suka-orange" />
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-suka-brown/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-suka-cream/40 text-suka-brown/70 text-[9px] uppercase font-black tracking-widest border-b border-suka-brown/10">
                        <th className="py-3 px-4">Tgl & No PO</th>
                        <th className="py-3 px-4">Vendor / Supplier</th>
                        <th className="py-3 px-4 text-right">Kuantitas</th>
                        <th className="py-3 px-4 text-right">Harga Beli</th>
                        <th className="py-3 px-4 text-right">Perubahan vs Prev</th>
                        <th className="py-3 px-4 text-right">Total Belanja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-suka-brown/5">
                      {poHistory.map((row) => (
                        <tr key={row.id} className="hover:bg-suka-cream/20 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-suka-brown">
                              {new Date(row.tanggal_po).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-[10px] font-mono text-suka-brown/60">
                              {row.nomor_po}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-extrabold text-suka-brown">
                            {row.supplier_nama}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-suka-brown">
                            {row.qty_terima} {item.satuan || ''}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-suka-brown text-sm">
                            {formatRupiah(row.harga_terima)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {row.selisih_pct !== null ? (
                              <span
                                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black ${
                                  row.selisih_pct > 0
                                    ? 'bg-red-50 text-red-600'
                                    : row.selisih_pct < 0
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-gray-50 text-gray-600'
                                }`}
                              >
                                {row.selisih_pct > 0 ? '+' : ''}
                                {(row.selisih_pct * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-suka-brown/30">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-suka-brown/80">
                            {formatRupiah(row.subtotal)}
                          </td>
                        </tr>
                      ))}

                      {poHistory.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-suka-brown/50">
                            Belum ada riwayat pembelian PO untuk bahan baku ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 md:p-5 border-t border-suka-brown/10 bg-white flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-suka-cream text-xs font-bold text-suka-brown hover:bg-suka-cream/80 transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
