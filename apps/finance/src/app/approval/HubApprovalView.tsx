'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Inbox, Loader2, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { useHubApproval } from '@/hooks/useHubApproval'
import { useProcessPettyCashFinance, useForwardPettyCashFinance } from '@/hooks/usePettyCash'
import { useApprovePo, useRejectPo } from '@/hooks/usePoApproval'
import { useTolakBayarPo, type PayablePo } from '@/hooks/useSupplierSettlement'
import { useOfficeVouchers } from '@/hooks/useOfficeVouchers'
import { useCashOverview } from '@/hooks/useCashData'
import { lokasiGrup } from '@/lib/kas/grupKas'
import { rupiah } from '@/lib/format'
import { JENIS_LABEL, URUTAN_JENIS, type HubItem, type HubJenis } from '@/lib/approval/hub'
import type { DisbursementMethod, PettyCashTopup } from '@/lib/types'
import type { OfficeVoucher } from '@/lib/officeVoucher'
import { FinanceApprovalModal } from '@/app/petty-cash/components/FinanceApprovalModal'
import { VerifyVoucherModal } from '@/components/VerifyVoucherModal'
import { AlasanTolakModal } from '@/components/approval/AlasanTolakModal'
import { SetujuiBayarVendorModal } from '@/components/approval/SetujuiBayarVendorModal'
import { BarisHub } from './BarisHub'

type Saringan = 'semua' | HubJenis

const PREFIX_HUB = [['petty_cash_topups'], ['po-pending-approval'], ['po_payable'], ['office_vouchers']]

function pesan(err: unknown, cadangan: string): string {
  return err instanceof Error && err.message ? err.message : cadangan
}

export function HubApprovalView() {
  const qc = useQueryClient()
  const { isChecker } = useFinanceRole()
  const { items, galat, isLoading, perJenis } = useHubApproval(isChecker)
  const [saringan, setSaringan] = useState<Saringan>('semua')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { locations } = useCashOverview()
  const rekeningBahanBaku = lokasiGrup(locations, 'bahan_baku', 'bank')[0]

  const processTopup = useProcessPettyCashFinance()
  const forwardTopup = useForwardPettyCashFinance()
  const approvePo = useApprovePo()
  const rejectPo = useRejectPo()
  const tolakBayar = useTolakBayarPo()
  const { verifyVoucher, rejectVoucher, isVerifying, isRejecting } = useOfficeVouchers(undefined, { enabled: isChecker })

  const [pettyAcc, setPettyAcc] = useState<PettyCashTopup | null>(null)
  const [vendorAcc, setVendorAcc] = useState<PayablePo | null>(null)
  const [voucherAcc, setVoucherAcc] = useState<OfficeVoucher | null>(null)
  const [tolakItem, setTolakItem] = useState<HubItem | null>(null)
  const [tolakPending, setTolakPending] = useState(false)

  const tampil = useMemo(
    () => (saringan === 'semua' ? items : items.filter((i) => i.jenis === saringan)),
    [items, saringan],
  )
  const totalNominal = useMemo(() => tampil.reduce((a, i) => a + i.nominal, 0), [tampil])

  /** Pengajuan yang sudah diputuskan di tab lain: segarkan agar barisnya hilang. */
  const segarkan = () => PREFIX_HUB.forEach((queryKey) => qc.invalidateQueries({ queryKey }))

  const setujui = async (i: HubItem) => {
    switch (i.jenis) {
      case 'petty_cash':
        setPettyAcc(i.data)
        return
      case 'serah_am':
        if (!confirm('Konfirmasi penyerahan dana dari Finance ke Area Manager?')) return
        try {
          await forwardTopup.mutateAsync({ id: i.data.id })
          toast.success('Dana berhasil diserahkan ke Area Manager!')
        } catch (err) {
          toast.error(pesan(err, 'Gagal meneruskan dana'))
          segarkan()
        }
        return
      case 'po':
        // Toast sukses/galat sudah dari useApprovePo.
        approvePo.mutate(i.data.id, { onError: segarkan })
        return
      case 'bayar_vendor':
        setVendorAcc(i.data)
        return
      case 'dana_kantor':
        setVoucherAcc(i.data)
        return
    }
  }

  const konfirmasiTolak = async (alasan: string) => {
    const i = tolakItem
    if (!i) return
    setTolakPending(true)
    try {
      switch (i.jenis) {
        case 'petty_cash':
          await processTopup.mutateAsync({ id: i.data.id, action: 'reject', approvalNote: alasan })
          toast.success('Pengajuan Petty Cash ditolak.')
          break
        case 'po':
          await rejectPo.mutateAsync({ poId: i.data.id, alasan })
          break
        case 'bayar_vendor':
          await tolakBayar.mutateAsync({ poId: i.data.id, alasan })
          toast.success(`Pengajuan ${i.data.nomor_po} ditolak, PO kembali belum dibayar`)
          break
        case 'dana_kantor':
          await rejectVoucher({ voucher: i.data, reason: alasan })
          break
        case 'serah_am':
          return
      }
      setTolakItem(null)
    } catch (err) {
      // useRejectPo sudah menampilkan toast galatnya sendiri.
      if (i.jenis !== 'po') toast.error(pesan(err, 'Gagal menolak pengajuan'))
      segarkan()
    } finally {
      setTolakPending(false)
    }
  }

  const approvePetty = async (
    method: DisbursementMethod,
    cashLocationId: string,
    proofFile?: File | null,
    approvedAmount?: number,
    approvalNote?: string,
  ) => {
    if (!pettyAcc) return
    try {
      await processTopup.mutateAsync({ id: pettyAcc.id, action: 'approve', method, cashLocationId, proofFile, approvedAmount, approvalNote })
      toast.success('Pencairan Petty Cash berhasil diproses!')
      setPettyAcc(null)
    } catch (err) {
      toast.error(pesan(err, 'Gagal memproses pencairan'))
      segarkan()
    }
  }

  if (!isChecker) {
    return (
      <div className="space-y-6 pb-12">
        <PageHeader title="Hub Approval" icon={Inbox} />
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Halaman ini khusus admin finance, admin, dan owner.
        </p>
      </div>
    )
  }

  const chip = (key: Saringan, label: string, jumlah: number | null) => (
    <button
      key={key}
      type="button"
      onClick={() => setSaringan(key)}
      className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
        saringan === key ? 'border-suka-brown bg-suka-brown text-white' : 'border-suka-brown/15 bg-white text-suka-ink hover:border-suka-brown/40'
      }`}
    >
      {label} {jumlah === null ? <span className="text-red-500">!</span> : jumlah}
    </button>
  )

  return (
    <div className="space-y-5 pb-12 font-sans">
      <PageHeader
        title="Hub Approval"
        icon={Inbox}
        description="Semua pengajuan yang menunggu keputusan admin finance. Paling lama menunggu di atas."
      />

      <div className="flex flex-wrap gap-2">
        {chip('semua', 'Semua', items.length)}
        {URUTAN_JENIS.map((j) => chip(j, JENIS_LABEL[j], galat.includes(j) ? null : perJenis[j]))}
      </div>

      {galat.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>Gagal memuat: {galat.map((j) => JENIS_LABEL[j]).join(', ')}. Bagian lain tetap tampil; muat ulang halaman untuk mencoba lagi.</span>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-suka-brown/10 bg-white">
        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-suka-gray-500">
            <Loader2 size={18} className="animate-spin text-suka-orange" /> Memuat pengajuan…
          </div>
        ) : tampil.length === 0 ? (
          <p className="py-16 text-center text-sm font-medium text-suka-gray-500">Tidak ada pengajuan yang menunggu</p>
        ) : (
          <>
            <div className="flex justify-between border-b border-suka-brown/5 bg-suka-cream/40 px-4 py-2 text-xs font-semibold text-suka-gray-600">
              <span>{tampil.length} pengajuan</span>
              <span>Total {rupiah(totalNominal)}</span>
            </div>
            <ul>
              {tampil.map((i) => (
                <BarisHub key={i.key} item={i} now={now} bolehPutuskan={isChecker} onSetujui={setujui} onTolak={setTolakItem} />
              ))}
            </ul>
          </>
        )}
      </div>

      {pettyAcc && (
        <FinanceApprovalModal
          isOpen
          request={pettyAcc}
          onClose={() => setPettyAcc(null)}
          onApprove={approvePetty}
          onReject={async () => {
            const req = pettyAcc
            setPettyAcc(null)
            const baris = items.find((i) => i.jenis === 'petty_cash' && i.id === req.id)
            if (baris) setTolakItem(baris)
          }}
        />
      )}

      {vendorAcc && (
        <SetujuiBayarVendorModal
          po={vendorAcc}
          rekeningLabel={rekeningBahanBaku?.label ?? 'Rekening Bahan Baku Bank'}
          saldo={rekeningBahanBaku?.saldo ?? 0}
          onClose={() => setVendorAcc(null)}
        />
      )}

      <VerifyVoucherModal
        voucher={voucherAcc}
        isOpen={Boolean(voucherAcc)}
        onClose={() => setVoucherAcc(null)}
        isProcessing={isVerifying || isRejecting}
        onVerify={async (data) => {
          try {
            await verifyVoucher(data)
            setVoucherAcc(null)
          } catch {
            segarkan()
          }
        }}
        onReject={async (data) => {
          try {
            await rejectVoucher(data)
            setVoucherAcc(null)
          } catch (err) {
            toast.error(pesan(err, 'Gagal menolak voucher'))
            segarkan()
          }
        }}
      />

      <AlasanTolakModal
        isOpen={Boolean(tolakItem)}
        judul={tolakItem ? `Tolak ${JENIS_LABEL[tolakItem.jenis].toLowerCase()}` : 'Tolak'}
        onClose={() => setTolakItem(null)}
        onKonfirmasi={konfirmasiTolak}
        isPending={tolakPending}
      />
    </div>
  )
}
