# Concord radical overhaul — UI/UX quality review

## Direction

**The Validity Biome** turns Concord's assurance model into a continuous forest-to-desert landscape. The forest represents authoritative source systems; the desert represents AI-derived state that can outlive a changed truth. Registered roots carry validity events between them, while a moving assurance boundary follows Detect, Trace, Repair, Verify, and Prove. The metaphor is product architecture, not background decoration.

The experience follows six clear beats: promise, validity gap, control loop, behavioral proof, honest operating boundary, and bounded action. Copy consistently distinguishes demonstration data, registered scope, unsupported state, unresolved state, and verified evidence.

## Scorecard

| Dimension | Score | Tested evidence |
| --- | ---: | --- |
| Product clarity | 2/2 | The hero states the trigger, Concord's role, the affected registered scope, and the concrete Detect-to-Prove outcome beside an interactive assurance trace. |
| Narrative structure | 2/2 | The page moves from source/derivative mismatch to mechanism, consumption-boundary proof, launch constraints, and a one-loop adoption action. |
| Original art direction | 2/2 | The procedural validity biome, registered roots, moving assurance boundary, regrowth, fauna, grid, and instrument panels form one Concord-specific visual language. No reference assets or signature compositions are reused. |
| Visual hierarchy | 2/2 | Large editorial headlines are paired with nearby explanation, controlled line measures, high contrast, section indices, and one dominant interaction per chapter. Desktop, tablet, and mobile captures were inspected. |
| Purposeful motion | 2/2 | Scroll and pointer motion change the landscape, root signals, camera, fauna, and active assurance stage. Motion communicates lineage and verification progress; it never gates copy or navigation. |
| Interaction usability | 2/2 | Automated browser QA passed roving stage tabs, playback, object inspection, focus trap/return, evidence filters, contact dialog, mobile disclosure, and touch-target checks. |
| Copy quality | 2/2 | Copy uses precise verbs—detect, trace, repair, read back, test, preserve—and explicitly rejects API success as proof. Product and staging limits remain visible. |
| Responsive design | 2/2 | No horizontal overflow at 1440, 1024, 768, 390, or 360 CSS pixels. The desktop sticky sequence becomes an intentional non-sticky mobile stack with horizontal controls where appropriate. |
| Accessibility | 2/2 | One H1, semantic section headings, labeled tablists/dialogs, text-plus-symbol states, keyboard operation, focus management, visible focus, decorative `aria-hidden` art, WebGL fallback, and reduced-motion behavior were verified. |
| Performance resilience | 1/2 | The 3D scene is justified, dynamically imported after hydration, isolated from route rendering, and backed by a CSS fallback. Its minified client chunk is about 890 KB before transfer compression, so a later geometry/engine budget pass remains worthwhile. |
| Implementation integrity | 2/2 | ESLint, the production build, 56 route/API/domain tests, and the complete browser verifier pass. Existing routes, API contracts, auth boundaries, data structures, and deployment configuration are unchanged. |

**Total: 21/22.** No dimension scores zero; the redesign exceeds the 19/22 acceptance threshold.

## Validation evidence

- Production Vinext build completed with all public, authenticated, commercial, deployment-agent, and 15 API routes present.
- ESLint completed without findings.
- Automated suite passed: 56/56.
- Browser verifier passed with no runtime exceptions or `console.error` calls.
- Keyboard ArrowRight moved Detect to Trace; the object inspector trapped focus, closed with Escape, and restored its trigger.
- Contact dialog focus, Escape close, and mobile navigation passed.
- Evidence filtering returned the two proof events with explicit pressed state.
- Scroll QA measured progressive roots and non-static fauna transforms.
- Reduced-motion emulation used native scroll, effectively zeroed UI transitions, completed the root path, froze fauna, and made the WebGL scene static.
- Final captures: `radical-hero-desktop-final.png`, `radical-workflow-tablet-final.png`, `radical-hero-mobile.png`, and focused risk/proof/boundary/final views.

## Remaining hardening

A hands-on VoiceOver/NVDA pass, Lighthouse/WebPageTest profile, low-end Android GPU profile, and a further Three.js chunk/geometry budget pass are valuable before a high-traffic campaign. They are not represented as completed.
