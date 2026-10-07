import type { KonteksAbsensi, KonteksHrRinci } from './tipe'

const OUTLET_EMPANG = { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal' }
const OUTLET_KP = { id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', name: 'Kantor Pusat', type: 'office' }
export const absensiPalsu: KonteksAbsensi = {
  hariIni: '2026-10-07',
  sekarang: new Date('2026-10-07T07:00:00Z'),
  outlets: async () => [OUTLET_EMPANG, OUTLET_KP],
  papan: async () => [
    {
      outlet: OUTLET_EMPANG,
      ringkas: { hadir: 1, telat: 1, telat_toleransi: 1, belum: 1, alpha: 1, cuti: 1, libur: 0, total: 6 },
      staf: [
        { id: 's1', nama: 'Andi', state: 'masuk', menitTelat: null, jam: '12.55' },
        { id: 's2', nama: 'Budi', state: 'telat', menitTelat: 40, jam: '13.40' },
        { id: 's3', nama: 'Cici', state: 'belum', menitTelat: null, jam: null },
        { id: 's4', nama: 'Dedi', state: 'alpha', menitTelat: null, jam: null },
        { id: 's6', nama: 'Gina', state: 'telat_toleransi', menitTelat: 5, jam: '13.05' },
        { id: 's7', nama: 'Hana', state: 'cuti', menitTelat: null, jam: null, keterangan: 'Sakit' },
      ],
    },
    { outlet: OUTLET_KP, ringkas: { hadir: 1, telat: 0, telat_toleransi: 0, belum: 0, alpha: 0, cuti: 0, libur: 0, total: 1 }, staf: [{ id: 's5', nama: 'Eka', state: 'masuk', menitTelat: null, jam: '08.00' }] },
  ],
  stafPerOutlet: async () => new Map([['o1', [{ id: 's1', nama: 'Andi' }, { id: 's2', nama: 'Budi' }]], [OUTLET_KP.id, [{ id: 's5', nama: 'Eka' }]]]),
  rekapStaf: async () => [
    { staffId: 's1', hariHadir: 7, telat: 0, telatToleransi: 1, menitTelat: 3, hariDikecualikan: 0 },
    { staffId: 's2', hariHadir: 5, telat: 3, telatToleransi: 0, menitTelat: 95, hariDikecualikan: 1 },
    { staffId: 's5', hariHadir: 7, telat: 0, telatToleransi: 0, menitTelat: 0, hariDikecualikan: 0 },
  ],
  cuti: async () => [
    { id: 'lv1', nama: 'Cici', outletId: 'o1', jenis: 'annual', mulai: '2026-10-06', selesai: '2026-10-08', hari: 3, status: 'approved' },
    { id: 'lv2', nama: 'Budi', outletId: 'o1', jenis: 'sick', mulai: '2026-10-09', selesai: '2026-10-09', hari: 1, status: 'pending' },
  ],
  kasbon: async () => [{ outletId: 'o1', menungguJumlah: 2, menungguNominal: 750_000, aktifJumlah: 3, aktifSisa: 1_200_000 }],
  ceklist: async () => [
    { outlet: OUTLET_EMPANG, laporan: { id: 'ck1', diperbaruiPada: '2026-10-07T05:00:00Z', namaAm: 'Fajar', nilai: 'perhatian', jumlahTemuan: 2, ditinjau: false } },
    { outlet: OUTLET_KP, laporan: null },
  ],
}

export const hrRinciPalsu: KonteksHrRinci = {
  kasbonDaftar: async () => [
    { id: 'k1', nama: 'Budi', outletId: 'o1', nominal: 500_000, sisa: 500_000, cicilanBulan: 2, status: 'menunggu', tanggal: '2026-10-05' },
    { id: 'k2', nama: 'Andi', outletId: 'o1', nominal: 1_000_000, sisa: 600_000, cicilanBulan: 5, status: 'aktif', tanggal: '2026-09-01' },
    { id: 'k3', nama: 'Cici', outletId: 'o1', nominal: 300_000, sisa: 0, cicilanBulan: 1, status: 'lunas', tanggal: '2026-08-01' },
    { id: 'k4', nama: 'Eka', outletId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', nominal: 200_000, sisa: 200_000, cicilanBulan: null, status: 'ditolak', tanggal: '2026-09-20' },
    { id: 'k5', nama: 'Eka', outletId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', nominal: 400_000, sisa: 400_000, cicilanBulan: 2, status: 'aktif', tanggal: '2026-09-22' },
  ],
  gajiDaftar: async () => [
    { nama: 'Andi', outletId: 'o1', gajiPokok: 3_000_000, tunjangan: 500_000, bonus: 100_000, potongan: 200_000, total: 3_400_000, status: 'finalized' },
    { nama: 'Eka', outletId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', gajiPokok: 4_000_000, tunjangan: 0, bonus: 0, potongan: 0, total: 4_000_000, status: 'draft' },
  ],
}
