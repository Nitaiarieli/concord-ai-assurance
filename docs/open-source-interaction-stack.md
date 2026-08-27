# Open-source interaction stack

The radical landing experience uses only permissively licensed runtime libraries:

| Package | Installed version | Role | License |
| --- | ---: | --- | --- |
| `three` | 0.185.1 | WebGL terrain, geometry, materials, lighting, particles, and root signals | MIT |
| `@react-three/fiber` | 9.7.0 | React renderer and lifecycle for the Three.js scene | MIT |
| `motion` | 13.1.1 | Component reveals, stage transitions, hover physics, and viewport choreography | MIT |
| `lenis` | 1.3.26 | Smooth wheel scrolling with native direction and accessibility fallback | MIT |

No premium GSAP plugins, commercial animation runtimes, copied 3D assets, remote stock media, or proprietary reference-site assets are shipped. Terrain, trees, derivative nodes, roots, particles, brand marks, system glyphs, and fauna are generated from code-native geometry or SVG.

## Resilience model

- The WebGL biome is dynamically imported and never blocks the server-rendered product story.
- Browsers without WebGL receive the complete CSS landscape and lineage fallback.
- `prefers-reduced-motion` disables smooth scrolling, freezes the 3D render loop, removes transforms, and reveals the full lineage state.
- All product controls remain ordinary semantic HTML and do not depend on WebGL hit testing.
- The scene's current minified client chunk is about 890 KB before transfer compression; this is documented as the main remaining performance optimization target.
