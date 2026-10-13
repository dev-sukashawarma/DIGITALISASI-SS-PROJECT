import type { KonteksSistemHermes } from './tipe'

export const sistemPalsu: KonteksSistemHermes = {
  sekarang: new Date('2026-10-07T07:00:00Z'),
  database: async () => ({
    status: 'terhubung',
    latensi_ms: 18,
    total_outlet: 20,
    layanan: [
      { target: 'supabase-db', status: 'up', latensi_ms: 18 },
      { target: 'pos-kasir', status: 'up', latensi_ms: 35 },
      { target: 'stok', status: 'up', latensi_ms: 22 },
      { target: 'absensi', status: 'up', latensi_ms: 20 },
    ],
  }),
}
