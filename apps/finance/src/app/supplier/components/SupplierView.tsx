'use client'

import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button, Spinner } from '@suka/design-system'
import { Banknote, Clock, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useCashOverview } from '@/hooks/useCashData'
import {
  usePayablePos, useTxBayarPo, useAjukanBayarPo, useTandaiPoLunasTanpaKas, useInvoicePerPo,
  type PayablePo,
} from '@/hooks/useSupplierSettlement'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { useUploadInvoice, getInvoiceUrl } from '@/hooks/usePurchaseOrder'
import { lokasiGrup } from '@/lib/kas/grupKas'
import { alasanDitolak, cocokPeriode, poSebelumKasBersih, type FilterPeriode } from '@/lib/kas/tagihanVendor'
import { rupiah, tanggal, tanggalWaktu } from '@/lib/format'
import { StatCard, SectionCard } from '@/components/ui'
import { BuktiModal } from '@/app/mutasi/components/BuktiModal'

type Tab = 'pending' | 'unpaid' | 'paid'

const TAB_LABEL: Record<Tab, string> = {
  unpaid: 'Belum diajukan',
  pending: 'Menunggu finance',
  paid: 'Lunas',
}

const PERIODE_LABEL: Record<FilterPeriode, string> = {
  semua: 'Semua',
  baru: 'Sejak 1 Nov',
  lama: 'Sebelum 1 Nov',
}

/**
 * Antrean tagihan vendor bersama purchasing & finance.
 * Purchasing mengajukan PO yang sudah diterima (satu atau banyak sekaligus); finance menyetujui
 * di Hub Approval dengan bukti, saldo baru terpotong saat itu. PO sebelum 1 Nov 2026 yang sudah
 * dibayar di luar sistem ditandai lunas oleh finance tanpa memotong saldo.
 */
export function SupplierView() {
  const supabase = useMemo(() => createClient(), [])
  const { locations } = useCashOverview()
  const rekening = lokasiGrup(locations, 'bahan_baku', 'bank')[0]
  const { data: pos = [], isLoading } = usePayablePos()
  const { data: txs = {} } = useTxBayarPo()
  const { data: invoices = {} } = useInvoicePerPo()
  const uploadInvoice = useUploadInvoice()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [unggahUntuk, setUnggahUntuk] = useState<PayablePo | null>(null)
  const adaInvoice = (id: string) => (invoices[id]?.length ?? 0) > 0
  const { isChecker, canAjukanBayarPO } = useFinanceRole()
  const ajukan = useAjukanBayarPo()
  const tandaiLunas = useTandaiPoLunasTanpaKas()
  const [tabPilihan, setTab] = useState<Tab | null>(null)
  const tab: Tab = tabPilihan ?? (isChecker ? 'pending' : 'unpaid')
  const [periode, setPeriode] = useState<FilterPeriode>('semua')
  const [pilih, setPilih] = useState<Set<string>>(new Set())
  const [sibuk, setSibuk] = useState(false)
  const [bukti, setBukti] = useState<{ url: string; judul: string } | null>(null)

  const per = (s: Tab) => pos.filter((p) => p.payment_status === s)
  const jumlah = (s: Tab) => per(s).reduce((a, p) => a + p.total, 0)
  const daftar = per(tab).filter((p) => tab !== 'unpaid' || cocokPeriode(p.tanggal_po, periode))
  const ditolak = per('unpaid').filter((p) => txs[p.id]?.status === 'rejected')

  const terpilih = daftar.filter((p) => pilih.has(p.id))
  const totalTerpilih = terpilih.reduce((a, p) => a + p.total, 0)
  const semuaLama = terpilih.length > 0 && terpilih.every((p) => poSebelumKasBersih(p.tanggal_po))
  const bolehPilih = tab === 'unpaid' && (canAjukanBayarPO || isChecker)

  const gantiTab = (t: Tab) => { setTab(t); setPilih(new Set()) }
  const togglePilih = (id: string) =>
    setPilih((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const togglePilihSemua = () =>
    setPilih(terpilih.length === daftar.length ? new Set() : new Set(daftar.map((p) => p.id)))

  const pilihFileInvoice = (p: PayablePo) => {
    setUnggahUntuk(p)
    fileRef.current?.click()
  }

  const unggahInvoice = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !unggahUntuk) return
    try {
      await uploadInvoice.mutateAsync({ poId: unggahUntuk.id, file })
      await qc.invalidateQueries({ queryKey: ['po_payable', 'invoice'] })
    } finally {
      setUnggahUntuk(null)
    }
  }

  const ajukanBanyak = async (semua: PayablePo[]) => {
    // Invoice wajib sebelum diajukan: finance butuh invoice saat menyetujui.
    const target = semua.filter((p) => adaInvoice(p.id))
    const tanpa = semua.length - target.length
    if (tanpa > 0) toast.error(`${tanpa} PO dilewati karena invoice belum diunggah`)
    if (target.length === 0) return
    const judul = target.length === 1
      ? `Ajukan pembayaran ${target[0].nomor_po} (${rupiah(target[0].total)}) ke admin finance.`
      : `Ajukan pembayaran ${target.length} PO (${rupiah(target.reduce((a, p) => a + p.total, 0))}) ke admin finance.`
    const catatan = window.prompt(`${judul}\nCatatan (opsional):`, '')
    if (catatan === null) return
    setSibuk(true)
    let berhasil = 0
    const gagal: string[] = []
    for (const p of target) {
      try {
        await ajukan.mutateAsync({ poId: p.id, catatan })
        berhasil++
      } catch (e) {
        gagal.push(`${p.nomor_po}: ${(e as Error).message}`)
      }
    }
    setSibuk(false)
    setPilih(new Set())
    if (berhasil) toast.success(`${berhasil} PO diajukan, menunggu approval admin finance`)
    if (gagal.length) toast.error(`Gagal diajukan:\n${gagal.join('\n')}`)
  }

  const tandaiLunasLama = () => {
    if (!semuaLama) return
    const alasan = window.prompt(
      `Tandai ${terpilih.length} PO (${rupiah(totalTerpilih)}) SUDAH DIBAYAR sebelum 1 November 2026?\n` +
      'Saldo rekening tidak dipotong. Hanya untuk PO yang benar-benar sudah lunas di luar sistem.\n\nAlasan / keterangan (wajib):',
      'Sudah dibayar sebelum pencatatan kas 1 November 2026',
    )
    if (alasan === null) return
    if (!alasan.trim()) { toast.error('Alasan wajib diisi'); return }
    tandaiLunas.mutate({ poIds: terpilih.map((p) => p.id), alasan }, {
      onSuccess: (n) => { toast.success(`${n} PO ditandai lunas (tanpa potong saldo)`); setPilih(new Set()) },
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
        <h1 className="font-display text-4xl md:text-5xl text-suka-brown tracking-wide">
          {isChecker ? 'Pembayaran Vendor' : 'Tagihan Vendor'}
        </h1>
        <p className="text-suka-ink/60 mt-2 font-medium">
          PO yang barangnya sudah diterima masuk ke <b>Belum diajukan</b>. Purchasing mengunggah invoice supplier
          lalu mengajukan pembayarannya,
          lalu admin finance mentransfer dan menyetujui di Hub Approval dengan bukti transfer.
          Saldo rekening baru terpotong saat disetujui.
        </p>
      </div>

      {ditolak.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <b>{ditolak.length} pengajuan ditolak admin finance</b> dan kembali ke <b>Belum diajukan</b>.
          Periksa alasannya, perbaiki, lalu ajukan ulang.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Belum diajukan" value={rupiah(jumlah('unpaid'))} icon={<Banknote size={22} />} tone="blue" hint={`${per('unpaid').length} PO`} />
        <StatCard label="Menunggu finance" value={rupiah(jumlah('pending'))} icon={<Clock size={22} />} tone="orange" hint={`${per('pending').length} PO`} />
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
              <button key={t} onClick={() => gantiTab(t)}
                className={`rounded-full px-3 py-1.5 ${tab === t ? 'bg-white text-suka-brown shadow-sm' : 'text-suka-gray-500 hover:text-suka-ink'}`}>
                {TAB_LABEL[t]} ({per(t).length})
              </button>
            ))}
          </div>
        }
      >
        {tab === 'unpaid' && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full bg-suka-gray-100 p-1 text-xs font-bold">
              {(Object.keys(PERIODE_LABEL) as FilterPeriode[]).map((f) => (
                <button key={f} onClick={() => { setPeriode(f); setPilih(new Set()) }}
                  className={`rounded-full px-3 py-1 ${periode === f ? 'bg-white text-suka-brown shadow-sm' : 'text-suka-gray-500 hover:text-suka-ink'}`}>
                  {PERIODE_LABEL[f]} ({per('unpaid').filter((p) => cocokPeriode(p.tanggal_po, f)).length})
                </button>
              ))}
            </div>
            {terpilih.length > 0 && (
              <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-suka-ink">{terpilih.length} PO · {rupiah(totalTerpilih)}</span>
                {canAjukanBayarPO && (
                  <Button onClick={() => ajukanBanyak(terpilih)} disabled={sibuk} className="px-3 py-1 text-xs">
                    {sibuk ? 'Mengajukan…' : 'Ajukan terpilih'}
                  </Button>
                )}
                {isChecker && (
                  <Button
                    variant="secondary"
                    onClick={tandaiLunasLama}
                    disabled={!semuaLama || tandaiLunas.isPending}
                    title={semuaLama ? undefined : 'Hanya untuk PO sebelum 1 November 2026'}
                    className="px-3 py-1 text-xs"
                  >
                    Tandai sudah dibayar (sebelum 1 Nov)
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-8"><Spinner size={28} /></div>
        ) : daftar.length === 0 ? (
          <p className="py-6 text-center text-suka-gray-400">Tidak ada PO di tab ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-suka-gray-500">
                  {bolehPilih && (
                    <th className="py-2 pl-3 w-8">
                      <input type="checkbox" aria-label="Pilih semua" checked={terpilih.length === daftar.length}
                        onChange={togglePilihSemua} />
                    </th>
                  )}
                  <th className="py-2 px-3">Nomor PO</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2">Tanggal PO</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2 pl-4">Invoice</th>
                  <th className="py-2 pl-4">{tab === 'paid' ? 'Dibayar' : tab === 'pending' ? 'Diajukan' : 'Keterangan'}</th>
                  <th className="py-2 pr-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {daftar.map((p) => {
                  const tx = txs[p.id]
                  const alasanTolak = tab === 'unpaid' && tx?.status === 'rejected' ? alasanDitolak(tx.note) ?? 'tanpa alasan' : null
                  return (
                    <tr key={p.id} className={alasanTolak ? 'bg-red-50/60' : undefined}>
                      {bolehPilih && (
                        <td className="py-3 pl-3">
                          <input type="checkbox" aria-label={`Pilih ${p.nomor_po}`} checked={pilih.has(p.id)}
                            onChange={() => togglePilih(p.id)} />
                        </td>
                      )}
                      <td className="py-3 px-3 font-semibold text-suka-ink">
                        <Link href={`/pembelian/${p.id}`} className="hover:text-suka-orange hover:underline">{p.nomor_po}</Link>
                      </td>
                      <td className="py-3 text-suka-gray-500">{p.supplier_nama}</td>
                      <td className="py-3 text-suka-gray-500">{tanggal(p.tanggal_po)}</td>
                      <td className="py-3 text-right font-bold text-suka-ink">{rupiah(p.total)}</td>
                      <td className="py-3 pl-4 text-xs whitespace-nowrap">
                        {adaInvoice(p.id) ? (
                          <a href={getInvoiceUrl(invoices[p.id][0])} target="_blank" rel="noreferrer" className="font-semibold text-emerald-700 hover:underline">
                            ✓ {invoices[p.id].length} file
                          </a>
                        ) : tab === 'unpaid' && canAjukanBayarPO ? (
                          <button onClick={() => pilihFileInvoice(p)} disabled={uploadInvoice.isPending}
                            className="font-semibold text-suka-orange hover:underline disabled:opacity-50">
                            {uploadInvoice.isPending && unggahUntuk?.id === p.id ? 'Mengunggah…' : 'Unggah'}
                          </button>
                        ) : (
                          <span className="text-suka-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pl-4 text-xs text-suka-gray-500">
                        {tab === 'unpaid' && (
                          alasanTolak ? (
                            <span className="font-semibold text-red-700">Ditolak: {alasanTolak}</span>
                          ) : poSebelumKasBersih(p.tanggal_po) ? (
                            <span className="text-amber-700">Sebelum 1 Nov</span>
                          ) : null
                        )}
                        {tab === 'pending' && tx && (
                          <>
                            <div>{tx.pengaju ?? '—'} · {tanggalWaktu(tx.created_at)}</div>
                            {tx.note && <div className="text-suka-ink/70">{tx.note}</div>}
                          </>
                        )}
                        {tab === 'paid' && (
                          <>
                            <div>{p.paid_at ? tanggalWaktu(p.paid_at) : '—'}{tx?.status === 'paid' && tx.penyetuju ? ` · ${tx.penyetuju}` : ''}</div>
                            {tx?.status === 'paid' ? (
                              tx.proof_url && (
                                <button onClick={() => lihatBukti(tx.proof_url!, `Bukti bayar ${p.nomor_po}`)} className="text-blue-600 underline">Bukti</button>
                              )
                            ) : p.lunas_tanpa_kas_at ? (
                              <span className="text-amber-700">Lunas tanpa potong saldo: {p.lunas_tanpa_kas_alasan}</span>
                            ) : (
                              <span className="text-amber-700">Ditandai lunas manual (tanpa transaksi kas)</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right whitespace-nowrap space-x-2">
                        {tab === 'unpaid' && canAjukanBayarPO && (
                          <Button onClick={() => ajukanBanyak([p])} disabled={sibuk || !adaInvoice(p.id)}
                            title={adaInvoice(p.id) ? undefined : 'Unggah invoice dulu'} className="px-3 py-1 text-xs">
                            {alasanTolak ? 'Ajukan ulang' : 'Ajukan'}
                          </Button>
                        )}
                        {tab === 'pending' && isChecker && (
                          <Link href="/approval" className="text-xs font-semibold text-suka-orange hover:underline">Putuskan di Hub Approval</Link>
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
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={unggahInvoice} />
      {bukti && <BuktiModal url={bukti.url} judul={bukti.judul} onClose={() => setBukti(null)} />}
    </div>
  )
}
