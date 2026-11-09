export function rupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID')
}
