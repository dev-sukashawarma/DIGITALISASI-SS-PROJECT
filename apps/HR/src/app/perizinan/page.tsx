import { redirect } from 'next/navigation'

export default async function PerizinanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  if (params?.tab === 'kasbon') {
    redirect('/perizinan/kasbon')
  }
  redirect('/perizinan/izin')
}
