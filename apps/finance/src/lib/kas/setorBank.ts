/** Pecahan terkecil yang disetor ke bank. Sama dengan RPC `record_setor_bank`. */
export const KELIPATAN_SETOR_BANK = 50_000

/**
 * Hitung receh Setor ke Bank. Pesan galat sengaja identik dengan RPC
 * `record_setor_bank` supaya layar dan database bicara sama.
 */
export function hitungSetorBank(i: { saldoTunai: number; diambil: number; keBank: number }): {
  receh: number
  galat: string | null
} {
  const receh = Math.max(0, i.diambil - i.keBank)
  let galat: string | null = null
  if (!(i.keBank > 0)) galat = 'Nominal ke bank harus lebih dari 0'
  else if (i.keBank % KELIPATAN_SETOR_BANK !== 0) galat = 'Nominal ke bank harus kelipatan Rp 50.000'
  else if (i.keBank > i.diambil) galat = 'Nominal ke bank tidak boleh melebihi uang yang diambil'
  else if (i.diambil > i.saldoTunai) galat = 'Uang yang diambil melebihi saldo Kas Setoran Tunai'
  return { receh, galat }
}
