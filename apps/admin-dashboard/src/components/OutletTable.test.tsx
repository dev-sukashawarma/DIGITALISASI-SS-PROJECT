import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OutletTable } from './OutletTable'
import type { Outlet } from '@/lib/types'

const mockOutlets: Outlet[] = [
  {
    id: 'out-1',
    name: 'Suka Shawarma Margonda',
    slug: 'ss-margonda',
    address: 'Jl. Margonda Raya No. 100, Depok',
    lat: -6.3728,
    lng: 106.8317,
    type: 'outlet',
    is_active: true,
    marquee_warning_threshold: 10,
    open_hour: '14:00',
    close_hour: '22:00',
  },
  {
    id: 'out-2',
    name: 'Suka Shawarma Tebet',
    slug: 'ss-tebet',
    address: 'Jl. Tebet Raya No. 45',
    lat: 0,
    lng: 0,
    type: 'mitra',
    is_active: false,
    marquee_warning_threshold: 15,
  },
]

describe('OutletTable', () => {
  it('merender empty state dengan benar saat rows kosong', () => {
    const onReset = vi.fn()
    render(<OutletTable rows={[]} onResetFilter={onReset} />)

    expect(screen.getByText('Tidak ada outlet yang sesuai')).toBeInTheDocument()
    const resetBtn = screen.getByRole('button', { name: /Reset Filter/i })
    fireEvent.click(resetBtn)
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('merender baris outlet beserta data pentingnya', () => {
    render(<OutletTable rows={mockOutlets} />)

    // Name and slug check
    expect(screen.getAllByText('Suka Shawarma Margonda').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ss-margonda').length).toBeGreaterThan(0)

    // Badges check
    expect(screen.getAllByText('Cabang Reguler').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Mitra SS').length).toBeGreaterThan(0)

    // Status check
    expect(screen.getAllByText('Aktif').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nonaktif').length).toBeGreaterThan(0)
  })

  it('merender link Google Maps saat koordinat valid dan alert belum diatur saat koordinat 0,0', () => {
    render(<OutletTable rows={mockOutlets} />)

    // out-1 has coordinates (-6.3728, 106.8317)
    const mapLinks = screen.getAllByRole('link', { name: /Buka titik koordinat di Google Maps|Buka Google Maps/i })
    expect(mapLinks.length).toBeGreaterThan(0)
    expect(mapLinks[0]).toHaveAttribute('href', expect.stringContaining('google.com/maps?q=-6.3728,106.8317'))

    // out-2 has 0, 0 coordinates -> shows "Belum diatur" or "Titik GPS belum diatur"
    expect(screen.getAllByText(/Belum diatur/i).length).toBeGreaterThan(0)
  })

  it('memanggil handler aksi onEdit, onToggleActive, onDelete, onManageInvestment', () => {
    const onEdit = vi.fn()
    const onToggleActive = vi.fn()
    const onDelete = vi.fn()
    const onManageInvestment = vi.fn()

    render(
      <OutletTable
        rows={mockOutlets}
        onEdit={onEdit}
        onToggleActive={onToggleActive}
        onDelete={onDelete}
        onManageInvestment={onManageInvestment}
      />
    )

    // Trigger edit on first outlet
    const editBtns = screen.getAllByTitle('Edit Data Outlet')
    fireEvent.click(editBtns[0])
    expect(onEdit).toHaveBeenCalledWith(mockOutlets[0])

    // Trigger toggle active on first outlet
    const toggleBtns = screen.getAllByTitle('Nonaktifkan Outlet')
    fireEvent.click(toggleBtns[0])
    expect(onToggleActive).toHaveBeenCalledWith(mockOutlets[0])

    // Trigger delete on first outlet
    const deleteBtns = screen.getAllByTitle('Hapus Outlet')
    fireEvent.click(deleteBtns[0])
    expect(onDelete).toHaveBeenCalledWith(mockOutlets[0])

    // Trigger manage investment on mitra outlet
    const investBtns = screen.getAllByTitle('Kelola Modal Mitra')
    fireEvent.click(investBtns[0])
    expect(onManageInvestment).toHaveBeenCalledWith(mockOutlets[1])
  })
})
