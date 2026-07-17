export function generateStaffEmail(username: string): string {
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return `${cleanUsername}@ss.com`;
}
