import type { BoardRecord, BoardStaff } from "./papan";

export type StafPenempatan = {
  id: string;
  name: string;
  role: string;
  /** outlet_staff.outlet_id */
  outletUtama: string | null;
  /** staff_outlets.outlet_id */
  outletTambahan: string[];
};
export type OutletCakupan = { id: string; name: string };
export type PenempatanOutlet = { staf: BoardStaff[]; records: BoardRecord[] };

/**
 * Outlet "rumah" staf dalam cakupan: outlet utama bila dalam cakupan, selain itu
 * outlet tambahan pertama dalam cakupan menurut urutan nama outlet; null bila tak ada.
 */
export function outletRumah(
  staf: Pick<StafPenempatan, "outletUtama" | "outletTambahan">,
  cakupan: OutletCakupan[],
): string | null {
  const peta = new Map(cakupan.map((o) => [o.id, o.name]));
  if (staf.outletUtama && peta.has(staf.outletUtama)) return staf.outletUtama;
  const kandidat = [...new Set(staf.outletTambahan)]
    .filter((id) => peta.has(id))
    .sort((a, b) => (peta.get(a)! as string).localeCompare(peta.get(b)! as string, "id") || a.localeCompare(b));
  return kandidat[0] ?? null;
}

/**
 * Tempatkan tiap orang tepat SEKALI per hari (tampilan seluruh perusahaan):
 * di outlet record 'in' pertama bila dalam cakupan, selain itu di outlet rumahnya.
 * Seluruh record orang itu hari itu (di outlet mana pun) ikut dibawa → dianggap hadir.
 */
export function tempatkanStaf(
  staf: StafPenempatan[],
  records: (BoardRecord & { outlet_id: string })[],
  cakupan: OutletCakupan[],
): Map<string, PenempatanOutlet> {
  const hasil = new Map<string, PenempatanOutlet>(cakupan.map((o) => [o.id, { staf: [], records: [] }]));
  const perStaf = new Map<string, (BoardRecord & { outlet_id: string })[]>();
  for (const r of records) {
    const arr = perStaf.get(r.outlet_staff_id) ?? [];
    arr.push(r);
    perStaf.set(r.outlet_staff_id, arr);
  }
  for (const s of staf) {
    const recs = (perStaf.get(s.id) ?? []).slice().sort((a, b) => a.ts_server.localeCompare(b.ts_server));
    const masukPertama = recs.find((r) => r.type === "in");
    const tujuan = masukPertama && hasil.has(masukPertama.outlet_id) ? masukPertama.outlet_id : outletRumah(s, cakupan);
    if (!tujuan) continue;
    const slot = hasil.get(tujuan)!;
    slot.staf.push({ id: s.id, name: s.name, role: s.role });
    for (const { outlet_id: _o, ...r } of recs) slot.records.push(r as BoardRecord);
  }
  return hasil;
}
