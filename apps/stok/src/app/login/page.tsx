import { redirect } from 'next/navigation'

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'https://app.sukashawarma.com'

export default function LoginPage() {
  redirect(PORTAL_URL)
}
