/**
 * Deskripsi pengajuan petty cash setelah diproses Finance.
 * RPC finance_process_petty_cash_custom menulis p_description pada approve
 * maupun reject, jadi alasan tolak tersimpan tanpa migration.
 */
export function deskripsiPettyCash(input: {
  deskripsiAwal: string
  action: 'approve' | 'reject'
  nominalDiajukan: number
  nominalDisetujui?: number
  catatan?: string | null
}): string {
  const { deskripsiAwal, action, nominalDiajukan, nominalDisetujui } = input
  const catatan = input.catatan?.trim() ?? ''

  if (action === 'reject') {
    return catatan ? `${deskripsiAwal}\n\n[Ditolak Finance: ${catatan}]` : deskripsiAwal
  }

  const final = nominalDisetujui ?? nominalDiajukan
  const dikurangi = Boolean(nominalDisetujui) && nominalDisetujui !== nominalDiajukan
  const rp = (n: number) => n.toLocaleString('id-ID')

  if (catatan) {
    return dikurangi
      ? `${deskripsiAwal}\n\n[Catatan Finance (Acc Rp ${rp(final)} dari Diajukan Rp ${rp(nominalDiajukan)}): ${catatan}]`
      : `${deskripsiAwal}\n\n[Catatan Finance: ${catatan}]`
  }
  if (dikurangi) {
    return `${deskripsiAwal}\n\n[Catatan Finance: Nominal disetujui Rp ${rp(final)} dari diajukan Rp ${rp(nominalDiajukan)}]`
  }
  return deskripsiAwal
}
