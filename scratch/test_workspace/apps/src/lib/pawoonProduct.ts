/**
 * Keputusan untuk satu baris produk di file Pawoon.
 *
 * Pawoon menulis modifier sebagai baris tersendiri berawalan "+" di bawah produk
 * induknya, dan modifier itu ada DUA jenis:
 *
 *   " + Tidak pedas"   harga 0      -> catatan pesanan, bukan barang terjual
 *   " + EXTRA KEJU"    harga 7.000  -> barang terjual, ikut dihitung di kolom Total struk
 *
 * Dulu keduanya dibuang oleh `productName.startsWith('+')`. Akibatnya
 * `orders.total_amount` (dari kolom Total, sudah termasuk extra) TIDAK PERNAH sama
 * dengan jumlah `order_items` — terukur di DB 2026-07-31: 200 order kurang total
 * Rp 2.093.000, dan 383 EXTRA KEJU + 33 EXTRA KENTANG hilang dari rekap item
 * sepanjang Juli.
 *
 * Modifier gratis tetap dibuang: qty-nya menggandakan qty induk (mis. induk qty 3
 * → " + Tidak pedas" qty 3) sehingga kalau ikut dicatat, jumlah item terjual jadi
 * menggelembung tanpa menambah nilai apa pun.
 */
export type PawoonRowDecision =
    | { action: 'skip'; reason: 'kosong' | 'modifier-gratis' }
    | { action: 'item'; lookupName: string; isModifier: boolean };

export function resolvePawoonProductRow(
    rawProductName: unknown,
    price: number,
    qty: number
): PawoonRowDecision {
    const name = rawProductName == null ? '' : rawProductName.toString().trim();

    if (!name) return { action: 'skip', reason: 'kosong' };

    if (name.startsWith('+')) {
        // Nilai dihitung dari |harga| × |qty| supaya baris void (yang bertanda
        // negatif) tetap dikenali sebagai modifier berbayar.
        const value = Math.abs(price || 0) * Math.abs(qty || 0);
        if (value === 0) return { action: 'skip', reason: 'modifier-gratis' };

        // Buang "+" di depan agar cocok dengan kunci mapping yang sudah ada
        // ("EXTRA KEJU", "EXTRA KENTANG").
        return {
            action: 'item',
            lookupName: name.replace(/^\+\s*/, '').trim(),
            isModifier: true,
        };
    }

    return { action: 'item', lookupName: name, isModifier: false };
}
