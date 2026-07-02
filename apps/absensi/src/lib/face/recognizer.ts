"use client";

import type { Human, Config } from "@vladmandic/human";

const config: Partial<Config> = {
  // Self-hosted (same-origin, apps/absensi/public/models): CDN jsdelivr sering lambat/tidak
  // stabil dari jaringan outlet + tidak kena browser HTTP cache lintas-origin. Hosting lokal
  // + header cache immutable (lihat next.config) bikin model tersimpan permanen di device
  // setelah kunjungan pertama, sehingga load berikutnya nyaris instan.
  modelBasePath: "/models/",
  warmup: "face", // hanya warm-up pipeline wajah (body/hand/object sudah dimatikan)
  filter: { enabled: true, equalization: true },
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 1, minConfidence: 0.5, return: true },
    mesh: { enabled: true },
    attention: { enabled: false },
    // Iris TIDAK dipakai: gesture "facing left/right"/"blink" dihitung dari mesh, bukan iris
    // (iris hanya untuk gaze "looking left/right" yang tak dipakai liveness.ts). Mematikannya
    // menghapus 1 model (~2.6MB) + inferensinya di SETIAP frame tanpa mengurangi fitur.
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: true },
};

/**
 * Override ringan dipakai loop polling frekuensi tinggi (liveness, ~25fps): matikan
 * `description` (model faceres 7MB, model TERBERAT) karena embedding hanya dibutuhkan
 * SEKALI saat frame lolos frontal, bukan di setiap frame gerakan. Gesture (facing
 * left/right, blink) tetap akurat karena berasal dari `mesh`, yang tetap menyala di sini.
 */
export const GESTURE_ONLY_CONFIG: Partial<Config> = {
  face: { description: { enabled: false } },
};

let humanInstance: Human | null = null;
let loaded = false;

export async function getHuman(): Promise<Human> {
  if (typeof window === "undefined") {
    throw new Error("getHuman must be called on the client side.");
  }
  if (!humanInstance) {
    const HumanClass = (await import("@vladmandic/human")).Human;
    humanInstance = new HumanClass(config);
  }
  return humanInstance;
}

export async function loadFaceModels(): Promise<void> {
  if (loaded) return;
  const human = await getHuman();
  await human.load();
  await human.warmup(); // Pre-compile shaders
  loaded = true;
}

/** Ekstrak satu descriptor dari elemen video/gambar. Null bila wajah tak terdeteksi. */
export async function extractDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<number[] | null> {
  const human = await getHuman();
  const res = await human.detect(input);
  if (res.face && res.face.length > 0 && res.face[0].embedding) {
    return Array.from(res.face[0].embedding);
  }
  return null;
}
