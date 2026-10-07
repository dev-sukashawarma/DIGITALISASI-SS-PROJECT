import { urlChat, kunciProfil, buatPengurai, tanyaHermes, GalatHermes } from './hermes'

const delta = (t: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`

function respons(potongan: string[], status = 200) {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) { for (const p of potongan) c.enqueue(enc.encode(p)); c.close() },
  })
  return new Response(body, { status, headers: { 'content-type': 'text/event-stream' } })
}

describe('hermes', () => {
  it('urlChat memakai prefix profil', () => {
    expect(urlChat('http://10.0.1.1:8643/', 'ceo')).toBe('http://10.0.1.1:8643/p/ceo/v1/chat/completions')
  })
  it('kunciProfil membaca HERMES_KEY_<PROFIL>', () => {
    expect(kunciProfil('ceo', { HERMES_KEY_CEO: 'k' })).toBe('k')
    expect(kunciProfil('ceo', {})).toBeNull()
  })
  it('pengurai: potongan terbelah, komentar, [DONE]', () => {
    const p = buatPengurai()
    const satu = delta('Omzet ')
    expect(p.masukkan(satu.slice(0, 10))).toEqual([])
    expect(p.masukkan(satu.slice(10) + ': ping\n\n' + delta('Rp 1'))).toEqual(['Omzet ', 'Rp 1'])
    expect(p.masukkan('data: [DONE]\n\n')).toEqual([])
    expect(p.selesai).toBe(true)
  })
  it('tanyaHermes: kirim header benar & hasilkan potongan teks', async () => {
    const fetchFn = vi.fn(async () => respons([delta('Halo '), delta('Bos'), 'data: [DONE]\n\n']))
    const keluar: string[] = []
    for await (const t of tanyaHermes({ baseUrl: 'http://h:8643', kunci: 'rahasia', profil: 'ceo', sesiId: 's-1', pesan: 'hai', fetchFn: fetchFn as any })) keluar.push(t)
    expect(keluar.join('')).toBe('Halo Bos')
    const [url, init] = fetchFn.mock.calls[0] as any
    expect(url).toBe('http://h:8643/p/ceo/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer rahasia')
    expect(init.headers['X-Hermes-Session-Id']).toBe('s-1')
    expect(JSON.parse(init.body)).toMatchObject({ stream: true, messages: [{ role: 'user', content: 'hai' }] })
  })
  it('HTTP gagal → GalatHermes http', async () => {
    const fetchFn = vi.fn(async () => new Response('x', { status: 401 }))
    const g = tanyaHermes({ baseUrl: 'http://h', kunci: 'k', profil: 'ceo', sesiId: 's', pesan: 'p', fetchFn: fetchFn as any })
    await expect(g.next()).rejects.toMatchObject({ alasan: 'http' })
  })
  it('stream tanpa teks → GalatHermes kosong', async () => {
    const fetchFn = vi.fn(async () => respons(['data: [DONE]\n\n']))
    const g = tanyaHermes({ baseUrl: 'http://h', kunci: 'k', profil: 'ceo', sesiId: 's', pesan: 'p', fetchFn: fetchFn as any })
    await expect(g.next()).rejects.toBeInstanceOf(GalatHermes)
  })
  it('fetch melempar → GalatHermes jaringan', async () => {
    const fetchFn = vi.fn(async () => { throw new TypeError('fetch failed') })
    const g = tanyaHermes({ baseUrl: 'http://h', kunci: 'k', profil: 'ceo', sesiId: 's', pesan: 'p', fetchFn: fetchFn as any })
    await expect(g.next()).rejects.toMatchObject({ alasan: 'jaringan' })
  })
})
