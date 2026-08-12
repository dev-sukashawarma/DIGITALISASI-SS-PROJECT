"use client";

import { motion } from "motion/react";
import { TestimonialsColumn, type Testimonial } from "./ui/testimonials-columns-1";

/**
 * TODO: Replace all testimonials below with real customer reviews.
 * Add `rating` (1–5), real avatar URLs, real names/roles.
 * Current avatars use randomuser.me as placeholder.
 */
const testimonials: Testimonial[] = [
  {
    text: "Satu menu bisa untuk 2 orang karena kebabnya sangat besar sekali sesuai dengan harga. Lebih enak yang beef, kalau ayam rasa bumbu aromatiknya terasa banget jadi kurang cocok sama lidahku yang kampung hehe.",
    image: "https://ui-avatars.com/api/?name=Chiti+a+kinno&background=6E1A10&color=fff&size=80",
    name: "Chiti a kinno",
    role: "Google Review",
    rating: 4,
  },
  {
    text: "Alhamdulillah akhirnya bisa pesan jajanan viral yang satu ini. Dulu pas pertama buka pengen banget tapi selalu ramai. Sekarang sudah buka pagi jadi bisa langsung diproses tanpa antre. Enak banget kebab Suka Shawarmanya. Karyawannya juga ramah.",
    image: "https://ui-avatars.com/api/?name=Salwa+Maulidina&background=6E1A10&color=fff&size=80",
    name: "salwa maulidina",
    role: "Google Review",
    rating: 5,
  },
  {
    text: "Pelayanannya ramah dan cepat. Kebabnya enak banget, cocok buat yang mau makan hemat tapi tetap kenyang. Order versi jumbo berdua kukira bakal habis, ternyata masih banyak. Pasti balik lagi ke sini.",
    image: "https://ui-avatars.com/api/?name=Sayyidatun+Nissa&background=6E1A10&color=fff&size=80",
    name: "Sayyidatun nissa febiani",
    role: "Google Review",
    rating: 5,
  },
  {
    text: "Sebenernya enak, harga sekitar 40 ribuan sudah dapat kebab yang besar. Ayamnya enak, sapinya juga enak walaupun menurutku bumbunya bisa sedikit lebih berani. Overall puas.",
    image: "https://ui-avatars.com/api/?name=Trio+Taryono&background=6E1A10&color=fff&size=80",
    name: "Trio Taryono",
    role: "Google Review",
    rating: 4,
  },
  {
    text: "Kalau main ke Bogor atau habis dari Puncak jangan lupa mampir ke Suka Shawarma. Ukuran jumbonya bikin kenyang dan cocok dijadikan makan utama.",
    image: "https://ui-avatars.com/api/?name=Irvan+Firmansyah&background=6E1A10&color=fff&size=80",
    name: "Irvan Firmansyah",
    role: "Google Review",
    rating: 5,
  },
  {
    text: "Kebab sapinya enak, gurih dengan rempah yang pas. Pelayanannya juga sangat responsif, cepat, dan ramah. Good service.",
    image: "https://ui-avatars.com/api/?name=Kazuwita+Hiroshi&background=6E1A10&color=fff&size=80",
    name: "Kazuwita Hiroshi",
    role: "Google Review",
    rating: 5,
  },
  {
    text: "Awalnya tidak suka kebab, tapi shawarma di sini enak banget sampai nagih. Sausnya melimpah, kentangnya lembut, dagingnya tebal, kulit tortillanya juga enak dan tidak mudah sobek. Worth it.",
    image: "https://ui-avatars.com/api/?name=Shakilla+Okta&background=6E1A10&color=fff&size=80",
    name: "Shakilla Okta",
    role: "Google Review",
    rating: 5,
  },
];

const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 5);
const thirdColumn = testimonials.slice(5, 7);

export default function Testimonials() {
  return (
    <section className="bg-[#FAF7F2] py-20 lg:py-28 relative overflow-hidden">
      {/* Layer 1 (z-[10]): Ambient background warmth glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full bg-[#FE7108]/5 blur-3xl pointer-events-none z-[10]" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 z-[20] relative">

        {/* Section header (Layer 4) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          viewport={{ once: true }}
          className="flex flex-col items-center justify-center max-w-[540px] mx-auto mb-12 relative z-[40]"
        >
          <div className="flex justify-center mb-3">
            <div className="border border-[#6E1A10]/30 py-1 px-4 rounded-lg text-[#6E1A10] text-xs font-semibold tracking-wider uppercase backdrop-blur-sm">
              Testimoni
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2 text-[#111111] text-center">
            Kata Mereka Tentang Kami
          </h2>
          <p className="text-center mt-4 text-[#111111]/60 leading-relaxed">
            Cerita asli dari pelanggan yang sudah mencoba Suka Shawarma.
          </p>
        </motion.div>

        {/* Scrolling columns (Layer 5) */}
        <div className="flex justify-center gap-6 mt-6 [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)] max-h-[740px] overflow-hidden relative z-[50]">
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn
            testimonials={secondColumn}
            className="hidden md:block"
            duration={19}
          />
          <TestimonialsColumn
            testimonials={thirdColumn}
            className="hidden lg:block"
            duration={17}
          />
        </div>
      </div>
    </section>
  );
}
