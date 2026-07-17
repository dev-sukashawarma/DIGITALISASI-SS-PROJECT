export function generateStaffEmail(username: string): string {
  const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '')
  return `${clean}@ss.com`
}
