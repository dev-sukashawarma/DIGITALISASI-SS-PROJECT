import { LiveMonitoringPage } from '@/components/monitoring/LiveMonitoringPage';

export const metadata = {
  title: 'Live Stock Monitoring - Stok Management',
};

export default function Page() {
  return (
    <main className="w-full min-h-screen bg-[#fff8f1]">
      <LiveMonitoringPage />
    </main>
  );
}
