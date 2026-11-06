import type { PettyCashTopup } from '@/lib/types'
import type { PendingPo } from '@/hooks/usePoApproval'
import type { PayablePo, TxBayarPo } from '@/hooks/useSupplierSettlement'
import type { OfficeVoucher } from '@/lib/officeVoucher'

/** Jenis pekerjaan yang menunggu admin finance di Hub Approval. */
export type HubJenis = 'petty_cash' | 'serah_am' | 'po' | 'bayar_vendor' | 'dana_kantor'

export const URUTAN_JENIS: HubJenis[] = ['petty_cash', 'serah_am', 'po', 'bayar_vendor', 'dana_kantor']

export const JENIS_LABEL: Record<HubJenis, string> = {
  petty_cash: 'Petty cash',
  serah_am: 'Serahkan ke AM',
  po: 'Approval PO',
  bayar_vendor: 'Bayar vendor',
  dana_kantor: 'Dana kantor',
}

/** Pengajuan yang menunggu lebih lama dari ini ditandai merah. */
export const AMBANG_LAMA_JAM = 24

type Dasar = {
  key: string
  id: string
  judul: string
  keterangan: string
  nominal: number
  menungguSejak: string
  detailHref: string | null
}

export type HubItem = Dasar &
  (
    | { jenis: 'petty_cash' | 'serah_am'; data: PettyCashTopup }
    | { jenis: 'po'; data: PendingPo }
    | { jenis: 'bayar_vendor'; data: PayablePo }
    | { jenis: 'dana_kantor'; data: OfficeVoucher }
  )

function gabungKeterangan(...bagian: (string | null | undefined)[]): string {
  return bagian.filter((b) => b && b.trim()).join(' · ')
}

function potong(teks: string | null | undefined, maks = 60): string {
  const t = (teks ?? '').replace(/\s+/g, ' ').trim()
  return t.length > maks ? `${t.slice(0, maks - 1)}…` : t
}

export function itemDariPettyCash(t: PettyCashTopup): HubItem | null {
  const jenis =
    t.status === 'forwarded_to_finance' ? 'petty_cash' : t.status === 'approved_by_finance' ? 'serah_am' : null
  if (!jenis) return null
  return {
    key: `${jenis}:${t.id}`,
    id: t.id,
    jenis,
    judul: t.outlet?.name ?? '-',
    keterangan: gabungKeterangan(t.outlet_staff?.name, potong(t.reason ?? t.description)),
    nominal: Number(t.amount) || 0,
    menungguSejak: t.created_at,
    detailHref: null,
    data: t,
  }
}

export function itemDariPo(p: PendingPo): HubItem {
  return {
    key: `po:${p.id}`,
    id: p.id,
    jenis: 'po',
    judul: p.supplier_nama,
    keterangan: p.nomor_po,
    nominal: Number(p.total) || 0,
    menungguSejak: p.updated_at ?? p.tanggal_po,
    detailHref: `/pembelian/${p.id}`,
    data: p,
  }
}

export function itemDariBayarVendor(p: PayablePo, tx?: TxBayarPo): HubItem | null {
  if (p.payment_status !== 'pending') return null
  return {
    key: `bayar_vendor:${p.id}`,
    id: p.id,
    jenis: 'bayar_vendor',
    judul: p.supplier_nama,
    keterangan: gabungKeterangan(p.nomor_po, tx?.pengaju ? `diajukan ${tx.pengaju}` : null),
    nominal: Number(p.total) || 0,
    menungguSejak: tx?.created_at ?? p.tanggal_po,
    detailHref: `/pembelian/${p.id}`,
    data: p,
  }
}

export function itemDariVoucher(v: OfficeVoucher): HubItem | null {
  if (v.status !== 'waiting_verification') return null
  return {
    key: `dana_kantor:${v.id}`,
    id: v.id,
    jenis: 'dana_kantor',
    judul: `${v.division} · ${v.recipientName}`,
    keterangan: gabungKeterangan(v.voucherNumber, potong(v.reason)),
    nominal: Number(v.realizedAmount ?? v.advanceAmount) || 0,
    menungguSejak: v.createdAt,
    detailHref: '/pengeluaran/kantor',
    data: v,
  }
}

/** Paling lama menunggu di atas; seri diurutkan menurut key agar stabil. */
export function urutkanHub(items: HubItem[]): HubItem[] {
  return [...items].sort((a, b) => {
    const selisih = new Date(a.menungguSejak).getTime() - new Date(b.menungguSejak).getTime()
    if (selisih !== 0) return selisih
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })
}

export function hitungPerJenis(items: HubItem[]): Record<HubJenis, number> {
  const hasil = Object.fromEntries(URUTAN_JENIS.map((j) => [j, 0])) as Record<HubJenis, number>
  for (const i of items) hasil[i.jenis] += 1
  return hasil
}

export function isLama(menungguSejak: string, now: Date, ambangJam: number = AMBANG_LAMA_JAM): boolean {
  const t = new Date(menungguSejak).getTime()
  if (!Number.isFinite(t)) return false
  return now.getTime() - t > ambangJam * 3_600_000
}

export type SumberHasil = { jenis: HubJenis[]; items: HubItem[]; isLoading: boolean; error: unknown }

/** Gabungkan hasil tiap sumber; sumber yang galat tidak diam-diam dihitung nol. */
export function gabungSumber(sumber: SumberHasil[]): { items: HubItem[]; galat: HubJenis[]; isLoading: boolean } {
  const galat: HubJenis[] = []
  const items: HubItem[] = []
  for (const s of sumber) {
    if (s.error) galat.push(...s.jenis)
    else items.push(...s.items)
  }
  return { items: urutkanHub(items), galat, isLoading: sumber.some((s) => s.isLoading) }
}
