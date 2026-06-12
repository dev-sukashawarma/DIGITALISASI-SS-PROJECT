/**
 * Resolves URLs across micro-frontend apps. App ini = DISTRIBUSI.
 *
 * - Route milik DISTRIBUSI sendiri (/distribusi, /dashboard, /login) → relatif (SPA nav).
 * - Route app lain (/stok/*) → absolut kalau NEXT_PUBLIC_STOK_URL di-set
 *   (Vercel dua domain); kalau tidak → relatif (cPanel subdomain proxy).
 * - Dev: redirect ke port lokal masing-masing app.
 */
export const getCrossAppUrl = (path: string): string => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    if (path.startsWith('/distribusi') || path === '/dashboard') {
      return `http://localhost:3002${path}`;
    }
    if (path.startsWith('/stok') || path === '/login') {
      return `http://localhost:3001${path}`;
    }
  }

  // Hanya route app LAIN (stok) yang di-eksternal-kan.
  const stokUrl = process.env.NEXT_PUBLIC_STOK_URL;
  if (path.startsWith('/stok') && stokUrl) {
    return `${stokUrl.replace(/\/$/, '')}${path}`;
  }

  return path;
};
