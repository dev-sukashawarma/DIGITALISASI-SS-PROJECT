export interface KonteksSistemHermes {
  sekarang: Date
  database: () => Promise<'terhubung' | 'terputus'>
}
