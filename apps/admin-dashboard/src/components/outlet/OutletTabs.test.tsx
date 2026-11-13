import { describe, it, expect, vi } from 'vitest'

// next/link di lingkungan uji memakai salinan React lain (useContext null);
// cukup jangkar biasa untuk memeriksa tujuan tautan (pola OutletTable.test.tsx).
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))
import { render, screen } from '@testing-library/react'
import { OutletTabs } from './OutletTabs'

describe('OutletTabs', () => {
  it('menampilkan tiga tab dengan tujuan yang benar', () => {
    render(<OutletTabs aktif="penutupan" jumlahPersiapan={2} jumlahPenutupan={4} />)
    expect(screen.getByRole('link', { name: /Semua Outlet/ })).toHaveAttribute('href', '/dashboard/outlets')
    expect(screen.getByRole('link', { name: /Persiapan/ })).toHaveAttribute('href', '/dashboard/pembukaan-outlet')
    const penutupan = screen.getByRole('link', { name: /Penutupan/ })
    expect(penutupan).toHaveAttribute('href', '/dashboard/penutupan-outlet')
    expect(penutupan).toHaveAttribute('aria-current', 'page')
    expect(penutupan).toHaveTextContent('4')
  })
})
