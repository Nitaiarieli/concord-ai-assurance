"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { KeyboardEvent as ReactKeyboardEvent, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { cases, integrations, readinessReport } from "@/lib/concord";

const ValidityBiome = lazy(() => import("@/components/validity-biome"));

function useClientReady() {
  return useSyncExternalStore(() => () => undefined, () => true, () => false);
}

type StageId = "detect" | "trace" | "repair" | "verify" | "prove";
type ObjectId = "authority" | "vector" | "cache" | "memory" | "probe" | "evidence";
type DetailId = "risk" | "action" | "proof";
type ProofState = "Verified" | "Repairing" | "Unresolved" | "Unsupported" | "Accepted risk";
type ProofView = "outcome" | "coverage" | "evidence" | "integrations" | "value";
type Stage = {
  id: StageId;
  number: string;
  label: string;
  headline: string;
  body: string;
  input: string;
  action: string;
  output: string;
  detail: string;
  objects: ObjectId[];
};

const stages: Stage[] = [
  {
    id: "detect",
    number: "01",
    label: "Detect",
    headline: "Capture the change where authority lives.",
    body: "Concord records the permission, identity, retention, or content event with its source object, principal, policy, and version.",
    input: "BookStack · strategy-page",
    action: "Validity event captured",
    output: "Policy access-revocation/v3",
    detail: "The authority stays customer-controlled. Observation does not imply that Concord can alter the source.",
    objects: ["authority"],
  },
  {
    id: "trace",
    number: "02",
    label: "Trace",
    headline: "Expose every registered derivative in range.",
    body: "Versioned lineage resolves the changed source to registered vector records, cache keys, memories, and retrieval paths.",
    input: "1 authority event",
    action: "Registered lineage resolved",
    output: "144 affected artifacts",
    detail: "Unknown or unregistered dependencies remain visible as coverage gaps. Absence of evidence is never presented as safety.",
    objects: ["authority", "vector", "cache", "memory"],
  },
  {
    id: "repair",
    number: "03",
    label: "Repair",
    headline: "Apply the smallest policy-safe repair.",
    body: "Each supported adapter receives the action it can prove: quarantine, update, delete, invalidate, recompute, or change access.",
    input: "144 selected artifacts",
    action: "Bounded repair executed",
    output: "128 vectors · 16 cache keys",
    detail: "An accepted write is progress, not proof. Every supported destination must still be read back.",
    objects: ["vector", "cache", "memory"],
  },
  {
    id: "verify",
    number: "04",
    label: "Verify",
    headline: "Read it back. Then test the real path.",
    body: "Concord confirms destination state, then executes the registered end-to-end retrieval path as the affected identity.",
    input: "Destination read-back",
    action: "Identity-aware probe",
    output: "0 protected results",
    detail: "A successful API response alone is never assurance. Verification depends on behavior at the consumption boundary.",
    objects: ["vector", "cache", "probe"],
  },
  {
    id: "prove",
    number: "05",
    label: "Prove",
    headline: "Seal the outcome without hiding the gaps.",
    body: "One durable record connects the event, impact calculation, actions, read-backs, retrieval probe, exposure time, and unresolved scope.",
    input: "Complete event trail",
    action: "Evidence sealed",
    output: "Bounded assurance record",
    detail: "Verified, repairing, unresolved, unsupported, and accepted-risk states stay distinct in every report.",
    objects: ["probe", "evidence"],
  },
];

const objectDetails: Record<ObjectId, {
  name: string;
  kind: string;
  registration: string;
  capability: string;
  policy: string;
  readBack: string;
  retrieval: string;
  state: ProofState;
  summary: string;
  risk: string;
  action: string;
  proof: string;
}> = {
  authority: {
    name: "BookStack",
    kind: "Authoritative source",
    registration: "Foundation contract",
    capability: "Observe and reconcile",
    policy: "access-revocation/v3",
    readBack: "Source version 0042",
    retrieval: "Not a destination",
    state: "Verified",
    summary: "The registered system that owns the current source object and effective permission state.",
    risk: "A source permission or document can change after AI derivatives have already been created.",
    action: "Observe the event, reconcile current source state, and calculate registered downstream impact.",
    proof: "Preserve the authoritative object version, permission observation, policy, and event receipt.",
  },
  vector: {
    name: "Pinecone",
    kind: "Vector destination",
    registration: "MVP contract",
    capability: "Quarantine, delete, read back",
    policy: "targeted-quarantine/v2",
    readBack: "128 / 128 expected",
    retrieval: "Included in affected-user probe",
    state: "Repairing",
    summary: "Embeddings and vector records derived from the affected source object.",
    risk: "A semantically searchable copy can remain retrievable after its source access changes.",
    action: "Quarantine, delete, update, or recompute only the registered records selected by policy.",
    proof: "Read back each destination record, then include it in the affected-identity retrieval probe.",
  },
  cache: {
    name: "Redis",
    kind: "Cache destination",
    registration: "MVP contract",
    capability: "Invalidate, update, read back",
    policy: "cache-invalidation/v4",
    readBack: "Pending",
    retrieval: "Blocked until read-back",
    state: "Repairing",
    summary: "Registered cache keys that can preserve a result after its authority changes.",
    risk: "A valid-looking response can outlive the permission, retention rule, or source data that created it.",
    action: "Invalidate or update affected keys with an idempotent, policy-specific operation.",
    proof: "Read back invalidation and test the application path used by the affected identity.",
  },
  memory: {
    name: "Agent memory",
    kind: "Persistent derivative",
    registration: "Adapter required",
    capability: "No supported adapter",
    policy: "No executable action",
    readBack: "Unavailable",
    retrieval: "Outside this proof",
    state: "Unsupported",
    summary: "Persistent agent state derived from enterprise knowledge or earlier interactions.",
    risk: "An agent can continue using remembered content after that content is no longer valid.",
    action: "Update, delete, recompute, change access, or invoke a callback only when a supported adapter exists.",
    proof: "No adapter is registered in this demonstration, so this object remains explicitly unsupported.",
  },
  probe: {
    name: "Retrieval probe",
    kind: "Behavioral verification",
    registration: "Registered path",
    capability: "Affected-identity retrieval",
    policy: "consumption-boundary/v2",
    readBack: "Destination state confirmed",
    retrieval: "0 protected results",
    state: "Verified",
    summary: "A final test of what the affected identity can retrieve after remediation.",
    risk: "A clean destination record can still produce the wrong behavior through another retrieval layer.",
    action: "Run the registered retrieval path using the affected identity and expected source version.",
    proof: "Preserve the query, identity, consumed version, returned results, and policy decision.",
  },
  evidence: {
    name: "Assurance record",
    kind: "Evidence package",
    registration: "Preserved",
    capability: "Seal and export",
    policy: "evidence-retention/v1",
    readBack: "Record hash confirmed",
    retrieval: "Probe linked",
    state: "Verified",
    summary: "A bounded record connecting the event, impact, repair, read-back, retrieval result, and exceptions.",
    risk: "Without one evidence chain, operators and auditors must reconstruct whether the incident actually closed.",
    action: "Seal the result without upgrading unresolved, unsupported, or accepted-risk scope.",
    proof: "Expose timestamps, policy, artifacts, receipts, probe behavior, exposure time, and remaining gaps.",
  },
};

const evidenceEvents: Array<{
  id: string;
  time: string;
  category: "Authority" | "Control" | "Proof";
  title: string;
  state: ProofState;
  evidence: string;
  boundary: string;
}> = [
  { id: "EVT-441", time: "09:42:16.021", category: "Authority", title: "Access revoked at the source", state: "Verified", evidence: "Source event · strategy-page · finance-leadership", boundary: "Authority observation is registered. Concord does not alter the source permission." },
  { id: "CALC-118", time: "09:42:16.184", category: "Control", title: "Registered impact calculated", state: "Verified", evidence: "144 artifacts · lineage revision 86 · access-revocation/v3", boundary: "Only registered edges are included. Agent memory remains outside this example." },
  { id: "ACT-207", time: "09:42:18.902", category: "Control", title: "Targeted remediation acknowledged", state: "Repairing", evidence: "128 quarantine receipts · 16 invalidation acknowledgements", boundary: "Accepted writes are progress. Destination read-back is still required." },
  { id: "READ-083", time: "09:49:54.411", category: "Proof", title: "Destination state read back", state: "Verified", evidence: "128 destination reads · 128 expected states · 0 mismatches", boundary: "Redis read-back is pending, so that scope remains Repairing." },
  { id: "PROBE-51", time: "09:50:58.772", category: "Proof", title: "Affected identity retrieved zero protected results", state: "Verified", evidence: "12 retrieval attempts · 0 protected results", boundary: "This proves the registered path tested in this run—not universal safety." },
];

const proofViews: Array<{ id: ProofView; label: string }> = [
  { id: "outcome", label: "Current outcome" },
  { id: "coverage", label: "Coverage" },
  { id: "evidence", label: "Evidence" },
  { id: "integrations", label: "Integrations" },
  { id: "value", label: "Organizational value" },
];

function Icon({ name }: { name: "arrow" | "close" | "next" | "pause" | "play" | "shield" }) {
  const path = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
    next: <path d="m9 6 6 6-6 6"/>,
    pause: <><path d="M9 6v12"/><path d="M15 6v12"/></>,
    play: <path d="m8 5 11 7-11 7z"/>,
    shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></>,
  }[name];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
}

function ConcordMark({ compact = false }: { compact?: boolean }) {
  return <span className="cc-brand-mark"><span className="cc-brand-aperture" aria-hidden="true"><i/><i/><i/></span>{!compact && <strong>Concord</strong>}</span>;
}

function SystemGlyph({ id }: { id: ObjectId }) {
  const paths: Record<ObjectId, React.ReactNode> = {
    authority: <><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 8h7M8 12h7"/></>,
    vector: <><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="m8 11 8-4M8 13l8 4"/></>,
    cache: <><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
    memory: <><path d="M4 15c3-7 5 3 8-4s5 3 8-4"/><path d="M4 20c3-7 5 3 8-4s5 3 8-4"/></>,
    probe: <><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="2"/></>,
    evidence: <><path d="M6 3h9l3 3v15H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></>,
  };
  return <span className={`cc-app-mark cc-app-${id}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">{paths[id]}</svg></span>;
}

function StateBadge({ state }: { state: ProofState }) {
  const slug = state.toLowerCase().replaceAll(" ", "-");
  const symbol: Record<ProofState, string> = { Verified: "✓", Repairing: "↻", Unresolved: "!", Unsupported: "×", "Accepted risk": "◇" };
  return <span className={`cc-state cc-state-${slug}`}><i aria-hidden="true">{symbol[state]}</i>{state}</span>;
}

function SectionIndex({ number, label }: { number: string; label: string }) {
  return <div className="cc-section-index"><span>{number}</span><p>{label}</p><i aria-hidden="true"/></div>;
}

function SiteHeader() {
  return <header className="cc-header">
    <a href="#top" aria-label="Concord home"><ConcordMark/></a>
    <nav aria-label="Primary navigation"><a href="#problem">The risk</a><a href="#how-it-works">Control loop</a><a href="#proof">Proof</a><a href="/coverage">Coverage</a><a href="/pricing">Pricing</a></nav>
    <details className="cc-mobile-menu"><summary>Menu</summary><div><a href="#problem">The risk</a><a href="#how-it-works">Control loop</a><a href="#proof">Proof</a><a href="/coverage">Coverage</a><a href="/consistency-engine">Engine</a><a href="/pricing">Pricing</a><a href="/value">Value &amp; FinOps</a><a href="/intelligence">Market radar</a><a href="/deployment-agent">Architecture agent</a><button type="button" data-contact-trigger>Contact</button></div></details>
    <div className="cc-header-actions"><button type="button" data-contact-trigger>Talk to us</button><a href="/workspace">Open workspace <Icon name="arrow"/></a></div>
  </header>;
}

function LineageFallback() {
  return <div className="cc-lineage-system" aria-hidden="true">
    <svg viewBox="0 0 1000 6000" preserveAspectRatio="none">
      <path className="cc-root-shadow" pathLength="1" d="M842 0C824 360 906 720 815 1080C728 1424 604 1615 636 1990C668 2366 829 2557 728 2930C622 3320 478 3505 541 3890C598 4236 730 4500 624 4860C538 5150 391 5480 442 6000"/>
      <path className="cc-root-main" pathLength="1" d="M842 0C824 360 906 720 815 1080C728 1424 604 1615 636 1990C668 2366 829 2557 728 2930C622 3320 478 3505 541 3890C598 4236 730 4500 624 4860C538 5150 391 5480 442 6000"/>
      <path className="cc-root-branch" pathLength="1" d="M811 1090C718 1022 645 914 548 786C486 704 399 638 302 606"/>
      <path className="cc-root-branch" pathLength="1" d="M635 1992C544 1898 455 1815 344 1780C262 1754 193 1680 151 1585"/>
      <path className="cc-root-branch" pathLength="1" d="M729 2934C814 2850 861 2744 902 2626C923 2565 951 2519 985 2490"/>
      <path className="cc-root-branch" pathLength="1" d="M541 3893C444 3806 344 3744 223 3721C141 3705 79 3657 22 3574"/>
      <path className="cc-root-branch" pathLength="1" d="M625 4862C720 4780 807 4680 843 4543C864 4461 911 4407 980 4360"/>
    </svg>
    <span className="cc-fauna cc-fauna-bird">
      <svg viewBox="0 0 160 80"><path d="M4 48c22-4 37-15 51-32 8 9 16 16 25 20 9-4 18-11 26-20 13 17 29 28 50 32-19 2-36 0-52-8-8 8-16 14-24 18-9-4-17-10-24-18-16 8-33 10-52 8Z"/></svg>
    </span>
    <span className="cc-fauna cc-fauna-oryx">
      <svg viewBox="0 0 190 126"><path d="M34 73c19-18 44-28 76-25l18-14 21 5 8 17-15 17-27 8-10 31-8-1 2-31-44 3-7 29-8-1 1-32-17 5-13-5 23-6Z"/><path d="M132 37c-5-18-4-28 2-35 1 17 6 28 15 36M143 39c6-18 13-28 23-34-5 16-6 29-3 39" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/></svg>
    </span>
    <span className="cc-fauna cc-fauna-gecko">
      <svg viewBox="0 0 170 90"><path d="M10 59c18 3 33-1 45-13 13-13 28-18 45-14 14 3 23 12 26 26 9-8 18-12 28-11-10 8-14 17-11 28-11-7-21-8-31-3-15 8-31 7-47-2-17-10-35-14-55-11Z"/><circle cx="103" cy="44" r="3" fill="var(--cc-carbon)"/></svg>
    </span>
  </div>;
}

function HeroInstrument() {
  const [focus, setFocus] = useState<"change" | "impact" | "proof">("impact");
  const messages = {
    change: ["Authority event", "Access revoked", "Source version 0042 captured"],
    impact: ["Registered impact", "144 artifacts", "Policy-safe repair calculated"],
    proof: ["Retrieval outcome", "0 protected results", "Behavior preserved as evidence"],
  } as const;
  const message = messages[focus];
  return <aside className={`cc-hero-instrument cc-focus-${focus}`} aria-label="Interactive assurance trace">
    <header><span><i aria-hidden="true"/> Live guided trace</span><strong>CR-0841</strong></header>
    <div className="cc-instrument-orbit" aria-hidden="true"><i/><i/><i/></div>
    <div className="cc-instrument-nodes">
      <button type="button" aria-pressed={focus === "change"} onClick={() => setFocus("change")}><SystemGlyph id="authority"/><span><small>Authority</small><strong>BookStack</strong></span></button>
      <button type="button" aria-pressed={focus === "impact"} onClick={() => setFocus("impact")}><ConcordMark compact/><span><small>Assurance boundary</small><strong>Concord</strong></span></button>
      <button type="button" aria-pressed={focus === "proof"} onClick={() => setFocus("proof")}><SystemGlyph id="probe"/><span><small>Consumption boundary</small><strong>Retrieval path</strong></span></button>
    </div>
    <AnimatePresence mode="wait"><motion.div className="cc-instrument-readout" key={focus} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: .32 }} aria-live="polite"><span>{message[0]}</span><strong>{message[1]}</strong><p>{message[2]}</p></motion.div></AnimatePresence>
    <footer><StateBadge state="Verified"/><span>Demonstration data · registered path only</span></footer>
  </aside>;
}

function HeroChapter() {
  const reduced = useReducedMotion();
  return <section className="cc-hero" id="top" aria-labelledby="hero-title">
    <SiteHeader/>
    <div className="cc-hero-coordinate" aria-hidden="true"><span>31.0461° N</span><span>34.8516° E</span><span>VALIDITY BIOME / 001</span></div>
    <div className="cc-hero-grid">
      <motion.div className="cc-hero-copy" initial={reduced ? false : { opacity: 0, y: 42 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9, ease: [.16, 1, .3, 1] }}>
        <p className="cc-kicker">Independent assurance for registered AI-derived state</p>
        <h1 id="hero-title"><span>The source changed.</span><em>Concord finds what must change with it.</em></h1>
        <p>Detect the authoritative event. Trace every affected registered artifact. Repair supported destinations. Read them back. Test the real retrieval path. Preserve the evidence.</p>
        <div className="cc-hero-actions"><a href="#how-it-works">Enter the control loop <Icon name="arrow"/></a><button type="button" data-contact-trigger>Talk to Ralph Team</button></div>
      </motion.div>
      <HeroInstrument/>
    </div>
    <div className="cc-hero-rail" aria-label="Concord assurance control loop">{stages.map((stage) => <span key={stage.id}><i>{stage.number}</i>{stage.label}</span>)}</div>
  </section>;
}

function RiskChapter() {
  return <section className="cc-risk" id="risk" aria-labelledby="risk-title">
    <SectionIndex number="01" label="The validity gap"/>
    <motion.div className="cc-risk-copy" initial={{ opacity: 0, y: 56 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: .35 }} transition={{ duration: .75, ease: [.16, 1, .3, 1] }}>
      <p className="cc-kicker">Changing the source is only the beginning</p>
      <h2 id="risk-title">An old answer can survive a new truth.</h2>
      <p>Vectors, caches, retrieval layers, and agent memory can retain content after access or authoritative information changes. That gap is where invalid answers persist.</p>
    </motion.div>
    <div className="cc-revision-object" aria-label="Example of source and derivative state diverging">
      <motion.article className="cc-revision-authority" whileHover={{ y: -8, rotateX: 1.5 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
        <header><SystemGlyph id="authority"/><span><small>Authoritative source</small><strong>Access removed</strong></span><time>09:42:16</time></header>
        <div className="cc-revision-field"><span/><span/><span/></div><footer>Version 0042 · current</footer>
      </motion.article>
      <div className="cc-revision-gap"><span>Validity gap</span><i aria-hidden="true"/><strong>02:18 exposed</strong></div>
      <motion.article className="cc-revision-derivative" whileHover={{ y: -8, rotateX: -1.5 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
        <header><SystemGlyph id="vector"/><span><small>AI-derived state</small><strong>Old access retained</strong></span><time>09:42:17</time></header>
        <div className="cc-revision-field"><span/><span/><span/></div><footer><StateBadge state="Unresolved"/></footer>
      </motion.article>
    </div>
    <p className="cc-risk-boundary"><Icon name="shield"/> Assurance applies only to registered artifacts and supported adapters. Unregistered state remains outside the guarantee.</p>
  </section>;
}

function WorkflowChapter() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedObject, setSelectedObject] = useState<ObjectId>("authority");
  const [detail, setDetail] = useState<DetailId>("risk");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const inspectorRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const returnObjectRef = useRef<ObjectId>("authority");
  const hasOpenedInspector = useRef(false);
  const manualUntil = useRef(0);
  const active = stages[activeIndex];
  const object = objectDetails[selectedObject];

  const chooseStage = useCallback((index: number, manual = true) => {
    if (manual) manualUntil.current = performance.now() + 1400;
    setActiveIndex(Math.max(0, Math.min(stages.length - 1, index)));
    if (manual) setPlaying(false);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("concord:stage", { detail: { stage: activeIndex } }));
  }, [activeIndex]);

  useEffect(() => {
    const onScroll = () => {
      if (playing || performance.now() < manualUntil.current || !sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const range = Math.max(1, rect.height - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / range));
      if (rect.top <= window.innerHeight * .1 && rect.bottom >= window.innerHeight * .75) {
        setActiveIndex(Math.min(stages.length - 1, Math.floor(progress * stages.length)));
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [playing]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActiveIndex((current) => {
      if (current === stages.length - 1) {
        setPlaying(false);
        return current;
      }
      return current + 1;
    }), 2500);
    return () => window.clearInterval(timer);
  }, [playing]);

  const closeInspector = useCallback(() => {
    setInspectorOpen(false);
  }, []);

  useEffect(() => {
    if (inspectorOpen || !hasOpenedInspector.current) return;
    const objectId = returnObjectRef.current;
    const currentTarget = document.querySelector<HTMLButtonElement>(`.cc-object-strip button[data-object-id="${objectId}"]`);
    const restoreFocus = () => (currentTarget ?? returnFocusRef.current)?.focus({ preventScroll: true });
    restoreFocus();
    const timer = window.setTimeout(restoreFocus, 0);
    return () => window.clearTimeout(timer);
  }, [inspectorOpen]);

  useEffect(() => {
    if (!inspectorOpen) return;
    const panel = inspectorRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
    focusable[0]?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
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
    const onKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeInspector();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [closeInspector, inspectorOpen]);

  const handleStageKey = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % stages.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + stages.length) % stages.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = stages.length - 1;
    else return;
    event.preventDefault();
    chooseStage(next);
    tabRefs.current[next]?.focus();
  };

  const openObject = (id: ObjectId, button: HTMLButtonElement) => {
    returnFocusRef.current = button;
    returnObjectRef.current = id;
    hasOpenedInspector.current = true;
    setSelectedObject(id);
    setDetail("risk");
    setInspectorOpen(true);
  };

  return <section ref={sectionRef} className="cc-workflow" id="how-it-works" aria-labelledby="workflow-title">
    <div className="cc-workflow-sticky">
      <header className="cc-workflow-heading"><SectionIndex number="02" label="The control loop"/><div><p className="cc-kicker">One event. Five controlled transformations.</p><h2 id="workflow-title">Watch assurance move through the system.</h2></div></header>
      <div className="cc-workflow-console">
        <div className="cc-stage-rail" role="tablist" aria-label="Assurance workflow stages">{stages.map((stage, index) => <button ref={(node) => { tabRefs.current[index] = node; }} id={`cc-stage-tab-${stage.id}`} key={stage.id} type="button" role="tab" tabIndex={activeIndex === index ? 0 : -1} aria-selected={activeIndex === index} aria-controls="cc-stage-panel" onKeyDown={(event) => handleStageKey(event, index)} onClick={() => chooseStage(index)}><span>{stage.number}</span><strong>{stage.label}</strong><i aria-hidden="true"/></button>)}</div>
        <AnimatePresence mode="wait"><motion.div id="cc-stage-panel" className={`cc-stage-panel cc-stage-${active.id}`} role="tabpanel" aria-labelledby={`cc-stage-tab-${active.id}`} key={active.id} initial={{ opacity: 0, x: 55, filter: "blur(12px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -45, filter: "blur(10px)" }} transition={{ duration: .5, ease: [.16, 1, .3, 1] }}>
          <div className="cc-stage-story"><span className="cc-kicker">{active.number} / {active.label}</span><h3>{active.headline}</h3><p>{active.body}</p><div className="cc-stage-controls"><button type="button" onClick={() => chooseStage(activeIndex - 1)} disabled={activeIndex === 0} aria-label="Previous stage"><Icon name="next"/> Previous</button><button type="button" className="cc-play" onClick={() => { if (activeIndex === stages.length - 1) setActiveIndex(0); setPlaying((current) => !current); }} aria-pressed={playing}><Icon name={playing ? "pause" : "play"}/>{playing ? "Pause trace" : "Run trace"}</button><button type="button" onClick={() => chooseStage(activeIndex === stages.length - 1 ? 0 : activeIndex + 1)}>{activeIndex === stages.length - 1 ? "Replay" : "Next"} <Icon name="next"/></button></div></div>
          <div className="cc-stage-chamber" aria-label={`${active.label} stage product demonstration`}><header><span>Guided product proof</span><strong>Demonstration data</strong></header><div className="cc-chamber-path"><article><small>Input</small><strong>{active.input}</strong></article><span className="cc-chamber-route" aria-hidden="true"><i/></span><div className="cc-chamber-core"><ConcordMark compact/><small>{active.action}</small></div><span className="cc-chamber-route" aria-hidden="true"><i/></span><article><small>Observed output</small><strong>{active.output}</strong></article></div><p className="cc-stage-boundary"><Icon name="shield"/>{active.detail}</p><div className="cc-object-strip" aria-label="Registered assurance objects">{(Object.keys(objectDetails) as ObjectId[]).map((id) => { const item = objectDetails[id]; const stageActive = active.objects.includes(id); return <motion.button whileHover={{ y: -5 }} key={id} type="button" data-object-id={id} className={stageActive ? "is-active" : ""} aria-haspopup="dialog" aria-expanded={inspectorOpen && selectedObject === id} onClick={(event) => openObject(id, event.currentTarget)}><SystemGlyph id={id}/><span><small>{item.kind}</small><strong>{item.name}</strong></span><i aria-hidden="true">+</i></motion.button>; })}</div></div>
        </motion.div></AnimatePresence>
      </div>
    </div>
    {inspectorOpen && <div className="cc-inspector-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeInspector(); }}><aside ref={inspectorRef} className="cc-inspector" role="dialog" aria-modal="true" aria-labelledby="cc-inspector-title" aria-describedby="cc-inspector-summary"><div className="cc-inspector-grip" aria-hidden="true"/><button className="cc-inspector-close" type="button" onClick={closeInspector} aria-label="Close object details"><Icon name="close"/></button><header><SystemGlyph id={selectedObject}/><span><small>{object.kind}</small><h3 id="cc-inspector-title">{object.name}</h3></span></header><p id="cc-inspector-summary">{object.summary}</p><div className="cc-inspector-state"><StateBadge state={object.state}/><span>{object.registration}</span></div><dl className="cc-inspector-facts"><div><dt>Adapter capability</dt><dd>{object.capability}</dd></div><div><dt>Applied policy</dt><dd>{object.policy}</dd></div><div><dt>Read-back</dt><dd>{object.readBack}</dd></div><div><dt>Retrieval test</dt><dd>{object.retrieval}</dd></div></dl><div className="cc-detail-tabs" role="tablist" aria-label="Object detail categories">{(["risk", "action", "proof"] as DetailId[]).map((item) => <button id={`cc-detail-tab-${item}`} key={item} type="button" role="tab" aria-selected={detail === item} aria-controls="cc-detail-panel" onClick={() => setDetail(item)}>{item === "risk" ? "Risk" : item === "action" ? "Action" : "Proof"}</button>)}</div><div id="cc-detail-panel" role="tabpanel" aria-labelledby={`cc-detail-tab-${detail}`}><span>{detail === "risk" ? "What can fail" : detail === "action" ? "What Concord can do" : "What closes the loop"}</span><p>{object[detail]}</p></div><footer><span>Evidence reference</span><strong>CR-0841/{selectedObject}</strong></footer></aside></div>}
  </section>;
}

function EvidenceTimeline() {
  const [filter, setFilter] = useState<"All" | "Authority" | "Control" | "Proof">("All");
  const filtered = useMemo(() => filter === "All" ? evidenceEvents : evidenceEvents.filter((event) => event.category === filter), [filter]);
  const [selectedId, setSelectedId] = useState(evidenceEvents.at(-1)?.id ?? evidenceEvents[0].id);
  const selected = filtered.find((event) => event.id === selectedId) ?? filtered[0] ?? evidenceEvents[0];
  const chooseFilter = (nextFilter: "All" | "Authority" | "Control" | "Proof") => {
    setFilter(nextFilter);
    const nextEvents = nextFilter === "All" ? evidenceEvents : evidenceEvents.filter((event) => event.category === nextFilter);
    if (!nextEvents.some((event) => event.id === selectedId)) setSelectedId(nextEvents[0]?.id ?? evidenceEvents[0].id);
  };
  return <div className="cc-evidence-timeline"><div className="cc-evidence-filters" aria-label="Filter evidence events">{(["All", "Authority", "Control", "Proof"] as const).map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => chooseFilter(item)}>{item}</button>)}</div><div className="cc-evidence-body"><div className="cc-evidence-list" role="list" aria-label="Timestamped evidence events">{filtered.map((event) => <button key={event.id} type="button" className={selected.id === event.id ? "is-selected" : ""} aria-pressed={selected.id === event.id} onClick={() => setSelectedId(event.id)}><time>{event.time}</time><span><small>{event.category} · {event.id}</small><strong>{event.title}</strong></span><StateBadge state={event.state}/></button>)}</div><aside className="cc-evidence-detail" aria-live="polite"><span>Selected evidence</span><h3>{selected.title}</h3><StateBadge state={selected.state}/><dl><div><dt>Observation</dt><dd>{selected.evidence}</dd></div><div><dt>Assurance boundary</dt><dd>{selected.boundary}</dd></div></dl></aside></div></div>;
}

function ProofViewPanel({ view }: { view: ProofView }) {
  const currentIntegrations = integrations.slice(0, 6);
  if (view === "coverage") return <div className="cc-proof-view cc-proof-coverage"><div><span>Registered artifacts</span><strong>144</strong><p>Demonstration scope only</p></div><div><span>Supported repair</span><strong>144</strong><p>Pinecone and Redis contracts</p></div><div><span>Outside coverage</span><strong>1</strong><p>Agent memory remains unsupported</p></div><a href="/coverage">Inspect the complete coverage model <Icon name="arrow"/></a></div>;
  if (view === "evidence") return <EvidenceTimeline/>;
  if (view === "integrations") return <div className="cc-proof-view cc-proof-integrations">{currentIntegrations.map((integration, index) => <a href="/coverage" key={integration.name}><span>{String(index + 1).padStart(2, "0")}</span><SystemGlyph id={index % 2 ? "vector" : "authority"}/><div><strong>{integration.name}</strong><small>{integration.role}</small></div><em>{integration.state}</em></a>)}</div>;
  if (view === "value") return <div className="cc-proof-view cc-proof-value"><article><span>Security</span><h3>See invalid-state exposure without inventing a safety score.</h3></article><article><span>AI platform</span><h3>Repair only the registered artifacts selected by policy.</h3></article><article><span>Audit</span><h3>Keep the event, action, read-back, retrieval result, and exception together.</h3></article><a href="/value">Open Value &amp; FinOps <Icon name="arrow"/></a></div>;
  return <div className="cc-proof-view cc-proof-outcome"><header><div><span>CR-0841</span><strong>Bounded assurance record</strong><small>Guided proof · demonstration data</small></div><StateBadge state="Verified"/></header><div className="cc-evidence-summary"><div><span>Authority event</span><strong>Access revoked</strong></div><div><span>Registered impact</span><strong>144 artifacts</strong></div><div><span>Observed retrieval</span><strong>0 protected results</strong></div><div><span>Invalid-state exposure</span><strong>{cases[0].exposure}</strong></div></div><EvidenceTimeline/><footer><Icon name="shield"/><p>Bounded consistency for registered artifacts and supported adapters. Accepted risk is never presented as verified safety.</p></footer></div>;
}

function EvidenceChapter() {
  const [view, setView] = useState<ProofView>("outcome");
  return <section className="cc-proof" id="proof" aria-labelledby="proof-title"><header className="cc-proof-heading"><SectionIndex number="03" label="Proof at the boundary"/><p className="cc-kicker">An API success response is not proof</p><h2 id="proof-title">Test what the affected user can retrieve.</h2><p>Concord closes a case only after destination read-back and a real retrieval test. Everything else remains visibly in progress or outside coverage.</p></header><div className="cc-proof-shell"><div className="cc-proof-tabs" role="tablist" aria-label="Enterprise proof views">{proofViews.map((item) => <button key={item.id} type="button" role="tab" aria-selected={view === item.id} aria-controls="cc-proof-view" onClick={() => setView(item.id)}>{item.label}</button>)}</div><AnimatePresence mode="wait"><motion.div id="cc-proof-view" key={view} role="tabpanel" initial={{ opacity: 0, y: 35, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -22, scale: .99 }} transition={{ duration: .42, ease: [.16, 1, .3, 1] }}><ProofViewPanel view={view}/></motion.div></AnimatePresence></div></section>;
}

function BoundaryChapter() {
  return <section className="cc-boundary" id="boundary" aria-labelledby="boundary-title"><SectionIndex number="04" label="The honest boundary"/><div className="cc-boundary-copy"><p className="cc-kicker">Coverage is a contract, not a mood</p><h2 id="boundary-title">Know exactly what Concord can prove.</h2><p>Each adapter states what it can observe, repair, read back, and verify. Unsupported or unresolved scope stays visible—never folded into a reassuring total.</p></div><div className="cc-boundary-orbit" aria-hidden="true"><i/><i/><i/><span>Registered scope</span></div><article className="cc-readiness"><header><span>Current launch boundary</span><StateBadge state="Unresolved"/></header><strong>{readinessReport.verdict}</strong><p>Ready for controlled design-partner staging. Live credentials, customer-hosted validation, recovery testing, and operational evidence remain production gates.</p><details><summary>Review operating boundaries <span aria-hidden="true">+</span></summary><ol>{readinessReport.gates.map((gate) => <li key={gate}>{gate}</li>)}</ol></details><div><a href="/consistency-engine">Open the assurance control surface <Icon name="arrow"/></a><a href="/coverage">Inspect adapter coverage <Icon name="arrow"/></a></div></article><div className="cc-state-legend" aria-label="Concord product states">{(["Verified", "Repairing", "Unresolved", "Unsupported", "Accepted risk"] as ProofState[]).map((state) => <StateBadge key={state} state={state}/>)}</div></section>;
}

function FinalChapter() {
  return <section className="cc-final" id="contact" aria-labelledby="final-title"><SectionIndex number="05" label="Start bounded"/><motion.div className="cc-final-copy" initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ amount: .4 }} transition={{ duration: .85, ease: [.16, 1, .3, 1] }}><p className="cc-kicker">One source. One event. One measurable outcome.</p><h2 id="final-title">Prove one downstream loop. Then expand.</h2><p>Connect one application, register one validity-changing event, and measure the retrieval outcome before expanding coverage.</p><div><a href="#how-it-works">Explore the guided proof <Icon name="arrow"/></a><button type="button" data-contact-trigger>Request a conversation <Icon name="arrow"/></button></div></motion.div><div className="cc-final-horizon" aria-hidden="true"><i/><i/><i/><i/></div><address><span>Ralph Team</span><a href="tel:+972556669857">+972 55-666-9857</a><a href="mailto:nitai@ralphteam.ai">nitai@ralphteam.ai</a></address></section>;
}

function SiteFooter() {
  return <footer className="cc-footer"><ConcordMark/><nav aria-label="Product routes"><a href="/coverage">Coverage</a><a href="/consistency-engine">Engine</a><a href="/pricing">Pricing</a><a href="/value">Value &amp; FinOps</a><a href="/intelligence">Market radar</a><a href="/deployment-agent">Architecture agent</a></nav><p>Product simulation · No external systems are modified</p><a href="#top">Back to top ↑</a></footer>;
}

export default function ConcordApp() {
  const clientReady = useClientReady();
  return <main className="cc-site">
    <div className="cc-world" aria-hidden="true"><div className="cc-world-fallback"/>{clientReady && <Suspense fallback={null}><ValidityBiome/></Suspense>}<div className="cc-world-vignette"/></div>
    <LineageFallback/>
    <div className="cc-cursor" aria-hidden="true"><i/></div>
    <HeroChapter/>
    <span id="problem" className="cc-anchor" aria-hidden="true"/>
    <RiskChapter/>
    <WorkflowChapter/>
    <EvidenceChapter/>
    <BoundaryChapter/>
    <FinalChapter/>
    <SiteFooter/>
  </main>;
}
