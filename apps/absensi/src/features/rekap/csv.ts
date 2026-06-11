export type CsvRow = { name: string; type: string; jam: string; status: string };

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Serialisasi baris rekap ke CSV (header Indonesia). */
export function attendanceToCsv(rows: CsvRow[]): string {
  const header = "Nama,Tipe,Jam,Status";
  const body = rows.map((r) => [r.name, r.type, r.jam, r.status].map(esc).join(","));
  return [header, ...body].join("\n");
}

/** Trigger unduhan file CSV di browser. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
