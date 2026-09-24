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
  if (role === 'ADMIN') {
    return true
  }

  // Melani: restricted to Konten Planner and Katalog Menu & Promo
  if (isMelani(email)) {
    return (
      pathname.startsWith('/dashboard/content-planner') ||
      pathname.startsWith('/dashboard/menu')
    )
  }

  // Putri Hambali: restricted from Konten Planner, Katalog Menu & Promo, and Admin Users
  if (isPutriHambali(email)) {
    if (
      pathname.startsWith('/dashboard/content-planner') ||
      pathname.startsWith('/dashboard/menu') ||
      pathname.startsWith('/dashboard/users')
    ) {
      return false
    }
    return true
  }

  // Standard non-admin marcom: cannot access /dashboard/users
  if (pathname.startsWith('/dashboard/users')) {
    return false
  }

  return true
}
