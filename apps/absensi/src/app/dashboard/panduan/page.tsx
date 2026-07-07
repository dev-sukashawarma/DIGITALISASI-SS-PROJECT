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
  const nextCategory =
    currentIndex >= 0 && currentIndex < categories.length - 1 ? categories[currentIndex + 1] : null;

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
    <div className="mx-auto max-w-2xl space-y-6" ref={topRef}>
      {/* Header */}
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-suka-orange/10 text-suka-orange">
          <BookOpen size={20} />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-suka-ink">Buku Panduan</h1>
          <p className="truncate text-sm text-gray-500">Sistem Absensi Suka Shawarma</p>
        </div>
      </header>

      {/* Chapter selector — satu baris, geser ke samping (tidak pernah pecah baris) */}
      <nav className="guide-pills -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {categories.map((cat) => {
          const { num, name } = splitCategory(cat);
          const active = currentCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full py-2 pl-2 pr-4 text-sm font-medium transition-colors ${
                active
                  ? "bg-suka-orange text-white shadow-sm"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-suka-ink"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  active ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
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
      <div className="border-b border-gray-200 pb-4">
        {currentMeta.num && (
          <p className="text-xs font-semibold uppercase tracking-wider text-suka-orange">
            Bab {currentMeta.num} dari {categories.length}
          </p>
        )}
        <h2 className="mt-1 text-2xl font-bold leading-tight text-suka-ink">{currentMeta.name}</h2>
      </div>

      {/* Topik-topik */}
      <div className="space-y-8">
        {activeGuides.map((guide, idx) => {
          const images = parseImages(guide.image_url);
          return (
            <article key={guide.id} className="scroll-mt-6">
              <h3 className="mb-3 flex items-baseline gap-3 text-lg font-bold text-suka-ink">
                <span className="flex h-7 w-7 shrink-0 translate-y-0.5 items-center justify-center rounded-full bg-suka-orange text-sm font-bold text-white">
                  {idx + 1}
                </span>
                <span className="leading-snug">{guide.title}</span>
              </h3>

              <div className="ml-10 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
                <div className="guide-content" dangerouslySetInnerHTML={{ __html: guide.content_html }} />

                {images.length > 0 && (
                  <div className="mt-5 space-y-3">
                    {images.map((img, i) => (
                      <figure key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-slate-50">
                        <img
                          src={img.url}
                          alt={img.title || guide.title}
                          loading="lazy"
                          decoding="async"
                          className="max-h-[480px] w-full bg-white object-contain"
                        />
                        {img.title && (
                          <figcaption className="border-t border-gray-100 px-3 py-2 text-center text-xs font-medium text-gray-500">
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
      <div className="flex items-stretch gap-3 border-t border-gray-200 pt-6">
        {prevCategory ? (
          <button
            onClick={() => setActiveCategory(prevCategory)}
            className="group flex flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-suka-orange/40"
          >
            <ChevronLeft size={18} className="shrink-0 text-gray-400 group-hover:text-suka-orange" />
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Sebelumnya</span>
              <span className="block truncate text-sm font-semibold text-suka-ink">{splitCategory(prevCategory).name}</span>
            </span>
          </button>
        ) : (
          <div className="flex-1" />
        )}
        {nextCategory ? (
          <button
            onClick={() => setActiveCategory(nextCategory)}
            className="group flex flex-1 items-center justify-end gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-right transition-colors hover:border-suka-orange/40"
          >
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Selanjutnya</span>
              <span className="block truncate text-sm font-semibold text-suka-ink">{splitCategory(nextCategory).name}</span>
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
