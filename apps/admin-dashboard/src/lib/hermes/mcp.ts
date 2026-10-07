import type { Domain } from './domain'

// MCP Streamable HTTP: satu objek JSON-RPC per POST, dijawab application/json.
// Notifikasi (tanpa id) tidak dijawab (route membalas 202). Batch tidak didukung.

/** Versi protokol MCP yang kita layani, terbaru dulu. */
export const VERSI_PROTOKOL = ['2025-06-18', '2025-03-26', '2024-11-05'] as const

export type HasilAlat = { ok: true; data: Record<string, unknown> } | { ok: false; pesan: string }

export interface AlatMcp {
  nama: string
  domain: Domain
  deskripsi: string
  skemaInput: Record<string, unknown>
  jalankan(args: unknown): Promise<HasilAlat>
}

export interface KonteksMcp {
  scope: Domain[]
  alat: AlatMcp[]
}

export type JawabanRpc = {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string }
}

type CatatanLog = { alat: string; status: 'ok' | 'galat' | 'ditolak'; alasan?: string }

const INSTRUKSI =
  'Data operasional Suka Shawarma (baca saja). Setiap angka WAJIB berasal dari hasil alat; ' +
  'bila alat gagal, katakan "data tidak tersedia" beserta alasannya. Jangan memperkirakan.'

const galat = (id: JawabanRpc['id'], code: number, message: string): JawabanRpc => ({ jsonrpc: '2.0', id, error: { code, message } })

export async function tanganiPesan(pesan: unknown, k: KonteksMcp): Promise<{ jawaban: JawabanRpc | null; log?: CatatanLog }> {
  if (Array.isArray(pesan)) return { jawaban: galat(null, -32600, 'Batch tidak didukung') }
  if (!pesan || typeof pesan !== 'object') return { jawaban: galat(null, -32600, 'Invalid Request') }
  const p = pesan as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: any }
  const adaId = Object.prototype.hasOwnProperty.call(p, 'id')
  const id = typeof p.id === 'string' || typeof p.id === 'number' ? p.id : null
  if (p.jsonrpc !== '2.0' || typeof p.method !== 'string') return { jawaban: galat(id, -32600, 'Invalid Request') }
  if (!adaId) return { jawaban: null } // notifikasi

  const terlihat = k.alat.filter((a) => k.scope.includes(a.domain))

  switch (p.method) {
    case 'initialize': {
      const diminta = p.params?.protocolVersion
      const versi = (VERSI_PROTOKOL as readonly string[]).includes(diminta) ? diminta : VERSI_PROTOKOL[0]
      return {
        jawaban: {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: versi,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'suka-shawarma', version: '1.0.0' },
            instructions: INSTRUKSI,
          },
        },
      }
    }
    case 'ping':
      return { jawaban: { jsonrpc: '2.0', id, result: {} } }
    case 'tools/list':
      return {
        jawaban: {
          jsonrpc: '2.0', id,
          result: { tools: terlihat.map((a) => ({ name: a.nama, description: a.deskripsi, inputSchema: a.skemaInput })) },
        },
      }
    case 'tools/call': {
      const nama = typeof p.params?.name === 'string' ? p.params.name : ''
      // Alat di luar scope dijawab persis seperti alat tak dikenal — keberadaannya tak dibocorkan.
      const a = terlihat.find((x) => x.nama === nama)
      if (!a) {
        return {
          jawaban: galat(id, -32602, `Alat tidak dikenal: ${nama}`),
          log: { alat: nama || '(kosong)', status: 'ditolak', alasan: 'di luar scope atau tak dikenal' },
        }
      }
      let hasil: HasilAlat
      try {
        hasil = await a.jalankan(p.params?.arguments ?? {})
      } catch (e) {
        hasil = { ok: false, pesan: `Data tidak tersedia: ${e instanceof Error ? e.message : String(e)}` }
      }
      if (!hasil.ok) {
        return {
          jawaban: { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: hasil.pesan }], isError: true } },
          log: { alat: nama, status: 'galat', alasan: hasil.pesan },
        }
      }
      return {
        jawaban: {
          jsonrpc: '2.0', id,
          result: { content: [{ type: 'text', text: JSON.stringify(hasil.data) }], structuredContent: hasil.data, isError: false },
        },
        log: { alat: nama, status: 'ok' },
      }
    }
    default:
      return { jawaban: galat(id, -32601, `Method tidak dikenal: ${p.method}`) }
  }
}
