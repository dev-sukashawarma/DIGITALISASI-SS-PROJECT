import { describe, it, expect } from 'vitest';

/**
 * Logika perhitungan penyusutan aset inventaris outlet
 * Nilai Sisa = Harga Beli * (1 - (Tingkat Penyusutan * Tahun))
 */
export function calculateBookValue(
  purchasePrice: number,
  annualDepreciationRate: number,
  yearsUsed: number
): number {
  if (purchasePrice <= 0) return 0;
  if (annualDepreciationRate <= 0) return purchasePrice;
  const totalDepreciation = annualDepreciationRate * yearsUsed;
  const remainingFraction = Math.max(0, 1 - totalDepreciation);
  return Math.round(purchasePrice * remainingFraction);
}

/**
 * Validasi kelayakan kondisi fisik aset
 */
export function isOperationalAsset(condition: 'baik' | 'perlu_perbaikan' | 'rusak' | 'tidak_ada'): boolean {
  return condition === 'baik' || condition === 'perlu_perbaikan';
}

describe('Inventory Asset Calculations (Inventori)', () => {
  it('calculates initial book value with zero years used', () => {
    const value = calculateBookValue(10_000_000, 0.1, 0);
    expect(value).toBe(10_000_000);
  });

  it('calculates depreciated value after 3 years at 10% per year', () => {
    const value = calculateBookValue(10_000_000, 0.1, 3);
    // 10M * (1 - 0.30) = 7M
    expect(value).toBe(7_000_000);
  });

  it('does not drop book value below zero when fully depreciated', () => {
    const value = calculateBookValue(10_000_000, 0.25, 6);
    // 10M * (1 - 1.5) -> clamped to 0
    expect(value).toBe(0);
  });

  it('identifies operational vs non-operational assets', () => {
    expect(isOperationalAsset('baik')).toBe(true);
    expect(isOperationalAsset('perlu_perbaikan')).toBe(true);
    expect(isOperationalAsset('rusak')).toBe(false);
    expect(isOperationalAsset('tidak_ada')).toBe(false);
  });
});
