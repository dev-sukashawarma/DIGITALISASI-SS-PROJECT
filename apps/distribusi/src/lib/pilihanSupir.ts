// Pilihan "Supir Internal" di tanda tangan SJ. Semua staf aktif tetap bisa
// dipilih: di lapangan crew (mis. Fahmi, Ismansyah) yang paling sering
// mengantar. Akun ber-role driver hanya diletakkan paling atas.
export function pilihanSupirInternal(staf: { name: string; role: string }[]): string[] {
  const driver = staf.filter((s) => s.role === 'driver')
  const lain = staf.filter((s) => s.role !== 'driver')
  return [...driver, ...lain].map((s) => s.name)
}
