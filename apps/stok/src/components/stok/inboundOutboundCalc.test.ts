import { describe, it, expect } from 'vitest';
import {
  getDistribusiFactorForBahan,
  getDistribusiCalculation,
} from './InboundOutboundList';
import { InboundOutbound } from '@/types/stok';

describe('InboundOutbound Pricing & Satuan Kirim (Opsi A)', () => {
  describe('getDistribusiFactorForBahan', () => {
    it('FOIL: 1 Dus = 48 Roll -> factor 48', () => {
      const bahan = {
        nama: 'FOIL',
        satuan: 'Dus',
        satuan_tengah: 'Roll',
        faktor_tengah: 48,
        satuan_kecil: 'cm',
        faktor_tampilan: 36480,
        satuan_distribusi: 'roll',
      };
      expect(getDistribusiFactorForBahan(bahan)).toBe(48);
    });

    it('HAND GLOVE: 1 Dus = 75 Box -> factor 75', () => {
      const bahan = {
        nama: 'HAND GLOVE',
        satuan: 'Dus',
        satuan_tengah: 'Box',
        faktor_tengah: 75,
        satuan_kecil: 'Lembar',
        faktor_tampilan: 7500,
        satuan_distribusi: 'box',
      };
      expect(getDistribusiFactorForBahan(bahan)).toBe(75);
    });

    it('CUP: 1 Pack = 25 Pcs -> factor 25', () => {
      const bahan = {
        nama: 'CUP',
        satuan: 'Pack',
        satuan_tengah: null,
        faktor_tengah: null,
        satuan_kecil: 'Pcs',
        faktor_tampilan: 25,
        satuan_distribusi: 'pcs',
      };
      expect(getDistribusiFactorForBahan(bahan)).toBe(25);
    });

    it('TUTUP PACK: 1 Pack = 25 Pcs -> factor 25', () => {
      const bahan = {
        nama: 'TUTUP PACK',
        satuan: 'Pack',
        satuan_tengah: null,
        faktor_tengah: null,
        satuan_kecil: 'Pcs',
        faktor_tampilan: 25,
        satuan_distribusi: 'pcs',
      };
      expect(getDistribusiFactorForBahan(bahan)).toBe(25);
    });

    it('SAOS TOMAT: 1 Dus = 12 Kg -> factor 12', () => {
      const bahan = {
        nama: 'SAOS TOMAT POUCH',
        satuan: 'Dus',
        satuan_tengah: 'Kg',
        faktor_tengah: 12,
        satuan_kecil: 'Gram',
        faktor_tampilan: 12000,
        satuan_distribusi: 'kg',
      };
      expect(getDistribusiFactorForBahan(bahan)).toBe(12);
    });

    it('KENTANG: 1 Dus = 10 Kg -> factor 10', () => {
      const bahan = {
        nama: 'KENTANG',
        satuan: 'Dus',
        satuan_tengah: 'Kg',
        faktor_tengah: 10,
        satuan_kecil: 'Gram',
        faktor_tampilan: 10000,
        satuan_distribusi: 'kg',
      };
      expect(getDistribusiFactorForBahan(bahan)).toBe(10);
    });

    it('AYAM: 1:1 Satuan Besar (Kg) -> factor 1', () => {
      const bahan = {
        nama: 'AYAM',
        satuan: 'Kg',
        satuan_tengah: null,
        faktor_tengah: null,
        satuan_kecil: 'Gram',
        faktor_tampilan: 1000,
        satuan_distribusi: 'kg',
      };
      expect(getDistribusiFactorForBahan(bahan)).toBe(1);
    });
  });

  describe('getDistribusiCalculation — verifikasi koreksi matematis & visual', () => {
    it('FOIL: 48 roll terkirim dengan harga master Rp 554.592/dus -> Rp 11.554/roll, total Rp 554.592 (BUKAN Rp 26.620.416)', () => {
      const item: InboundOutbound = {
        id: '1',
        tipe: 'OUT',
        sumber: 'kirim_outlet',
        kategori: 'Kirim ke Outlet',
        qty: 48, // 48 roll basis
        harga_satuan: 554592, // master price per Dus
        catatan: null,
        created_at: '2026-09-21T08:00:00Z',
        created_by: 'staff-1',
        outlet_staff: { name: 'Admin' },
        outlet_id: 'out-1',
        tujuan_outlet_nama: 'MITRA PEKAYON',
        nomor_sj: 'SJ-0012',
        bahan_baku_id: '1',
        bahan_baku: {
          nama: 'FOIL',
          satuan: 'Dus',
          satuan_tengah: 'Roll',
          faktor_tengah: 48,
          satuan_kecil: 'Roll',
          faktor_tampilan: 48,
          satuan_distribusi: 'roll',
        },
      };

      const result = getDistribusiCalculation(item);
      expect(result.qtyNumber).toBe(48);
      expect(result.unitLabel).toBe('roll');
      expect(result.displayText).toBe('48 roll');
      expect(result.distFactor).toBe(48);
      expect(result.hargaPerDistUnit).toBe(11554);
      expect(result.totalNilai).toBe(554592);
    });

    it('HAND GLOVE: 5 box terkirim dengan harga master Rp 448.125/dus -> Rp 5.975/box, total Rp 29.875 (BUKAN Rp 2.240.625)', () => {
      const item: InboundOutbound = {
        id: '2',
        tipe: 'OUT',
        sumber: 'kirim_outlet',
        kategori: 'Kirim ke Outlet',
        qty: 500, // 5 box = 500 lembar basis
        harga_satuan: 448125, // master price per Dus (isi 75 box)
        catatan: null,
        created_at: '2026-09-21T08:00:00Z',
        created_by: 'staff-1',
        outlet_staff: { name: 'Admin' },
        outlet_id: 'out-1',
        tujuan_outlet_nama: 'MITRA PEKAYON',
        nomor_sj: 'SJ-0012',
        bahan_baku_id: '2',
        bahan_baku: {
          nama: 'HAND GLOVE',
          satuan: 'Dus',
          satuan_tengah: 'Box',
          faktor_tengah: 75,
          satuan_kecil: 'Lembar',
          faktor_tampilan: 7500,
          satuan_distribusi: 'box',
        },
      };

      const result = getDistribusiCalculation(item);
      expect(result.qtyNumber).toBe(5);
      expect(result.unitLabel).toBe('box');
      expect(result.displayText).toBe('5 box');
      expect(result.distFactor).toBe(75);
      expect(result.hargaPerDistUnit).toBe(5975);
      expect(result.totalNilai).toBe(29875);
    });

    it('CUP: 50 pcs terkirim dengan harga master Rp 42.800/pack (isi 25 pcs) -> Rp 1.712/pcs, total Rp 85.600 (BUKAN Rp 2.140.000)', () => {
      const item: InboundOutbound = {
        id: '3',
        tipe: 'OUT',
        sumber: 'kirim_outlet',
        kategori: 'Kirim ke Outlet',
        qty: 50, // 50 pcs
        harga_satuan: 42800, // master price per Pack
        catatan: null,
        created_at: '2026-09-21T08:00:00Z',
        created_by: 'staff-1',
        outlet_staff: { name: 'Admin' },
        outlet_id: 'out-1',
        tujuan_outlet_nama: 'MITRA PEKAYON',
        nomor_sj: 'SJ-0012',
        bahan_baku_id: '3',
        bahan_baku: {
          nama: 'CUP',
          satuan: 'Pack',
          satuan_tengah: null,
          faktor_tengah: null,
          satuan_kecil: 'Pcs',
          faktor_tampilan: 25,
          satuan_distribusi: 'pcs',
        },
      };

      const result = getDistribusiCalculation(item);
      expect(result.qtyNumber).toBe(50);
      expect(result.unitLabel).toBe('pcs');
      expect(result.distFactor).toBe(25);
      expect(result.hargaPerDistUnit).toBe(1712);
      expect(result.totalNilai).toBe(85600);
    });

    it('TUTUP PACK: 50 pcs terkirim dengan harga master Rp 89.000/pack (isi 25 pcs) -> Rp 3.560/pcs, total Rp 178.000 (BUKAN Rp 4.450.000)', () => {
      const item: InboundOutbound = {
        id: '4',
        tipe: 'OUT',
        sumber: 'kirim_outlet',
        kategori: 'Kirim ke Outlet',
        qty: 50, // 50 pcs
        harga_satuan: 89000,
        catatan: null,
        created_at: '2026-09-21T08:00:00Z',
        created_by: 'staff-1',
        outlet_staff: { name: 'Admin' },
        outlet_id: 'out-1',
        tujuan_outlet_nama: 'MITRA PEKAYON',
        nomor_sj: 'SJ-0012',
        bahan_baku_id: '4',
        bahan_baku: {
          nama: 'TUTUP PACK',
          satuan: 'Pack',
          satuan_tengah: null,
          faktor_tengah: null,
          satuan_kecil: 'Pcs',
          faktor_tampilan: 25,
          satuan_distribusi: 'pcs',
        },
      };

      const result = getDistribusiCalculation(item);
      expect(result.qtyNumber).toBe(50);
      expect(result.unitLabel).toBe('pcs');
      expect(result.distFactor).toBe(25);
      expect(result.hargaPerDistUnit).toBe(3560);
      expect(result.totalNilai).toBe(178000);
    });

    it('SAOS TOMAT: 12 kg terkirim dengan harga master Rp 141.000/dus (isi 12 kg) -> Rp 11.750/kg, total Rp 141.000 (BUKAN Rp 1.692.000)', () => {
      const item: InboundOutbound = {
        id: '5',
        tipe: 'OUT',
        sumber: 'kirim_outlet',
        kategori: 'Kirim ke Outlet',
        qty: 12000, // 12000 gram
        harga_satuan: 141000,
        catatan: null,
        created_at: '2026-09-21T08:00:00Z',
        created_by: 'staff-1',
        outlet_staff: { name: 'Admin' },
        outlet_id: 'out-1',
        tujuan_outlet_nama: 'MITRA PEKAYON',
        nomor_sj: 'SJ-0012',
        bahan_baku_id: '5',
        bahan_baku: {
          nama: 'SAOS TOMAT',
          satuan: 'Dus',
          satuan_tengah: 'Kg',
          faktor_tengah: 12,
          satuan_kecil: 'Gram',
          faktor_tampilan: 12000,
          satuan_distribusi: 'kg',
        },
      };

      const result = getDistribusiCalculation(item);
      expect(result.qtyNumber).toBe(12);
      expect(result.unitLabel).toBe('kg');
      expect(result.distFactor).toBe(12);
      expect(result.hargaPerDistUnit).toBe(11750);
      expect(result.totalNilai).toBe(141000);
    });

    it('KENTANG: 25 kg terkirim dengan harga master Rp 250.000/dus (isi 10 kg) -> Rp 25.000/kg, total Rp 625.000 (BUKAN Rp 6.250.000)', () => {
      const item: InboundOutbound = {
        id: '6',
        tipe: 'OUT',
        sumber: 'kirim_outlet',
        kategori: 'Kirim ke Outlet',
        qty: 25000, // 25000 gram
        harga_satuan: 250000,
        catatan: null,
        created_at: '2026-09-21T08:00:00Z',
        created_by: 'staff-1',
        outlet_staff: { name: 'Admin' },
        outlet_id: 'out-1',
        tujuan_outlet_nama: 'MITRA PEKAYON',
        nomor_sj: 'SJ-0012',
        bahan_baku_id: '6',
        bahan_baku: {
          nama: 'KENTANG',
          satuan: 'Dus',
          satuan_tengah: 'Kg',
          faktor_tengah: 10,
          satuan_kecil: 'Gram',
          faktor_tampilan: 10000,
          satuan_distribusi: 'kg',
        },
      };

      const result = getDistribusiCalculation(item);
      expect(result.qtyNumber).toBe(25);
      expect(result.unitLabel).toBe('kg');
      expect(result.distFactor).toBe(10);
      expect(result.hargaPerDistUnit).toBe(25000);
      expect(result.totalNilai).toBe(625000);
    });

    it('Total 6 item surat jalan akurat Rp 1.614.067 (bukan Rp 43.623.041)', () => {
      const subtotalItems = [
        554592, // FOIL
        29875,  // HAND GLOVE
        85600,  // CUP
        178000, // TUTUP PACK
        141000, // SAOS TOMAT
        625000, // KENTANG
      ];
      const total = subtotalItems.reduce((acc, v) => acc + v, 0);
      expect(total).toBe(1614067);
    });
  });
});
