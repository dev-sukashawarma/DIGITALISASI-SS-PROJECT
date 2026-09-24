import { redirect } from 'next/navigation'

// Katalog vendor kini tab "Vendor" di Master Bahan Baku (spec 2026-09-23 K2).
export default function Page() {
  redirect('/dashboard/bahan-baku?tab=vendor')
}
