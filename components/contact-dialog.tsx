"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function ContactDialog() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const openFromTrigger = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-contact-trigger]") : null;
      if (!target) return;
      event.preventDefault();
      openerRef.current = target;
      setOpen(true);
    };
    document.addEventListener("click", openFromTrigger);
    return () => document.removeEventListener("click", openFromTrigger);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : [];
    focusable[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  if (!open) return null;

  return (
    <div className="contact-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <section ref={dialogRef} className="contact-dialog" role="dialog" aria-modal="true" aria-labelledby="contact-title" aria-describedby="contact-description">
        <div className="contact-environment" aria-hidden="true">
          <span className="contact-aperture"><i/><i/><i/><i/><i/></span>
          <span className="contact-trace"><i/><i/><i/></span>
        </div>
        <button className="contact-close" type="button" onClick={close} aria-label="Close contact window">×</button>
        <div className="contact-copy">
          <span className="contact-eyebrow">Talk to the team</span>
          <h2 id="contact-title">Let’s map your first control loop.</h2>
          <p id="contact-description">Start with one application, one validity-changing event, and a measurable verification goal.</p>
        </div>
        <div className="contact-card">
          <div><span>Team</span><strong>Ralph Team</strong></div>
          <div><span>Phone</span><a href="tel:+972556669857">+972 55-666-9857</a></div>
          <div><span>Email</span><a href="mailto:nitai@ralphteam.ai">nitai@ralphteam.ai</a></div>
        </div>
        <div className="contact-actions">
          <a className="contact-action contact-action-primary" href="tel:+972556669857">Call Us <span aria-hidden="true">↗</span></a>
          <a className="contact-action" href="mailto:nitai@ralphteam.ai">Send an Email <span aria-hidden="true">↗</span></a>
        </div>
      </section>
    </div>
  );
}
