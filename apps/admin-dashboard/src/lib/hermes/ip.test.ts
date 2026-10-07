import { ipKlien, ipDiizinkan, ipValid, normalisasiIp } from './ip'

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
