import { haversineMeters } from "@/lib/gps";

/** Lokasi non-operasional: kalah bila jaraknya seri dengan outlet sungguhan. */
const NON_OPERASIONAL = new Set(["test", "marketplace"]);

/** Selisih jarak (meter) yang dianggap seri — koordinat kembar persis bernilai 0. */
const TOLERANSI_SERI_M = 1;

type Kandidat = { id: string; lat: number | null; lng: number | null; type?: string | null };

/**
 * Id outlet terdekat dari posisi perangkat, untuk auto-pilih outlet di panel absen.
 *
 * Bila beberapa outlet berjarak seri (mis. "outlet tes" menyalin koordinat BNR),
 * outlet operasional didahulukan. Tanpa ini pemenangnya ditentukan urutan daftar,
 * dan staff multi-outlet yang berdiri di BNR diam-diam absen di "outlet tes"
 * — memakai jam kerja & pilihan shift outlet yang salah.
 */
export function pilihOutletTerdekat(
  list: Kandidat[],
  device: { lat: number; lng: number },
): string | undefined {
  let terbaik: { id: string; jarak: number; operasional: boolean } | undefined;
  for (const o of list) {
    if (o.lat === null || o.lng === null) continue;
    const jarak = haversineMeters({ lat: o.lat, lng: o.lng }, device);
    const operasional = !NON_OPERASIONAL.has(o.type ?? "");
    if (
      !terbaik ||
      jarak < terbaik.jarak - TOLERANSI_SERI_M ||
      (Math.abs(jarak - terbaik.jarak) <= TOLERANSI_SERI_M && operasional && !terbaik.operasional)
    ) {
      terbaik = { id: o.id, jarak, operasional };
    }
  }
  return terbaik?.id;
}
