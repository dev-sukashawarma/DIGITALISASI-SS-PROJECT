import { describe, it, expect } from 'vitest';
import { resolvePawoonProductRow } from './pawoonProduct';

// Kasus-kasus di bawah diambil dari baris asli file Pawoon Juli 2026
// (INTERNAL/BEJI/1-24.xls, struk VPRKSZRQMP97Y & BMPDSG6BQRG6Q).
describe('resolvePawoonProductRow', () => {
    it('memproses produk biasa apa adanya', () => {
        expect(resolvePawoonProductRow('AYAM SEDANG', 24000, 3)).toEqual({
            action: 'item',
            lookupName: 'AYAM SEDANG',
            isModifier: false,
        });
    });

    it('membuang modifier gratis (qty-nya menggandakan qty induk)', () => {
        expect(resolvePawoonProductRow(' + Tidak pedas', 0, 3)).toEqual({
            action: 'skip',
            reason: 'modifier-gratis',
        });
        expect(resolvePawoonProductRow(' + Tanpa sayur', 0, 1)).toEqual({
            action: 'skip',
            reason: 'modifier-gratis',
        });
    });

    // Inti bug: baris ini DULU ikut dibuang, padahal nilainya sudah masuk kolom
    // Total struk — sehingga order_items selalu kurang dari orders.total_amount.
    it('MEMPERTAHANKAN modifier berbayar dan membuang tanda + agar cocok dengan mapping', () => {
        expect(resolvePawoonProductRow(' + EXTRA KEJU', 7000, 9)).toEqual({
            action: 'item',
            lookupName: 'EXTRA KEJU',
            isModifier: true,
        });
        expect(resolvePawoonProductRow('+ EXTRA KENTANG', 9000, 1)).toEqual({
            action: 'item',
            lookupName: 'EXTRA KENTANG',
            isModifier: true,
        });
    });

    it('mengenali modifier berbayar pada baris void (nilai negatif)', () => {
        expect(resolvePawoonProductRow(' + EXTRA KEJU', -7000, -1)).toEqual({
            action: 'item',
            lookupName: 'EXTRA KEJU',
            isModifier: true,
        });
    });

    it('membuang baris tanpa nama produk', () => {
        expect(resolvePawoonProductRow('', 0, 0)).toEqual({ action: 'skip', reason: 'kosong' });
        expect(resolvePawoonProductRow(null, 0, 0)).toEqual({ action: 'skip', reason: 'kosong' });
        expect(resolvePawoonProductRow(undefined, 0, 0)).toEqual({ action: 'skip', reason: 'kosong' });
    });
});
