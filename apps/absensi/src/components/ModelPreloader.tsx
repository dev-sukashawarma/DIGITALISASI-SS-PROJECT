"use client";

import { useEffect } from "react";
import { loadFaceModels } from "@/lib/face/recognizer";

export function ModelPreloader() {
  useEffect(() => {
    // Jalankan secara idle di background agar tidak memblokir render UI utama
    const preloader = setTimeout(() => {
      loadFaceModels().catch((err) => {
        console.warn("Failed to preload face models:", err);
      });
    }, 2000); // Tunda 2 detik agar tidak rebutan network di awal load
    
    return () => clearTimeout(preloader);
  }, []);

  return null;
}
