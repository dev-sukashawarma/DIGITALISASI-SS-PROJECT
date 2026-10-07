import { tanganiPesan, VERSI_PROTOKOL, type AlatMcp, type KonteksMcp, type HasilAlat } from './mcp'

const alat = (nama: string, domain: AlatMcp['domain'], hasil: HasilAlat): AlatMcp => ({
  nama, domain, deskripsi: `alat ${nama}`, skemaInput: { type: 'object', properties: {} },
  jalankan: vi.fn(async () => hasil),
})
const k = (scope: KonteksMcp['scope'], extra: AlatMcp[] = []): KonteksMcp => ({
  scope,
  alat: [alat('omzet', 'penjualan', { ok: true, data: { status: 'ok', omzet: 1 } }), alat('rahasia_finance', 'finance', { ok: true, data: {} }), ...extra],
})

describe('MCP JSON-RPC', () => {
  it('initialize menyepakati versi yang didukung', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, k(['penjualan']))
    expect(r.jawaban?.result).toMatchObject({ protocolVersion: '2025-03-26', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'suka-shawarma' } })
  })
  it('initialize dengan versi asing → versi terbaru kita', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, k(['penjualan']))
    expect((r.jawaban?.result as any).protocolVersion).toBe(VERSI_PROTOKOL[0])
  })
  it('notifikasi (tanpa id) → tanpa jawaban', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', method: 'notifications/initialized' }, k(['penjualan']))
    expect(r.jawaban).toBeNull()
  })
  it('ping → objek kosong', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 'p', method: 'ping' }, k(['penjualan']))
    expect(r.jawaban).toEqual({ jsonrpc: '2.0', id: 'p', result: {} })
  })
  it('tools/list hanya menampilkan alat dalam scope', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, k(['penjualan']))
    const tools = (r.jawaban?.result as any).tools
    expect(tools.map((t: any) => t.name)).toEqual(['omzet'])
    expect(tools[0]).toEqual({ name: 'omzet', description: 'alat omzet', inputSchema: { type: 'object', properties: {} } })
  })
  it('tools/call alat dalam scope → content teks JSON', async () => {
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'omzet', arguments: { periode: 'kemarin' } } }, k(['penjualan']))
    const res = r.jawaban?.result as any
    expect(res.isError).toBe(false)
    expect(JSON.parse(res.content[0].text)).toEqual({ status: 'ok', omzet: 1 })
    expect(res.structuredContent).toEqual({ status: 'ok', omzet: 1 })
    expect(r.log).toEqual({ alat: 'omzet', status: 'ok' })
  })
  it('tools/call alat di luar scope → error seperti alat tak dikenal (tak membocorkan keberadaan)', async () => {
    const konteks = k(['penjualan'])
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'rahasia_finance' } }, konteks)
    expect(r.jawaban?.error).toEqual({ code: -32602, message: 'Alat tidak dikenal: rahasia_finance' })
    expect(konteks.alat[1].jalankan).not.toHaveBeenCalled()
    expect(r.log).toEqual({ alat: 'rahasia_finance', status: 'ditolak', alasan: 'di luar scope atau tak dikenal' })
  })
  it('alat gagal → isError true + pesan, BUKAN angka 0', async () => {
    const r = await tanganiPesan(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'rusak' } },
      k(['penjualan'], [alat('rusak', 'penjualan', { ok: false, pesan: 'Data tidak tersedia: timeout' })]),
    )
    const res = r.jawaban?.result as any
    expect(res.isError).toBe(true)
    expect(res.content[0].text).toBe('Data tidak tersedia: timeout')
    expect(r.log).toEqual({ alat: 'rusak', status: 'galat', alasan: 'Data tidak tersedia: timeout' })
  })
  it('alat melempar exception → isError true', async () => {
    const meledak: AlatMcp = { nama: 'meledak', domain: 'penjualan', deskripsi: '', skemaInput: {}, jalankan: async () => { throw new Error('boom') } }
    const r = await tanganiPesan({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'meledak' } }, k(['penjualan'], [meledak]))
    expect((r.jawaban?.result as any).isError).toBe(true)
    expect((r.jawaban?.result as any).content[0].text).toBe('Data tidak tersedia: boom')
  })
  it('method tak dikenal → -32601; pesan rusak → -32600; batch → -32600', async () => {
    expect((await tanganiPesan({ jsonrpc: '2.0', id: 7, method: 'resources/list' }, k(['penjualan']))).jawaban?.error?.code).toBe(-32601)
    expect((await tanganiPesan({ id: 8, method: 'ping' }, k(['penjualan']))).jawaban?.error?.code).toBe(-32600)
    expect((await tanganiPesan([{ jsonrpc: '2.0', id: 9, method: 'ping' }], k(['penjualan']))).jawaban?.error?.code).toBe(-32600)
  })
})
