"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MapPin, Clock, Star, Search, ExternalLink, X, ChevronDown, RotateCcw } from "lucide-react";
import type { Outlet } from "@/data/outlets";

// ─── Outlet Card ──────────────────────────────────────────────────────────────

function OutletCard({ outlet, index }: { outlet: Outlet; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.45, delay: (index % 3) * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className="group bg-white rounded-2xl overflow-hidden
                 border border-black/[0.06]
                 shadow-[0_2px_12px_rgba(0,0,0,0.06)]
                 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]
                 transition-shadow duration-300"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3
            className="font-heading font-bold text-[#111111] text-[15px] leading-snug"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {outlet.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            <Star className="w-3.5 h-3.5 fill-[#FFC500] text-[#FFC500]" />
            <span className="text-xs font-semibold text-[#111111]">{outlet.rating}</span>
            <span className="text-xs text-[#111111]/40">({outlet.reviewCount})</span>
          </div>
        </div>

        <div className="flex items-start gap-2 mb-2">
          <MapPin className="w-3.5 h-3.5 text-[#6E1A10] mt-0.5 shrink-0" />
          <p className="text-xs text-[#111111]/60 leading-relaxed">{outlet.address}</p>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-3.5 h-3.5 text-[#6E1A10] shrink-0" />
          <p className="text-xs text-[#111111]/60">{outlet.openingHours}</p>
        </div>

        <div className="flex gap-2">
          <a
            href={outlet.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5
                       h-10 px-4 rounded-full
                       border-[1.5px] border-[#6E1A10] text-[#6E1A10]
                       text-xs font-semibold
                       hover:bg-[#FFF7F2] transition-colors duration-200"
            style={{ width: "42%" }}
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            View Maps
          </a>
          <a
            href={outlet.orderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center
                       h-10 rounded-full
                       bg-[#FE7108] text-white
                       text-xs font-semibold
                       hover:bg-[#E86300] transition-colors duration-200"
            style={{ width: "58%" }}
          >
            Pesan Sekarang
          </a>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OutletGrid({ outlets }: { outlets: Outlet[] }) {
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("Semua Kota");

  // Generate city options from data — deduplicated + sorted
  const cityOptions = useMemo(() => {
    const cities = [...new Set(outlets.map((o) => o.city))].sort();
    return ["Semua Kota", ...cities];
  }, [outlets]);

  // Filter — search + city, both applied
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().slice(0, 100);
    return outlets.filter((o) => {
      const matchesSearch =
        !q ||
        o.name.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        o.district.toLowerCase().includes(q) ||
        o.address.toLowerCase().includes(q);
      const matchesCity =
        cityFilter === "Semua Kota" || o.city === cityFilter;
      return matchesSearch && matchesCity;
    });
  }, [query, cityFilter, outlets]);

  // Group by city
  const grouped = useMemo(() => {
    const map = new Map<string, Outlet[]>();
    filtered.forEach((o) => {
      if (!map.has(o.city)) map.set(o.city, []);
      map.get(o.city)!.push(o);
    });
    // Sort city groups alphabetically
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const hasResults = filtered.length > 0;
  const isFiltered = query.trim() !== "" || cityFilter !== "Semua Kota";

  const resetFilters = () => {
    setQuery("");
    setCityFilter("Semua Kota");
  };

  return (
    <div>
      {/* ── Search + City filter ── */}
      <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111111]/40 pointer-events-none" />
          <input
            type="text"
            maxLength={100}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama outlet, kota, atau kecamatan..."
            className="w-full h-12 pl-11 pr-10 rounded-full
                       border border-gray-200 bg-white
                       text-sm text-[#111111] placeholder-[#111111]/40
                       shadow-sm focus:outline-none focus:ring-2 focus:ring-[#6E1A10]/20
                       focus:border-[#6E1A10] transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#111111]/30 hover:text-[#111111]/60 transition-colors"
              aria-label="Hapus pencarian"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* City dropdown */}
        <div className="relative shrink-0">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="h-12 pl-4 pr-10 rounded-full
                       border border-gray-200 bg-white
                       text-sm font-medium text-[#111111]
                       shadow-sm appearance-none cursor-pointer
                       focus:outline-none focus:ring-2 focus:ring-[#6E1A10]/20
                       focus:border-[#6E1A10]
                       hover:border-[#6E1A10]/40
                       transition-all duration-200
                       min-w-[160px]"
            aria-label="Filter kota"
          >
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#111111]/40 pointer-events-none" />
        </div>
      </div>

      {/* Result count */}
      <p className="text-sm text-[#111111]/40 max-w-2xl mx-auto mb-10">
        {filtered.length} outlet ditemukan
        {isFiltered && (
          <button
            onClick={resetFilters}
            className="ml-3 text-[#6E1A10] font-medium hover:underline inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            Reset filter
          </button>
        )}
      </p>

      {/* ── Outlet listing grouped by city ── */}
      <AnimatePresence mode="wait">
        {hasResults ? (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-14"
          >
            {grouped.map(([city, cityOutlets]) => (
              <div key={city}>
                {/* City header */}
                <div className="flex items-center gap-3 mb-6">
                  <h2
                    className="font-heading font-bold text-xl text-[#111111]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {city}
                  </h2>
                  <span className="text-sm text-[#111111]/40 font-medium">
                    ({cityOutlets.length})
                  </span>
                  <div className="flex-1 h-px bg-black/[0.06]" />
                </div>

                {/* Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cityOutlets.map((outlet, index) => (
                    <OutletCard key={outlet.id} outlet={outlet} index={index} />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          /* ── Empty state ── */
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center py-24"
          >
            <div className="w-16 h-16 rounded-full bg-[#FAF7F2] flex items-center justify-center mx-auto mb-5">
              <MapPin className="w-7 h-7 text-[#6E1A10]/40" />
            </div>
            <h3
              className="font-heading font-bold text-xl text-[#111111] mb-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Outlet tidak ditemukan
            </h3>
            <p className="text-sm text-[#111111]/50 mb-6 max-w-xs mx-auto leading-relaxed">
              Coba gunakan kata kunci lain atau pilih kota yang berbeda.
            </p>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full
                         border-[1.5px] border-[#6E1A10] text-[#6E1A10]
                         text-sm font-semibold
                         hover:bg-[#FFF7F2] transition-colors duration-200"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Filter
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
