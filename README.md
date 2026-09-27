# Excavation takeoff · Cut and fill

Web app for **earthwork quantity takeoff (cut and fill)** from PDF plans, plus simple **concrete** and **asphalt**
quantity modules. The user loads a plan, calibrates the scale, draws zones (polygons) on an interactive canvas,
gives each zone a **cut depth** and/or a **fill depth** (one zone can have both), soil type / fill material, and gets
areas, bank / loose / compacted volumes, material needed, net balance and truck trips.

> Current status: **project skeleton (phase 0) + units, i18n, soils/fill materials, concrete and asphalt modules**.
> PDF loading/zoom/pan, scale calibration (two points) and zone drawing (polygon or drag-rectangle) work. Excel/PDF
> export is not implemented yet (see "Next steps").

## Usage

- **Calibrate the scale**: press **📏 Calibrate scale** (the button turns orange, the plan gets a cyan frame and a
  banner says what to do). Click the first point of a known distance (e.g. the scale bar), then the second point (or
  press-drag from one to the other). A box appears on the plan: type the real distance (meters, or feet + inches with
  fractions) and press **Apply** (or Enter). The scale is stored as meters per PDF unit. If no plan is shown, the
  banner asks you to load a PDF first. Loading a different PDF resets the scale (the default 1:500 only applies to the
  sample plan).
- **Multi-page PDFs**: use **◀ / ▶**, the “Page 1 of 3” selector next to the PDF name, or **PageUp / PageDown**
  (when the cursor is not in a text field). Each sheet has its **own scale** (calibrate every sheet you draw on) and its
  own zones: the plan only shows the zones of the visible sheet, the zone list groups them by sheet (“Sheet 2”) and the
  totals add up all sheets. Switching sheets cancels an unfinished drawing/calibration and fits the new sheet to the
  view. `node scripts/make-multipage-pdf.mjs out.pdf` creates a 3-sheet test PDF (1:500, 1:200, 1:1000).
- **Draw a zone**: press **✏️ Draw zone**, then either **drag** to draw a rectangle, or **click** to add polygon
  vertices and close it by clicking the first point, double-clicking or pressing **Enter**. **Backspace** removes the
  last point, **Esc** cancels (Esc again returns to Pan). The new zone is selected in the list to set its name,
  cut depth, fill depth and soil. Area = shoelace (PDF units²) × scale²; without a calibrated scale the zone is still drawn
  and its area appears as soon as you calibrate. Mouse, touch and pen all work; wheel = zoom, middle button = pan.

- **Language**: `EN | ES` toggle in the top bar (default English). Saved in `localStorage`
  (`excavation-app:language-v2`; the old `excavation-app:language` key is ignored and removed so everyone starts
  in English once). Updates the page `<title>` and `<html lang>`.
- **Version tag**: small `v0.3.0 · <commit> · <date>` text at the right of the top bar shows which build is running.
- **Units**: `Meters | Feet` toggle in the top bar (default Meters). Saved in `localStorage`
  (`excavation-app:sistemaUnidades`). Everything is stored internally in meters / m² / m³.
  - Meters: lengths in m, areas in m², volumes in m³.
  - Feet: no metric units are shown. Lengths as feet-inches rounded to the nearest 1/8" with reduced fractions
    (e.g. `65' 7 3/8"`, `3' 6 1/2"`, `0' 8"`), areas in ft², volumes in yd³ (cubic yards), asphalt density in
    lb/ft³ and tonnage in US short tons.
  - Distance inputs: one numeric field in Meters mode; in Feet mode a **ft** field (whole numbers) and an **in**
    text field that takes fractions like tradespeople write them: `7`, `3/4`, `5/8`, `1/16`, `7 1/2`, `7-1/2`,
    `11 15/16` (denominators 2, 4, 8, 16; a plain decimal such as `7.5` is also accepted). 12 or more inches are
    carried into feet when the field loses focus. Stored values load back as fractions to 1/16 (e.g. `7 3/8`).
- **Modules** (tabs in the top bar):
  - **Earthwork**: PDF plan + zone list. Each zone has two depths, **Cut depth** and **Fill depth** (either may be
    0; both work in Meters and in Feet with ft-in fractions), so a zone that is partly cut and partly filled does not
    have to be drawn twice. The cut part has a *Soil type* (drives the cut *Swell %*, editable); the fill part has a
    *Fill material* (drives *Compaction shrink %*, editable) and a haul swell. Per zone: Cut volume (bank), Fill
    volume (compacted), signed Net (cut +, fill −), cut loose, material needed and fill loose. Totals add cut and
    fill separately over all zones and sheets; truck trips use loose volumes. On the plan, cut-only zones are red,
    fill-only blue, cut + fill purple.
  - **Concrete**: sidewalks, columns (rectangular or round), slabs/floors, footings, beams, walls. Quantity,
    dimensions, waste % (default 5 %) and notes. Shows net volume and **Order volume (incl. waste)**.
  - **Asphalt**: road, parking lot, sidewalk topping, driveway, patch/other. Area, net volume, order volume and
    tonnage using an editable compacted density (default 2.35 t/m³ ≈ 146.7 lb/ft³, hot-mix asphalt).
- Mouse wheel = zoom at the pointer; drag = pan the plan. **Load PDF** opens your own plan
  (`/sample-plan.pdf` is loaded by default).

## Stack

| Area | Tool |
| --- | --- |
| UI | React 19 + TypeScript + Vite |
| Styles | Tailwind CSS v4 (`@tailwindcss/vite`) |
| State | Zustand |
| PDF rendering | pdfjs-dist (pdf.js) |
| Interactive canvas | Konva + react-konva |
| Geometry | @turf/turf |
| Excel export | xlsx (SheetJS, from the official CDN `cdn.sheetjs.com`) |
| PDF generation | pdf-lib |

## Troubleshooting

- **"Error loading the PDF…" / the plan stays empty**: close every black window of the app, run `iniciar.bat` again and
  reload with Ctrl+F5. `iniciar.bat` warns if port 5173 is already taken by an old copy of the app (you would otherwise
  be looking at an old version). If it still fails, update Chrome/Edge.
- The pdf.js worker is served from a fixed URL (`/pdf.worker.min.mjs`, plugin `pdfWorker` in `vite.config.ts`, emitted
  into `dist/` by the build) and the app uses pdf.js's *legacy* build, which includes polyfills: the modern build calls
  very recent JavaScript APIs (`Uint8Array.prototype.toHex`, `Map.prototype.getOrInsertComputed`, `Math.sumPrecise`…)
  and fails on Chrome/Edge versions that are not fully up to date.

## Folder structure

```
src/
├── components/
│   ├── Canvas.tsx            # Konva stage: PDF layer + drawing layer; wheel zoom, pan, tool hints
│   ├── DrawingLayer.tsx      # zones (filled polygons + name/area), polygon/rectangle draft, calibration line
│   ├── useCanvasTools.ts     # pointer/keyboard logic of the Calibrate and Draw zone tools
│   ├── Toolbar.tsx           # module tabs, Load PDF, Calibrate, Draw zone, zoom, Meters|Feet, EN|ES
│   ├── ZoneList.tsx          # zones (soil / fill material, swell, shrink, volumes) and totals
│   ├── ScaleCalibration.tsx  # calibration panel: current scale, steps, real distance + Apply
│   ├── DistanceInput.tsx     # distance input: meters field or ft + in fields
│   └── modules/              # ConcretePanel, AsphaltPanel and shared ElementFields
├── i18n/                     # en.ts (keys), es.ts (same keys, type-checked), index.ts (t), useT.ts (hook)
├── lib/
│   ├── units.ts              # unit conversion and formatting (ft-in, ft², yd³, short tons…)
│   ├── soils.ts              # soil types (swell) and fill materials (shrink) with documented ranges
│   ├── geometry.ts           # shoelace area, scale, drag → rectangle, screen ↔ plan, centroid
│   ├── zones.ts              # zone name, old-model migration (migrarZona), cut/fill kind, per-zone factors
│   ├── pages.ts              # page clamping, per-page scale and zones
│   ├── canvasHint.ts         # which instruction banner / PDF error hint to show
│   ├── volumes.ts            # per-zone cut and fill volumes (bank / compacted / needed / loose) and totals
│   ├── factors.ts            # swell, shrink, truck trips
│   ├── concrete.ts           # concrete volumes
│   └── asphalt.ts            # asphalt area, volume and tonnage
├── store/projectStore.ts     # global state (Zustand)
└── types/index.ts
```

## Key concepts

- **PDF units**: the canvas works in PDF units (1 u = 1/72 inch on paper), independent of zoom.
- **Scale** (`metersPerPdfUnit`): real meters per PDF unit. A 1:500 plan printed at full size equals
  `500 × 0.0254 / 72 ≈ 0.1764 m/u`.
- **Zone volumes**: cut bank = area (m²) × cut depth (m); fill compacted = area × fill depth; net = cut − fill.
  Zones saved with the old single `profundidad` + `tipo` model are migrated by `migrarZona()` (`src/lib/zones.ts`):
  cut d → cutDepth d / fillDepth 0; fill d → cutDepth 0 / fillDepth d.
- **Factors**: loose = bank × (1 + swell); material needed = compacted / (1 − shrink);
  trips = ⌈loose / truck capacity⌉. Swell/shrink come from the zone's manual value, else its soil type / fill
  material (midpoint of a documented typical range, see `src/lib/soils.ts`), else the project default
  (25 % swell, 10 % shrink).

On Windows, double-click `iniciar.bat`: it installs dependencies if needed and runs `npm run dev -- --open`, so the
browser opens on the port Vite actually got (5173, or 5174 if an older server is still running — close old windows
first).

## Requirements

- Node.js **20.19+** (or 22.12+) and npm.

## Commands

```bash
npm install          # install dependencies
npm run dev          # dev server (http://localhost:5173)
npm run build        # type check + production build into dist/
npm run lint         # oxlint
npm test             # quick checks of the pure modules (units, geometry, soils, volumes, concrete, asphalt, i18n)
npm run preview      # serve the production build
npm run sample-pdf   # regenerate public/sample-plan.pdf (English labels, metric 1:500 plan)
```

## Next steps

1. Vertex editing of existing zones (drag vertices, insert/delete points); snapping.
2. Editable project factors; multiple pages; holes.
3. Export: Excel (SheetJS) and annotated PDF (pdf-lib) — zones, concrete and asphalt sheets, translated via `t()`.
4. Project persistence (JSON / IndexedDB) and undo/redo.
