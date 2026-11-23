export const MELANI_EMAIL = 'melani@ss.com'
export const PUTRI_EMAIL = 'putri.hambali@ss.com'

/**
 * Checks if the given email belongs to Melani.
 */
export function isMelani(email?: string | null): boolean {
  if (!email) return false
  const lower = email.toLowerCase().trim()
  return lower === MELANI_EMAIL || lower.startsWith('melani@')
}

/**
 * Checks if the given email belongs to Putri Hambali.
 */
export function isPutriHambali(email?: string | null): boolean {
  if (!email) return false
  const lower = email.toLowerCase().trim()
  return lower === PUTRI_EMAIL || lower.startsWith('putri.hambali@')
}

/**
 * Returns the default dashboard path for an authenticated user.
 * Melani lands on Konten Planner, others land on Overview (/dashboard).
 */
export function getDefaultDashboardPath(email?: string | null): string {
  if (isMelani(email)) {
    return '/dashboard/content-planner'
  }
  return '/dashboard'
}

/**
 * Validates route permission based on user email and role.
 * - ADMIN: full access to everything.
 * - Melani: only /dashboard/content-planner* and /dashboard/menu*
 * - Putri Hambali: all other dashboard tabs, blocked from content-planner, menu, and users.
 */
export function isRouteAllowed(
  email?: string | null,
  role?: string | null,
  pathname: string = ''
): boolean {
  // developer = superuser teknis (lib/auth.ts menimpa ADMIN jadi 'developer').
  if (isAdminLike(role)) {
    return true
  }

  // Melani: restricted to Konten Planner, Katalog Menu & Promo, Laba Rugi, and Rangkuman Penjualan
  if (isMelani(email)) {
    return (
      pathname.startsWith('/dashboard/content-planner') ||
      pathname.startsWith('/dashboard/menu') ||
      pathname.startsWith('/dashboard/laba-rugi') ||
      pathname.startsWith('/dashboard/penjualan')
    )
  }

  // Putri Hambali: restricted from Konten Planner, Katalog Menu & Promo, Laba Rugi, Rangkuman Penjualan, and Admin Users
  if (isPutriHambali(email)) {
    if (
      pathname.startsWith('/dashboard/content-planner') ||
      pathname.startsWith('/dashboard/menu') ||
      pathname.startsWith('/dashboard/laba-rugi') ||
      pathname.startsWith('/dashboard/penjualan') ||
      pathname.startsWith('/dashboard/users')
    ) {
      return false
    }
    return true
  }

  // Standard non-admin marcom: cannot access /dashboard/users, /dashboard/laba-rugi, or /dashboard/penjualan
  if (
    pathname.startsWith('/dashboard/users') ||
    pathname.startsWith('/dashboard/laba-rugi') ||
    pathname.startsWith('/dashboard/penjualan')
  ) {
    return false
  }

  return true
}

/** ADMIN Prisma atau developer SSO — keduanya akses penuh. */
export function isAdminLike(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'developer'
}
