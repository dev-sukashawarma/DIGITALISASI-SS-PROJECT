import { ipKlien, ipDiizinkan, ipValid, normalisasiIp, dariCloudflare } from './ip'

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null })

describe('IP klien', () => {
  it('x-real-ip diutamakan', () => {
    expect(ipKlien(h({ 'x-real-ip': '76.13.193.138', 'x-forwarded-for': '1.1.1.1' }))).toBe('76.13.193.138')
  })
  it('tanpa x-real-ip: hop TERAKHIR x-forwarded-for (yang ditambahkan proxy), bukan yang pertama', () => {
    expect(ipKlien(h({ 'x-forwarded-for': '6.6.6.6, 76.13.193.138' }))).toBe('76.13.193.138')
  })
  it('tanpa header → null', () => {
    expect(ipKlien(h({}))).toBeNull()
  })
  it('IPv4-mapped IPv6 dinormalkan', () => {
    expect(normalisasiIp('::ffff:76.13.193.138')).toBe('76.13.193.138')
    expect(ipKlien(h({ 'x-real-ip': '::ffff:10.0.1.1' }))).toBe('10.0.1.1')
  })
  // Produksi (2026-10-07): admin.sukashawarma.com di belakang Cloudflare — x-real-ip yang
  // di-set Traefik = IP edge Cloudflare (172.70.92.232, 104.23.175.17), berganti tiap panggilan.
  it('lewat edge Cloudflare: pakai cf-connecting-ip (IP pemanggil asli)', () => {
    expect(ipKlien(h({ 'x-real-ip': '172.70.92.232', 'cf-connecting-ip': '76.13.193.138' }))).toBe('76.13.193.138')
    expect(ipKlien(h({ 'x-real-ip': '104.23.175.17', 'cf-connecting-ip': '76.13.193.138' }))).toBe('76.13.193.138')
    expect(ipKlien(h({ 'x-real-ip': '2606:4700::1', 'cf-connecting-ip': '2a02:4780:59:ce0d::1' }))).toBe('2a02:4780:59:ce0d::1')
  })
  it('cf-connecting-ip DIABAIKAN bila pengirim bukan Cloudflare (menembak origin langsung = bisa dipalsukan)', () => {
    expect(ipKlien(h({ 'x-real-ip': '9.9.9.9', 'cf-connecting-ip': '76.13.193.138' }))).toBe('9.9.9.9')
  })
  it('edge Cloudflare tanpa / dengan cf-connecting-ip rusak → IP edge (pasti tak ada di allowlist)', () => {
    expect(ipKlien(h({ 'x-real-ip': '172.70.92.232' }))).toBe('172.70.92.232')
    expect(ipKlien(h({ 'x-real-ip': '172.70.92.232', 'cf-connecting-ip': 'bukan-ip' }))).toBe('172.70.92.232')
  })
  it('dariCloudflare mengenali rentang resmi', () => {
    expect(dariCloudflare('172.70.92.232')).toBe(true)
    expect(dariCloudflare('104.23.175.17')).toBe(true)
    expect(dariCloudflare('2606:4700:10::6816:1')).toBe(true)
    expect(dariCloudflare('76.13.193.138')).toBe(false)
    expect(dariCloudflare('172.72.0.1')).toBe(false)
    expect(dariCloudflare('bukan-ip')).toBe(false)
  })
  it('allowlist fail-closed', () => {
    expect(ipDiizinkan('76.13.193.138', ['76.13.193.138'])).toBe(true)
    expect(ipDiizinkan('76.13.193.138', [])).toBe(false)
    expect(ipDiizinkan(null, ['76.13.193.138'])).toBe(false)
    expect(ipDiizinkan('76.13.193.139', ['76.13.193.138'])).toBe(false)
  })
  it('ipValid', () => {
    expect(ipValid('76.13.193.138')).toBe(true)
    expect(ipValid('2a02:4780:59:ce0d::1')).toBe(true)
    expect(ipValid('999.1.1.1')).toBe(false)
    expect(ipValid('abc')).toBe(false)
    expect(ipValid('76.13.193.0/24')).toBe(false)
  })
})
