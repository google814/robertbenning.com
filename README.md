# robertbenning.com

Single-page, purely visual landing page: a mirror-polished stainless rocket lifts off from Earth,
transfers through space and enters lunar orbit.

- Scroll/swipe drives the flight (no scrollbar, virtual progress), the mouse shifts the perspective.
- **Click/tap** switches between the outside view and the cockpit — helmet visor, windscreen and a
  live glass panel. Clicking again returns outside at exactly the same point in the flight.
- The hull is a real-time reflector: a cube camera rides with the vehicle, so it mirrors Earth,
  the Moon, the sun and the plume.

Files:
- `index.html` — the whole site (Three.js, single file, no build step)
- `vendor/` — three.js r170 + the postprocessing addons used (vendored, no CDN dependency)
- `textures/` — Earth/Moon maps from the three.js examples (NASA-derived)

QA hooks (dev only): `window.__rb.setProgress(p, snap)`, `window.__rb.setCockpit(on, snap)`.
Headless rendering needs Chrome with `--use-angle=swiftshader --enable-unsafe-swiftshader`.

Deploy: static hosting. Any web server that serves the folder works.
