import { Spinner } from "@suka/design-system";

export default function LoadingDashboard() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <Spinner className="h-8 w-8 text-suka-orange" />
      <p className="text-sm font-semibold text-gray-500 animate-pulse">
        Memuat data...
      </p>
    </div>
  );
}
