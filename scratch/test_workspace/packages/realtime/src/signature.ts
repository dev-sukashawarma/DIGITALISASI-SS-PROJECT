export function subsSignature(
  subs: { table: string; event?: string; filter?: string }[]
): string {
  return subs
    .map((s) => `${s.table}|${s.event ?? "*"}|${s.filter ?? ""}`)
    .join(";");
}
