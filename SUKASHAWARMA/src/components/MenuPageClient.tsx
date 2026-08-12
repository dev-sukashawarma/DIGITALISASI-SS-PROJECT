"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MenuCard from "@/components/MenuCard";
import CategoryNav from "@/components/CategoryNav";
import {
  menuItems,
  bestSellerItems,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type MenuCategory,
} from "@/data/menu";

// ─── Section component ────────────────────────────────────────────────────────

function MenuSection({
  category,
  sectionRef,
}: {
  category: MenuCategory;
  sectionRef: (el: HTMLElement | null) => void;
}) {
  const items =
    category === "best-seller"
      ? bestSellerItems
      : menuItems.filter((item) => item.category === category);

  if (items.length === 0) return null;

  return (
    <section
      id={`section-${category}`}
      ref={sectionRef}
      className="scroll-mt-32"
    >
      {/* Category heading */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-4 mb-8"
      >
        <h2
          className="font-heading font-bold text-2xl md:text-3xl text-[#111111] shrink-0"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {CATEGORY_LABELS[category]}
        </h2>
        <div className="flex-1 h-px bg-black/[0.06]" />
      </motion.div>

      {/* Grid — 4 col desktop / 2 tablet / 1 mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {items.map((item, index) => (
          <MenuCard key={item.id} item={item} index={index} />
        ))}
      </div>
    </section>
  );
}

// ─── Client Page ──────────────────────────────────────────────────────────────

export default function MenuPageClient() {
  const [activeCategory, setActiveCategory] = useState<MenuCategory>("best-seller");
  const sectionRefs = useRef<Record<MenuCategory, HTMLElement | null>>(
    {} as Record<MenuCategory, HTMLElement | null>
  );

  // IntersectionObserver — update active tab as user scrolls
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    CATEGORY_ORDER.forEach((cat) => {
      const el = sectionRefs.current[cat];
      if (!el) return;

      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveCategory(cat);
        },
        { rootMargin: "-30% 0px -60% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  // Click tab → smooth scroll to section
  const handleCategorySelect = (cat: MenuCategory) => {
    setActiveCategory(cat);
    const el = sectionRefs.current[cat];
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <Navbar />

      <main className="pt-[68px]">

        {/* Hero */}
        <section className="bg-[#FAF7F2] pt-20 pb-12 px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#FE7108] mb-4">
              Menu Lengkap
            </p>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-bold
                         tracking-tight text-[#111111] leading-[1.1] mb-5"
            >
              Temukan Menu<br />
              <span className="text-[#6E1A10]">Favorit Kamu</span>
            </h1>
            <p className="text-[#111111]/55 text-base max-w-lg mx-auto leading-relaxed">
              Dari shawarma original hingga varian spesial, semua tersedia segar setiap hari.
            </p>
          </div>
        </section>

        {/* Sticky category nav */}
        <div className="sticky top-[68px] z-40 bg-white/95 backdrop-blur-sm
                        border-b border-black/[0.06] shadow-[0_1px_0_0_rgba(0,0,0,0.04)]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-3">
            <CategoryNav
              activeCategory={activeCategory}
              onSelect={handleCategorySelect}
            />
          </div>
        </div>

        {/* Menu sections */}
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14 space-y-16">
          {CATEGORY_ORDER.map((cat) => (
            <MenuSection
              key={cat}
              category={cat}
              sectionRef={(el) => {
                sectionRefs.current[cat] = el;
              }}
            />
          ))}
        </div>

      </main>

      <Footer />
    </>
  );
}
