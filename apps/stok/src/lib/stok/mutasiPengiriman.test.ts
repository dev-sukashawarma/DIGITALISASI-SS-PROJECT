import { describe, it, expect } from 'vitest';
import { convertToBaseUnit, convertToDistribusiUnit, convertGramToBesar } from '@/lib/format/compositeUnit';

describe('Mutasi Pengiriman — Validasi Kuantitas & Stok Outlet', () => {
  const KENTANG = {
    id: 'a606d977-266a-4526-8ba6-a92b3760aff2',
    nama: 'KENTANG',
    satuan: 'Dus',
    satuan_tengah: 'Kg',
    faktor_tengah: 10,
    satuan_kecil: 'Gram',
    faktor_tampilan: 10000,
    satuan_distribusi: 'kg',
  };

  const KULIT_25 = {
    id: '860ca70e-8546-4ea4-a0c7-c02952bb006e',
    nama: 'KULIT 25',
    satuan: 'Pack',
    satuan_kecil: 'Lembar',
    faktor_tampilan: 20,
    satuan_distribusi: 'pack',
  };

  it('menghitung stok tersedia dalam satuan distribusi dengan benar saat saldo_is_gram = true', () => {
    // Kentang saldo 12500 Gram -> 1.25 Dus -> 12.5 kg
    const saldoRaw = 12500;
    const saldoBesar = convertGramToBesar(saldoRaw, KENTANG);
    expect(saldoBesar).toBe(1.25);
    const distQty = convertToDistribusiUnit(saldoBesar, KENTANG);
    expect(distQty).toBe(12.5);

    // Bandingkan dengan permintaan awal 18 kg (1.8 Dus)
    const diajukanDist = 18;
    expect(diajukanDist > distQty).toBe(true); // Melebihi stok!
  });

  it('mengonversi qty_dikirim yang disesuaikan kembali ke base unit untuk database', () => {
    // User menyesuaikan kirim kentang dari 18 kg ke 12.5 kg (stok maksimal yang ada)
    const disesuaikanDist = 12.5;
    const baseQty = convertToBaseUnit(disesuaikanDist, KENTANG);
    expect(baseQty).toBe(1.25); // 1.25 Dus

    // Untuk Kulit 25: saldo 360 lembar -> 18 pack. User kirim 18 pack:
    const baseKulit = convertToBaseUnit(18, KULIT_25);
    expect(baseKulit).toBe(18); // 18 Pack
  });
});
