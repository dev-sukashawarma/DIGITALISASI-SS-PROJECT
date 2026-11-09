'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Inbox } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { useHubApproval } from '@/hooks/useHubApproval'
import { useProcessPettyCashFinance, useForwardPettyCashFinance } from '@/hooks/usePettyCash'
import { useRejectPo, type PendingPo } from '@/hooks/usePoApproval'
import { useTolakBayarPo, useTagihanBelumDiajukanCount, type PayablePo } from '@/hooks/useSupplierSettlement'
import Link from 'next/link'
import { useOfficeVouchers } from '@/hooks/useOfficeVouchers'
import { useCashOverview } from '@/hooks/useCashData'
import { JENIS_LABEL, type HubItem } from '@/lib/approval/hub'
import type { DisbursementMethod, PettyCashTopup } from '@/lib/types'
import type { OfficeVoucher } from '@/lib/officeVoucher'
import { FinanceApprovalModal } from '@/app/petty-cash/components/FinanceApprovalModal'
import { VerifyVoucherModal } from '@/components/VerifyVoucherModal'
import { AlasanTolakModal } from '@/components/approval/AlasanTolakModal'
import { SetujuiBayarVendorModal } from '@/components/approval/SetujuiBayarVendorModal'
import { SetujuiPoModal } from '@/components/approval/SetujuiPoModal'
import { MenungguPanel } from './MenungguPanel'
import { RiwayatApprovalPanel } from './RiwayatApprovalPanel'

const PREFIX_HUB = [['petty_cash_topups'], ['po-pending-approval'], ['po_payable'], ['office_vouchers']]

function pesan(err: unknown, cadangan: string): string {
  return err instanceof Error && err.message ? err.message : cadangan
}

export function HubApprovalView() {
  const qc = useQueryClient()
  const { isChecker } = useFinanceRole()
  const { items, galat, isLoading, perJenis } = useHubApproval(isChecker)
  const { data: tagihanBelumDiajukan = 0 } = useTagihanBelumDiajukanCount(isChecker)
  const [tab, setTab] = useState<'menunggu' | 'riwayat'>('menunggu')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const { locations } = useCashOverview()

  const processTopup = useProcessPettyCashFinance()
  const forwardTopup = useForwardPettyCashFinance()
  const rejectPo = useRejectPo()
  const tolakBayar = useTolakBayarPo()
  const { verifyVoucher, rejectVoucher, isVerifying, isRejecting } = useOfficeVouchers(undefined, { enabled: isChecker })

  const [pettyAcc, setPettyAcc] = useState<PettyCashTopup | null>(null)
  const [poAcc, setPoAcc] = useState<PendingPo | null>(null)
  const [vendorAcc, setVendorAcc] = useState<PayablePo | null>(null)
  const [voucherAcc, setVoucherAcc] = useState<OfficeVoucher | null>(null)
  const [tolakItem, setTolakItem] = useState<HubItem | null>(null)
  const [tolakPending, setTolakPending] = useState(false)

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
        setPoAcc(i.data)
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

  return (
    <div className="space-y-5 pb-12 font-sans">
      <PageHeader
        title="Hub Approval"
        icon={Inbox}
        description="Semua pengajuan yang menunggu keputusan admin finance. Paling lama menunggu di atas."
      />

      <div className="flex gap-1 border-b border-suka-brown/10">
        {(['menunggu', 'riwayat'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t ? 'border-suka-orange text-suka-brown' : 'border-transparent text-suka-gray-500 hover:text-suka-ink'
            }`}
          >
            {t === 'menunggu' ? `Menunggu (${items.length})` : 'Riwayat'}
          </button>
        ))}
      </div>

      {tab === 'riwayat' ? (
        <RiwayatApprovalPanel enabled={isChecker} />
      ) : (
        <>
        {tagihanBelumDiajukan > 0 && (
          <p className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <b>{tagihanBelumDiajukan} PO</b> sudah diterima tapi pembayarannya belum diajukan purchasing.{' '}
            <Link href="/supplier" className="font-semibold underline">Lihat Pembayaran Vendor</Link>
          </p>
        )}
        <MenungguPanel
          items={items}
          galat={galat}
          isLoading={isLoading}
          perJenis={perJenis}
          now={now}
          bolehPutuskan={isChecker}
          onSetujui={setujui}
          onTolak={setTolakItem}
        />
        </>
      )}

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

      {poAcc && (
        <SetujuiPoModal
          isOpen
          po={poAcc}
          onClose={() => setPoAcc(null)}
          onGagal={segarkan}
        />
      )}

      {vendorAcc && (
        <SetujuiBayarVendorModal
          po={vendorAcc}
          locations={locations}
          onClose={() => setVendorAcc(null)}
          onGagal={segarkan}
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
