import { describe, it, expect } from 'vitest';
import { convertToBaseUnit, convertToDistribusiUnit } from '@/lib/format/compositeUnit';

describe('Mutasi Antar Outlet — Penyelarasan Satuan dengan Order Gudang', () => {
  const KENTANG = {
    id: 'k-1',
    nama: 'KENTANG',
    satuan: 'Dus',
    satuan_tengah: 'Kg',
    faktor_tengah: 10,
    satuan_kecil: 'Gram',
    faktor_tampilan: 10000,
    satuan_distribusi: 'kg',
  };

  const MAYONAISE = {
    id: 'm-1',
    nama: 'MAYONAISE',
    satuan: 'Dus',
    satuan_tengah: 'Kg',
    faktor_tengah: 12,
    satuan_kecil: 'Gram',
    faktor_tampilan: 12000,
    satuan_distribusi: 'kg',
  };

  const FOIL = {
    id: 'f-1',
    nama: 'FOIL',
    satuan: 'Dus',
    satuan_tengah: 'Roll',
    faktor_tengah: 48,
    satuan_kecil: 'cm',
    faktor_tampilan: 36480,
    satuan_distribusi: 'roll',
  };

  const AYAM = {
    id: 'a-1',
    nama: 'AYAM',
    satuan: 'Kg',
    satuan_tengah: null,
    faktor_tengah: null,
    satuan_kecil: 'Gram',
    faktor_tampilan: 1000,
    satuan_distribusi: 'kg',
  };

  const SAPI = {
    id: 's-1',
    nama: 'SAPI',
    satuan: 'Blok',
    satuan_tengah: 'Kg',
    faktor_tengah: 2,
    satuan_kecil: 'Gram',
    faktor_tampilan: 2000,
    satuan_distribusi: 'blok',
  };

  describe('Form Pengajuan: Konversi input satuan distribusi ke base unit (satuan besar)', () => {
    it('Kentang: input 7.5 kg -> 0.75 Dus (bukan 7500 Dus)', () => {
      const baseQty = convertToBaseUnit(7.5, KENTANG);
      expect(baseQty).toBe(0.75);
    });

    it('Kentang: input 7 kg -> 0.7 Dus (bukan 7 Dus / 70 kg)', () => {
      const baseQty = convertToBaseUnit(7, KENTANG);
      expect(baseQty).toBe(0.7);
    });

    it('Mayonaise: input 6 kg -> 0.5 Dus', () => {
      const baseQty = convertToBaseUnit(6, MAYONAISE);
      expect(baseQty).toBe(0.5);
    });

    it('Foil: input 6 roll -> 0.125 Dus (bukan 6 Dus / 288 roll)', () => {
      const baseQty = convertToBaseUnit(6, FOIL);
      expect(baseQty).toBe(6 / 48);
    });

    it('Ayam: input 5 kg -> 5 Kg (satuan sama)', () => {
      const baseQty = convertToBaseUnit(5, AYAM);
      expect(baseQty).toBe(5);
    });

    it('Sapi: input 3 blok -> 3 Blok (satuan sama)', () => {
      const baseQty = convertToBaseUnit(3, SAPI);
      expect(baseQty).toBe(3);
    });
  });

  describe('Detail & Verifikasi: Konversi base unit dari database kembali ke satuan distribusi', () => {
    it('Kentang: 0.75 Dus tersimpan -> tampil sebagai 7.5 kg', () => {
      const distQty = convertToDistribusiUnit(0.75, KENTANG);
      expect(Math.round(distQty * 100) / 100).toBe(7.5);
    });

    it('Mayonaise: 0.5 Dus tersimpan -> tampil sebagai 6 kg', () => {
      const distQty = convertToDistribusiUnit(0.5, MAYONAISE);
      expect(Math.round(distQty * 100) / 100).toBe(6);
    });

    it('Foil: 0.125 Dus tersimpan -> tampil sebagai 6 roll', () => {
      const distQty = convertToDistribusiUnit(0.125, FOIL);
      expect(Math.round(distQty * 100) / 100).toBe(6);
    });
  });

  describe('Konsistensi Ledger Database (to_ledger_scale expectation)', () => {
    it('Kentang: 0.75 Dus dikali faktor 10000 menghasilkan tepat 7500 gram (7.5 kg)', () => {
      const baseQty = convertToBaseUnit(7.5, KENTANG);
      const ledgerQtyGram = baseQty * KENTANG.faktor_tampilan;
      expect(ledgerQtyGram).toBe(7500); // 7.5 kg
    });

    it('Mayonaise: 0.5 Dus dikali faktor 12000 menghasilkan tepat 6000 gram (6 kg)', () => {
      const baseQty = convertToBaseUnit(6, MAYONAISE);
      const ledgerQtyGram = baseQty * MAYONAISE.faktor_tampilan;
      expect(ledgerQtyGram).toBe(6000); // 6 kg
    });
  });
});
