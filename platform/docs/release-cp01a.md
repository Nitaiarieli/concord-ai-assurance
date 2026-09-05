# CP-01A release — 2026-09-05

User approved implementation and publication on the existing Site, preserving its stone-and-plant motif throughout. Current audience is public and remains public. CP-01B live customer integrations are outside this release.

Changes: four primary screens (Overview, Change review, Coverage, Evidence); focused access-revocation copy; explicit sample-data/runtime boundary; baseline checks for Alex/Jordan plus Alex's unrelated control; frozen supplemental observations per proof; aggregate JSON verification_result; open-change guard preventing interference with another scenario; scoped connector inventory; updated product brief. Existing Python core and local fixture architecture retained. Old #lineage and #connections fragments map to review/coverage. Browser session survives tab navigation.

Validation: production build passed; changed Concord frontend TypeScript passed with a focused configuration. Full-project tsc still has pre-existing Cloudflare ambient type errors in db/index.ts and worker/index.ts. Python unittest suite: 21 passed. Browser desktop QA: permission scenario passes denied Alex, allowed Jordan and unrelated allowed Alex; unavailable probe stays Unknown; coverage truth labels; navigation/session persistence; reset dialog. Actual downloaded JSON was parsed and checked against visible result. Browser download-event capture timed out, but the file was successfully downloaded and inspected. Responsive media rules and mobile navigation retained and inspected in source; a narrow physical browser viewport was unavailable, so mobile visual QA is not claimed.

UI/UX review: product clarity 2; narrative 2; original direction 2; hierarchy 2; purposeful motion 1 (restrained, no blocking transition); interaction 2; copy 2; responsive visual verification unverified; accessibility 2 (semantic labels, keyboard focus, reduced motion); performance 2 (existing optimized WebP, local runtime); implementation 2. 19 verified points; mobile visual review remains follow-up.

Rollback: redeploy saved version 1: appgprj_6a9c0fb1ff5081919f863cb560680fc8~appgver_09573f592d088191af137f7ccebc9626. Preserve current audience. No database migration, external source mutation, or customer data change occurred. Resetting/reloading the sample workspace clears local evidence, so export before reset.

## Brand and positioning follow-up

The user clarified that rock and plant imagery should form a visual family, with different scenes rather than one repeated picture. Added three generated and visually reviewed stone/fern studies (review, coverage and evidence); kept the original hero sculpture. Reused optimized WebP encodings, 103–167 KB each.

The user corrected the overarching product message to agent-data freshness. Hero: “Keep your AI agents’ data up to date.” Supporting copy: “When source information changes, Concord updates connected agent data and verifies the result.” The sample-data boundary stays visible. Permission-change verification is the proposed first commercial test within the broader vision, alongside existing local content/deletion scenarios. No live-integration capability or coverage was added.

Rollback for this follow-up: redeploy saved version 2, appgprj_6a9c0fb1ff5081919f863cb560680fc8~appgver_3dce4e53ccbc8191b3d4f72d5e6d16d0. No migration or customer-data change.
