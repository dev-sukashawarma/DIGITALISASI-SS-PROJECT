"use client";

import { motion } from "motion/react";
import type { MenuItem } from "@/data/menu";

interface MenuCardProps {
  item: MenuItem;
  index?: number;
}

export default function MenuCard({ item, index = 0 }: MenuCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        duration: 0.5,
        delay: (index % 4) * 0.07,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden
                 shadow-layered-sm hover:shadow-layered-lg hover:-translate-y-1
                 transition-all duration-300 transform-gpu z-[50] relative"
    >
      {/* Image — 4:3 (Layer 2) */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#FAF7F2] z-[20]">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover
                     group-hover:scale-[1.04]
                     transition-transform duration-500 ease-out transform-gpu"
        />
        {/* Best Seller badge (Layer 3) */}
        {item.isBestSeller && (
          <div className="absolute top-3 left-3 z-[30] bg-[#FFC500] text-[#111111]
                          text-[10px] font-bold tracking-wider uppercase
                          px-2.5 py-1 rounded-full shadow-sm backdrop-blur-sm">
            Best Seller
          </div>
        )}
      </div>

      {/* Content (Layer 4 & 6) */}
      <div className="flex flex-col flex-1 p-4 relative z-[40]">
        <h3
          className="font-bold text-[#111111] text-sm
                     tracking-wide uppercase leading-snug mb-2"
        >
          {item.name}
        </h3>

        {item.description && (
          <p className="text-xs text-[#111111]/60 leading-relaxed line-clamp-2 mb-3">
            {item.description}
          </p>
        )}

        <a
          href="https://order.sukashawarma.com/"
          className="text-xs font-semibold text-[#FE7108] hover:text-[#e56507]
                     transition-colors duration-150 mt-auto relative z-[60]"
        >
          Pesan →
        </a>
      </div>
    </motion.div>
  );
}
