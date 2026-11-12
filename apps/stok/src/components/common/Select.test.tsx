import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Select } from '@suka/design-system'

describe('Design System Select (aturan > 5 opsi wajib search bar)', () => {
  it('tidak menampilkan search bar bila total opsi <= 5', () => {
    const onChange = vi.fn()
    render(
      <Select
        aria-label="Pilih Rentang"
        value="7"
        onChange={onChange}
        searchPlaceholder="Cari rentang..."
        options={[
          { value: '1', label: 'Hari Ini' },
          { value: '7', label: '7 Hari Terakhir' },
          { value: '30', label: '30 Hari Terakhir' },
          { value: '90', label: '90 Hari Terakhir' },
          { value: 'all', label: 'Semua Riwayat' },
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pilih Rentang' }))
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.queryByPlaceholderText('Cari rentang...')).toBeNull()
  })

  it('otomatis menampilkan search bar bila total opsi > 5 dan memfilter pilihan', () => {
    const onChange = vi.fn()
    render(
      <Select
        aria-label="Filter Bahan Baku"
        value="ALL"
        onChange={onChange}
        searchPlaceholder="Cari bahan baku..."
        options={[
          { value: 'ALL', label: 'Semua Bahan Baku' },
          { value: 'ayam', label: 'AYAM (Kg)' },
          { value: 'bawang', label: 'BAWANG (Bal)' },
          { value: 'foil5', label: 'FOIL 5M (Dus)' },
          { value: 'foil76', label: 'FOIL 7,6M (Dus)' },
          { value: 'keju', label: 'KEJU (Dus)' },
        ]}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filter Bahan Baku' }))

    const searchInput = screen.getByPlaceholderText('Cari bahan baku...') as HTMLInputElement
    expect(searchInput).toBeTruthy()
    expect(searchInput.type).toBe('text')

    fireEvent.change(searchInput, { target: { value: 'foil 7' } })

    expect(screen.getByRole('option', { name: /FOIL 7,6M/i })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /AYAM/i })).toBeNull()

    fireEvent.click(screen.getByRole('option', { name: /FOIL 7,6M/i }))
    expect(onChange).toHaveBeenCalledWith('foil76')
  })

  it('menghitung total opsi gabungan pada groups untuk aturan > 5 dan mendukung tombol reset clearable', () => {
    const onChange = vi.fn()
    render(
      <Select
        aria-label="Filter Outlet"
        value="o2"
        onChange={onChange}
        clearable
        clearValue="all"
        clearTitle="Reset outlet"
        searchPlaceholder="Cari outlet..."
        options={[{ value: 'all', label: 'Semua Outlet Aktif' }]}
        groups={[
          {
            label: 'OUTLET INTERNAL',
            options: [
              { value: 'o1', label: 'CIMANGGU' },
              { value: 'o2', label: 'PAJAJARAN' },
              { value: 'o3', label: 'DRAMAGA' },
            ],
          },
          {
            label: 'OUTLET MITRA',
            options: [
              { value: 'm1', label: 'MITRA SENTUL' },
              { value: 'm2', label: 'MITRA CILEUNGSI' },
            ],
          },
        ]}
      />
    )

    // Total 1 + 3 + 2 = 6 (> 5), maka search bar wajib muncul saat dibuka
    fireEvent.click(screen.getByRole('button', { name: 'Filter Outlet' }))
    expect(screen.getByPlaceholderText('Cari outlet...')).toBeTruthy()

    // Klik tombol clear pada trigger mereset ke clearValue tanpa memilih manual
    fireEvent.click(screen.getByRole('button', { name: 'Reset outlet' }))
    expect(onChange).toHaveBeenCalledWith('all')
  })
})
