export type AttendanceConfig = { jam_masuk: string; jam_keluar?: string; toleransi_menit: number };
export type AttendanceStatus = "tepat" | "telat" | "alpha";

/** Menentukan status absen. Bila keluar sebelum jam keluar terhitung telat. */
export function computeStatus(
  type: "in" | "out",
  tsBasis: string,        // ISO timestamp (ts_server online; ts_client bila dari queue)
  cfg: AttendanceConfig,
  tz = "Asia/Jakarta",
): AttendanceStatus {
  // Jam lokal outlet dari timestamp
  const local = new Date(
    new Date(tsBasis).toLocaleString("en-US", { timeZone: tz }),
  );

  if (type === "out") {
    const [hOut, mOut] = (cfg.jam_keluar || "17:00").split(":").map(Number);
    const deadlineOut = new Date(local);
    deadlineOut.setHours(hOut, mOut, 0, 0);
    return local.getTime() < deadlineOut.getTime() ? "telat" : "tepat";
  }

  const [h, m] = cfg.jam_masuk.split(":").map(Number);
  const deadline = new Date(local);
  deadline.setHours(h, m + cfg.toleransi_menit, 0, 0);

  return local.getTime() <= deadline.getTime() ? "tepat" : "alpha";
}
