"use client";

import { useEffect } from "react";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function SiteMotionController() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main section, main > header, .commercial-header"));
    const site = document.querySelector<HTMLElement>(".cc-site");
    let reduced = media.matches;
    let frame = 0;

    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      (entry.target as HTMLElement).dataset.motionActive = entry.isIntersecting ? "true" : "false";
    }), { rootMargin: "12% 0px 12%", threshold: .08 });

    const updateScrollScenes = () => {
      frame = 0;
      if (!site) return;
      if (reduced) {
        site.style.setProperty("--cc-root-progress", "1");
        site.style.setProperty("--cc-scroll-shift", "0");
        return;
      }

      const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = clamp(window.scrollY / scrollRange);
      site.style.setProperty("--cc-root-progress", String(.14 + progress * .86));
      site.style.setProperty("--cc-scroll-shift", String(progress));
    };

    const requestScrollUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScrollScenes);
    };

    const configureMotion = () => {
      reduced = media.matches;
      sections.forEach((section) => {
        observer.unobserve(section);
        if (reduced) section.dataset.motionActive = "true";
        else observer.observe(section);
      });
      requestScrollUpdate();
    };

    configureMotion();
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate);
    media.addEventListener("change", configureMotion);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", requestScrollUpdate);
      media.removeEventListener("change", configureMotion);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
