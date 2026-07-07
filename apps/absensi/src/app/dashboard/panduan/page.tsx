"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { Book, Loader2 } from "lucide-react";

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

export default function PanduanPage() {
  const supabase = useMemo(() => createClient(), []);
  const [activeCategory, setActiveCategory] = useState<string>("");

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
  const activeGuides = groupedGuides[currentCategory] || [];

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-suka-ink flex items-center gap-2">
          <Book className="w-6 h-6 text-suka-orange" />
          Buku Panduan
        </h1>
        <p className="text-gray-500 text-sm mt-1">Panduan penggunaan Sistem Absensi Suka Shawarma</p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
              currentCategory === cat
                ? "bg-suka-orange/10 text-suka-orange"
                : "text-gray-600 bg-white border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-12">
        {activeGuides.map((guide, idx) => (
          <div key={guide.id} className="space-y-4">
            <h3 className="text-lg font-bold text-suka-ink flex items-center gap-3">
              <span className="w-7 h-7 shrink-0 rounded-full bg-suka-orange/10 text-suka-orange flex items-center justify-center text-sm">
                {idx + 1}
              </span>
              {guide.title}
            </h3>

            <div
              className="prose prose-sm sm:prose-base max-w-none ml-10 prose-p:leading-relaxed prose-p:text-gray-600"
              dangerouslySetInnerHTML={{ __html: guide.content_html }}
            />

            {parseImages(guide.image_url).length > 0 && (
              <div className="ml-10 space-y-3">
                {parseImages(guide.image_url).map((img, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 p-3 space-y-2">
                    <img src={img.url} alt={img.title || guide.title} className="w-full h-auto rounded-xl object-contain bg-white max-h-[500px]" />
                    {img.title && <p className="text-sm font-medium text-gray-700 text-center">{img.title}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
