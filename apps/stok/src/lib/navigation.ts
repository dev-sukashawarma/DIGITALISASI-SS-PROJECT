/**
 * Resolves URLs across micro-frontend apps. App ini = STOK.
 *
 * - Route milik STOK sendiri (/stok, /dashboard, /login) → relatif (SPA nav).
 * - Route app lain (/distribusi/*) → absolut kalau NEXT_PUBLIC_DISTRIBUSI_URL
 *   di-set (Vercel dua domain); kalau tidak → relatif (cPanel subdomain proxy).
 * - Dev: redirect ke port lokal masing-masing app.
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

  // Hanya route app LAIN (distribusi) yang di-eksternal-kan.
  const distribusiUrl = process.env.NEXT_PUBLIC_DISTRIBUSI_URL;
  if (path.startsWith('/distribusi') && distribusiUrl) {
    return `${distribusiUrl.replace(/\/$/, '')}${path}`;
  }

  return path;
};
