"use client";

import Lenis from "lenis";
import { useEffect } from "react";

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function SiteMotionController() {
  useEffect(() => {
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main section, main > header, .commercial-header"));
    const site = document.querySelector<HTMLElement>(".cc-site");
    let reduced = reducedQuery.matches;
    let frame = 0;
    let lenis: Lenis | null = null;
    let lenisFrame = 0;

    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      (entry.target as HTMLElement).dataset.motionActive = entry.isIntersecting ? "true" : "false";
    }), { rootMargin: "14% 0px 14%", threshold: .06 });

    const updateSceneVariables = () => {
      frame = 0;
      if (!site) return;
      if (reduced) {
        site.style.setProperty("--cc-root-progress", "1");
        site.style.setProperty("--cc-scroll-shift", "0");
        return;
      }
      const scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = clamp(window.scrollY / scrollRange);
      site.style.setProperty("--cc-root-progress", String(.08 + progress * .92));
      site.style.setProperty("--cc-scroll-shift", String(progress));
    };

    const requestSceneUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateSceneVariables);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!site || reduced || !finePointer.matches) return;
      site.style.setProperty("--cc-pointer-x", `${event.clientX}px`);
      site.style.setProperty("--cc-pointer-y", `${event.clientY}px`);
      site.style.setProperty("--cc-pointer-nx", String(event.clientX / window.innerWidth - .5));
      site.style.setProperty("--cc-pointer-ny", String(event.clientY / window.innerHeight - .5));
    };

    const stopLenis = () => {
      if (lenisFrame) window.cancelAnimationFrame(lenisFrame);
      lenisFrame = 0;
      lenis?.destroy();
      lenis = null;
      document.documentElement.classList.remove("cc-lenis-active");
    };

    const startLenis = () => {
      if (reduced || lenis) return;
      lenis = new Lenis({
        duration: 1.05,
        easing: (time) => Math.min(1, 1.001 - Math.pow(2, -10 * time)),
        smoothWheel: true,
        wheelMultiplier: .88,
        touchMultiplier: 1,
        syncTouch: false,
      });
      document.documentElement.classList.add("cc-lenis-active");
      lenis.on("scroll", requestSceneUpdate);
      const raf = (time: number) => {
        lenis?.raf(time);
        lenisFrame = window.requestAnimationFrame(raf);
      };
      lenisFrame = window.requestAnimationFrame(raf);
    };

    const configureMotion = () => {
      reduced = reducedQuery.matches;
      sections.forEach((section) => {
        observer.unobserve(section);
        if (reduced) section.dataset.motionActive = "true";
        else observer.observe(section);
      });
      stopLenis();
      startLenis();
      requestSceneUpdate();
    };

    configureMotion();
    window.addEventListener("scroll", requestSceneUpdate, { passive: true });
    window.addEventListener("resize", requestSceneUpdate);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    reducedQuery.addEventListener("change", configureMotion);

    return () => {
      observer.disconnect();
      stopLenis();
      window.removeEventListener("scroll", requestSceneUpdate);
      window.removeEventListener("resize", requestSceneUpdate);
      window.removeEventListener("pointermove", onPointerMove);
      reducedQuery.removeEventListener("change", configureMotion);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
