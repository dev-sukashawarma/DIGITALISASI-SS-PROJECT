import type { KonteksSistemHermes } from '../sistem/tipe'

export function buatKonteksSistem(svc: any, sekarang: Date): KonteksSistemHermes {
  return {
    sekarang,
    database: async (): Promise<'terhubung' | 'terputus'> => {
      try {
        const { error } = await svc.from('outlets').select('id').limit(1)
        return error ? 'terputus' : 'terhubung'
      } catch {
        return 'terputus'
      }
    },
  }
}
