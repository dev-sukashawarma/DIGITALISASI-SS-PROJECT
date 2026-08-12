"use client";

import React from "react";
import { motion } from "motion/react";
import { Star } from "lucide-react";

const StarRating = ({ rating = 5 }: { rating?: number }) => (
  <div className="flex items-center gap-0.5 mb-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating
            ? "fill-[#FFC500] text-[#FFC500]"
            : "fill-none text-gray-300"
        }`}
      />
    ))}
  </div>
);

export type Testimonial = {
  text: string;
  image: string;
  name: string;
  role: string;
  rating: number;
};

export const TestimonialsColumn = (props: {
  className?: string;
  testimonials: Testimonial[];
  duration?: number;
}) => {
  return (
    <div className={props.className}>
      <motion.div
        animate={{ translateY: "-50%" }}
        transition={{
          duration: props.duration || 10,
          repeat: Infinity,
          ease: "linear",
          repeatType: "loop",
        }}
        className="flex flex-col gap-6 pb-6 transform-gpu will-change-transform"
      >
        {[...new Array(2).fill(0).map((_, index) => (
          <React.Fragment key={index}>
            {props.testimonials.map(({ text, image, name, role, rating }, i) => (
              <div
                className="p-8 rounded-3xl border border-gray-100 shadow-layered-md hover:shadow-layered-lg hover:-translate-y-1 transition-all duration-300 max-w-xs w-full bg-white transform-gpu z-[50] relative"
                key={i}
              >
                <StarRating rating={rating} />
                <p className="text-sm leading-relaxed text-[#111111]/80 mb-5">
                  {text}
                </p>
                <div className="flex items-center gap-3">
                  <img
                    width={40}
                    height={40}
                    src={image}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover shadow-sm"
                  />
                  <div className="flex flex-col">
                    <div className="font-semibold text-sm tracking-tight leading-5 text-[#111111]">
                      {name}
                    </div>
                    <div className="text-xs leading-5 text-[#111111]/50 tracking-tight">
                      {role}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </React.Fragment>
        ))]}
      </motion.div>
    </div>
  );
};
