import type { KonteksSistemHermes, InfoDatabase } from '../sistem/tipe'

export function buatKonteksSistem(svc: any, sekarang: Date): KonteksSistemHermes {
  return {
    sekarang,
    database: async (): Promise<InfoDatabase> => {
      const t0 = Date.now()
      try {
        const [outletsRes, healthRes] = await Promise.all([
          svc.from('outlets').select('id', { count: 'exact', head: true }),
          svc.from('system_health_latest').select('target_name, status, response_time_ms, last_activity_at'),
        ])
        const latensi_ms = Date.now() - t0
        const status = outletsRes.error ? 'terputus' : 'terhubung'
        const total_outlet = outletsRes.count ?? 0
        const layanan = (healthRes.data ?? []).map((h: any) => ({
          target: h.target_name,
          status: h.status,
          latensi_ms: h.response_time_ms,
          aktivitas_terakhir: h.last_activity_at,
        }))

        return {
          status,
          latensi_ms,
          total_outlet,
          layanan,
        }
      } catch {
        return {
          status: 'terputus',
          latensi_ms: Date.now() - t0,
          total_outlet: 0,
          layanan: [],
        }
      }
    },
  }
}
