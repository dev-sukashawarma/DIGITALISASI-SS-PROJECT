
/**
 * Kode 4 digit yang diucapkan pelanggan ke kasir.
 * Deterministik dari client_order_id supaya percobaan kirim ulang
 * menghasilkan kode yang sama, bukan kode baru yang membingungkan.
 * Rentang 1000-9999: tidak pernah berawalan nol, tidak pernah 0000.
 */
export function buatKodeAmbil(clientOrderId: string): string {
  let hash = 0
  for (let i = 0; i < clientOrderId.length; i++) {
    hash = (hash * 31 + clientOrderId.charCodeAt(i)) >>> 0
  }
  return String(1000 + (hash % 9000))
}
