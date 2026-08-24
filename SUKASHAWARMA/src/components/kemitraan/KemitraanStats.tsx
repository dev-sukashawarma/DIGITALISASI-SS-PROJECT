"use client";

import { motion } from "motion/react";

export default function KemitraanStats() {
  const stats = [
    {
      number: "20+",
      label: "Outlet Aktif",
      description: ""
    },
    {
      number: "Mei '24",
      label: "Mulai di Bogor",
      description: ""
    },
    {
      number: "28K+",
      label: "Followers IG",
      description: ""
    },
    {
      number: "Halal",
      label: "Sertifikasi MUI",
      description: ""
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-4xl md:text-5xl font-bold text-[#6E1A10] mb-2">
                {stat.number}
              </div>
              <div className="text-[#111111] font-semibold mb-1">
                {stat.label}
              </div>
              {stat.description && (
                <div className="text-sm text-[#111111]/60">
                  {stat.description}
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  );
}