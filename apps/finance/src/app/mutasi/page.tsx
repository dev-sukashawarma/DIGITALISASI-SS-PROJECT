import { MutasiView } from './components/MutasiView'

export const dynamic = 'force-dynamic'

export default async function MutasiPage({
  searchParams,
}: {
  searchParams: Promise<{ rekening?: string }>
}) {
  const { rekening } = await searchParams
  return <MutasiView rekeningAwal={rekening ?? ''} />
}
