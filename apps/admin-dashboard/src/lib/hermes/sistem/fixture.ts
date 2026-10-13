import type { KonteksSistemHermes } from './tipe'

export const sistemPalsu: KonteksSistemHermes = {
  sekarang: new Date('2026-10-07T07:00:00Z'),
  database: async () => 'terhubung',
}
