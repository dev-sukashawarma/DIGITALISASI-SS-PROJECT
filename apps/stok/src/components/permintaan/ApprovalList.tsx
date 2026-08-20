'use client'
import { useState, useEffect, useMemo } from 'react'
import { useApprovalList } from '@/hooks/usePermintaan'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { useOutletBudgetStatus } from '@/hooks/useOutletBudget'
import { estimateCartValue } from '@/app/actions/budget'
import { convertToDistribusiUnit } from '@/lib/format/compositeUnit'
import type { PermintaanWithItems, PermintaanItem } from '@/types/permintaan'
import type { BahanBaku } from '@/types/stok'
import { ApprovalModal } from './ApprovalModal'
import { BudgetBadge } from './BudgetBadge'

interface Props {
  canApprove?: boolean
}

function ApprovalCardBudget({ outletId, items, bahanBakuMap }: {
  outletId: string
  items: PermintaanItem[]
  bahanBakuMap: Map<string, BahanBaku>
}) {
  const { status } = useOutletBudgetStatus(outletId)
  const [estimate, setEstimate] = useState(0)

  useEffect(() => {
    if (!status?.hasConfig || items.length === 0) {
      setEstimate(0)
      return
    }
    const payload = items.map(it => {
      const b = bahanBakuMap.get(it.bahan_baku_id)
      const qtyDist = b ? Math.ceil(convertToDistribusiUnit(it.qty_diminta, b)) : it.qty_diminta
      return { bahan_baku_id: it.bahan_baku_id, qty: qtyDist }
    })
    estimateCartValue(payload).then(r => setEstimate(r.totalNilai)).catch(() => setEstimate(0))
  }, [status?.hasConfig, items, bahanBakuMap])

  if (!status) return null
  return <BudgetBadge status={status} projectedAdd={estimate} compact />
}

export function ApprovalList({ canApprove = true }: Props) {
  const { permintaan, loading, error, refresh } = useApprovalList()
  const { bahanBaku } = useBahanBaku()
  const [selected, setSelected] = useState<PermintaanWithItems | null>(null)
  const bahanBakuMap = useMemo(() => new Map(bahanBaku.map(b => [b.id, b])), [bahanBaku])

  if (loading) return <p className="text-xs text-suka-brown/60">Memuat antrean permintaan…</p>
  if (error) return <p className="text-xs text-red-600 font-bold">{error}</p>
  if (permintaan.length === 0)
    return (
      <div className="bg-white border border-suka-brown/10 rounded-2xl p-6 text-center shadow-xs">
        <p className="text-xs text-suka-brown/60">Tidak ada permintaan bahan baku yang menunggu persetujuan.</p>
      </div>
    )

  return (
    <>
      {!canApprove && (
        <div
          role="status"
          className="bg-suka-cream/50 border border-suka-brown/10 rounded-2xl p-4 mb-3 flex gap-3 items-start"
        >
          <span className="text-base leading-none mt-0.5">👁️</span>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-suka-brown">Mode pantau — tanpa hak persetujuan</p>
            <p className="text-[11px] text-suka-brown/70 leading-relaxed">
              Anda bisa melihat antrean permintaan, tetapi keputusan persetujuan ada di
              Gudang Pusat (kitchen).
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {permintaan.map(p => {
          const reqCode = `#REQ-${p.id.slice(0, 4).toUpperCase()}`
          
          let omzetKotor = 0
          if (Array.isArray(p.target_metadata)) {
            omzetKotor = p.target_metadata.reduce((acc, tm) => acc + (tm.qty * (tm.harga_jual || 0)), 0)
          }
          
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className="bg-white border border-suka-brown/10 rounded-2xl p-4 md:p-5 shadow-2xs hover:bg-suka-cream/20 cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between group"
            >
              <div className="space-y-2 flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black bg-suka-cream text-suka-orange px-2 py-0.5 rounded-md uppercase">
                    Menunggu Persetujuan
                  </span>
                  <span className="text-xs font-bold text-suka-brown/60">{reqCode}</span>
                  <ApprovalCardBudget
                    outletId={p.outlet_id}
                    items={p.items}
                    bahanBakuMap={bahanBakuMap}
                  />
                  {omzetKotor > 0 && (
                    <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                      Potensi Omzet: Rp {omzetKotor.toLocaleString('id-ID')}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-suka-brown text-sm sm:text-base truncate group-hover:text-suka-orange transition-colors">
                      {p.outlet_name ?? p.outlet_id}
                    </h3>
                    {p.staff_name && (
                      <span className="text-[10px] font-bold text-suka-brown/60 bg-suka-cream/60 px-2 py-0.5 rounded-full border border-suka-brown/10">
                        Oleh: {p.staff_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-suka-brown/80 mt-0.5">
                    {p.items.length} jenis bahan baku
                  </p>
                  <div className="mt-2 space-y-1">
                    {p.items.slice(0, 3).map(it => {
                      const b = bahanBaku.find(x => x.id === it.bahan_baku_id);
                      const distUnit = b?.satuan_distribusi || it.satuan || '';
                      const qtyDiminta = b ? Math.ceil(convertToDistribusiUnit(it.qty_diminta, b)) : it.qty_diminta;
                      return (
                      <div key={it.bahan_baku_id} className="text-[11px] text-suka-brown/80 flex justify-between items-center bg-suka-cream/30 px-2.5 py-1 rounded-lg border border-suka-brown/5">
                        <span className="truncate pr-2 font-medium">{it.nama ?? it.bahan_baku_id}</span>
                        <span className="font-black whitespace-nowrap text-suka-brown">{qtyDiminta} {distUnit}</span>
                      </div>
                      );
                    })}
                    {p.items.length > 3 && (
                      <p className="text-[10px] text-suka-brown/50 italic px-1">
                        +{p.items.length - 3} item lainnya...
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-suka-orange group-hover:translate-x-0.5 transition-transform inline-block">
                  Periksa →
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <ApprovalModal
          permintaan={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null)
            refresh()
          }}
          canApprove={canApprove}
        />
      )}
    </>
  )
}
