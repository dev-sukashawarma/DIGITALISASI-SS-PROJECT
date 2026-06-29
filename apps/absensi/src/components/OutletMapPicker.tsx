"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GEOFENCE_RADIUS_M } from "@/lib/gps";

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

    const emit = (lat: number, lng: number) => {
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      onChangeRef.current(lat, lng);
    };
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      circle.setLatLng(p);
      onChangeRef.current(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => emit(e.latlng.lat, e.latlng.lng));

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

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl overflow-hidden border border-gray-200" />;
}
