import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BarisHub } from './BarisHub'
import type { HubItem } from '@/lib/approval/hub'

const now = new Date('2026-11-06T12:00:00Z')

function item(jenis: HubItem['jenis'], menungguSejak: string): HubItem {
  return {
    key: `${jenis}:1`,
    id: '1',
    jenis,
    judul: 'Mitra Cibinong',
    keterangan: 'Andi · beli gas',
    nominal: 500000,
    menungguSejak,
    detailHref: null,
    data: {},
  } as HubItem
}

function pasang(i: HubItem, bolehPutuskan = true) {
  const onSetujui = vi.fn()
  const onTolak = vi.fn()
  render(<BarisHub item={i} now={now} bolehPutuskan={bolehPutuskan} onSetujui={onSetujui} onTolak={onTolak} />)
  return { onSetujui, onTolak }
}

describe('BarisHub', () => {
  it('serah ke AM hanya punya tombol Serahkan ke AM, tanpa Tolak', () => {
    const { onSetujui } = pasang(item('serah_am', '2026-11-06T10:00:00Z'))
    expect(screen.queryByRole('button', { name: 'Tolak' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Serahkan ke AM' }))
    expect(onSetujui).toHaveBeenCalledTimes(1)
  })

  it('dana kantor memakai tombol Verifikasi dan Tolak', () => {
    const { onTolak } = pasang(item('dana_kantor', '2026-11-06T10:00:00Z'))
    expect(screen.getByRole('button', { name: 'Verifikasi' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }))
    expect(onTolak).toHaveBeenCalledTimes(1)
  })

  it('umur lebih dari 24 jam ditandai merah', () => {
    pasang(item('po', '2026-11-05T06:00:00Z'))
    expect(screen.getByTestId('umur-hub')).toHaveClass('text-red-600')
  })

  it('umur di bawah 24 jam tidak merah', () => {
    pasang(item('po', '2026-11-06T06:00:00Z'))
    expect(screen.getByTestId('umur-hub')).not.toHaveClass('text-red-600')
  })

  it('tanpa hak memutuskan, semua tombol terkunci', () => {
    pasang(item('petty_cash', '2026-11-06T10:00:00Z'), false)
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tolak' })).toBeDisabled()
  })

  it('menampilkan nomor rekening tujuan dan tombol salin bila tersedia', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const i = {
      ...item('petty_cash', '2026-11-06T10:00:00Z'),
      rekeningTujuan: { bank: 'BCA', nomor: '1234567890', atasNama: 'Budi' },
    }
    pasang(i)
    const el = screen.getByTestId('rekening-tujuan')
    expect(el).toHaveTextContent('BCA')
    expect(el).toHaveTextContent('1234567890')
    expect(el).toHaveTextContent('a.n. Budi')
    fireEvent.click(screen.getByRole('button', { name: 'Salin nomor rekening 1234567890' }))
    expect(writeText).toHaveBeenCalledWith('1234567890')
  })

  it('tidak menampilkan baris rekening tujuan bila kosong', () => {
    pasang(item('po', '2026-11-06T10:00:00Z'))
    expect(screen.queryByTestId('rekening-tujuan')).toBeNull()
  })

  it('retur vendor memakai Setujui dan Tolak (alasan diminta di modal tolak)', () => {
    const { onSetujui, onTolak } = pasang(item('retur_vendor', '2026-11-06T10:00:00Z'))
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }))
    expect(onTolak).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    expect(onSetujui).toHaveBeenCalledTimes(1)
  })
})
