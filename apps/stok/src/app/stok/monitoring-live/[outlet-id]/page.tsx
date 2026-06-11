import { DetailOutletMonitoring } from '@/components/monitoring/DetailOutletMonitoring';

export const metadata = {
  title: 'Detail Outlet - Monitoring Stok',
};

export default function DetailOutletPage({ params }: { params: { 'outlet-id': string } }) {
  return (
    <main className="w-full min-h-screen bg-[#fff8f1]">
      <DetailOutletMonitoring outletId={params['outlet-id']} />
    </main>
  );
}
