export interface InfoLayananHealth {
  target: string
  status: string
  latensi_ms: number | null
  aktivitas_terakhir?: string | null
}

export interface InfoDatabase {
  status: 'terhubung' | 'terputus'
  latensi_ms: number
  total_outlet: number
  layanan: InfoLayananHealth[]
}

export interface KonteksSistemHermes {
  sekarang: Date
  database: () => Promise<InfoDatabase>
}

