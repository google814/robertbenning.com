# robertbenning.com

Single-page, purely visual landing page: a rocket lifts off from Earth, transfers through space and enters lunar orbit.
Scroll/swipe drives the flight (no scrollbar, virtual progress), the mouse shifts the camera perspective.

- `index.html` — the whole site (Three.js, single file, no build step)
- `vendor/` — three.js r170 + the postprocessing addons used (vendored, no CDN dependency)
- `textures/` — Earth/Moon maps from the three.js examples (NASA-derived)

Deploy: static hosting. Any web server that serves the folder works.
