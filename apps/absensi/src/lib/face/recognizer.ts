"use client";

import * as faceapi from "face-api.js";

let loaded = false;

/** Load model sekali (dari /models). */
export async function loadFaceModels(): Promise<void> {
  if (loaded) return;
  const url = "/models";
  await faceapi.nets.tinyFaceDetector.loadFromUri(url);
  await faceapi.nets.faceLandmark68Net.loadFromUri(url);
  await faceapi.nets.faceRecognitionNet.loadFromUri(url);
  loaded = true;
}

/** Ekstrak satu descriptor[128] dari elemen video/gambar. Null bila wajah tak terdeteksi. */
export async function extractDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<number[] | null> {
  const det = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det ? Array.from(det.descriptor) : null;
}
