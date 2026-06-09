export type AttendanceConfig = { jam_masuk: string; toleransi_menit: number };
export type AttendanceStatus = "tepat" | "telat" | "alpha";

/** Menentukan status absen masuk. Clock-out selalu 'tepat'. */
export function computeStatus(
  type: "in" | "out",
  tsBasis: string,        // ISO timestamp (ts_server online; ts_client bila dari queue)
  cfg: AttendanceConfig,
  tz = "Asia/Jakarta",
): AttendanceStatus {
  if (type === "out") return "tepat";

  // Jam lokal outlet dari timestamp
  const local = new Date(
    new Date(tsBasis).toLocaleString("en-US", { timeZone: tz }),
  );
  const [h, m] = cfg.jam_masuk.split(":").map(Number);
  const deadline = new Date(local);
  deadline.setHours(h, m + cfg.toleransi_menit, 0, 0);

  return local.getTime() <= deadline.getTime() ? "tepat" : "telat";
}
