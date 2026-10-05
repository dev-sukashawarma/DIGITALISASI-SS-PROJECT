import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OutletForm } from './OutletForm'
import { resolveLokasiGoogleMaps } from '@/app/dashboard/outlets/lokasiActions'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  }),
}))

vi.mock('@/app/dashboard/outlets/lokasiActions', () => ({
  resolveLokasiGoogleMaps: vi.fn(),
}))

describe('OutletForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('merender semua kolom form dasar dengan lengkap', () => {
    render(<OutletForm submitting={false} isEdit={false} onSubmit={vi.fn()} />)

    expect(screen.getByText('Quick-Fill dari Google Maps')).toBeInTheDocument()
    expect(screen.getByLabelText('Link Google Maps atau koordinat')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Tempel link Google Maps/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ekstrak Lokasi/i })).toBeInTheDocument()

    expect(screen.getByText('Nama')).toBeInTheDocument()
    expect(screen.getByText('Slug')).toBeInTheDocument()
    expect(screen.getByText('Alamat')).toBeInTheDocument()
    expect(screen.getByText('Latitude')).toBeInTheDocument()
    expect(screen.getByText('Longitude')).toBeInTheDocument()
    expect(screen.getByText('Tipe')).toBeInTheDocument()
    expect(screen.getByText('Batas Peringatan Porsi (Marquee)')).toBeInTheDocument()
    expect(screen.getByText('Jam Buka')).toBeInTheDocument()
    expect(screen.getByText('Jam Tutup')).toBeInTheDocument()
    expect(screen.getByText('Status Outlet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aktif/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pending/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buat Outlet' })).toBeInTheDocument()
  })

  it('menonaktifkan tombol ekstrak jika input link kosong dan menampilkan toast error jika Enter ditekan', async () => {
    render(<OutletForm submitting={false} isEdit={false} onSubmit={vi.fn()} />)

    const btn = screen.getByRole('button', { name: /Ekstrak Lokasi/i })
    expect(btn).toBeDisabled()

    const input = screen.getByLabelText('Link Google Maps atau koordinat')
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(toast.error).toHaveBeenCalledWith('Tempel link Google Maps atau koordinat terlebih dahulu')
  })

  it('mengisi otomatis lat, lng, alamat, nama, dan slug saat ekstraksi berhasil', async () => {
    vi.mocked(resolveLokasiGoogleMaps).mockResolvedValueOnce({
      ok: true,
      lat: -6.597143,
      lng: 106.806038,
      akurasi: 'pin',
      alamat: 'Jl. Pajajaran No. 12, Bogor Timur, Kota Bogor',
      namaTempat: 'Suka Shawarma Pajajaran',
    })

    render(<OutletForm submitting={false} isEdit={false} onSubmit={vi.fn()} />)

    const inputMaps = screen.getByPlaceholderText(/Tempel link Google Maps/i)
    fireEvent.change(inputMaps, {
      target: { value: 'https://maps.app.goo.gl/w1nL6wS8T4e9yJ128' },
    })

    const btnEkstrak = screen.getByRole('button', { name: /Ekstrak Lokasi/i })
    expect(btnEkstrak).not.toBeDisabled()
    fireEvent.click(btnEkstrak)

    await waitFor(() => {
      expect(resolveLokasiGoogleMaps).toHaveBeenCalledWith(
        'https://maps.app.goo.gl/w1nL6wS8T4e9yJ128'
      )
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Lokasi berhasil diekstrak!')
    })

    // Cek bahwa field form terisi
    const namaInput = screen.getByLabelText(/^Nama$/i) as HTMLInputElement
    expect(namaInput.value).toBe('Suka Shawarma Pajajaran')

    const alamatInput = screen.getByLabelText(/^Alamat$/i) as HTMLInputElement
    expect(alamatInput.value).toBe('Jl. Pajajaran No. 12, Bogor Timur, Kota Bogor')

    const latInput = screen.getByLabelText(/^Latitude$/i) as HTMLInputElement
    expect(Number(latInput.value)).toBeCloseTo(-6.597143, 5)

    const lngInput = screen.getByLabelText(/^Longitude$/i) as HTMLInputElement
    expect(Number(lngInput.value)).toBeCloseTo(106.806038, 5)

    // Cek badge info
    expect(screen.getByText(/Titik & Alamat berhasil diekstrak/i)).toBeInTheDocument()
    const linkMaps = screen.getByRole('link', { name: /Lihat di Maps/i })
    expect(linkMaps).toHaveAttribute(
      'href',
      'https://www.google.com/maps?q=-6.597143,106.806038'
    )
  })

  it('tidak menimpa nama jika nama sudah diketik oleh admin sebelumnya', async () => {
    vi.mocked(resolveLokasiGoogleMaps).mockResolvedValueOnce({
      ok: true,
      lat: -6.597143,
      lng: 106.806038,
      akurasi: 'pin',
      alamat: 'Jl. Pajajaran No. 12, Bogor',
      namaTempat: 'Nama Tempat dari Google',
    })

    render(<OutletForm submitting={false} isEdit={false} onSubmit={vi.fn()} />)

    const namaInput = screen.getByLabelText(/^Nama$/i) as HTMLInputElement
    fireEvent.change(namaInput, { target: { value: 'Outlet Pilihan Admin' } })

    const inputMaps = screen.getByPlaceholderText(/Tempel link Google Maps/i)
    fireEvent.change(inputMaps, {
      target: { value: 'https://maps.app.goo.gl/w1nL6wS8T4e9yJ128' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Ekstrak Lokasi/i }))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Lokasi berhasil diekstrak!')
    })

    // Nama tetap 'Outlet Pilihan Admin'
    expect(namaInput.value).toBe('Outlet Pilihan Admin')
  })

  it('menampilkan peringatan jika akurasi adalah tengah_peta', async () => {
    vi.mocked(resolveLokasiGoogleMaps).mockResolvedValueOnce({
      ok: true,
      lat: -6.597143,
      lng: 106.806038,
      akurasi: 'tengah_peta',
      alamat: 'Jl. Pajajaran',
      namaTempat: null,
    })

    render(<OutletForm submitting={false} isEdit={false} onSubmit={vi.fn()} />)

    const inputMaps = screen.getByPlaceholderText(/Tempel link Google Maps/i)
    fireEvent.change(inputMaps, {
      target: { value: 'https://www.google.com/maps/@-6.597143,106.806038,17z' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Ekstrak Lokasi/i }))

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(
        'Titik diambil dari tampilan peta. Pastikan posisi sudah tepat.'
      )
    })

    expect(screen.getByText(/Titik diambil dari tampilan peta/i)).toBeInTheDocument()
  })

  it('menampilkan pesan error jika server action mengembalikan galat', async () => {
    vi.mocked(resolveLokasiGoogleMaps).mockResolvedValueOnce({
      ok: false,
      pesan: 'Link ini tidak memuat titik lokasi.',
    })

    render(<OutletForm submitting={false} isEdit={false} onSubmit={vi.fn()} />)

    const inputMaps = screen.getByPlaceholderText(/Tempel link Google Maps/i)
    fireEvent.change(inputMaps, {
      target: { value: 'https://www.google.com/maps/place/Invalid' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Ekstrak Lokasi/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Link ini tidak memuat titik lokasi.')
    })
  })

  it('tidak memanggil resolveLokasiGoogleMaps berulang kali jika sedang dalam proses ekstraksi', async () => {
    let resolvePromise: (val: any) => void = () => {}
    vi.mocked(resolveLokasiGoogleMaps).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve
        })
    )

    render(<OutletForm submitting={false} isEdit={false} onSubmit={vi.fn()} />)

    const input = screen.getByLabelText('Link Google Maps atau koordinat')
    fireEvent.change(input, {
      target: { value: 'https://maps.app.goo.gl/test' },
    })

    const btn = screen.getByRole('button', { name: /Ekstrak Lokasi/i })
    fireEvent.click(btn)

    // Saat sedang extracting, coba picu Enter berulang kali
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(resolveLokasiGoogleMaps).toHaveBeenCalledTimes(1)

    // Selesaikan promise
    resolvePromise({
      ok: true,
      lat: -6.1,
      lng: 106.1,
      akurasi: 'pin',
      alamat: 'Test',
      namaTempat: 'Test',
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Lokasi berhasil diekstrak!')
    })
  })

  it('melakukan submit data dengan nilai valid', async () => {
    const handleSubmit = vi.fn()
    render(
      <OutletForm
        initial={{
          name: 'Outlet Suryakencana',
          slug: 'outlet-suryakencana',
          address: 'Jl. Suryakencana No. 50',
          lat: -6.601,
          lng: 106.802,
          type: 'internal',
          is_active: true,
          marquee_warning_threshold: 5,
          open_hour: '10:00',
          close_hour: '21:00',
        }}
        submitting={false}
        isEdit={true}
        onSubmit={handleSubmit}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))

    expect(handleSubmit).toHaveBeenCalledWith({
      name: 'Outlet Suryakencana',
      slug: 'outlet-suryakencana',
      address: 'Jl. Suryakencana No. 50',
      lat: -6.601,
      lng: 106.802,
      type: 'internal',
      status: 'active',
      is_active: true,
      marquee_warning_threshold: 5,
      open_hour: '10:00',
      close_hour: '21:00',
    })
  })

  it('memilih status pending mengubah status dan is_active menjadi false', async () => {
    const handleSubmit = vi.fn()
    render(
      <OutletForm
        initial={{
          name: 'Outlet Rawamangun',
          slug: 'outlet-rawamangun',
          address: 'Jl. Pemuda No. 10',
          lat: -6.195,
          lng: 106.885,
          type: 'internal',
          status: 'active',
          is_active: true,
          marquee_warning_threshold: 10,
          open_hour: '14:00',
          close_hour: '22:00',
        }}
        submitting={false}
        isEdit={true}
        onSubmit={handleSubmit}
      />
    )

    // Klik tombol status Pending
    fireEvent.click(screen.getByRole('button', { name: /Pending/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))

    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        is_active: false,
      })
    )
  })
  it('tipe dipilih dari dropdown INTERNAL / MITRA tanpa ikut men-submit form', () => {
    const handleSubmit = vi.fn()
    render(
      <OutletForm
        initial={{
          name: 'Mitra Baru', slug: 'mitra-baru', address: '', lat: -6.6, lng: 106.8,
          type: 'internal', is_active: true, marquee_warning_threshold: 7,
          open_hour: '14:00', close_hour: '22:00',
        }}
        submitting={false}
        isEdit={true}
        onSubmit={handleSubmit}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'INTERNAL' }))
    expect(screen.getAllByRole('button', { name: /^(INTERNAL|MITRA)$/ })).toHaveLength(3) // pemicu + 2 opsi
    fireEvent.click(screen.getByRole('button', { name: 'MITRA' }))
    expect(handleSubmit).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Simpan Perubahan' }))
    expect(handleSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'mitra' }))
  })

  it('lokasi non-outlet (gudang) tidak bisa diganti tipenya', () => {
    render(
      <OutletForm
        initial={{
          name: 'GUDANG PUSAT (HQ)', slug: 'gudang', address: '', lat: -6.6, lng: 106.8,
          type: 'office', is_active: true, marquee_warning_threshold: 7,
        }}
        submitting={false}
        isEdit={true}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Lokasi non-outlet (Kantor)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'MITRA' })).not.toBeInTheDocument()
  })
})
