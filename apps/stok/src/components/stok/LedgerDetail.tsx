'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card } from '@suka/design-system'

const LABEL_MAP: Record<string, string> = {
  terima_kiriman: 'Terima Kiriman',
  pemakaian: 'Pemakaian',
  waste: 'Waste',
  adjustment: 'Penyesuaian',
  opname_selisih: 'Selisih Opname',
  transfer_keluar: 'Transfer Keluar',
  transfer_masuk: 'Transfer Masuk',
};

export function LedgerDetail({ ledgerId }: { ledgerId: string }) {
  const [l, setL] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    const supabase = createClient()
    const load = async () => {
      try {
        const { data, error: err } = await supabase
          .from('ledger_stok')
          .select('*, bahan_baku(nama, satuan)')
          .eq('id', ledgerId)
          .single()
        if (err) throw err
        setL(data)
      } catch (err: any) {
        setError(`Gagal muat ledger: ${err.message || err}`)
      }
    }
    load()
  }, [ledgerId])

  if (error) return <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-4 rounded-xl">{error}</p>
  if (!l) return <div className="text-center py-8 text-xs font-bold text-[#544437]/50 animate-pulse">Memuat Detail...</div>

  const isPositive = l.qty > 0;
  const unit = l.bahan_baku?.satuan || '';

  const getTipeBadge = (tipe: string) => {
    let style = 'bg-[#faf2e9] text-[#701604] border-[#d9c2b2]/40';
    if (tipe === 'terima_kiriman' || tipe === 'transfer_masuk') {
      style = 'bg-[#93f997]/15 text-[#006e24] border-[#93f997]/25';
    } else if (tipe === 'waste' || tipe === 'pemakaian') {
      style = 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/10';
    } else if (tipe === 'transfer_keluar') {
      style = 'bg-[#ffdcc2] text-[#904d00] border-[#ffdcc2]/10';
    }
    return (
      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${style}`}>
        {LABEL_MAP[tipe] || tipe}
      </span>
    );
  };

  return (
    <Card className="p-6 border border-[#d9c2b2]/45 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)] space-y-5 bg-white">
      <div className="flex justify-between items-center border-b border-[#d9c2b2]/20 pb-4">
        <div>
          <span className="text-[9px] font-black text-[#544437]/50 uppercase tracking-widest leading-none">ID LOG</span>
          <p className="text-xs font-mono font-bold text-gray-500 mt-1.5 leading-none truncate max-w-[150px] lg:max-w-xs">{l.id}</p>
        </div>
        {getTipeBadge(l.tipe)}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-3.5">
          <span className="text-xs font-bold text-[#544437]/70">Waktu Transaksi</span>
          <span className="text-xs font-semibold text-[#1e1b15]">
            {new Date(l.created_at).toLocaleString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-3.5">
          <span className="text-xs font-bold text-[#544437]/70">Bahan Baku</span>
          <span className="text-xs font-extrabold text-[#701604] uppercase">
            {l.bahan_baku?.nama || 'Memuat...'}
          </span>
        </div>

        <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-3.5">
          <span className="text-xs font-bold text-[#544437]/70">Jumlah Perubahan</span>
          <span className={`text-sm font-bold ${isPositive ? 'text-[#0a7d2c]' : 'text-[#ba1a1a]'}`}>
            {isPositive ? '+' : ''}{l.qty} <span className="text-xs font-medium text-[#544437]/60">{unit}</span>
          </span>
        </div>

        <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-3.5">
          <span className="text-xs font-bold text-[#544437]/70">Mutasi Saldo</span>
          <span className="text-xs font-semibold text-[#1e1b15]">
            {l.saldo_sebelum} {unit} → <span className="font-bold">{l.saldo_sesudah} {unit}</span>
          </span>
        </div>

        {l.catatan && (
          <div className="flex flex-col gap-1.5 border-b border-[#d9c2b2]/10 pb-3.5">
            <span className="text-xs font-bold text-[#544437]/70">Catatan</span>
            <span className="text-xs font-medium text-gray-600 bg-[#fff8f1]/50 p-2.5 rounded-lg border border-[#d9c2b2]/20">
              {l.catatan}
            </span>
          </div>
        )}

        {l.ref_shipment_id && (
          <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-3.5">
            <span className="text-xs font-bold text-[#544437]/70">Referensi Kiriman</span>
            <span className="text-xs font-mono font-bold text-gray-500 truncate max-w-[150px]">{l.ref_shipment_id}</span>
          </div>
        )}

        {l.ref_opname_id && (
          <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-3.5">
            <span className="text-xs font-bold text-[#544437]/70">Referensi Opname</span>
            <span className="text-xs font-mono font-bold text-gray-500 truncate max-w-[150px]">{l.ref_opname_id}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
