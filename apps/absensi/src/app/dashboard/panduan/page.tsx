"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { Book, BookOpen, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

interface Guide {
  id: string;
  category: string;
  title: string;
  content_html: string;
  image_url: string | null;
  sort_order: number;
}

function parseImages(imageUrl: string | null): { url: string; title: string }[] {
  if (!imageUrl) return [];
  try {
    const parsed = JSON.parse(imageUrl);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return [{ url: imageUrl, title: "" }];
  }
  return [];
}

// "Bab 1 · Mengenal Sistem" → { num: "1", name: "Mengenal Sistem" }
function splitCategory(cat: string): { num: string | null; name: string } {
  const m = cat.match(/^Bab\s+(\d+)\s*·\s*(.+)$/i);
  if (m) return { num: m[1], name: m[2] };
  return { num: null, name: cat };
}

export default function PanduanPage() {
  const supabase = useMemo(() => createClient(), []);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const topRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  const { data: guides = [], isLoading } = useQuery({
    queryKey: ["system_guides", "absensi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_guides")
        .select("id, category, title, content_html, image_url, sort_order")
        .eq("system_code", "absensi")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Guide[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const groupedGuides = useMemo(() => {
    return guides.reduce((acc, guide) => {
      if (!acc[guide.category]) acc[guide.category] = [];
      acc[guide.category].push(guide);
      return acc;
    }, {} as Record<string, Guide[]>);
  }, [guides]);

  const categories = Object.keys(groupedGuides);
  const currentCategory = activeCategory || categories[0] || "";
  const currentIndex = categories.indexOf(currentCategory);
  const activeGuides = groupedGuides[currentCategory] || [];
  const prevCategory = currentIndex > 0 ? categories[currentIndex - 1] : null;
  const nextCategory = currentIndex >= 0 && currentIndex < categories.length - 1 ? categories[currentIndex + 1] : null;

  // Scroll balik ke atas tiap ganti bab (kecuali render pertama)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentCategory]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-suka-orange" />
        <p className="font-medium">Memuat panduan...</p>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center">
        <Book className="w-12 h-12 mb-4 text-gray-300" strokeWidth={1.5} />
        <p className="font-medium">Belum ada panduan yang ditambahkan.</p>
      </div>
    );
  }

  const currentMeta = splitCategory(currentCategory);

  return (
    <div className="space-y-5" ref={topRef}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-suka-orange flex items-center justify-center shrink-0 shadow-sm">
          <BookOpen className="text-white" size={22} />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-suka-ink leading-tight">Buku Panduan</h1>
          <p className="text-gray-500 text-xs sm:text-sm">Panduan penggunaan Sistem Absensi Suka Shawarma</p>
        </div>
      </div>

      {/* Bab pills — geser ke samping di layar kecil */}
      <nav className="guide-pills flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap pb-1">
        {categories.map((cat) => {
          const { num, name } = splitCategory(cat);
          const active = currentCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-2 shrink-0 pl-1.5 pr-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                active
                  ? "bg-suka-orange border-suka-orange text-white shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:border-suka-orange/40 hover:text-suka-ink"
              }`}
            >
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  active ? "bg-white/25 text-white" : "bg-suka-orange/10 text-suka-orange"
                }`}
              >
                {num ?? <Book size={12} />}
              </span>
              {name}
            </button>
          );
        })}
      </nav>

      {/* Judul bab aktif */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          {currentMeta.num && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-suka-orange">Bab {currentMeta.num} dari {categories.length}</p>
          )}
          <h2 className="text-lg sm:text-xl font-bold text-suka-ink">{currentMeta.name}</h2>
        </div>
        <span className="shrink-0 text-xs font-semibold text-gray-400 bg-white border border-gray-200 rounded-full px-3 py-1">
          {activeGuides.length} topik
        </span>
      </div>

      {/* Kartu per topik */}
      <div className="space-y-4">
        {activeGuides.map((guide, idx) => {
          const images = parseImages(guide.image_url);
          return (
            <article key={guide.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-slate-50/60">
                <span className="w-8 h-8 shrink-0 rounded-full bg-suka-orange text-white flex items-center justify-center text-sm font-bold shadow-sm">
                  {idx + 1}
                </span>
                <h3 className="font-bold text-suka-ink text-base leading-snug">{guide.title}</h3>
              </div>

              <div className="px-5 py-4 sm:px-6 sm:py-5">
                <div className="guide-content" dangerouslySetInnerHTML={{ __html: guide.content_html }} />

                {images.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {images.map((img, i) => (
                      <figure key={i} className="rounded-xl border border-gray-200 overflow-hidden bg-slate-50">
                        <img
                          src={img.url}
                          alt={img.title || guide.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-auto object-contain bg-white max-h-[480px]"
                        />
                        {img.title && (
                          <figcaption className="text-xs font-medium text-gray-500 text-center px-3 py-2 border-t border-gray-100">
                            {img.title}
                          </figcaption>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Navigasi bab sebelumnya / selanjutnya */}
      <div className="flex items-stretch gap-3 pt-1">
        {prevCategory ? (
          <button
            onClick={() => setActiveCategory(prevCategory)}
            className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-left hover:border-suka-orange/40 transition-colors group"
          >
            <ChevronLeft size={18} className="shrink-0 text-gray-400 group-hover:text-suka-orange" />
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Sebelumnya</span>
              <span className="block text-sm font-semibold text-suka-ink truncate">{splitCategory(prevCategory).name}</span>
            </span>
          </button>
        ) : (
          <div className="flex-1" />
        )}
        {nextCategory ? (
          <button
            onClick={() => setActiveCategory(nextCategory)}
            className="flex-1 flex items-center justify-end gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-right hover:border-suka-orange/40 transition-colors group"
          >
            <span className="min-w-0">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Selanjutnya</span>
              <span className="block text-sm font-semibold text-suka-ink truncate">{splitCategory(nextCategory).name}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-gray-400 group-hover:text-suka-orange" />
          </button>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
