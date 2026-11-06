import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MenungguPanel } from './MenungguPanel'
import { hitungPerJenis, type HubItem } from '@/lib/approval/hub'

const now = new Date('2026-11-06T12:00:00Z')

function item(jenis: HubItem['jenis'], id: string, menungguSejak: string, nominal = 100000): HubItem {
  return { key: `${jenis}:${id}`, id, jenis, judul: `Judul ${id}`, keterangan: '', nominal, menungguSejak, detailHref: null, data: {} } as HubItem
}

function pasang(items: HubItem[], galat: HubItem['jenis'][] = []) {
  render(
    <MenungguPanel
      items={items}
      galat={galat}
      isLoading={false}
      perJenis={hitungPerJenis(items)}
      now={now}
      bolehPutuskan
      onSetujui={vi.fn()}
      onTolak={vi.fn()}
    />,
  )
}

describe('MenungguPanel', () => {
  it('memisahkan pengajuan lewat 24 jam dari yang baru masuk', () => {
    pasang([item('po', 'lama', '2026-11-04T08:00:00Z'), item('petty_cash', 'baru', '2026-11-06T10:00:00Z')])
    const lama = screen.getByRole('region', { name: /Lewat 24 jam/ })
    const baru = screen.getByRole('region', { name: /Baru masuk/ })
    expect(within(lama).getByText('Judul lama')).toBeInTheDocument()
    expect(within(baru).getByText('Judul baru')).toBeInTheDocument()
  })

  it('saringan jenis hanya menampilkan jenis itu', () => {
    pasang([item('po', 'a', '2026-11-06T10:00:00Z'), item('petty_cash', 'b', '2026-11-06T10:00:00Z')])
    fireEvent.click(screen.getByRole('button', { name: /Approval PO/ }))
    expect(screen.getByText('Judul a')).toBeInTheDocument()
    expect(screen.queryByText('Judul b')).toBeNull()
  })

  it('sumber yang gagal dimuat ditandai, bukan dihitung nol', () => {
    pasang([item('po', 'a', '2026-11-06T10:00:00Z')], ['dana_kantor'])
    expect(screen.getByRole('button', { name: /Dana kantor/ })).toHaveTextContent('Gagal dimuat')
  })

  it('kosong: memberi tahu tidak ada pekerjaan', () => {
    pasang([])
    expect(screen.getByText('Tidak ada pengajuan yang menunggu')).toBeInTheDocument()
  })
})
