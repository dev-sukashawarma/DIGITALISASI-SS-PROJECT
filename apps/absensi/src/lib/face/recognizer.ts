"use client";

import type { Human, Config } from "@vladmandic/human";

const config: Partial<Config> = {
  // We remove hardcoded 'webgl' backend. Let human auto-detect (webgl -> wasm) to prevent crashes on older phones.
  // We can use jsdelivr as a CDN to avoid having to host models, or local path.
  // We'll use CDN for high availability and zero-config caching, which also avoids downloading 20MB of models locally for the dev.
  modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human/models",
  filter: { enabled: true, equalization: true },
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 1, minConfidence: 0.5, return: true },
    mesh: { enabled: true },
    attention: { enabled: false },
    iris: { enabled: true },
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
