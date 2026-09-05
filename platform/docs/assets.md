# Artwork and runtime assets

Concord uses a family of stones and plants, with different scenes for different screens. These are original generated decorative images, not customer data, architectural diagrams or photographs of real integrations.

| Scene | Original | Web asset | Usage |
|---|---|---|---|
| Living network | `public/assets/living-network.png` | `public/assets/living-network.webp` | Overview hero |
| Limestone and ferns | `design/source-images/concord-review-stone-ferns.png` | `public/assets/concord-review-stone-ferns.webp` | Change review |
| Stone arch | `design/source-images/concord-coverage-stone-arch.png` | `public/assets/concord-coverage-stone-arch.webp` | Coverage and product brief |
| Balanced stones | `design/source-images/concord-evidence-balanced-stones.png` | `public/assets/concord-evidence-balanced-stones.webp` | Evidence and sidebar |

`design/asset-manifest.json` records source paths, web variants, placements and SHA-256 checksums for the three new original PNGs. The original hero PNG is retained in its existing location. No visual-reference website’s artwork was copied. PNG originals are raster source images, not editable 3D scenes or layered design files.

The SVG favicon and retained scaffold icons are in `public/`. Shared UI styles and icons retain their dependency notices.

Pyodide is generated from the exact `pyodide` package in `package-lock.json`, using `npm run prepare:python`. Do not manually copy a newer runtime into `public/py-runtime`; change and review the dependency lockfile first. Preserve `public/py-runtime/THIRD_PARTY_NOTICES.md` and [the notices](THIRD_PARTY_NOTICES.md).
