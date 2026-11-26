'use client'

import { useMemo } from 'react'
import { usePettyCashMenunggu, usePettyCashCount } from '@/hooks/usePettyCash'
import {
  usePettyCashExpensesMenunggu,
  usePettyCashExpensesPendingCount,
} from '@/hooks/usePettyCashExpenseApproval'
import { usePendingPos, usePendingPoCount } from '@/hooks/usePoApproval'
import { usePayablePos, useTxBayarPo, useBayarVendorPendingCount } from '@/hooks/useSupplierSettlement'
import { useOfficeVouchers } from '@/hooks/useOfficeVouchers'
import { useKasbonMenunggu, useKasbonMenungguCount } from '@/hooks/useKasbonPencairan'
import { useReturVendorMenunggu } from '@/hooks/useReturVendor'
import {
  gabungSumber,
  hitungPerJenis,
  itemDariBayarVendor,
  itemDariKasbon,
  itemDariPengeluaranPettyCash,
  itemDariPettyCash,
  itemDariPo,
  itemDariReturVendor,
  itemDariVoucher,
  type HubItem,
  type HubJenis,
} from '@/lib/approval/hub'

function tanpaNull(items: (HubItem | null)[]): HubItem[] {
  return items.filter((i): i is HubItem => i !== null)
}

/**
 * Semua pekerjaan yang menunggu admin finance, digabung dari seluruh sumber,
 * termasuk pengeluaran petty cash POS (kembali ke Finance sejak 26 Nov 2026,
 * migrasi 20261126100000_pengeluaran_dan_topup_petty_cash_finance).
 */
export function useHubApproval(enabled: boolean): {
  items: HubItem[]
  galat: HubJenis[]
  isLoading: boolean
  perJenis: Record<HubJenis, number>
} {
  const petty = usePettyCashMenunggu(enabled)
  const pengeluaranPc = usePettyCashExpensesMenunggu(enabled)
  const kasbon = useKasbonMenunggu(enabled)
  const po = usePendingPos(enabled)
  const vendor = usePayablePos(enabled)
  const tx = useTxBayarPo(enabled)
  const voucher = useOfficeVouchers(undefined, { enabled })
  const retur = useReturVendorMenunggu(enabled)

  return useMemo(() => {
    const hasil = gabungSumber([
      {
        jenis: ['petty_cash'],
        items: tanpaNull((petty.data ?? []).map(itemDariPettyCash)),
        isLoading: petty.isLoading,
        error: petty.error,
      },
      {
        jenis: ['pengeluaran_petty_cash'],
        items: tanpaNull((pengeluaranPc.data ?? []).map(itemDariPengeluaranPettyCash)),
        isLoading: pengeluaranPc.isLoading,
        error: pengeluaranPc.error,
      },
      {
        jenis: ['kasbon'],
        items: (kasbon.data ?? []).map(itemDariKasbon),
        isLoading: kasbon.isLoading,
        error: kasbon.error,
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
      {
        jenis: ['retur_vendor'],
        items: tanpaNull((retur.data ?? []).map(itemDariReturVendor)),
        isLoading: retur.isLoading,
        error: retur.error,
      },
    ])
    return { ...hasil, perJenis: hitungPerJenis(hasil.items) }
  }, [
    petty.data, petty.isLoading, petty.error,
    pengeluaranPc.data, pengeluaranPc.isLoading, pengeluaranPc.error,
    kasbon.data, kasbon.isLoading, kasbon.error,
    po.data, po.isLoading, po.error,
    vendor.data, vendor.isLoading, vendor.error,
    tx.data, tx.isLoading, tx.error,
    voucher.vouchers, voucher.isLoading, voucher.error,
    retur.data, retur.isLoading, retur.error,
  ])
}

/** Angka badge menu Hub Approval — kueri hitung dengan filter yang sama dengan daftarnya. */
export function useHubApprovalCount(enabled: boolean): { total: number; adaGalat: boolean } {
  const pettyAcc = usePettyCashCount('forwarded_to_finance', enabled)
  const pengeluaranPc = usePettyCashExpensesPendingCount(enabled)
  const kasbon = useKasbonMenungguCount(enabled)
  const po = usePendingPoCount(enabled)
  const vendor = useBayarVendorPendingCount(enabled)
  const voucher = useOfficeVouchers(undefined, { enabled })
  const retur = useReturVendorMenunggu(enabled)

  const danaKantor = voucher.vouchers.filter((v) => v.status === 'waiting_verification').length
  const total =
    (pettyAcc.data ?? 0) +
    (pengeluaranPc.data ?? 0) +
    (kasbon.data ?? 0) +
    (po.data ?? 0) +
    (vendor.data ?? 0) +
    danaKantor +
    (retur.data?.length ?? 0)
  const adaGalat = Boolean(
    pettyAcc.error || pengeluaranPc.error || kasbon.error || po.error || vendor.error || voucher.error || retur.error,
  )
  return { total, adaGalat }
}
