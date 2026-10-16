import type { KonteksStokHermes } from './tipe'
import { GUDANG_PUSAT_ID } from '@/lib/sukaBot/alat/stok'

const SAPI = { id: 'b-sapi', nama: 'SAPI', satuan: 'Pack', satuan_tengah: null, faktor_tengah: null, satuan_kecil: 'gram', faktor_tampilan: 1000 }

export const stokPalsu: KonteksStokHermes = {
  hariIni: '2026-10-07',
  outlets: [
    { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal', is_active: true },
    { id: GUDANG_PUSAT_ID, name: 'GUDANG PUSAT (HQ)', type: 'office', is_active: true },
  ],
  daftarBahan: async () => [SAPI],
  barisStok: async () => [
    { outlet_id: 'o1', bahan_baku_id: 'b-sapi', current_qty: 15, last_opname_date: '2026-10-06', saldo_is_gram: false },
    { outlet_id: GUDANG_PUSAT_ID, bahan_baku_id: 'b-sapi', current_qty: 120, last_opname_date: '2026-10-05', saldo_is_gram: false },
  ],
  suratJalan: async () => [
    {
      id: 'sj-1',
      outlet: 'SUKA SHAWARMA EMPANG',
      status: 'dikirim',
      tanggal: '2026-10-07',
      item: [
        { bahan: 'SAPI', satuan: 'Pack', qty_dikirim: 10, qty_terima: null, kondisi: 'baik', selisih: null },
      ],
    },
  ],
  opname: async () => [
    { outlet: 'SUKA SHAWARMA EMPANG', tanggal: '2026-10-06', status: 'finalized', tipe: 'harian' },
  ],
  permintaanBahan: async () => [
    { outlet: 'SUKA SHAWARMA EMPANG', tanggal: '2026-10-06', status: 'menunggu' },
  ],
}
