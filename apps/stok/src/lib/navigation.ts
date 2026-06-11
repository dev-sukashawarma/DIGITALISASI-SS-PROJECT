/**
 * Resolves URLs across different micro-frontend applications in the monorepo.
 * In development, redirects localhost:3001 (stok) and localhost:3002 (distribusi) correctly.
 * In production, uses relative sub-paths handled by the reverse proxy/subdomain mapping.
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
  return path;
};
