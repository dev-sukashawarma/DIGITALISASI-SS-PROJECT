import { BARIS_OPEX_OUTLET, CLOSING_OPEX_INTERNAL_SEPT_2026 as C, type BarisOpexOutlet } from './opexClosingInternalSeptember2026'
import { GUDANG_SS_ONLINE_ID, SS_ONLINE_ID, rentangClosingTepat } from './terapkanClosingOpex'

/* Kartu Buku Kas untuk closing OPEX September 2026: angka kartu = target sheet
 * FIXED untuk cakupan yang dipilih. File ini identik dengan versi app finance. */

export type ViewKartuClosing =
  | { jenis: 'outlet'; outletId: string }
  | { jenis: 'internal' }
  | { jenis: 'internal_pusat' }
  | { jenis: 'pusat' }

export interface KartuClosing {
  gajiRutin: number
  bonusKru: number
  bonusManajer: number
  lembur: number
  nonGaji: number
  total: number
}

const CATATAN_SEBAGIAN = 'Closing OPEX September 2026 hanya berlaku untuk rentang 1–30 September; rentang ini memakai data apa adanya.'
const CATATAN_TAK_DIDUKUNG = 'Closing OPEX September 2026 tampil saat memilih Kantor Pusat atau satu outlet internal (di admin-dashboard juga Outlet Internal dan Kantor Pusat + Outlet Internal).'

export function viewKartuDariTarget(target: string): ViewKartuClosing | null {
  if (target === 'PUSAT') return { jenis: 'pusat' }
  if (target === 'INTERNAL_OUTLETS') return { jenis: 'internal' }
  if (target === 'INTERNAL_PUSAT') return { jenis: 'internal_pusat' }
  const id = target === GUDANG_SS_ONLINE_ID ? SS_ONLINE_ID : target
  return C.outlets[id] ? { jenis: 'outlet', outletId: id } : null
}

function kosong(): KartuClosing {
  return { gajiRutin: 0, bonusKru: 0, bonusManajer: 0, lembur: 0, nonGaji: 0, total: 0 }
}

function tambahOutlet(k: KartuClosing, target: Record<BarisOpexOutlet, number>) {
  for (const b of BARIS_OPEX_OUTLET) {
    const v = target[b]
    if (b === 'gaji_crew_outlet') k.gajiRutin += v
    else if (b === 'bonus_crew') k.bonusKru += v
    else if (b === 'bonus_area_manager' || b === 'bonus_regional_manager') k.bonusManajer += v
    else if (b === 'lembur') k.lembur += v
    else k.nonGaji += v
    k.total += v
  }
}

function tambahPusat(k: KartuClosing) {
  for (const [b, v] of Object.entries(C.pusat.target)) {
    if (b === 'gaji_staff_kantor' || b === 'crew_backup') k.gajiRutin += v
    else k.nonGaji += v
    k.total += v
  }
}

export function targetKartuClosing(view: ViewKartuClosing): KartuClosing {
  const k = kosong()
  if (view.jenis === 'outlet') tambahOutlet(k, C.outlets[view.outletId].target)
  if (view.jenis === 'internal' || view.jenis === 'internal_pusat') {
    for (const o of Object.values(C.outlets)) tambahOutlet(k, o.target)
  }
  if (view.jenis === 'pusat' || view.jenis === 'internal_pusat') tambahPusat(k)
  return k
}

export function kartuClosingUntuk(target: string, from: string, to: string): { kartu: KartuClosing | null; catatan: string | null } {
  const memotong = from <= C.to && to >= C.from
  if (!memotong) return { kartu: null, catatan: null }
  if (!rentangClosingTepat(from, to)) return { kartu: null, catatan: CATATAN_SEBAGIAN }
  const view = viewKartuDariTarget(target)
  if (!view) return { kartu: null, catatan: CATATAN_TAK_DIDUKUNG }
  return { kartu: targetKartuClosing(view), catatan: null }
}
