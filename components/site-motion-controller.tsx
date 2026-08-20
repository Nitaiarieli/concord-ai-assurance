"use client";

import { useEffect } from "react";

export function SiteMotionController() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main section, main > header, .commercial-header"));
    let scrollFrame = 0;
    let pointerFrame = 0;
    let previousScroll = window.scrollY;
    let previousTime = performance.now();

    const updateScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        const now = performance.now();
        const elapsed = Math.max(now - previousTime, 16);
        const delta = window.scrollY - previousScroll;
        const velocity = Math.max(-1, Math.min(1, delta / elapsed / 1.4));
        root.style.setProperty("--scroll-velocity", reduced ? "0" : velocity.toFixed(3));
        if (!reduced) sections.forEach((section) => {
          const bounds = section.getBoundingClientRect();
          const progress = Math.max(0, Math.min(1, (window.innerHeight - bounds.top) / (window.innerHeight + bounds.height)));
          section.style.setProperty("--scene-progress", progress.toFixed(3));
        });
        previousScroll = window.scrollY;
        previousTime = now;
        scrollFrame = 0;
      });
    };

    const updatePointer = (event: PointerEvent) => {
      if (reduced || pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(() => {
        root.style.setProperty("--pointer-x", ((event.clientX / window.innerWidth) * 2 - 1).toFixed(3));
        root.style.setProperty("--pointer-y", ((event.clientY / window.innerHeight) * 2 - 1).toFixed(3));
        pointerFrame = 0;
      });
    };

    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      (entry.target as HTMLElement).dataset.motionActive = entry.isIntersecting ? "true" : "false";
    }), { rootMargin: "12% 0px 12%", threshold: .08 });

    sections.forEach((section) => observer.observe(section));
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll, { passive: true });
    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
      window.removeEventListener("pointermove", updatePointer);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    };
  }, []);

  return null;
}
