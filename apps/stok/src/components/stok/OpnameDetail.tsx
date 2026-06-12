'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import type { Opname, OpnameItem } from '@/types/stok'
import { useBahanBaku } from '@/hooks/useBahanBaku'

const TIPE_LABEL: Record<string, string> = {
  harian: 'Harian 📅',
  mingguan: 'Mingguan 📆',
  ad_hoc: 'Ad Hoc ⚡',
};

export function OpnameDetail({ opnameId }: { opnameId: string }) {
  const [opname, setOpname] = useState<Opname | null>(null)
  const [items, setItems] = useState<OpnameItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const { bahanBaku, loading: bahanLoading } = useBahanBaku()

  const bahanMap = useMemo(() => {
    const map: Record<string, { nama: string; satuan: string; kategori: string }> = {}
    for (const b of bahanBaku) {
      map[b.id] = { nama: b.nama, satuan: b.satuan, kategori: b.kategori }
    }
    return map
  }, [bahanBaku])

  useEffect(() => {
    setError(null)
    const supabase = createClient()
    const load = async () => {
      try {
        const [opnameRes, itemsRes] = await Promise.all([
          supabase.from('opname').select('*, outlet_staff(name)').eq('id', opnameId).single(),
          supabase.from('opname_item').select('*').eq('opname_id', opnameId)
        ])
        
        if (opnameRes.error) throw opnameRes.error
        if (itemsRes.error) throw itemsRes.error

        setOpname(opnameRes.data as Opname)
        setItems((itemsRes.data as OpnameItem[]) ?? [])
      } catch (err: any) {
        setError(`Gagal memuat detail opname: ${err.message || err}`)
      }
    }
    load()
  }, [opnameId])

  if (error) return <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-4 rounded-xl">{error}</p>
  if (!opname || bahanLoading) return <div className="text-center py-12 text-xs font-bold text-[#544437]/50 animate-pulse">Memuat Detail Opname...</div>

  const isFinalized = opname.status === 'finalized';
  const formattedDate = new Date(opname.tanggal).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Overview Metadata Card */}
      <div className="bg-white border border-[#d9c2b2]/45 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)] p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-[#d9c2b2]/20 pb-4">
          <div>
            <span className="text-[9px] font-black text-[#544437]/50 uppercase tracking-widest leading-none">ID OPNAME</span>
            <p className="text-xs font-mono font-bold text-gray-500 mt-1.5 leading-none truncate max-w-[150px] lg:max-w-xs">{opname.id}</p>
          </div>
          {isFinalized ? (
            <span className="bg-[#93f997]/15 text-[#006e24] border border-[#93f997]/25 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
              Selesai
            </span>
          ) : (
            <span className="bg-[#ffdcc2] text-[#904d00] border border-[#ffdcc2]/10 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
              Draft
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-2.5">
            <span className="text-xs font-bold text-[#544437]/70">Tanggal Opname</span>
            <span className="text-xs font-bold text-[#1e1b15]">{formattedDate}</span>
          </div>

          <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-2.5">
            <span className="text-xs font-bold text-[#544437]/70">Tipe Opname</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-2.5 py-0.5 rounded border border-[#d9c2b2]/30">
              {TIPE_LABEL[opname.tipe] || opname.tipe}
            </span>
          </div>

          {opname.outlet_staff?.name && (
            <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-2.5">
              <span className="text-xs font-bold text-[#544437]/70">Petugas Pencatat</span>
              <span className="text-xs font-bold text-[#701604] uppercase">{opname.outlet_staff.name}</span>
            </div>
          )}

          {opname.notes && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-xs font-bold text-[#544437]/70">Catatan</span>
              <span className="text-xs font-medium text-gray-600 bg-[#fff8f1]/50 p-2.5 rounded-lg border border-[#d9c2b2]/20">
                {opname.notes}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Opname Items Log List */}
      <div className="space-y-3">
        <h3 className="text-xs font-black text-[#544437]/50 uppercase tracking-widest pl-1">Daftar Item Opname</h3>
        <div className="space-y-2.5">
          {items.map(it => {
            const bahan = bahanMap[it.bahan_baku_id];
            const name = bahan ? bahan.nama : `Bahan ${it.bahan_baku_id.slice(0, 8)}`;
            const unit = bahan ? bahan.satuan : '';
            const category = bahan ? bahan.kategori : '';
            
            let qtyFisikText = it.qty_fisik !== null ? `${it.qty_fisik} ${unit}` : '-';

            return (
              <div
                key={it.id}
                className={`p-4 rounded-xl border flex justify-between items-center transition-all duration-200 ${
                  it.flagged
                    ? 'bg-[#ffdad6]/10 border-[#ba1a1a]/30 shadow-[0_2px_8px_rgba(186,26,26,0.03)]'
                    : 'bg-white border-[#d9c2b2]/45 shadow-[0_2px_8px_rgba(144,77,0,0.015)] hover:border-[#f29744]/30'
                }`}
              >
                {/* Left: Material Name and Category Badge */}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-1.5 py-0.5 rounded border border-[#d9c2b2]/25">
                      {category || 'Bahan'}
                    </span>
                    {it.flagged && (
                      <span className="text-[8px] font-bold uppercase bg-[#ffdad6] text-[#ba1a1a] px-1.5 py-0.5 rounded border border-[#ba1a1a]/10">
                        ⚠️ Selisih Kritis
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-[#1e1b15] text-xs uppercase tracking-wide truncate">
                    {name}
                  </h4>
                  <p className="text-[9px] text-[#544437]/65">
                    Fisik: <span className="font-bold text-[#1e1b15]">{qtyFisikText}</span> • Sistem: <span className="font-semibold">{it.qty_system} {unit}</span>
                  </p>
                  {it.catatan && (
                    <p className="text-[8px] text-gray-500 font-medium italic mt-0.5">
                      * {it.catatan}
                    </p>
                  )}
                </div>

                {/* Right: Discrepancy indicator */}
                <div className="text-right flex-shrink-0 pl-3">
                  {it.qty_fisik === null ? (
                    <span className="text-[10px] text-gray-400 font-bold italic">Belum terhitung</span>
                  ) : it.selisih === 0 ? (
                    <span className="text-[10px] text-gray-500 font-bold bg-[#faf2e9]/50 border border-[#d9c2b2]/20 px-2.5 py-0.5 rounded">
                      Pas (0)
                    </span>
                  ) : (
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded border ${
                      it.flagged
                        ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/15 font-black animate-pulse-subtle'
                        : it.selisih < 0
                          ? 'bg-orange-50 text-orange-700 border-orange-100'
                          : 'bg-green-50 text-green-700 border-green-100'
                    }`}>
                      {it.selisih > 0 ? '+' : ''}{it.selisih} {unit}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
