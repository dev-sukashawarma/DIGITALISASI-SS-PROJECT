export function generateStaffEmail(name: string, outletId: string): string {
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const outletCode = outletId.split("-")[0];
  return `${cleanName}.${outletCode}@ss.com`;
}
