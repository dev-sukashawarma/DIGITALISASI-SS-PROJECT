import type { KonteksAbsensi } from './tipe'

const OUTLET_EMPANG = { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal' }
const OUTLET_KP = { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', name: 'Kantor Pusat', type: 'office' }
export const absensiPalsu: KonteksAbsensi = {
  hariIni: '2026-10-07',
  sekarang: new Date('2026-10-07T07:00:00Z'),
  outlets: async () => [OUTLET_EMPANG, OUTLET_KP],
  papan: async () => [
    {
      outlet: OUTLET_EMPANG,
      ringkas: { hadir: 1, telat: 1, telat_toleransi: 1, belum: 1, alpha: 1, total: 5 },
      staf: [
        { id: 's1', nama: 'Andi', state: 'masuk', menitTelat: null, jam: '12.55' },
        { id: 's2', nama: 'Budi', state: 'telat', menitTelat: 40, jam: '13.40' },
        { id: 's3', nama: 'Cici', state: 'belum', menitTelat: null, jam: null },
        { id: 's4', nama: 'Dedi', state: 'alpha', menitTelat: null, jam: null },
        { id: 's6', nama: 'Gina', state: 'telat_toleransi', menitTelat: 5, jam: '13.05' },
      ],
    },
    { outlet: OUTLET_KP, ringkas: { hadir: 1, telat: 0, telat_toleransi: 0, belum: 0, alpha: 0, total: 1 }, staf: [{ id: 's5', nama: 'Eka', state: 'masuk', menitTelat: null, jam: '08.00' }] },
  ],
  stafPerOutlet: async () => new Map([['o1', [{ id: 's1', nama: 'Andi' }, { id: 's2', nama: 'Budi' }]], [OUTLET_KP.id, [{ id: 's5', nama: 'Eka' }]]]),
  rekapStaf: async () => [
    { staffId: 's1', hariHadir: 7, telat: 0, telatToleransi: 1, menitTelat: 3 },
    { staffId: 's2', hariHadir: 5, telat: 3, telatToleransi: 0, menitTelat: 95 },
    { staffId: 's5', hariHadir: 7, telat: 0, telatToleransi: 0, menitTelat: 0 },
  ],
  cuti: async () => [
    { nama: 'Cici', outletId: 'o1', jenis: 'annual', mulai: '2026-10-06', selesai: '2026-10-08', hari: 3, status: 'approved' },
    { nama: 'Budi', outletId: 'o1', jenis: 'sick', mulai: '2026-10-09', selesai: '2026-10-09', hari: 1, status: 'pending' },
  ],
  kasbon: async () => [{ outletId: 'o1', menungguJumlah: 2, menungguNominal: 750_000, aktifJumlah: 3, aktifSisa: 1_200_000 }],
  ceklist: async () => [
    { outlet: OUTLET_EMPANG, laporan: { namaAm: 'Fajar', nilai: 'perhatian', jumlahTemuan: 2, ditinjau: false } },
    { outlet: OUTLET_KP, laporan: null },
  ],
}
