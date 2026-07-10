import { Spinner } from "@suka/design-system";
import { Settings2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function LoadingPengaturan() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-20 sm:space-y-6 sm:pb-12">
      <PageHeader
        icon={<Settings2 size={24} />}
        title="Atur Jam Absensi"
        subtitle="Memuat pengaturan..."
      />
      <div className="flex h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-suka-gray-200 bg-white p-6 shadow-sm">
        <Spinner className="h-8 w-8 text-suka-orange" />
        <p className="text-sm font-semibold text-gray-500 animate-pulse">
          Mengambil data konfigurasi outlet...
        </p>
      </div>
    </div>
  );
}
