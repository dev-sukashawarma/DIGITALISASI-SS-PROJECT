"use client";

import { useEffect, useRef } from "react";

type Props = {
  onReady?: (video: HTMLVideoElement) => void;
  onError?: (e: string) => void;
};

/** Live camera (kamera depan) untuk face match & selfie. */
export function CameraCapture({ onReady, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          onReady?.(videoRef.current);
        }
      } catch {
        onError?.("Tidak bisa mengakses kamera. Aktifkan izin kamera.");
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  return <video ref={videoRef} playsInline muted className="w-full rounded-lg" />;
}

/** Ambil frame video → dataURL JPEG. */
export function captureFrame(
  video: HTMLVideoElement,
  quality = 0.6,
): { canvas: HTMLCanvasElement; dataUrl: string } {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d")!.drawImage(video, 0, 0);
  return { canvas, dataUrl: canvas.toDataURL("image/jpeg", quality) };
}
