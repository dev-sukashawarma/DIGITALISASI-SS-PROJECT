"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Clock,
  Star,
  X,
  Search,
} from "lucide-react";
import type { Outlet } from "@/data/outlets";

// ─── Outlet Card ──────────────────────────────────────────────────────────────

function OutletCard({
  outlet,
  onClose,
}: {
  outlet: Outlet;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <motion.div
      key={outlet.id}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]
                 w-[340px] max-w-[calc(100%-24px)]
                 bg-white rounded-3xl
                 shadow-[0_24px_64px_rgba(0,0,0,0.18)]
                 overflow-hidden"
      role="dialog"
      aria-label={`Detail outlet ${outlet.name}`}
    >
      {/* Close button */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3
          className="font-heading font-bold text-[#111111] text-base leading-snug"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {outlet.name}
        </h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-black/[0.06] flex items-center justify-center
                     text-[#111111]/50 hover:bg-black/10 transition-colors shrink-0"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        {/* Rating */}
        <div className="flex items-center gap-1 mb-3">
          <Star className="w-3.5 h-3.5 fill-[#FFC500] text-[#FFC500]" />
          <span className="text-xs font-semibold text-[#111111]">
            {outlet.rating}
          </span>
          <span className="text-xs text-[#111111]/40">
            ({outlet.reviewCount})
          </span>
        </div>

        {/* Address */}
        <div className="flex items-start gap-2 mb-2">
          <MapPin className="w-3.5 h-3.5 text-[#6E1A10] mt-0.5 shrink-0" />
          <p className="text-xs text-[#111111]/60 leading-relaxed">
            {outlet.address}
          </p>
        </div>

        {/* Hours */}
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-3.5 h-3.5 text-[#6E1A10] shrink-0" />
          <p className="text-xs text-[#111111]/60">{outlet.openingHours}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <a
            href={outlet.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Buka lokasi ${outlet.name} di Google Maps`}
            className="inline-flex items-center justify-center gap-2
                       h-[52px] rounded-full
                       border-[1.5px] border-[#6E1A10]
                       bg-white text-[#6E1A10]
                       text-[15px] font-semibold
                       hover:bg-[#FFF7F2]
                       active:scale-[0.98]
                       transition-all duration-200 ease-out
                       cursor-pointer focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-[#6E1A10]/40"
            style={{ width: "42%" }}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            View Maps
          </a>
          <a
            href={outlet.orderUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Pesan sekarang dari ${outlet.name}`}
            className="inline-flex items-center justify-center
                       h-[52px] rounded-full
                       bg-[#FE7108] text-white
                       text-[15px] font-semibold
                       hover:bg-[#E86300]
                       active:scale-[0.98]
                       shadow-sm
                       transition-all duration-200 ease-out
                       cursor-pointer focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-[#FE7108]/40"
            style={{ width: "58%" }}
          >
            Pesan Sekarang
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar({
  outlets,
  onSelect,
}: {
  outlets: Outlet[];
  onSelect: (outlet: Outlet) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().slice(0, 100);
    return outlets.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        o.district.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q)
    );
  }, [query, outlets]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={ref}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-[340px] max-w-[calc(100%-32px)]"
    >
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111111]/40 pointer-events-none" />
        <input
          type="text"
          maxLength={100}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cari outlet terdekat..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl
                     bg-white/95 backdrop-blur-md
                     border border-white/60
                     shadow-[0_8px_32px_rgba(0,0,0,0.12)]
                     text-sm text-[#111111] placeholder-[#111111]/40
                     focus:outline-none focus:ring-2 focus:ring-[#6E1A10]/20
                     transition-all"
          aria-label="Cari outlet"
          aria-expanded={open && results.length > 0}
          role="combobox"
          aria-autocomplete="list"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#111111]/30 hover:text-[#111111]/60 transition-colors"
            aria-label="Hapus pencarian"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="mt-2 bg-white/95 backdrop-blur-md rounded-2xl
                       shadow-[0_8px_32px_rgba(0,0,0,0.12)]
                       border border-white/60 overflow-hidden"
            role="listbox"
          >
            {results.map((o) => (
              <li key={o.id} role="option" aria-selected={false}>
                <button
                  onClick={() => {
                    onSelect(o);
                    setQuery(o.name);
                    setOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-[#FAF7F2]
                             transition-colors border-b border-gray-100 last:border-0"
                >
                  <p className="text-sm font-semibold text-[#111111]">{o.name}</p>
                  <p className="text-xs text-[#111111]/50 mt-0.5">
                    {o.district}, {o.city}
                  </p>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Map Component ───────────────────────────────────────────────────────

export default function OutletMap({ outlets }: { outlets: Outlet[] }) {
  const mapRef = useRef<HTMLDivElement & { _leaflet_id?: number }>(null);
  const leafletMap = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<number, import("leaflet").Marker>>(new Map());
  const clusterRef = useRef<unknown>(null);
  const [selected, setSelected] = useState<Outlet | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const handleSelect = useCallback((outlet: Outlet) => {
    setSelected(outlet);
    if (leafletMap.current) {
      leafletMap.current.flyTo([outlet.latitude, outlet.longitude], 15, {
        animate: true,
        duration: 1.2,
      });
      const marker = markersRef.current.get(outlet.id);
      if (marker) {
        marker.setZIndexOffset(1000);
        // bounce effect via CSS class toggle
        const el = marker.getElement();
        if (el) {
          el.classList.add("marker-bounce");
          setTimeout(() => el.classList.remove("marker-bounce"), 600);
        }
      }
    }
  }, []);

  useEffect(() => {
    // Prevent initialization if map container doesn't exist or map is already initialized
    if (!mapRef.current || leafletMap.current || mapReady) return;
    
    // Additional check for Leaflet's internal state
    if (mapRef.current._leaflet_id) {
      return;
    }

    let map: import("leaflet").Map;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cluster: any;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      await import("leaflet.markercluster");
      await import("leaflet.markercluster/dist/MarkerCluster.css");
      await import("leaflet.markercluster/dist/MarkerCluster.Default.css");

      if (!mapRef.current || leafletMap.current) return;

      // Clear any existing map instance on the container
      if (mapRef.current._leaflet_id) {
        mapRef.current._leaflet_id = undefined;
      }

      // Init map
      map = L.map(mapRef.current, {
        center: [-6.45, 106.85],
        zoom: 10,
        zoomControl: false,
        scrollWheelZoom: true,
        inertia: true,
        inertiaDeceleration: 3000,
      });

      leafletMap.current = map;

      // Tile layer — CartoDB Positron (clean, minimal, premium)
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      // Custom zoom control — bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Custom marker HTML
      const createMarkerIcon = (active = false) =>
        L.divIcon({
          className: "",
          html: `
            <div class="ss-marker ${active ? "ss-marker--active" : ""}">
              <div class="ss-marker__pin">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="white"/>
                </svg>
              </div>
              <div class="ss-marker__dot"></div>
            </div>
          `,
          iconSize: [36, 42],
          iconAnchor: [18, 42],
        });

      // Cluster group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cluster = (L as any).markerClusterGroup({
        maxClusterRadius: 60,
        showCoverageOnHover: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iconCreateFunction: (c: any) => {
          const count = c.getChildCount();
          return L.divIcon({
            html: `<div class="ss-cluster"><span>${count}</span></div>`,
            className: "",
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });
        },
        animate: true,
        animateAddingMarkers: true,
      });

      clusterRef.current = cluster;

      // Add markers with progressive entrance
      outlets.forEach((outlet, i) => {
        setTimeout(() => {
          const marker = L.marker([outlet.latitude, outlet.longitude], {
            icon: createMarkerIcon(false),
            title: outlet.name,
            alt: outlet.name,
            riseOnHover: true,
          });

          marker.on("click", () => {
            // reset previous active markers
            markersRef.current.forEach((m, id) => {
              const el = m.getElement();
              if (el) el.classList.remove("ss-marker--active");
            });
            // set active
            const el = marker.getElement();
            if (el) {
              el.querySelector(".ss-marker")?.classList.add("ss-marker--active");
            }
            handleSelect(outlet);
          });

          markersRef.current.set(outlet.id, marker);
          cluster.addLayer(marker);
        }, i * 80);
      });

      map.addLayer(cluster);

      // Click outside to close card
      map.on("click", () => setSelected(null));

      setMapReady(true);
    })();

    return () => {
      if (map) {
        map.remove();
      }
      if (leafletMap.current) {
        leafletMap.current.remove();
      }
      leafletMap.current = null;
      markersRef.current.clear();
      clusterRef.current = null;
      setMapReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative w-full h-full" role="region" aria-label="Peta lokasi outlet">
      {/* Search bar */}
      <SearchBar outlets={outlets} onSelect={handleSelect} />

      {/* Map container */}
      <div
        ref={mapRef}
        className="w-full h-full"
        aria-label="Leaflet map"
      />

      {/* Skeleton overlay while loading */}
      {!mapReady && (
        <div className="absolute inset-0 bg-[#e8e3dc] animate-pulse rounded-[24px] flex items-center justify-center">
          <div className="text-[#6E1A10]/40 text-sm font-medium">Memuat peta...</div>
        </div>
      )}

      {/* Outlet card */}
      <AnimatePresence>
        {selected && (
          <OutletCard
            outlet={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>

      {/* Marker & cluster styles */}
      <style>{`
        .ss-marker {
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1);
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.20));
        }
        .ss-marker:hover {
          transform: scale(1.18);
          filter: drop-shadow(0 8px 16px rgba(110,26,16,0.35));
        }
        .ss-marker__pin {
          width: 36px;
          height: 36px;
          background: #6E1A10;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2.5px solid white;
          transition: background 0.2s;
        }
        .ss-marker__pin svg {
          transform: rotate(45deg);
        }
        .ss-marker--active .ss-marker__pin {
          background: #FE7108;
        }
        .ss-marker__dot {
          width: 6px;
          height: 6px;
          background: #6E1A10;
          border-radius: 50%;
          margin-top: 2px;
          transition: background 0.2s;
        }
        .ss-marker--active .ss-marker__dot {
          background: #FE7108;
        }
        @keyframes markerBounce {
          0%,100% { transform: scale(1); }
          30% { transform: scale(1.3) translateY(-6px); }
          60% { transform: scale(0.95); }
        }
        .marker-bounce .ss-marker {
          animation: markerBounce 0.55s cubic-bezier(0.36,0.07,0.19,0.97);
        }
        /* Cluster */
        .ss-cluster {
          width: 44px;
          height: 44px;
          background: #6E1A10;
          border: 2.5px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 700;
          font-size: 13px;
          box-shadow: 0 4px 12px rgba(110,26,16,0.35);
          transition: transform 0.2s;
          cursor: pointer;
        }
        .ss-cluster:hover {
          transform: scale(1.12);
        }
        /* Override Leaflet default */
        .leaflet-container {
          font-family: inherit;
          background: #f0ebe3;
        }
        .leaflet-control-zoom a {
          border-radius: 8px !important;
          font-size: 16px;
        }
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.10) !important;
        }
        .leaflet-control-attribution {
          font-size: 10px;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
}
