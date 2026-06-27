export type AttendanceConfig = { jam_masuk: string; jam_keluar?: string; toleransi_menit: number };
export type AttendanceStatus = "tepat" | "telat" | "alpha" | "lebih_awal" | "pulang_telat";

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
    
    const diffMins = Math.floor((local.getTime() - deadlineOut.getTime()) / 60000);
    if (diffMins < 0) {
      return "lebih_awal";
    } else if (diffMins >= 1) {
      return "pulang_telat";
    } else {
      return "tepat";
    }
  }

  const [h, m] = cfg.jam_masuk.split(":").map(Number);
  
  const jamMasukDeadline = new Date(local);
  jamMasukDeadline.setHours(h, m, 0, 0);

  const toleransiDeadline = new Date(local);
  toleransiDeadline.setHours(h, m + cfg.toleransi_menit, 0, 0);

  if (local.getTime() <= jamMasukDeadline.getTime()) {
    return "tepat";
  } else if (local.getTime() <= toleransiDeadline.getTime()) {
    return "telat";
  } else {
    return "alpha";
  }
}
