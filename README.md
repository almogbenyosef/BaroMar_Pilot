# BaroMar Cyprus Pilot — interactive 3D site

A static website (no server code) that shows the Proteas pilot in 3D: the shore station, the landfall,
the ~6 km subsea pipeline, the underwater storage tanks and the surveyed seabed, with a site map,
an explanation panel for each part, and an animated charge / store / generate simulation.

**Confidential.** The figures come from the BaroMar Intro Snapshot (Nov 2026) and are meant for investors under NDA.
Check with management before publishing the site publicly.

## Publish on GitHub Pages
1. Create a new repository (for example `baromar-pilot-3d`). A **private** repository needs a paid GitHub plan for Pages;
   otherwise the site is public to anyone who has the link.
2. Upload the whole contents of this folder (keep the folder structure).
3. Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/ (root)` → Save.
4. After a minute the site is at `https://<your-user>.github.io/<repo>/`.

To test on your own computer: run `python -m http.server 8000` in this folder and open `http://localhost:8000`.
Opening `index.html` directly by double-click will not work (browsers block loading the data files).

## Useful links
- `?part=tanks` (or `station`, `landfall`, `pipeline`, `seabed`) opens the site on that part.
- `?tanks=3` starts with three tank structures instead of one.

## Editing
- **Text and numbers:** `js/content.js` (all panel text, key figures, process steps, credits).
- **Shore station model:** the station shown is a simplified stand-in. When an up-to-date export is available
  (GLB, metres, Y up, origin at the pad centre), put it in `assets/models/` and set `stationModel` in `js/content.js`.
- **Tank structure:** `js/tank.js` (dimensions from Leonardo Stadler drawings BAROMAR-C-01…C-05, Rev.05).
- **Shore station layout:** `js/station.js`.

## Data sources
- Seabed: Proteas MBES survey (`Proteas_MBES.kmz`), depths read from the survey colour scale and
  extended to the coast with a smooth model. Depth is exaggerated ×3 in the 3D view.
- Pipeline route, tank positions and permit corridor: `Altum Mare Pipeline Route.kmz`, `Tanks Points.kmz`,
  `Compatibility Permit Corridor.kmz`. Station position: Permit-to-Operate coordinates.
- Coastline: © OpenStreetMap contributors. Satellite imagery (loaded live): © Esri, Maxar, Earthstar Geographics.
- Libraries: three.js r160, Leaflet 1.9.4 (included in `vendor/`).
