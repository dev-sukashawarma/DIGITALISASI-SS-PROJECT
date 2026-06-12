/**
 * Resolves URLs across different micro-frontend applications in the monorepo.
 *
 * - Development: redirects localhost:3001 (stok) and localhost:3002 (distribusi).
 * - Staging (Vercel, dua domain terpisah): pakai NEXT_PUBLIC_STOK_URL /
 *   NEXT_PUBLIC_DISTRIBUSI_URL kalau di-set → domain absolut.
 * - Production (cPanel, subdomain + reverse proxy): fallback ke path relatif.
 */
export const getCrossAppUrl = (path: string): string => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    if (path.startsWith('/distribusi')) {
      return `http://localhost:3002${path}`;
    }
    if (path.startsWith('/stok') || path === '/dashboard' || path === '/login') {
      return `http://localhost:3001${path}`;
    }
  }

  const stokUrl = process.env.NEXT_PUBLIC_STOK_URL;
  const distribusiUrl = process.env.NEXT_PUBLIC_DISTRIBUSI_URL;
  if (path.startsWith('/distribusi') && distribusiUrl) {
    return `${distribusiUrl.replace(/\/$/, '')}${path}`;
  }
  if (path.startsWith('/stok') && stokUrl) {
    return `${stokUrl.replace(/\/$/, '')}${path}`;
  }

  return path;
};
