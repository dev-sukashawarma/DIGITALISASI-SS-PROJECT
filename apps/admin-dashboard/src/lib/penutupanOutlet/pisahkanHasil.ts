/**
 * Memisahkan hasil Promise.allSettled: satu outlet yang gagal dimuat tidak
 * boleh mengosongkan seluruh daftar Penutupan. `label[i]` = nama untuk hasil ke-i.
 */
export function pisahkanHasil<T>(
  hasil: PromiseSettledResult<T>[],
  label: string[],
): { ok: T[]; gagal: string[] } {
  const ok: T[] = []
  const gagal: string[] = []
  hasil.forEach((h, i) => {
    if (h.status === 'fulfilled') ok.push(h.value)
    else gagal.push(label[i] ?? `#${i + 1}`)
  })
  return { ok, gagal }
}
