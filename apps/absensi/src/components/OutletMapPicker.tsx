"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GEOFENCE_RADIUS_M } from "@/lib/gps";
import { buildNominatimSearchUrl, parseNominatimResults, type GeocodeResult } from "@/lib/geocode";

// Fix ikon marker default (bundler tidak menyalin aset Leaflet otomatis).
const ICON = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER: [number, number] = [-6.4, 106.82]; // Jabodetabek

type Props = {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
};

export default function OutletMapPicker({ value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Diisi oleh effect init dgn fungsi yang memindah pin (klik/drag/hasil cari) — satu jalur.
  const applyPointRef = useRef<(lat: number, lng: number) => void>(() => {});

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Inisialisasi peta sekali.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const start = value ?? { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };
    const map = L.map(containerRef.current).setView([start.lat, start.lng], value ? 18 : 11);
    mapRef.current = map;

    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap", maxZoom: 19,
    });
    const sat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "&copy; Esri World Imagery", maxZoom: 19 },
    );
    sat.addTo(map); // default satelit agar atap gedung terlihat
    L.control.layers({ Satelit: sat, Jalan: osm }).addTo(map);

    const marker = L.marker([start.lat, start.lng], { draggable: true, icon: ICON }).addTo(map);
    markerRef.current = marker;
    const circle = L.circle([start.lat, start.lng], { radius: GEOFENCE_RADIUS_M, color: "#f29744" }).addTo(map);
    circleRef.current = circle;

    const applyPoint = (lat: number, lng: number) => {
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      map.setView([lat, lng], 18);
      onChangeRef.current(lat, lng);
    };
    applyPointRef.current = applyPoint;

    marker.on("dragend", () => {
      const p = marker.getLatLng();
      applyPoint(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => applyPoint(e.latlng.lat, e.latlng.lng));

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkron posisi marker bila `value` berubah dari luar (ganti outlet).
  useEffect(() => {
    const map = mapRef.current, marker = markerRef.current, circle = circleRef.current;
    if (!map || !marker || !circle || !value) return;
    marker.setLatLng([value.lat, value.lng]);
    circle.setLatLng([value.lat, value.lng]);
    map.setView([value.lat, value.lng], 18);
  }, [value]);

  /** Cari alamat via Nominatim (OSM) — dipicu submit eksplisit, bukan tiap ketikan. */
  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(buildNominatimSearchUrl(q));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const parsed = parseNominatimResults(json);
      setResults(parsed);
      if (parsed.length === 0) setSearchError("Tidak ditemukan. Coba kata kunci lain (alamat/area).");
    } catch {
      setResults([]);
      setSearchError("Gagal mencari lokasi. Periksa koneksi internet & coba lagi.");
    } finally {
      setSearching(false);
    }
  }

  function handlePickResult(r: GeocodeResult) {
    applyPointRef.current(r.lat, r.lng);
    setResults([]);
    setSearchError(null);
    setQuery(r.label);
  }

  return (
    <div className="relative">
      <form onSubmit={handleSearch} className="absolute top-2 left-2 right-2 z-[1000] flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari alamat / area outlet…"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-lg bg-suka-orange px-3 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
        >
          {searching ? "…" : "Cari"}
        </button>
      </form>

      {(results.length > 0 || searchError) && (
        <div className="absolute top-14 left-2 right-2 z-[1000] max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow">
          {searchError ? (
            <p className="px-3 py-2 text-sm text-gray-500">{searchError}</p>
          ) : (
            results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handlePickResult(r)}
                className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {r.label}
              </button>
            ))
          )}
        </div>
      )}

      <div ref={containerRef} className="h-[420px] w-full rounded-xl overflow-hidden border border-gray-200" />
    </div>
  );
}
