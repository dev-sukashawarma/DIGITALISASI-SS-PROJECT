import { NextResponse, type NextRequest } from 'next/server'
import { prisma, ensureDatabaseSchema } from '@/lib/prisma'
import { buatKonteksMarcomPrisma } from '@/lib/hermes/server/marcomSumber'
import { DAFTAR_ALAT_MARCOM } from '@/lib/hermes/marcom/registry'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const INSTRUKSI_MARCOM =
  'Data operasional Marketing & Communication Suka Shawarma (baca saja). ' +
  'Setiap angka WAJIB berasal dari hasil alat marcom; dilarang memperkirakan angka sendiri. ' +
  'Bila data kosong atau tidak ditemukan, sampaikan apa adanya.'

function validasiToken(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.slice(7).trim()
  const expectedKey =
    process.env.HERMES_MARCOM_API_KEY || 'hermes_marcom_dev_secret_key'

  return token === expectedKey
}

export async function POST(req: NextRequest) {
  // 1. Validasi Autentikasi Bearer Token
  if (!validasiToken(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse Body JSON-RPC
  let pesan: any
  try {
    pesan = await req.json()
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400 }
    )
  }

  if (!pesan || typeof pesan !== 'object' || Array.isArray(pesan)) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } },
      { status: 400 }
    )
  }

  const id = typeof pesan.id === 'string' || typeof pesan.id === 'number' ? pesan.id : null
  if (pesan.jsonrpc !== '2.0' || typeof pesan.method !== 'string') {
    return NextResponse.json(
      { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } },
      { status: 400 }
    )
  }

  // 3. Tangani Protokol MCP
  switch (pesan.method) {
    case 'initialize': {
      const diminta = pesan.params?.protocolVersion || '2024-11-05'
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: diminta,
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'suka-shawarma-marcom',
            version: '1.0.0',
          },
          instructions: INSTRUKSI_MARCOM,
        },
      })
    }

    case 'ping':
      return NextResponse.json({ jsonrpc: '2.0', id, result: {} })

    case 'tools/list':
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: DAFTAR_ALAT_MARCOM.map((a) => ({
            name: a.name,
            description: a.description,
            inputSchema: a.inputSchema,
          })),
        },
      })

    case 'tools/call': {
      const nama = typeof pesan.params?.name === 'string' ? pesan.params.name : ''
      const alat = DAFTAR_ALAT_MARCOM.find((x) => x.name === nama)

      if (!alat) {
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: `Alat tidak dikenal: ${nama}` },
        })
      }

      try {
        await ensureDatabaseSchema()
        const konteks = buatKonteksMarcomPrisma(prisma, new Date())
        const hasil = await alat.jalankan(konteks, pesan.params?.arguments || {})

        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(hasil) }],
            structuredContent: hasil,
            isError: false,
          },
        })
      } catch (err: any) {
        console.error(`[hermes-marcom] error menjalankan alat ${nama}:`, err)
        return NextResponse.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Data tidak tersedia: ${err?.message || String(err)}` }],
            isError: true,
          },
        })
      }
    }

    default:
      return NextResponse.json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${pesan.method}` },
      })
  }
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
