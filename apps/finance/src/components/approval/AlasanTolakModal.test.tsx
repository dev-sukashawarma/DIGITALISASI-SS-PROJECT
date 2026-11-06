import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AlasanTolakModal } from './AlasanTolakModal'

function pasang(onKonfirmasi = vi.fn().mockResolvedValue(undefined)) {
  render(<AlasanTolakModal isOpen judul="Tolak pengajuan" onClose={() => {}} onKonfirmasi={onKonfirmasi} />)
  return onKonfirmasi
}

describe('AlasanTolakModal', () => {
  it('tombol Tolak mati selama alasan kosong atau hanya spasi', () => {
    pasang()
    const tombol = screen.getByRole('button', { name: 'Tolak' })
    expect(tombol).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    expect(tombol).toBeDisabled()
  })

  it('mengirim alasan yang sudah di-trim', async () => {
    const onKonfirmasi = pasang()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' stok habis ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }))
    await waitFor(() => expect(onKonfirmasi).toHaveBeenCalledWith('stok habis'))
  })

  it('tidak merender apa pun saat tertutup', () => {
    const { container } = render(
      <AlasanTolakModal isOpen={false} judul="x" onClose={() => {}} onKonfirmasi={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
