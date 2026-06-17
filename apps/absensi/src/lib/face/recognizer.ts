"use client";

import * as faceapi from "face-api.js";

let loaded = false;

/** Load model secara konkuren (dari /models). */
export async function loadFaceModels(): Promise<void> {
  if (loaded) return;
  const url = "/models";
  
  // Menggunakan Promise.all untuk loading model secara paralel agar memangkas waktu tunggu
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(url),
    faceapi.nets.faceLandmark68Net.loadFromUri(url),
    faceapi.nets.faceRecognitionNet.loadFromUri(url)
  ]);
  
  loaded = true;
}

/** Ekstrak satu descriptor[128] dari elemen video/gambar. Null bila wajah tak terdeteksi. */
export async function extractDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
): Promise<number[] | null> {
  const det = await faceapi
    .detectSingleFace(input, new faceapi.SsdMobilenetv1Options())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return det ? Array.from(det.descriptor) : null;
}
