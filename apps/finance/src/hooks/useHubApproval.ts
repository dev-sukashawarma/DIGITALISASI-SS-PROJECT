'use client'

import { useMemo } from 'react'
import { usePettyCashMenunggu, usePettyCashCount } from '@/hooks/usePettyCash'
import { usePendingPos, usePendingPoCount } from '@/hooks/usePoApproval'
import { usePayablePos, useTxBayarPo, useBayarVendorPendingCount } from '@/hooks/useSupplierSettlement'
import { useOfficeVouchers } from '@/hooks/useOfficeVouchers'
import {
  gabungSumber,
  hitungPerJenis,
  itemDariBayarVendor,
  itemDariPettyCash,
  itemDariPo,
  itemDariVoucher,
  type HubItem,
  type HubJenis,
} from '@/lib/approval/hub'

function tanpaNull(items: (HubItem | null)[]): HubItem[] {
  return items.filter((i): i is HubItem => i !== null)
}

/** Semua pekerjaan yang menunggu admin finance, digabung dari lima sumber. */
export function useHubApproval(enabled: boolean): {
  items: HubItem[]
  galat: HubJenis[]
  isLoading: boolean
  perJenis: Record<HubJenis, number>
} {
  const petty = usePettyCashMenunggu(enabled)
  const po = usePendingPos(enabled)
  const vendor = usePayablePos(enabled)
  const tx = useTxBayarPo(enabled)
  const voucher = useOfficeVouchers(undefined, { enabled })

  return useMemo(() => {
    const hasil = gabungSumber([
      {
        jenis: ['petty_cash', 'serah_am'],
        items: tanpaNull((petty.data ?? []).map(itemDariPettyCash)),
        isLoading: petty.isLoading,
        error: petty.error,
      },
      { jenis: ['po'], items: (po.data ?? []).map(itemDariPo), isLoading: po.isLoading, error: po.error },
      {
        jenis: ['bayar_vendor'],
        items: tanpaNull((vendor.data ?? []).map((p) => itemDariBayarVendor(p, tx.data?.[p.id]))),
        isLoading: vendor.isLoading || tx.isLoading,
        error: vendor.error ?? tx.error,
      },
      {
        jenis: ['dana_kantor'],
        items: tanpaNull(voucher.vouchers.map(itemDariVoucher)),
        isLoading: voucher.isLoading,
        error: voucher.error,
      },
    ])
    return { ...hasil, perJenis: hitungPerJenis(hasil.items) }
  }, [
    petty.data, petty.isLoading, petty.error,
    po.data, po.isLoading, po.error,
    vendor.data, vendor.isLoading, vendor.error,
    tx.data, tx.isLoading, tx.error,
    voucher.vouchers, voucher.isLoading, voucher.error,
  ])
}

/** Angka badge menu Hub Approval — kueri hitung dengan filter yang sama dengan daftarnya. */
export function useHubApprovalCount(enabled: boolean): { total: number; adaGalat: boolean } {
  const pettyAcc = usePettyCashCount('forwarded_to_finance', enabled)
  const pettySerah = usePettyCashCount('approved_by_finance', enabled)
  const po = usePendingPoCount(enabled)
  const vendor = useBayarVendorPendingCount(enabled)
  const voucher = useOfficeVouchers(undefined, { enabled })

  const danaKantor = voucher.vouchers.filter((v) => v.status === 'waiting_verification').length
  const total = (pettyAcc.data ?? 0) + (pettySerah.data ?? 0) + (po.data ?? 0) + (vendor.data ?? 0) + danaKantor
  const adaGalat = Boolean(pettyAcc.error || pettySerah.error || po.error || vendor.error || voucher.error)
  return { total, adaGalat }
}
