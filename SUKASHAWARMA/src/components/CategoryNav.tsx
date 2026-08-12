"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABELS, CATEGORY_ORDER, type MenuCategory } from "@/data/menu";

interface CategoryNavProps {
  activeCategory: MenuCategory;
  onSelect: (cat: MenuCategory) => void;
}

export default function CategoryNav({ activeCategory, onSelect }: CategoryNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll active tab into view on change
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeCategory]);

  return (
    <div
      ref={navRef}
      className="flex items-center gap-1 overflow-x-auto scrollbar-none
                 pb-0.5 -mx-1 px-1"
      role="tablist"
      aria-label="Kategori menu"
    >
      {CATEGORY_ORDER.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(cat)}
            className={`relative shrink-0 px-4 py-2 rounded-full text-sm font-medium
                        transition-all duration-200 whitespace-nowrap
                        ${isActive
                          ? "bg-[#6E1A10] text-white"
                          : "text-[#111111]/50 hover:text-[#111111] hover:bg-black/[0.04]"
                        }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        );
      })}
    </div>
  );
}
