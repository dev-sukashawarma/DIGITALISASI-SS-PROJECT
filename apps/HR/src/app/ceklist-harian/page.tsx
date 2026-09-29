import CeklistPantauView from '@/components/modules/ceklist/CeklistPantauView'

export default async function CeklistHarianPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; outlet?: string }>
}) {
  const { tanggal, outlet } = await searchParams
  return <CeklistPantauView tanggalAwal={tanggal} outletAwal={outlet} />
}
