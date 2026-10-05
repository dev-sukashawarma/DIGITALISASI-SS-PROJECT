export type KondisiTampil = { kurangiGerak: boolean; hematData: boolean; videoGagal: boolean }

/** Video hanya bila pengguna tidak mematikan animasi, tidak hemat data, dan video belum pernah gagal. */
export const bolehVideo = (k: KondisiTampil): boolean => !k.kurangiGerak && !k.hematData && !k.videoGagal
