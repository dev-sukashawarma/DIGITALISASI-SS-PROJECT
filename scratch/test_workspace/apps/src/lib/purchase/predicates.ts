// Predikat role pengadaan. HARUS cocok dengan guard RPC di
// 20260723100100_purchase_rpcs_guards.sql — satu sumber aturan, dua tempat pakai.
export function canComposePO(role: string): boolean {
  return ['admin', 'kitchen', 'purchase'].includes(role)
}
export function canVerifyReceipt(role: string): boolean {
  // Purchase SENGAJA dikecualikan — tak boleh jadi hakim atas barangnya sendiri.
  return ['kitchen', 'admin', 'owner'].includes(role)
}
export function canApprovePOFinance(role: string): boolean {
  return ['admin_finance', 'owner', 'admin'].includes(role)
}
