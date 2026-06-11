import { KioskClient } from "./KioskClient";

export function generateStaticParams() {
  return [{ outlet_id: "default" }];
}

export default function KioskPage({ params }: { params: { outlet_id: string } }) {
  return <KioskClient outlet_id={params.outlet_id} />;
}
