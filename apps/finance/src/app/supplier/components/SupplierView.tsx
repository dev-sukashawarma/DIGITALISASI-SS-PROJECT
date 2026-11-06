'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Banknote, Clock, CheckCircle2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useCashOverview } from '@/hooks/useCashData'
import {
  usePayablePos, useTxBayarPo, useAjukanBayarPo, useTolakBayarPo,
  type PayablePo,
} from '@/hooks/useSupplierSettlement'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { lokasiGrup } from '@/lib/kas/grupKas'
import { rupiah, tanggal, tanggalWaktu } from '@/lib/format'
import { StatCard, SectionCard } from '@/components/ui'
import { BuktiModal } from '@/app/mutasi/components/BuktiModal'
import { SetujuiBayarVendorModal } from '@/components/approval/SetujuiBayarVendorModal'

type Tab = 'pending' | 'unpaid' | 'paid'

const TAB_LABEL: Record<Tab, string> = {
  pending: 'Menunggu approval',
  unpaid: 'Belum diajukan',
  paid: 'Lunas',
}

/**
 * Pembayaran vendor: purchasing mengajukan PO yang sudah diterima, admin finance mentransfer
 * dari Rekening Bahan Baku Bank lalu menyetujui dengan bukti. Saldo terpotong saat disetujui.
 */
export function SupplierView() {
  const supabase = useMemo(() => createClient(), [])
  const { locations } = useCashOverview()
  const rekening = lokasiGrup(locations, 'bahan_baku', 'bank')[0]
  const { data: pos = [], isLoading } = usePayablePos()
  const { data: txs = {} } = useTxBayarPo()
  const { isChecker, canAjukanBayarPO } = useFinanceRole()
  const ajukan = useAjukanBayarPo()
  const tolak = useTolakBayarPo()
  const [tab, setTab] = useState<Tab>('pending')
  const [setujuiPo, setSetujuiPo] = useState<PayablePo | null>(null)
  const [bukti, setBukti] = useState<{ url: string; judul: string } | null>(null)

  const per = (s: Tab) => pos.filter((p) => p.payment_status === s)
  const jumlah = (s: Tab) => per(s).reduce((a, p) => a + p.total, 0)
  const daftar = per(tab)

  const ajukanPo = (p: PayablePo) => {
    const catatan = window.prompt(`Ajukan pembayaran ${p.nomor_po} (${rupiah(p.total)}) ke admin finance.\nCatatan (opsional):`, '')
    if (catatan === null) return
    ajukan.mutate({ poId: p.id, catatan }, {
      onSuccess: () => toast.success(`${p.nomor_po} diajukan, menunggu approval admin finance`),
      onError: (e) => toast.error((e as Error).message),
    })
  }

  const tolakPo = (p: PayablePo) => {
    const alasan = window.prompt(`Alasan menolak pembayaran ${p.nomor_po}?`)
    if (!alasan?.trim()) return
    tolak.mutate({ poId: p.id, alasan }, {
      onSuccess: () => toast.success(`Pengajuan ${p.nomor_po} ditolak, PO kembali belum dibayar`),
      onError: (e) => toast.error((e as Error).message),
    })
  }

  const lihatBukti = (path: string, judul: string) => {
    const url = /^https?:\/\//.test(path) ? path : supabase.storage.from('finance-proofs').getPublicUrl(path).data.publicUrl
    setBukti({ url, judul })
  }

  return (
    <div className="space-y-8 font-sans">
      <div>
        <p className="text-suka-orange font-bold uppercase tracking-wider text-sm mb-1">Pembayaran</p>
        <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide">Pembayaran Vendor</h1>
        <p className="text-suka-ink/60 mt-2 font-medium">
          Purchasing mengajukan PO yang sudah diterima. Admin finance mentransfer dari Rekening Bahan Baku Bank,
          lalu menyetujui dengan bukti transfer. Saldo baru terpotong saat disetujui.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Menunggu approval" value={rupiah(jumlah('pending'))} icon={<Clock size={22} />} tone="orange" hint={`${per('pending').length} PO`} />
        <StatCard label="Belum diajukan" value={rupiah(jumlah('unpaid'))} icon={<Banknote size={22} />} tone="blue" hint={`${per('unpaid').length} PO`} />
        <StatCard
          label="Saldo Rekening Bahan Baku Bank"
          value={rekening ? rupiah(rekening.saldo) : '—'}
          icon={<CheckCircle2 size={22} />}
          tone="green"
          hint={rekening?.label}
        />
      </div>

      <SectionCard
        title="Daftar PO Diterima"
        action={
          <div className="flex gap-1 rounded-full bg-suka-gray-100 p-1 text-xs font-bold">
            {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1.5 ${tab === t ? 'bg-white text-suka-brown shadow-sm' : 'text-suka-gray-500 hover:text-suka-ink'}`}>
                {TAB_LABEL[t]} ({per(t).length})
              </button>
            ))}
          </div>
        }
      >
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : daftar.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">Tidak ada PO di tab ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  <th className="py-2 px-3">Nomor PO</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2">Tanggal PO</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 pl-4">{tab === 'paid' ? 'Dibayar' : tab === 'pending' ? 'Diajukan' : ''}</th>
                  <th className="py-2 pr-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {daftar.map((p) => {
                  const tx = txs[p.id]
                  return (
                    <tr key={p.id}>
                      <td className="py-3 px-3 font-semibold text-suka-ink">
                        <Link href={`/pembelian/${p.id}`} className="hover:text-suka-orange hover:underline">{p.nomor_po}</Link>
                      </td>
                      <td className="py-3 text-suka-gray-500">{p.supplier_nama}</td>
                      <td className="py-3 text-suka-gray-500">{tanggal(p.tanggal_po)}</td>
                      <td className="py-3 text-right font-bold text-suka-ink">{rupiah(p.total)}</td>
                      <td className="py-3 pl-4 text-xs text-suka-gray-500">
                        {tab === 'pending' && tx && (
                          <>
                            <div>{tx.pengaju ?? '—'} · {tanggalWaktu(tx.created_at)}</div>
                            {tx.note && <div className="text-suka-ink/70">{tx.note}</div>}
                          </>
                        )}
                        {tab === 'paid' && (
                          <>
                            <div>{p.paid_at ? tanggalWaktu(p.paid_at) : '—'}{tx?.penyetuju ? ` · ${tx.penyetuju}` : ''}</div>
                            {tx?.status === 'paid' ? (
                              tx.proof_url && (
                                <button onClick={() => lihatBukti(tx.proof_url!, `Bukti bayar ${p.nomor_po}`)} className="text-blue-600 underline">Bukti</button>
                              )
                            ) : (
                              <span className="text-amber-700">Ditandai lunas manual (tanpa transaksi kas)</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right whitespace-nowrap space-x-2">
                        {tab === 'unpaid' && canAjukanBayarPO && (
                          <Button onClick={() => ajukanPo(p)} disabled={ajukan.isPending} className="px-3 py-1 text-xs">Ajukan</Button>
                        )}
                        {tab === 'pending' && isChecker && (
                          <>
                            <Button onClick={() => setSetujuiPo(p)} className="px-3 py-1 text-xs">Setujui</Button>
                            <button onClick={() => tolakPo(p)} disabled={tolak.isPending} className="text-xs font-semibold text-red-600 hover:underline">Tolak</button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {setujuiPo && (
        <SetujuiBayarVendorModal po={setujuiPo} rekeningLabel={rekening?.label ?? 'Rekening Bahan Baku Bank'} saldo={rekening?.saldo ?? 0}
          onClose={() => setSetujuiPo(null)} />
      )}
      {bukti && <BuktiModal url={bukti.url} judul={bukti.judul} onClose={() => setBukti(null)} />}
    </div>
  )
}
