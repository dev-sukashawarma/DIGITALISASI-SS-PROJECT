"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

declare const gtag: (...args: unknown[]) => void;

export default function KemitraanStickyWA() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const heroSentinelRef = useRef<HTMLDivElement>(null);

  // Show after user scrolls past ~100vh
  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Collapse expanded state when hidden
  useEffect(() => {
    if (!visible) setExpanded(false);
  }, [visible]);

  const handleClick = () => {
    if (typeof gtag !== "undefined") {
      gtag("event", "conversion", {
        send_to: "AW-11522229721/18NOCPO46eYcENmLnfYq",
        value: 1.0,
        currency: "IDR",
      });
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.92 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed bottom-6 right-5 z-50 flex flex-col items-end gap-2"
          aria-label="Hubungi via WhatsApp"
        >
          {/* Tooltip / expanded label */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="bg-[#111111] text-white text-xs font-semibold
                           px-3.5 py-2 rounded-xl shadow-lg whitespace-nowrap
                           leading-tight"
              >
                Konsultasi gratis via WA
                <br />
                <span className="text-white/50 font-normal">Tanpa paksaan &amp; tanpa DP</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main button */}
          <motion.a
            href="https://wa.me/6282299325621"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            onHoverStart={() => setExpanded(true)}
            onHoverEnd={() => setExpanded(false)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className="flex items-center justify-center w-14 h-14 rounded-full
                       bg-[#25D366] text-white
                       shadow-[0_6px_24px_rgba(37,211,102,0.45)]
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
            aria-label="Chat WhatsApp"
          >
            {/* Pulse ring */}
            <span className="absolute w-14 h-14 rounded-full bg-[#25D366] opacity-30 animate-ping" aria-hidden="true" />
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white relative z-10" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.522 5.847L0 24l6.335-1.502A11.95 11.95 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.792 9.792 0 0 1-5.002-1.373l-.359-.213-3.72.882.939-3.618-.234-.372A9.792 9.792 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
            </svg>
          </motion.a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
